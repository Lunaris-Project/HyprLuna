import Widget from "resource:///com/github/Aylur/ags/widget.js";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import Mpris from 'resource:///com/github/Aylur/ags/service/mpris.js';
import userOptions from '../.configuration/user_options.js';
import GObject from 'gi://GObject';
import Gst from 'gi://Gst';

// Initialize GStreamer
Gst.init(null);

const SUPPORTED_FORMATS = /\.(mp3|wav|ogg|m4a|flac|opus|mp4|mkv)$/i;
const DEFAULT_MUSIC_DIR = "/Music";
const { execAsync } = Utils;

// State store for persistent settings
const STATE_PATH = GLib.build_filenamev([GLib.get_user_cache_dir(), 'ags', 'music_player_state.json']);

// Player states
let isShuffleMode = false;
let isLoopMode = false;
let lastPlayedFile = null;

// Add a new player mode state variable
let playerMode = 'offline'; // Can be 'offline' or 'online'

// Add a new state variable to track the active MPRIS player
let activePlayerName = null;

// Load saved state
const loadState = () => {
    try {
        if (GLib.file_test(STATE_PATH, GLib.FileTest.EXISTS)) {
            const contents = Utils.readFile(STATE_PATH);
            const state = JSON.parse(contents);
            isShuffleMode = state.shuffle || false;
            isLoopMode = state.loop || false;
            lastPlayedFile = state.lastPlayed || null;
            if (state.playerMode) {
                playerMode = state.playerMode;
            }
            if (state.activePlayerName) {
                activePlayerName = state.activePlayerName;
            }
            
            // Verify the file still exists
            if (lastPlayedFile && !GLib.file_test(lastPlayedFile, GLib.FileTest.EXISTS)) {
                lastPlayedFile = null;
            }
            
            return true;
        }
    } catch (error) {
        console.error("Error loading player state:", error);
    }
    return false;
};

// Save current state
const saveState = () => {
    try {
        const state = {
            shuffle: isShuffleMode,
            loop: isLoopMode,
            lastPlayed: lastPlayedFile,
            playerMode: playerMode,
            activePlayerName: activePlayerName
        };
        
        // Ensure directory exists
        const dir = GLib.path_get_dirname(STATE_PATH);
        Utils.exec(`mkdir -p "${dir}"`);
        
        // Write state file
        Utils.writeFile(JSON.stringify(state, null, 2), STATE_PATH);
    } catch (error) {
        console.error("Error saving player state:", error);
    }
};

// Create a GStreamer-based player class
class AudioPlayer extends GObject.Object {
    static {
        GObject.registerClass({
            Signals: {
                'position-updated': { param_types: [GObject.TYPE_DOUBLE] },
                'duration-updated': { param_types: [GObject.TYPE_DOUBLE] },
                'state-changed': { param_types: [GObject.TYPE_STRING] },
                'end-of-stream': { param_types: [GObject.TYPE_STRING] },
            },
        }, this);
    }

    constructor() {
        super();
        
        // Create the GStreamer pipeline
        this.pipeline = Gst.ElementFactory.make("playbin", "player");
        
        // Create a bus to get messages from the pipeline
        this.bus = this.pipeline.get_bus();
        this.bus.add_watch(GLib.PRIORITY_DEFAULT, this._onBusMessage.bind(this));
        
        this.currentFile = null;
        this.currentDuration = 0;
        this.isPlaying = false;
        this.updateIntervalId = null;
    }

    _onBusMessage(bus, message) {
        const messageType = message.type;
        
        if (messageType === Gst.MessageType.EOS) {
            // End of stream - save current file before stopping
            const endedFile = this.currentFile;
            console.log("End of stream");
            this.stop();
            this.emit('end-of-stream', endedFile);
        } else if (messageType === Gst.MessageType.ERROR) {
            const [error] = message.parse_error();
            console.error("GStreamer error:", error.message);
            this.stop();
        } else if (messageType === Gst.MessageType.STATE_CHANGED) {
            const [, newState] = message.parse_state_changed();
            if (message.src === this.pipeline) {
                if (newState === Gst.State.PLAYING) {
                    this.isPlaying = true;
                    this.emit('state-changed', 'playing');
                    
                    // Start position updates
                    if (!this.updateIntervalId) {
                        this.updateIntervalId = Utils.interval(250, () => {
                            this._updatePosition();
                            return true;
                        });
                    }
                    
                    // Query duration
                    const success = this.pipeline.query_duration(Gst.Format.TIME);
                    if (success[0]) {
                        this.currentDuration = success[1] / Gst.SECOND;
                        this.emit('duration-updated', this.currentDuration);
                    }
                } else if (newState === Gst.State.PAUSED) {
                    this.isPlaying = false;
                    this.emit('state-changed', 'paused');
                } else if (newState === Gst.State.NULL) {
                    this.isPlaying = false;
                    if (this.updateIntervalId) {
                        Utils.timeout.clearInterval(this.updateIntervalId);
                        this.updateIntervalId = null;
                    }
                    this.emit('state-changed', 'stopped');
                }
            }
        }
        
        return true;
    }

    _updatePosition() {
        if (!this.isPlaying) return;
        
        const success = this.pipeline.query_position(Gst.Format.TIME);
        if (success[0]) {
            const position = success[1] / Gst.SECOND;
            this.emit('position-updated', position);
        }
    }

