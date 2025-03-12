import * as Utils from 'resource:///com/github/Aylur/ags/utils.js'
import Service from 'resource:///com/github/Aylur/ags/service.js'
import App from 'resource:///com/github/Aylur/ags/app.js'

class AudioVisualizerService extends Service {
    static {
        Service.register(this, {
            'output-changed': ['string'],
        });
    }

    #output = null;
    #proc = null;
    #config = {
        bars: 50,
        framerate: 60,
        sensitivity: 150,
        channels: 'stereo',
        monstercat: 1.0,
        noise_reduction: 0.77,
    };

    constructor() {
        super();
        this.#initCava();
    }

    #initCava() {
        if (this.#proc) return;

        const configPath = '/tmp/cava.config';
        const configContent = `
[general]
framerate = ${this.#config.framerate}
bars = ${this.#config.bars}
sensitivity = ${this.#config.sensitivity}

[input]
method = pipewire
source = auto

[output]
method = raw
raw_target = /dev/stdout
data_format = ascii
ascii_max_range = 8
channels = ${this.#config.channels}

[smoothing]
monstercat = ${this.#config.monstercat}
noise_reduction = ${this.#config.noise_reduction}
`;

        Utils.writeFile(configContent, configPath);

        try {
            this.#proc = Utils.subprocess([
                'cava',
                '-p', configPath
            ], (output) => {
                if (!output) return;
                
                const newOutput = output.trim();
                if (newOutput !== this.#output) {
                    this.#output = newOutput;
                    this.emit('output-changed', newOutput);
                }
            }, (err) => {
                console.error('Cava error:', err);
                if (!this.#output) {
                    this.#output = '0'.repeat(this.#config.bars);
                    this.emit('output-changed', this.#output);
                }
            });
        } catch (error) {
            console.error('Failed to start cava:', error);
            this.#output = '0'.repeat(this.#config.bars);
            this.emit('output-changed', this.#output);
        }
    }

    get output() {
        return this.#output;
    }

    start() {
        if (!this.#proc) {
            this.#initCava();
        }
    }

    stop() {
        if (this.#proc) {
            this.#proc.force_exit();
            this.#proc = null;
            this.#output = '0'.repeat(this.#config.bars);
            this.emit('output-changed', this.#output);
        }
    }

    destroy() {
        this.stop();
        super.destroy();
    }
}

const service = new AudioVisualizerService();
export default service;
