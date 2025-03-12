import Service from 'resource:///com/github/Aylur/ags/service.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import { fileExists } from '../modules/.miscutils/files.js';
import Gst from 'gi://Gst'; // GStreamer for audio capture/playback

// Initialize GStreamer
Gst.init(null);

const HISTORY_DIR = `${GLib.get_user_state_dir()}/ags/user/ai/chats/`;
const HISTORY_FILENAME = `gemini.txt`;
const HISTORY_PATH = HISTORY_DIR + HISTORY_FILENAME;
let initMessages = []
if (!fileExists(`${GLib.get_user_config_dir()}/gemini_history.json`)) {
    Utils.execAsync([`bash`, `-c`, `touch ${GLib.get_user_config_dir()}/gemini_history.json`]).catch(print);
    Utils.writeFile('[ ]', `${GLib.get_user_config_dir()}/gemini_history.json`).catch(print);
}

Utils.exec(`mkdir -p ${GLib.get_user_state_dir()}/ags/user/ai`);
const KEY_FILE_LOCATION = `${GLib.get_user_state_dir()}/ags/user/ai/google_key.txt`;
const APIDOM_FILE_LOCATION = `${GLib.get_user_state_dir()}/ags/user/ai/google_api_dom.txt`;

function replaceapidom(URL) {
    if (fileExists(APIDOM_FILE_LOCATION)) {
        var contents = Utils.readFile(APIDOM_FILE_LOCATION).trim();
        var URL = URL.toString().replace("generativelanguage.googleapis.com", contents);
    }
    return URL;
}

const CHAT_MODELS = ["gemini-2.0-flash"];
const ONE_CYCLE_COUNT = 3;

class GeminiMessage extends Service {
    static {
        Service.register(this,
            {
                'delta': ['string'],
            },
            {
                'content': ['string'],
                'thinking': ['boolean'],
                'done': ['boolean'],
            });
    }

    _role = '';
    _parts = [{ text: '' }];
    _thinking;
    _done = false;
    _rawData = '';

    constructor(role, content, thinking = true, done = false) {
        super();
        this._role = role;
        this._parts = [{ text: content }];
        this._thinking = thinking;
        this._done = done;
    }

    get rawData() { return this._rawData; }
    set rawData(value) { this._rawData = value; }

    get done() { return this._done; }
    set done(isDone) { this._done = isDone; this.notify('done'); }

    get role() { return this._role; }
    set role(role) { this._role = role; this.emit('changed'); }

    get content() {
        return this._parts.map(part => part.text).join();
    }
    set content(content) {
        this._parts = [{ text: content }];
        this.notify('content');
        this.emit('changed');
    }

    get parts() { return this._parts; }

    get label() { return this._parserState.parsed + this._parserState.stack.join(''); }

    get thinking() { return this._thinking; }
    set thinking(value) {
        this._thinking = value;
        this.notify('thinking');
        this.emit('changed');
    }

    addDelta(delta) {
        if (this.thinking) {
            this.thinking = false;
            this.content = delta;
        } else {
            this.content += delta;
        }
        this.emit('delta', delta);
    }

    parseSection() {
        if (this._thinking) {
            this.thinking = false;
            this._parts[0].text = '';
        }
        const parsedData = JSON.parse(this._rawData);
        if (!parsedData.candidates)
            this._parts[0].text += `Blocked: ${parsedData.promptFeedback.blockReason}`;
        else {
            // Check if the response contains an image URL
            if (parsedData.candidates[0].content.imageUrl) {
                this._parts[0].text += parsedData.candidates[0].content.imageUrl;
            } else {
                const delta = parsedData.candidates[0].content.parts[0].text;
                this._parts[0].text += delta;
            }
        }
        this.notify('content');
        this._rawData = '';
    }
}

class GeminiService extends Service {
    static {
        Service.register(this, {
            'initialized': [],
            'clear': [],
            'newMsg': ['int'],
            'hasKey': ['boolean'],
        });
    }

    _assistantPrompt = userOptions.asyncGet().ai.enhancements;
    _cycleModels = true;
    _usingHistory = userOptions.asyncGet().ai.useHistory;
    _key = '';
    _requestCount = 0;
    _safe = userOptions.asyncGet().ai.safety;
    _temperature = userOptions.asyncGet().ai.defaultTemperature;
    _messages = [];
    _modelIndex = 0;
    _decoder = new TextDecoder();

    constructor() {
        super();

        if (fileExists(KEY_FILE_LOCATION))
            this._key = Utils.readFile(KEY_FILE_LOCATION).trim();
        else
            this.emit('hasKey', false);

        if (this._usingHistory) this.loadHistory();
        else this._messages = this._assistantPrompt ? [...initMessages] : [];

        this.emit('initialized');
    }