    play(filePath) {
        if (!filePath) return false;
        
        // Check if the file exists
        if (!GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
            console.error(`File does not exist: ${filePath}`);
            return false;
        }
        
        // If the same file is playing, just resume
        if (this.currentFile === filePath && !this.isPlaying) {
            this.resume();
            return true;
        }
        
        // Stop any current playback
        this.stop();
        
        try {
            // Convert to URI
            const uri = Gio.File.new_for_path(filePath).get_uri();
            this.pipeline.set_property('uri', uri);
            this.pipeline.set_state(Gst.State.PLAYING);
            this.currentFile = filePath;
            
            // Save last played file
            lastPlayedFile = filePath;
            saveState();
            
            return true;
        } catch (error) {
            console.error("Error playing file:", error);
            return false;
        }
    }

    pause() {
        if (this.isPlaying) {
            this.pipeline.set_state(Gst.State.PAUSED);
        }
    }

    resume() {
        if (!this.isPlaying && this.currentFile) {
            this.pipeline.set_state(Gst.State.PLAYING);
        }
    }

    stop() {
        this.pipeline.set_state(Gst.State.NULL);
        this.currentFile = null;
    }

    seek(position) {
        if (!this.currentFile) return;
        
        // Convert seconds to nanoseconds
        const time = position * Gst.SECOND;
        this.pipeline.seek_simple(
            Gst.Format.TIME,
            Gst.SeekFlags.FLUSH | Gst.SeekFlags.KEY_UNIT,
            time
        );
    }
    
    skipForward(seconds = 10) {
        if (!this.currentFile) return;
        
        const success = this.pipeline.query_position(Gst.Format.TIME);
        if (success[0]) {
            const currentPos = success[1] / Gst.SECOND;
            const newPos = Math.min(currentPos + seconds, this.getDuration());
            this.seek(newPos);
        }
    }
    
    skipBackward(seconds = 10) {
        if (!this.currentFile) return;
        
        const success = this.pipeline.query_position(Gst.Format.TIME);
        if (success[0]) {
            const currentPos = success[1] / Gst.SECOND;
            const newPos = Math.max(currentPos - seconds, 0);
            this.seek(newPos);
        }
    }

    getDuration() {
        return this.currentDuration;
    }

    getCurrentPosition() {
        if (!this.isPlaying) return 0;
        
        const success = this.pipeline.query_position(Gst.Format.TIME);
        if (success[0]) {
            return success[1] / Gst.SECOND;
        }
        return 0;
    }

    isCurrentlyPlaying() {
        return this.isPlaying;
    }

    getCurrentFile() {
        return this.currentFile;
    }
}

// Create a global audio player instance
const player = new AudioPlayer();
let audioFiles = []; // Store list of all audio files

// Get path to music directory from config
const getMusicDir = () => {
    try {
        const musicDir = userOptions.asyncGet()?.music?.musicDir || DEFAULT_MUSIC_DIR;
        // Remove any leading slashes and build the full path
        const cleanPath = musicDir.replace(/^\/+/, '');
        return GLib.build_filenamev([GLib.get_home_dir(), cleanPath]);
    } catch (e) {
        console.error("Error getting music directory:", e);
        return GLib.build_filenamev([GLib.get_home_dir(), DEFAULT_MUSIC_DIR]);
    }
};

// Load all audio files from directory
const loadAudioFiles = (directory) => {
    audioFiles = [];
    try {
        const dir = Gio.File.new_for_path(directory);
        const enumerator = dir.enumerate_children(
            "standard::*",
            Gio.FileQueryInfoFlags.NONE,
            null,
        );
        
        let fileInfo;
        while ((fileInfo = enumerator.next_file(null)) !== null) {
            const filename = fileInfo.get_name();
            if (!SUPPORTED_FORMATS.test(filename)) continue;

            const filepath = GLib.build_filenamev([directory, filename]);
            audioFiles.push(filepath);
        }
        
        // Sort files alphabetically
        audioFiles.sort();
    } catch (error) {
        console.error("Error loading audio files:", error);
    }
    return audioFiles;
};

// Get next or random file
const getNextFile = () => {
    // Can't determine next file if we don't have a file list
    if (audioFiles.length === 0) return null;
    
    // If no current file, return the first one or a random one depending on mode
    if (!player.getCurrentFile()) {
        if (isShuffleMode) {
            const randomIndex = Math.floor(Math.random() * audioFiles.length);
            console.log(`Shuffle mode: starting with random file ${randomIndex}/${audioFiles.length}`);
            return audioFiles[randomIndex]; 
        } else {
            return audioFiles[0]; // Just return the first file
        }
    }
    
    // Find current index
    const currentIndex = audioFiles.indexOf(player.getCurrentFile());
    if (currentIndex === -1) {
        console.log("Current file not found in audio files list");
        // Current file not found in the list, return first or random
        if (isShuffleMode) {
            const randomIndex = Math.floor(Math.random() * audioFiles.length);
            return audioFiles[randomIndex];
        } else {
            return audioFiles[0];
        }
    }
    
    // Get next file according to mode
    if (isShuffleMode) {
        // Get a random file that's not the current one
        console.log("Shuffle mode: selecting random next file");
        let randomIndex;
        if (audioFiles.length > 1) {
            do {
                randomIndex = Math.floor(Math.random() * audioFiles.length);
            } while (randomIndex === currentIndex);
            console.log(`Selected random index ${randomIndex} from ${audioFiles.length} files`);
        } else {
            randomIndex = 0; // Only one file
        }
        return audioFiles[randomIndex];
    } else {
        // Sequential mode
        const nextIndex = (currentIndex + 1) % audioFiles.length;
        return audioFiles[nextIndex];
    }
};

