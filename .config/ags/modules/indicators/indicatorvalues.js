// This file is for brightness/volume/scale indicators
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Audio from 'resource:///com/github/Aylur/ags/service/audio.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const { Box, Label, ProgressBar } = Widget;
import { MarginRevealer } from '../.widgethacks/advancedrevealers.js';
import Brightness from '../../services/brightness.js';
import Indicator from '../../services/indicator.js';

// Import Gio to access GSettings
const { Gio } = imports.gi;
// Create a Gio.Settings instance for the GTK text-scaling-factor
const scaleSettings = new Gio.Settings({ schema: "org.gnome.desktop.interface" });
// Helper object to get the current scaling factor.
const Scale = {
    get scaling_value() {
        return scaleSettings.get_double("text-scaling-factor");
    }
};

// Generic indicator widget that shows a name, a numeric value, and a progress bar.
const OsdValue = ({
    name, nameSetup = undefined, labelSetup, progressSetup,
    extraClassName = '', extraProgressClassName = '',
    ...rest
}) => {
    const valueName = Label({
        xalign: 0, yalign: 0, hexpand: true,
        className: 'osd-label',
        label: `${name}`,
        setup: nameSetup,
    });
    const valueNumber = Label({
        hexpand: false, className: 'osd-value-txt',
        setup: labelSetup,
    });
    return Box({
        vertical: true,
        hexpand: true,
        className: `osd-bg osd-value ${extraClassName}`,
        attribute: {
            'disable': () => {
                valueNumber.label = '󰖭';
            }
        },
        children: [
            Box({
                vexpand: true,
                children: [
                    valueName,
                    valueNumber,
                ]
            }),
            ProgressBar({
                className: `osd-progress ${extraProgressClassName}`,
                hexpand: true,
                vertical: false,
                setup: progressSetup,
            })
        ],
        ...rest,
    });
}

// Brightness indicator – uses the Brightness service.
const brightnessIndicator = OsdValue({
    name: 'Brightness',
    extraClassName: 'osd-brightness',
    extraProgressClassName: 'osd-brightness-progress',
    labelSetup: (self) => self.hook(Brightness[0], self => {
        self.label = `${Math.round(Brightness[0].screen_value * 100)}`;
    }, 'notify::screen-value'),
    progressSetup: (self) => self.hook(Brightness[0], (progress) => {
        const updateValue = Brightness[0].screen_value;
        if (updateValue !== progress.value) Indicator.popup(1);
        progress.value = updateValue;
    }, 'notify::screen-value'),
});

// Volume indicator – uses the Audio service.
const volumeIndicator = OsdValue({
    name: 'Volume',
    extraClassName: 'osd-volume',
    extraProgressClassName: 'osd-volume-progress',
    attribute: { headphones: undefined, device: undefined },
    nameSetup: (self) => Utils.timeout(1, () => {
        const updateAudioDevice = (self) => {
            const usingHeadphones = (Audio.speaker?.stream?.port)?.toLowerCase().includes('headphone');
            if (volumeIndicator.attribute.headphones === undefined ||
                volumeIndicator.attribute.headphones !== usingHeadphones) {
                volumeIndicator.attribute.headphones = usingHeadphones;
                // self.label = usingHeadphones ? 'Headphones' : 'Speakers';
                // Indicator.popup(1);
            }
        }
        self.hook(Audio, updateAudioDevice);
        Utils.timeout(1000, updateAudioDevice);
    }),
    labelSetup: (self) => self.hook(Audio, (label) => {
        const newDevice = (Audio.speaker?.name);
        const updateValue = Math.round(Audio.speaker?.volume * 100);
        if (!isNaN(updateValue)) {
            if (newDevice === volumeIndicator.attribute.device && updateValue != label.label) {
                Indicator.popup(1);
            }
        }
        volumeIndicator.attribute.device = newDevice;
        if (updateValue === 0) {
            label.className = 'osd-value-icon icon-material';
            label.label = 'volume_off';
        } else {
            label.className = "osd-value-txt";
            label.label = `${updateValue}`;
        }
    }),
    progressSetup: (self) => self.hook(Audio, (progress) => {
        const updateValue = Audio.speaker?.volume;
        if (!isNaN(updateValue)) {
            if (updateValue > 1) progress.value = 1;
            else progress.value = updateValue;
        }
    }),
});

// Scale indicator – shows the current GTK text scaling factor.
// This version connects to the "changed::text-scaling-factor" signal so that
// whenever the bash script (or any other process) changes the value, the indicator updates immediately.
// It also calls Indicator.popup(1) when the scale changes.
const scaleIndicator = OsdValue({
    name: 'Scale',
    extraClassName: 'osd-scale',
    extraProgressClassName: 'osd-scale-progress',
    labelSetup: (self) => {
        let previousScale = Scale.scaling_value;
        // Initialize label with the current value as a percentage.
        self.label = `${(previousScale * 100).toFixed(0)}`;
        // Connect to changes on the "text-scaling-factor".
        scaleSettings.connect("changed::text-scaling-factor", () => {
            const newScale = Scale.scaling_value;
            // Only trigger popup if the value has changed.
            if (newScale !== previousScale) {
                Indicator.popup(1);
                previousScale = newScale;
            }
            self.label = `${(newScale * 100).toFixed(0)}`;
        });
    },
    progressSetup: (self) => {
        let previousScale = Scale.scaling_value;
        // Initialize progress bar using a normalized fraction of the scaling value.
        const MIN_SCALE = 0.5;
        const MAX_SCALE = 2.0;
        self.value = Math.min(Math.max((previousScale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE), 0), 1);
        // Connect to changes on the scaling factor.
        scaleSettings.connect("changed::text-scaling-factor", () => {
            const newScale = Scale.scaling_value;
            if (newScale !== previousScale) {
                Indicator.popup(1);
                previousScale = newScale;
            }
            const fraction = (newScale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE);
            self.value = Math.min(Math.max(fraction, 0), 1);
        });
    },
});

// Export the indicator widget with brightness, volume, and the new scale indicator.
// The MarginRevealer uses a hook on the Indicator service to determine when to show or hide the indicator.
export default (monitor = 0) => {
    return MarginRevealer({
        transition: 'slide_down',
        showClass: 'osd-show',
        hideClass: 'osd-hide',
        extraSetup: (self) => self
            .hook(Indicator, (revealer, value) => {
                if (value > -1) revealer.attribute.show();
                else revealer.attribute.hide();
            }, 'popup'),
        child: Box({
            hpack: 'center',
            vertical: false,
            className: 'spacing-h--10',
            children: [
                brightnessIndicator,
                volumeIndicator,
                scaleIndicator // Current scale indicator appears with changes.
            ]
        })
    });
}