    get modelName() { return CHAT_MODELS[this._modelIndex]; }

    get keyPath() { return KEY_FILE_LOCATION; }
    get key() { return this._key; }
    set key(keyValue) {
        this._key = keyValue;
        Utils.writeFile(this._key, KEY_FILE_LOCATION)
            .then(this.emit('hasKey', true))
            .catch(print);
    }

    get cycleModels() { return this._cycleModels; }
    set cycleModels(value) {
        this._cycleModels = value;
        if (!value)
            this._modelIndex = 0;
        else {
            this._modelIndex = (this._requestCount - (this._requestCount % ONE_CYCLE_COUNT)) % CHAT_MODELS.length;
        }
    }

    get useHistory() { return this._usingHistory; }
    set useHistory(value) {
        if (value && !this._usingHistory)
            this.loadHistory();
        this._usingHistory = value;
    }

    get safe() { return this._safe; }
    set safe(value) { this._safe = value; }

    get temperature() { return this._temperature; }
    set temperature(value) { this._temperature = value; }

    get messages() { return this._messages; }
    get lastMessage() { return this._messages[this._messages.length - 1]; }

    saveHistory() {
        Utils.exec(`bash -c 'mkdir -p ${HISTORY_DIR} && touch ${HISTORY_PATH}'`);
        Utils.writeFile(JSON.stringify(this._messages.map(msg => {
            let m = { role: msg.role, parts: msg.parts };
            return m;
        })), HISTORY_PATH);
    }

    loadHistory() {
        this._messages = [];
        this.appendHistory();
        this._usingHistory = true;
    }

    appendHistory() {
        if (fileExists(HISTORY_PATH)) {
            const readfile = Utils.readFile(HISTORY_PATH);
            JSON.parse(readfile).forEach(element => {
                this.addMessage(element.role, element.parts[0].text);
            });
        } else {
            this._messages = this._assistantPrompt ? [...initMessages] : [];
        }
    }

    clear() {
        this._messages = this._assistantPrompt ? [...initMessages] : [];
        if (this._usingHistory)
            this.saveHistory();
        this.emit('clear');
    }

    get assistantPrompt() { return this._assistantPrompt; }
    set assistantPrompt(value) {
        this._assistantPrompt = value;
        if (value)
            this._messages = [...initMessages];
        else
            this._messages = [];
    }

    readResponse(stream, aiResponse) {
        stream.read_line_async(
            0, null,
            (stream, res) => {
                try {
                    const [bytes] = stream.read_line_finish(res);
                    const line = this._decoder.decode(bytes);
                    if (line == '[{') { // beginning of response
                        aiResponse._rawData += '{';
                        this.thinking = false;
                    } else if (line == ',\u000d' || line == ']') { // end of stream pulse
                        aiResponse.parseSection();
                    } else { // Normal content
                        aiResponse._rawData += line;
                    }
                    this.readResponse(stream, aiResponse);
                } catch {
                    aiResponse.done = true;
                    if (this._usingHistory)
                        this.saveHistory();
                    return;
                }
            });
    }

    addMessage(role, message) {
        this._messages.push(new GeminiMessage(role, message, false));
        this.emit('newMsg', this._messages.length - 1);
    }

    send(msg) {
        this._messages.push(new GeminiMessage('user', msg, false));
        this.emit('newMsg', this._messages.length - 1);
        const aiResponse = new GeminiMessage('model', 'thinking...', true, false);

        const body = {
            "contents": this._messages.map(msg => {
                let m = { role: msg.role, parts: msg.parts };
                return m;
            }),
            "safetySettings": this._safe ? [] : [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            ],
            "generationConfig": {
                "temperature": this._temperature,
            },
        };

        const proxyResolver = new Gio.SimpleProxyResolver({
            'default-proxy': userOptions.asyncGet().ai.proxyUrl || null
        });
        const session = new Soup.Session({ 'proxy-resolver': proxyResolver });
        const message = new Soup.Message({
            method: 'POST',
            uri: GLib.Uri.parse(replaceapidom(`https://generativelanguage.googleapis.com/v1/models/${this.modelName}:streamGenerateContent?key=${this._key}`), GLib.UriFlags.NONE),
        });
        message.request_headers.append('Content-Type', `application/json`);
        message.set_request_body_from_bytes('application/json', new GLib.Bytes(JSON.stringify(body)));

        session.send_async(message, GLib.DEFAULT_PRIORITY, null, (_, result) => {
            try {
                const stream = session.send_finish(result);
                this.readResponse(new Gio.DataInputStream({
                    close_base_stream: true,
                    base_stream: stream
                }), aiResponse);
            } catch (e) {
                aiResponse.addDelta(e.message);
                aiResponse.thinking = false;
            }
        });
        this._messages.push(aiResponse);
        this.emit('newMsg', this._messages.length - 1);

        if (this._cycleModels) {
            this._requestCount++;
            if (this._cycleModels)
                this._modelIndex = (this._requestCount - (this._requestCount % ONE_CYCLE_COUNT)) % CHAT_MODELS.length;
        }
    }