// Play the next file in the directory
const playNextFile = () => {
    // If in loop mode and a file is playing or we have a last played file
    if (isLoopMode) {
        const fileToPlay = player.getCurrentFile() || lastPlayedFile;
        if (fileToPlay) {
            console.log("Loop mode active, replaying current/last track:", fileToPlay);
            return playAudioFile(fileToPlay);
        }
    }
    
    // Normal next track logic (either sequential or shuffled)
    const nextFile = getNextFile();
    if (nextFile) {
        console.log("Playing next track:", nextFile);
        return playAudioFile(nextFile);
    }
    return false;
};

// Play the previous file in the directory
const playPreviousFile = () => {
    const currentFile = player.getCurrentFile();
    if (!currentFile || audioFiles.length === 0) return false;
    
    if (isShuffleMode) {
        // In shuffle mode, pick a random file
        const randomIndex = Math.floor(Math.random() * audioFiles.length);
        return playAudioFile(audioFiles[randomIndex]);
    } else {
        const currentIndex = audioFiles.indexOf(currentFile);
        if (currentIndex === -1) return false;
        
        const prevIndex = (currentIndex - 1 + audioFiles.length) % audioFiles.length;
        return playAudioFile(audioFiles[prevIndex]);
    }
};

// Play an audio file
const playAudioFile = (filepath) => {
    try {
        // Check if the file exists
        if (!GLib.file_test(filepath, GLib.FileTest.EXISTS)) {
            console.error(`File does not exist: ${filepath}`);
            Utils.notify({
                summary: "Error",
                body: `File not found: ${GLib.path_get_basename(filepath)}`,
                icon: "dialog-error-symbolic"
            });
            return false;
        }
        
        // If the file is already playing
        if (player.getCurrentFile() === filepath && player.isCurrentlyPlaying()) {
            Utils.notify({
                summary: "Already Playing",
                body: `${GLib.path_get_basename(filepath).replace(/\.(mp3|wav|ogg|m4a|flac|opus|mp4|mkv)$/i, '')} is already playing`,
                icon: "audio-x-generic-symbolic"
            });
            return true;
        }
        
        // Play the file
        const success = player.play(filepath);
        
        if (success) {
            Utils.notify({
                summary: "Now Playing",
                body: GLib.path_get_basename(filepath).replace(/\.(mp3|wav|ogg|m4a|flac|opus|mp4|mkv)$/i, ''),
                icon: "audio-x-generic-symbolic"
            });
            
            // Trigger UI update immediately
            if (typeof updateControlsCallback === 'function') {
                updateControlsCallback();
            }
            
            // Update file list to show active file
            if (typeof refreshFileList === 'function') {
                refreshFileList();
            }
        }
        
        return success;
    } catch (error) {
        console.error("Error playing file:", error);
        return false;
    }
};

// Get currently playing Mpris player
const getPlayer = () => {
    // If in online mode, check for active player first
    if (playerMode === 'online' && activePlayerName) {
        // Check for a player marked as active
        for (const player of Mpris.players) {
            if (player.name === activePlayerName) {
                return player;
            }
        }
    }
    
    // Find the first player that's actively playing something
    const activePlayers = Mpris.players.filter(player => 
        player.playBackStatus === 'Playing' && player.trackTitle
    );
    
    if (activePlayers.length > 0) {
        // Auto-select the first playing player
        activePlayerName = activePlayers[0].name;
        saveState();
        return activePlayers[0];
    }
    
    // Otherwise look for mpv player first
    for (const player of Mpris.players) {
        if (player.name === 'mpv') {
            return player;
        }
    }
    
    // Fallback to any player
    return Mpris.players[0] || null;
};

// Function to validate icon
const getValidIcon = (iconPath) => {
    if (!iconPath) return "audio-x-generic-symbolic";
    
    // Check if it's a named icon (doesn't contain slashes)
    if (!iconPath.includes('/')) {
        return iconPath;
    }
    
    // Check if it's a valid file
    try {
        const file = Gio.File.new_for_path(iconPath);
        if (file.query_exists(null)) {
            return iconPath;
        }
    } catch (e) {
        // Try as URI
        try {
            const file = Gio.File.new_for_uri(iconPath);
            if (file.query_exists(null)) {
                return iconPath;
            }
        } catch (e) {
            console.log(`Invalid icon path: ${iconPath}`);
        }
    }
    
    // Fallback
    return "audio-x-generic-symbolic";
};

