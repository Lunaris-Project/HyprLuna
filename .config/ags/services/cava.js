import * as Utils from 'resource:///com/github/Aylur/ags/utils.js'
import Service from 'resource:///com/github/Aylur/ags/service.js'
import App from 'resource:///com/github/Aylur/ags/app.js'

class AudioVisualizerService extends Service {
    static {
        Service.register(this, {
            'output-changed': ['string'],
        });
    }

    // Private properties:
    #output = null;
    #proc = null;
    // Constant config settings (adjust values as needed)
    #config = {
        bars: 50,            // Number of bars to display
        framerate: 30,       // Frame rate for the visualization
        sensitivity: 200,    // Sensitivity level
        bar_width: 1,        // Width of each bar (optional)
        bar_spacing: 1,      // Spacing between bars (optional)
        smoothing: 0.5,      // Smoothing factor for output (optional)
        noise_reduction: 0   // Noise reduction for smoothing (optional)
    };

    constructor() {
        super();
        // Initialize cava only once at startup.
        this.#initCava();
    }

    getConfig() {
        return { ...this.#config };
    }

    #initCava() {
        // Avoid respawning if already running.
        if (this.#proc) return;

        // Create a constant config file for cava at a temporary location
        const configPath = '/tmp/cava.config';
        const configContent = `
[general]
framerate = ${this.#config.framerate}
sensitivity = ${this.#config.sensitivity}
bars = ${this.#config.bars}
bar_width = ${this.#config.bar_width}
bar_spacing = ${this.#config.bar_spacing}

[input]
method = "pipewire"
source = "auto"

[output]
method = raw
raw_target = /dev/stdout
data_format = ascii
channels = stereo
ascii_max_range = 7

[smoothing]
noise_reduction = ${this.#config.noise_reduction}
smoothing = ${this.#config.smoothing}
        `;
        Utils.writeFile(configContent, configPath);

        // Start the cava process with a single spawn and hook into its output
        try {
            this.#proc = Utils.subprocess(
                ['cava', '-p', configPath],
                output => {
                    if (!output?.trim()) return;

                    // Clean the output and convert numbers to bars
                    const values = output.trim().split('').map(char => char.charCodeAt(0) - 48);
                    const bars = values.slice(0, this.#config.bars)
                        .map(n => {
                            // Logarithmic scaling to avoid maximum height artifacts
                            const scaledValue = Math.log1p(n) / Math.log1p(7);
                            const level = Math.min(Math.max(0, Math.floor(scaledValue * 8)));
                            return ["", "▂", "▃", "▄", "▅", "▆", "▇", "█"][level];
                        })
                        .join('');

                    if (bars !== this.#output) {
                        this.#output = bars;
                        this.emit('output-changed', bars);
                    }
                },
                error => {
                    console.error('Cava error:', error);
                    if (!this.#output) {
                        this.#output = "▁".repeat(this.#config.bars);
                        this.emit('output-changed', this.#output);
                    }
                }
            );
        } catch (error) {
            console.error('Failed to start cava:', error);
            this.#output = "▁".repeat(this.#config.bars);
            this.emit('output-changed', this.#output);
        }
    }

    get output() {
        return this.#output;
    }

    destroy() {
        if (this.#proc) {
            this.#proc.force_exit();
            this.#proc = null;
        }
        super.destroy();
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
            this.#output = "".repeat(this.#config.bars);
            this.emit('output-changed', this.#output);
        }
    }
}

const service = new AudioVisualizerService();
export default service;