    // ========================
    // New Voice Chat Methods
    // ========================

    // Record audio from the microphone for 5 seconds and save as WAV.
    async recordVoice() {
        const tmpFile = `${GLib.get_tmp_dir()}/voice_input.wav`;
        // Example GStreamer pipeline: capture audio, convert, encode to WAV and save.
        let pipeline = Gst.parse_launch(`autoaudiosrc ! audioconvert ! audioresample ! wavenc ! filesink location=${tmpFile}`);
        pipeline.set_state(Gst.State.PLAYING);

        // Record for 5 seconds (adjust as needed).
        await new Promise(resolve =>
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => { resolve(); return GLib.SOURCE_REMOVE; })
        );

        pipeline.set_state(Gst.State.NULL);
        return tmpFile;
    }

    // Play an audio file using GStreamer's playbin.
    playAudio(filePath) {
        let player = Gst.ElementFactory.make("playbin", "player");
        player.set_property("uri", `file://${filePath}`);
        player.set_state(Gst.State.PLAYING);
    }

    // Helper to combine array of Uint8Arrays.
    combineChunks(chunks) {
        let combined = [];
        for (let chunk of chunks) {
            combined = combined.concat(Array.from(chunk));
        }
        return new Uint8Array(combined);
    }

    // Read a binary audio response stream, write to a temp file, then play it.
    readVoiceResponse(stream, aiResponse) {
        let chunks = [];
        const readChunk = () => {
            stream.read_bytes_async(4096, GLib.PRIORITY_DEFAULT, null, (stream, result) => {
                try {
                    const bytes = stream.read_bytes_finish(result);
                    if (bytes.get_size() > 0) {
                        chunks.push(bytes.toArray());
                        readChunk();
                    } else {
                        // End of stream: combine chunks and write to a temporary file.
                        let combined = this.combineChunks(chunks);
                        let tmpAudioFile = `${GLib.get_tmp_dir()}/response_audio.mp3`;
                        Utils.writeFile(combined, tmpAudioFile);
                        this.playAudio(tmpAudioFile);
                        aiResponse.done = true;
                    }
                } catch (e) {
                    aiResponse.done = true;
                }
            });
        };
        readChunk();
    }

    // Send a voice message: record, encode audio, and send to Gemini.
    async sendVoice() {
        // Record the user's voice.
        let audioFilePath = await this.recordVoice();
        let audioDataRaw = Utils.readFile(audioFilePath);
        let audioBase64 = GLib.base64_encode(audioDataRaw);

        // Build the request body with audio data.
        const body = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "audioData": audioBase64,
                            "inputMediaType": "audio/wav"
                        }
                    ]
                }
            ],
            "safetySettings": this._safe ? [] : [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            ],
            "generationConfig": {
                "temperature": this._temperature,
                // Request an audio response.
                "responseMimeType": "audio/mpeg"
            },
        };

        const proxyResolver = new Gio.SimpleProxyResolver({
            'default-proxy': userOptions.asyncGet().ai.proxyUrl || null
        });
        const session = new Soup.Session({ 'proxy-resolver': proxyResolver });
        const message = new Soup.Message({
            method: 'POST',
            uri: GLib.Uri.parse(replaceapidom(`https://generativelanguage.googleapis.com/v1/models/${this.modelName}:streamGenerateContent?key=${this._key}`), GLib.UriFlags.NONE),
        });
        message.request_headers.append('Content-Type', 'application/json');
        message.set_request_body_from_bytes('application/json', new GLib.Bytes(JSON.stringify(body)));

        const aiResponse = new GeminiMessage('model', 'processing voice...', true, false);
        this._messages.push(aiResponse);
        this.emit('newMsg', this._messages.length - 1);

        session.send_async(message, GLib.DEFAULT_PRIORITY, null, (_, result) => {
            try {
                const stream = session.send_finish(result);
                this.readVoiceResponse(new Gio.DataInputStream({
                    close_base_stream: true,
                    base_stream: stream
                }), aiResponse);
            } catch (e) {
                aiResponse.addDelta(e.message);
                aiResponse.thinking = false;
            }
        });
    }
}

export default new GeminiService();