// Function to get the best available icon for an MPRIS player
const getPlayerIcon = (player) => {
    // First try to get the track cover
    if (player.trackCoverUrl) {
        const validIcon = getValidIcon(player.trackCoverUrl);
        if (validIcon !== "audio-x-generic-symbolic") {
            return validIcon;
        }
    }
    
    // Then try to get the application icon
    if (player.name) {
        // Common player name to icon mapping
        const iconMap = {
            // Music players
            'spotify': 'spotify',
            'rhythmbox': 'rhythmbox',
            'clementine': 'clementine',
            'audacious': 'audacious',
            'amarok': 'amarok',
            'strawberry': 'strawberry',
            'lollypop': 'org.gnome.Lollypop',
            'deadbeef': 'deadbeef',
            'quodlibet': 'io.github.quodlibet.QuodLibet',
            'elisa': 'org.kde.elisa',
            'jamendo': 'jamendo',
            'qmmp': 'qmmp',
            'juk': 'juk',
            'gmusicbrowser': 'gmusicbrowser',
            'cantata': 'cantata',
            'tomahawk': 'tomahawk',
            'musique': 'musique',
            'banshee': 'banshee',
            'beatbox': 'beatbox',
            'gnome-music': 'org.gnome.Music',
            'yarock': 'yarock',
            
            // Video players
            'mpv': 'mpv',
            'vlc': 'vlc',
            'smplayer': 'smplayer',
            'mplayer': 'mplayer',
            'totem': 'org.gnome.Totem',
            'kaffeine': 'kaffeine',
            'parole': 'org.xfce.Parole',
            'dragonplayer': 'dragonplayer',
            'mpd': 'mpd',
            
            // Browsers
            'chromium': 'chromium',
            'chrome': 'google-chrome',
            'firefox': 'firefox',
            'opera': 'opera',
            'edge': 'microsoft-edge',
            'vivaldi': 'vivaldi',
            'brave': 'brave',
            'epiphany': 'org.gnome.Epiphany',
            'midori': 'midori',
            'falkon': 'falkon',
            'konqueror': 'konqueror',
            'browser': 'web-browser-symbolic',
            
            // Generic fallbacks
            'audio': 'audio-x-generic-symbolic',
            'video': 'video-x-generic-symbolic',
            'multimedia': 'multimedia-player-symbolic',
            'music': 'multimedia-player-symbolic',
            'web': 'web-browser-symbolic'
        };
        
        const playerNameLower = player.name.toLowerCase();
        
        // Try exact match first
        if (iconMap[playerNameLower]) {
            return iconMap[playerNameLower];
        }
        
        // Try partial match
        for (const [key, icon] of Object.entries(iconMap)) {
            if (playerNameLower.includes(key)) {
                return icon;
            }
        }
        
        // Try the name as-is as an icon name
        return playerNameLower;
    }
    
    // Fallback to generic icon or player's symbol icon
    return player.symbolIcon || "audio-x-generic-symbolic";
};

// Audio file button component
const AudioFileButton = (filename, filepath) => {
    // Remove file extensions (.mp3, .wav, etc.) from the displayed name
    const displayName = filename.replace(/\.(mp3|wav|ogg|m4a|flac|opus|mp4|mkv)$/i, '');
    
    // Check if this file is currently playing or was the last played file
    const isPlaying = player.getCurrentFile() === filepath;
    const isLastPlayed = !isPlaying && lastPlayedFile === filepath;
    
    return Widget.Button({
        className: `audio-files-button ${isPlaying ? 'audio-files-button-active' : ''} ${isLastPlayed ? 'audio-files-button-last-played' : ''}`,
        onClicked: () => playAudioFile(filepath),
    child: Widget.Box({
        homogeneous: false,
            spacing: 6,
        children: [
            Widget.Icon({
                icon: "audio-x-generic-symbolic",
                    size: 20,
                className: "audio-files-icon",
            }),
            Widget.Label({
                    label: displayName,
                xalign: 0,
                maxWidthChars: 30,
                truncate: "end",
                justification: "left",
                className: "audio-files-label",
            }),
        ],
    }),
});
};

// Create a simple control button
const MediaButton = ({ icon, size = 12, className = '', onClick, tooltip = '' }) => {
    const button = Widget.Button({
        className: `media-control-button ${className}`,
        tooltipText: tooltip,
        child: Widget.Icon({
            icon: icon,
            size: size,
        }),
        onClicked: onClick,
        setup: self => {
            // Add hover and active states via connect signals
            self.connect('enter-notify-event', () => {
                self.toggleClassName('media-control-button-hover', true);
                return false;
            });
            
            self.connect('leave-notify-event', () => {
                self.toggleClassName('media-control-button-hover', false);
                return false;
            });
            
            self.connect('button-press-event', () => {
                self.toggleClassName('media-control-button-active', true);
                return false;
            });
            
            self.connect('button-release-event', () => {
                self.toggleClassName('media-control-button-active', false);
                return false;
            });
        }
    });
    
    return button;
};

// Callback reference for updating controls
let updateControlsCallback = null;

// Media controls component
const MediaControls = () => {
    // Progress bar that updates with the player position
    const progressBar = Widget.Slider({
        className: 'media-progress-bar',
        drawValue: false,
        value: 0,
        onChange: ({ value }) => {
            // Local player
            if (player.getCurrentFile()) {
                // Calculate position in seconds
                const position = value * player.getDuration();
                player.seek(position);
            } 
            // External MPRIS player
            else {
                const mprisPlayer = getPlayer();
                if (mprisPlayer && mprisPlayer.length > 0) {
                    mprisPlayer.position = mprisPlayer.length * value;
                }
            }
        }
    });
    
    // Shuffle button with toggle state
    const shuffleButton = MediaButton({
        icon: isShuffleMode ? 'media-playlist-shuffle-symbolic' : 'view-list-symbolic',
        size: 12,
        className: isShuffleMode ? 'media-control-button-toggled' : '',
        tooltip: 'Toggle Shuffle',
        onClick: () => {
            isShuffleMode = !isShuffleMode;
            shuffleButton.toggleClassName('media-control-button-toggled', isShuffleMode);
            // Switch to a different icon when toggled
            shuffleButton.child.icon = isShuffleMode ? 
                'media-playlist-shuffle-symbolic' : 'view-list-symbolic';
            saveState();
        }
    });
    
    // Skip backward 10s button
    const skipBackButton = MediaButton({
        icon: 'media-seek-backward-symbolic',
        size: 12,
        tooltip: 'Skip back 10 seconds',
        onClick: () => {
            if (player.getCurrentFile()) {
                player.skipBackward(10);
            }
        }
    });
    
    // Previous button
    const prevButton = MediaButton({
        icon: 'media-skip-backward-symbolic',
        size: 12,
        tooltip: 'Previous track',
        onClick: () => {
            // If in offline mode
            if (playerMode === 'offline') {
                if (player.getCurrentFile()) {
                    playPreviousFile();
                }
            } 
            // In online mode, control the MPRIS player
            else if (playerMode === 'online') {
                const mprisPlayer = getPlayer();
                if (mprisPlayer) {
                    mprisPlayer.previous();
                    // Update UI after a short delay
                    setTimeout(updateControls, 300);
                }
            }
        }
    });
    
    // Play/Pause button
    const playPauseButton = MediaButton({
        icon: 'media-playback-start-symbolic',
        size: 14,
        className: 'media-playpause-button',
        tooltip: 'Play/Pause',
        onClick: () => {
            // If in offline mode and our player is active
            if (playerMode === 'offline') {
                if (player.getCurrentFile()) {
                    if (player.isCurrentlyPlaying()) {
                        player.pause();
                    } else {
                        player.resume();
                    }
                    // Update UI immediately
                    updateControls();
                } 
                // If no file is playing but we have a last played file
                else if (lastPlayedFile) {
                    playAudioFile(lastPlayedFile);
                }
            }
            // In online mode, control the MPRIS player
            else if (playerMode === 'online') {
                const mprisPlayer = getPlayer();
                if (mprisPlayer) {
                    mprisPlayer.playPause();
                    // Update UI
                    updateControls();
                }
            }
        }
    });
    
    // Next button
    const nextButton = MediaButton({
        icon: 'media-skip-forward-symbolic',
        size: 12,
        tooltip: 'Next track',
        onClick: () => {
            // If in offline mode
            if (playerMode === 'offline') {
                if (player.getCurrentFile()) {
                    playNextFile();
                }
            } 
            // In online mode, control the MPRIS player
            else if (playerMode === 'online') {
                const mprisPlayer = getPlayer();
                if (mprisPlayer) {
                    mprisPlayer.next();
                    // Update UI after a short delay
                    setTimeout(updateControls, 300);
                }
            }
        }
    });
    
    // Skip forward 10s button
    const skipForwardButton = MediaButton({
        icon: 'media-seek-forward-symbolic',
        size: 12,
        tooltip: 'Skip forward 10 seconds',
        onClick: () => {
            if (player.getCurrentFile()) {
                player.skipForward(10);
            }
        }
    });
    
    // Loop button with toggle state
    const loopButton = MediaButton({
        icon: isLoopMode ? 'media-playlist-repeat-one-symbolic' : 'media-playlist-repeat-symbolic',
        size: 12,
        className: isLoopMode ? 'media-control-button-toggled' : '',
        tooltip: 'Toggle Loop',
        onClick: () => {
            isLoopMode = !isLoopMode;
            loopButton.toggleClassName('media-control-button-toggled', isLoopMode);
            // Change icon when toggled
            loopButton.child.icon = isLoopMode ? 
                'media-playlist-repeat-one-symbolic' : 'media-playlist-repeat-symbolic';
            saveState();
        }
    });
    
    // Song title
    const titleLabel = Widget.Label({
        className: 'media-title-label',
        truncate: "end",
        justification: "center",
        label: lastPlayedFile ? GLib.path_get_basename(lastPlayedFile).replace(/\.(mp3|wav|ogg|m4a|flac|opus|mp4|mkv)$/i, '') : "No media playing",
        hpack: 'center',
        xalign: 0.5,
        setup: label => {
            label.set_size_request(330, -1);
        }
    });
    
    // Current time / Duration display
    const timeLabel = Widget.Label({
        className: 'media-time-label',
        label: "0:00 / 0:00",
        hpack: 'center',
        xalign: 0.5,
    });
    
    // Format time in seconds to MM:SS format
    const formatTime = (seconds) => {
        if (isNaN(seconds) || seconds < 0) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Connect to audio player signals
    player.connect('position-updated', (_, position) => {
        // Update progress bar
        const duration = player.getDuration();
        if (duration > 0) {
            progressBar.value = position / duration;
            timeLabel.label = `${formatTime(position)} / ${formatTime(duration)}`;
        }
    });
    
    player.connect('state-changed', (_, state) => {
        // Update play/pause button
        if (state === 'playing') {
            playPauseButton.child.icon = 'media-playback-pause-symbolic';
        } else {
            playPauseButton.child.icon = 'media-playback-start-symbolic';
        }
        
        // If stopped, clear title
        if (state === 'stopped') {
            titleLabel.label = 'No media playing';
            progressBar.value = 0;
            timeLabel.label = "0:00 / 0:00";
        }
    });
    
    // Special function to properly replay a file with full pipeline reset
    const replayFile = (filePath) => {
        if (!filePath || !GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
            console.error(`Cannot replay, file does not exist: ${filePath}`);
            return false;
        }
        
        console.log(`Replaying file with full reset: ${filePath}`);
        
        // First stop any playback and reset the pipeline
        player.stop();
        
        // Short delay to ensure pipeline is fully reset
        return new Promise(resolve => {
            setTimeout(() => {
                // Play the file
                const success = player.play(filePath);
                console.log(`Replay ${success ? 'successful' : 'failed'}`);
                
                // Verify playback started
                setTimeout(() => {
                    if (!player.isCurrentlyPlaying()) {
                        console.log("Playback verification failed, retrying");
                        player.play(filePath);
                    }
                }, 200);
                
                resolve(success);
            }, 200);
        });
    };

    player.connect('end-of-stream', (_, endedFile) => {
        // Auto-play next track when current one ends
        console.log("End of stream detected, playing next");
        console.log("Loop mode:", isLoopMode, "Shuffle mode:", isShuffleMode);
        
        if (isLoopMode && endedFile) {
            // Replay the same track in loop mode using the file that just ended
            console.log("Replaying in loop mode:", endedFile);
            replayFile(endedFile);
        } else {
            // Play next track with a small delay
            setTimeout(() => {
                console.log("Playing next track");
                playNextFile();
            }, 300);
        }
    });
    
    // Update controls based on player state
    const updateControls = () => {
        // Check if we're in offline mode with a last played file but nothing actively playing
        if (playerMode === 'offline' && lastPlayedFile && !player.getCurrentFile()) {
            // Show the last played filename (without extension)
            const filename = GLib.path_get_basename(lastPlayedFile).replace(/\.(mp3|wav|ogg|m4a|flac|opus|mp4|mkv)$/i, '');
            titleLabel.label = filename;
            
            // Set pause icon since we're not playing
            playPauseButton.child.icon = 'media-playback-start-symbolic';
            
            // Reset progress
            progressBar.value = 0;
            timeLabel.label = "0:00 / 0:00";
            
            return;
        }
        
        // If our player is active and we're in offline mode
        if (player.getCurrentFile() && playerMode === 'offline') {
            // Update title
            const filename = GLib.path_get_basename(player.getCurrentFile()).replace(/\.(mp3|wav|ogg|m4a|flac|opus|mp4|mkv)$/i, '');
            titleLabel.label = filename;
            
            // Update play/pause button
            playPauseButton.child.icon = player.isCurrentlyPlaying() ? 
                'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
            
            // Position and duration will be updated by the signal handlers
            return;
        }
        
        // Otherwise, check MPRIS players for online mode
        const mprisPlayer = getPlayer();
        
        // Update play/pause button icon
        if (mprisPlayer) {
            const icon = mprisPlayer.playBackStatus === 'Playing' 
                ? 'media-playback-pause-symbolic' 
                : 'media-playback-start-symbolic';
            playPauseButton.child.icon = icon;
            
            // Update title with the player name
            if (playerMode === 'online') {
                titleLabel.label = `${mprisPlayer.name || 'Media Player'}: ${mprisPlayer.trackTitle || mprisPlayer.title || 'Unknown Track'}`;
            } else {
                titleLabel.label = mprisPlayer.trackTitle || mprisPlayer.title || 'Unknown Track';
            }
            
            // Update progress if available
            if (mprisPlayer.length > 0) {
                progressBar.value = mprisPlayer.position / mprisPlayer.length;
                timeLabel.label = `${formatTime(mprisPlayer.position)} / ${formatTime(mprisPlayer.length)}`;
            } else {
                progressBar.value = 0;
                timeLabel.label = "0:00 / 0:00";
            }
        } else {
            // No player active
            playPauseButton.child.icon = 'media-playback-start-symbolic';
            
            // Show appropriate message based on mode
            if (playerMode === 'online') {
                titleLabel.label = 'Select a media player to control';
            } else {
                titleLabel.label = 'No media playing';
            }
            
            progressBar.value = 0;
            timeLabel.label = "0:00 / 0:00";
        }
    };
    
    // Store callback reference for external updates
    updateControlsCallback = updateControls;
    
    // Create a box with all controls
    return Widget.Box({
        vertical: true,
        className: 'media-controls-box',
        setup: self => {
            // Fixed size
            self.set_size_request(320, -1);
            
            // Set up a timer to update the progress bar for MPRIS players
            const timerId = Utils.interval(1000, () => {
                if (!player.getCurrentFile()) {
                    updateControls(); // Only update MPRIS info here
                }
                return true; // Keep running
            });
            
            // Hook into Mpris service for player status changes
            self.hook(Mpris, updateControls);
            
            // Initial update
            updateControls();
            
            // Clean up when destroyed
            self.connect('destroy', () => {
                Utils.timeout.clearInterval(timerId);
                
                // Stop playback
                if (player.getCurrentFile()) {
                    player.stop();
                }
            });
        },
        children: [
            Widget.Box({
                setup: box => box.set_size_request(320, 36), // Reduced height
                child: titleLabel
            }),
            Widget.Box({
                className: 'media-progress-container',
                vertical: true,
                setup: box => box.set_size_request(320, 36), // Reduced height
                children: [
                    progressBar,
                    timeLabel,
                ]
            }),
            Widget.Box({
                spacing: 14,
                className: 'media-buttons-box',
                vpack: 'center',
                hpack: 'center',
                homogeneous: true,
                setup: box => box.set_size_request(320, 42), // Reduced height
                children: [
                    Widget.Box({
                        hpack: 'end',
                        className: 'media-button-left-margin',
                        child: shuffleButton
                    }),
                    skipBackButton,
                    prevButton,
                    playPauseButton,
                    nextButton,
                    skipForwardButton,
                    Widget.Box({
                        hpack: 'start',
                        className: 'media-button-right-margin',
                        child: loopButton
                    }),
                ]
            })
        ]
    });
};

// Empty directory message
const EmptyDirectoryMessage = (directory) => Widget.Box({
    vertical: true,
    valign: 'center',
    halign: 'center',
    className: 'empty-media-message',
    setup: self => {
        self.set_size_request(-1, 120); // Reduced height
    },
    children: [
        Widget.Icon({
            icon: 'folder-music-symbolic',
            size: 32,
            className: 'empty-media-icon',
        }),
        Widget.Label({
            label: 'No audio files found',
            className: 'empty-media-title',
        }),
        Widget.Label({
            label: `Please add media files to ${directory}`,
            className: 'empty-media-subtitle',
            justification: 'center',
        }),
    ],
});

// Main audio files widget
const AudioFiles = ({ directory = getMusicDir() } = {}) => {
    // Load saved state
    loadState();
    
    const fileList = Widget.Box({
        vertical: true,
        className: "audio-files-list",
    });
    
    // Create a stack for the offline and online modes
    const offlineContent = Widget.Box({
        vertical: true,
        children: [
            Widget.Scrollable({
                child: fileList,
                vexpand: true,
                hscroll: "never",
                className: "audio-files-scrollable",
                setup: self => {
                    self.set_size_request(300, 100); // Reduced width and height
                }
            })
        ]
    });
    
    // MPRIS players list for online mode
    const onlineContent = Widget.Box({
        vertical: true,
        setup: (self) => {
            // Update the list of players when Mpris changes
            self.hook(Mpris, () => {
                self.children = buildMprisPlayersList();
            });
            
            // Set fixed dimensions with reduced height
            self.set_size_request(300, 100);
        }
    });
    
    // Function to build the list of MPRIS players
    const buildMprisPlayersList = () => {
        // Filter players: only show players that are actually playing or have track info
        const activePlayers = Mpris.players.filter(player => 
            player.trackTitle || player.playBackStatus === 'Playing'
        );
        
        if (activePlayers.length === 0) {
            return [Widget.Box({
                vertical: true,
                valign: 'center',
                halign: 'center',
                className: 'empty-media-message',
                setup: self => {
                    self.set_size_request(-1, 120); // Reduced height
                },
                children: [
                    Widget.Icon({
                        icon: 'audio-card-symbolic',
                        size: 32,
                        className: 'empty-media-icon',
                    }),
                    Widget.Label({
                        label: 'No active media players',
                        className: 'empty-media-title',
                    }),
                    Widget.Label({
                        label: 'Start playing media in any application',
                        className: 'empty-media-subtitle',
                        justification: 'center',
                    }),
                ],
            })];
        }
        
        // If we have an active player, make sure it exists in the list
        if (activePlayerName) {
            const playerExists = activePlayers.some(p => p.name === activePlayerName);
            if (!playerExists && activePlayers.length > 0) {
                // Auto-select the first player if our active player isn't in the list
                activePlayerName = activePlayers[0].name;
                saveState();
            }
        } else if (activePlayers.length > 0) {
            // Auto-select the first player if none is selected
            activePlayerName = activePlayers[0].name;
            saveState();
        }
        
        return activePlayers.map(player => {
            // Determine if this player is the active one
            const isActive = player.name === activePlayerName;
            
            // Get player icon
            const iconSrc = getPlayerIcon(player);
            
            return Widget.Button({
                className: `audio-files-button ${isActive ? 'audio-files-button-active' : ''}`,
                onClicked: () => {
                    // Set this player as active
                    activePlayerName = player.name;
                    
                    // Stop any local playback when switching to online mode
                    if (playerMode === 'online' && player.getCurrentFile) {
                        player.stop();
                    }
                    
                    // Force update
                    updateControlsCallback();
                    
                    // Rebuild player list to show active state
                    onlineContent.children = buildMprisPlayersList();
                    
                    // Save state
                    saveState();
                },
                child: Widget.Box({
                    homogeneous: false,
                    spacing: 6,
                    children: [
                        Widget.Icon({
                            icon: iconSrc,
                            size: 24,
                            className: "audio-files-icon",
                        }),
                        Widget.Box({
                            vertical: true,
                            children: [
                                Widget.Label({
                                    label: player.name || 'Unknown Player',
                                    xalign: 0,
                                    className: "audio-files-player-name",
                                }),
                                Widget.Label({
                                    label: player.trackTitle || 'Not playing',
                                    xalign: 0,
                                    wrap: true,
                                    truncate: "end",
                                    maxWidthChars: 30,
                                    className: "audio-files-player-track",
                                }),
                            ]
                        }),
                    ],
                }),
            });
        });
    };
    
    const contentStack = Widget.Stack({
        transition: 'crossfade',
        children: {
            'empty': EmptyDirectoryMessage(directory),
            'offline': offlineContent,
            'online': onlineContent,
        }
    });
    
    const modeButton = Widget.Button({
        className: 'media-mode-button',
        onClicked: () => {
            playerMode = playerMode === 'offline' ? 'online' : 'offline';
            updatePlayerMode();
        },
        child: Widget.Icon({
            icon: playerMode === 'offline' ? 'audio-headphones-symbolic' : 'audio-card-symbolic',
            size: 16,
        }),
        tooltipText: playerMode === 'offline' ? 
            'Switch to online media players' : 
            'Switch to local audio files',
        setup: self => {
            self.set_size_request(36, 36);
        }
    });

    const headerTitle = Widget.Label({
        label: playerMode === 'offline' ? 'Local Music' : 'Media Players',
        xalign: 0,
        className: 'media-header-title',
    });

    const header = Widget.Box({
        className: 'media-header',
        children: [
            headerTitle,
            Widget.Box({ hexpand: true }),
            modeButton,
        ],
    });
    
    // Function to update UI based on mode
    const updatePlayerMode = () => {
        modeButton.child.icon = playerMode === 'offline' ? 
            'audio-headphones-symbolic' : 'audio-card-symbolic';
        
        modeButton.tooltipText = playerMode === 'offline' ? 
            'Switch to online media players' : 
            'Switch to local audio files';
        
        headerTitle.label = playerMode === 'offline' ? 'Local Music' : 'Media Players';
        
        if (playerMode === 'offline') {
            activePlayerName = null;
            
            if (audioFiles.length > 0) {
                contentStack.shown = 'offline';
            } else {
                contentStack.shown = 'empty';
            }
        } else {
            if (player.getCurrentFile()) {
                player.stop();
            }
            
            contentStack.shown = 'online';
            
            onlineContent.children = buildMprisPlayersList();
        }
        
        if (typeof updateControlsCallback === 'function') {
            updateControlsCallback();
        }
        
        savePlayerMode();
    };
    
    // Save player mode preference
    const savePlayerMode = () => {
        try {
            // Update the state with the player mode
            const state = {
                shuffle: isShuffleMode,
                loop: isLoopMode,
                lastPlayed: lastPlayedFile,
                playerMode: playerMode,
                activePlayerName: activePlayerName
            };
            
            // Write state file
            Utils.writeFile(JSON.stringify(state, null, 2), STATE_PATH);
        } catch (error) {
            console.error("Error saving player mode:", error);
        }
    };
    
    // Load player mode from state
    const loadPlayerMode = () => {
        try {
            if (GLib.file_test(STATE_PATH, GLib.FileTest.EXISTS)) {
                const contents = Utils.readFile(STATE_PATH);
                const state = JSON.parse(contents);
                if (state.playerMode) {
                    playerMode = state.playerMode;
                }
                if (state.activePlayerName) {
                    activePlayerName = state.activePlayerName;
                }
            }
        } catch (error) {
            console.error("Error loading player mode:", error);
        }
    };
    
    const controls = MediaControls();

    const updateFileList = () => {
        const dir = Gio.File.new_for_path(directory);
        fileList.children = [];
        let fileCount = 0;

        try {
            const enumerator = dir.enumerate_children(
                "standard::*",
                Gio.FileQueryInfoFlags.NONE,
                null,
            );
            
            // Get a sorted list of files to display consistently
            const filesToAdd = [];
            
            let fileInfo;
            while ((fileInfo = enumerator.next_file(null)) !== null) {
                const filename = fileInfo.get_name();
                if (!SUPPORTED_FORMATS.test(filename)) continue;

                const filepath = GLib.build_filenamev([directory, filename]);
                filesToAdd.push({ filename, filepath });
                fileCount++;
            }
            
            // Sort files alphabetically
            filesToAdd.sort((a, b) => a.filename.localeCompare(b.filename));
            
            // Add files to the list
            filesToAdd.forEach(({ filename, filepath }) => {
                fileList.add(AudioFileButton(filename, filepath));
            });
            
            // Update audio files list for navigation
            loadAudioFiles(directory);
            
            // Update display based on file count and mode
            if (playerMode === 'offline') {
                contentStack.shown = fileCount > 0 ? 'offline' : 'empty';
            }
            
            // If we have a last played file but nothing is playing, make sure to update the UI
            if (lastPlayedFile && !player.getCurrentFile()) {
                updateControlsCallback();
            }
            
        } catch (error) {
            console.error("Error reading directory:", error);
            if (playerMode === 'offline') {
                contentStack.shown = 'empty';
            }
        }
    };

    const setupFileMonitor = (widget) => {
        const file = Gio.File.new_for_path(directory);
        const monitor = file.monitor_directory(
            Gio.FileMonitorFlags.NONE,
            null
        );

        const monitorHandler = monitor.connect('changed', updateFileList);

        widget.connect('destroy', () => {
            monitor.disconnect(monitorHandler);
            monitor.cancel();
            
            // Also stop any playing audio when widget is destroyed
            player.stop();
        });

        return monitor;
    };

    // Main widget with reduced width
    return Widget.Box({
        vertical: true,
        className: "audio-files-widget",
        setup: self => {
            // Set fixed width for the entire widget
            self.set_size_request(320, -1);
            
            // Load player mode
            loadPlayerMode();
            
            // Initial file list population
            updateFileList();
            
            // Initial mode update
            updatePlayerMode();
            
            // Setup file monitoring
            setupFileMonitor(self);

            // Cleanup handler
            self.connect('destroy', () => {
                self.get_children().forEach(child => {
                    if (child.destroy) child.destroy();
                });
            });
        },
        children: [
            header,
            contentStack,
            // Controls are always visible regardless of whether there are files
            Widget.Box({
                vertical: true,
                className: "media-container",
                setup: self => {
                    self.set_size_request(320, -1); // Reduced width for container
                },
                children: [
                    controls
                ]
            })
        ],
    });
};

export default AudioFiles;
