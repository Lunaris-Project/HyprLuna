import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Audio from 'resource:///com/github/Aylur/ags/service/audio.js';

const VolumeIndicator = () => {
    let updateTimeout = null;

    const getVolumeIcon = volume => {
        const percent = volume * 100;
        if (Audio.speaker?.is_muted)
            return 'volume_off';
        if (percent >= 70)
            return 'volume_up';
        if (percent >= 40)
            return 'volume_down';
        if (percent >= 1)
            return 'volume_mute';
        return 'volume_off';
    };

    const getVolumeCSS = volume => {
        const percent = volume * 100;
        return `margin-bottom: ${Math.max(0.5, percent / 100)}rem;`;
    };

    const slider = Widget.Slider({
        class_name: 'indicator-volume-slider',
        draw_value: false,
        orientation: 1,
        inverted: true,
        value: Audio.speaker?.volume || 0,
        on_change: ({ value }) => {
            if (Audio.speaker) {
                Audio.speaker.volume = value;
            }
        },
    });

    const iconLabel = Widget.Label({
        hpack: 'center',
        hexpand: true,
        vexpand: true,
        vpack: 'end',
        css:`margin-bottom: -0.5rem;`,
        class_name: 'volume-indicator icon-material',
        label: getVolumeIcon(Audio.speaker?.volume || 0),
    });

    const icon = Widget.Box({
        class_name: 'volume-icon',
        hpack: 'center',
        hexpand: true,
        child: iconLabel,
    });

    const overlay = Widget.Overlay({
        child: slider,
        overlays: [icon],
        setup: self => self.set_overlay_pass_through(icon, true),
    });

    const indicator = Widget.Box({
        class_name: 'volume-indicator',
        child: overlay,
    });

    const widget = Widget.Box({
        child: indicator,
        setup: self => {
            // Store signal handler IDs for cleanup
            let audioHandler = null;
            
            // Set up hooks and connections
            audioHandler = Audio.speaker?.connect?.('changed', () => {
                const volume = Audio.speaker?.volume || 0;
                updateValue(volume);
            });
            
            // Clean up resources on destroy
            self.connect('destroy', () => {
                // Clean up the timeout
                if (updateTimeout) {
                    clearTimeout(updateTimeout);
                    updateTimeout = null;
                }
                
                // Safely disconnect audio handler
                if (audioHandler && Audio.speaker) {
                    if (globalThis.safeDisconnect) {
                        globalThis.safeDisconnect(Audio.speaker, audioHandler);
                    } else {
                        try {
                            Audio.speaker.disconnect(audioHandler);
                        } catch (e) {
                            console.log("Failed to disconnect audio handler:", e);
                        }
                    }
                    audioHandler = null;
                }
            });
            
            // Window toggled hook
            self.hook(App, (_, windowName, visible) => {
                if (windowName === 'volume-indicator' && !visible && updateTimeout) {
                    clearTimeout(updateTimeout);
                    updateTimeout = null;
                }
            }, 'window-toggled');
        }
    });

    const updateValue = value => {
        if (updateTimeout) {
            clearTimeout(updateTimeout);
        }
        
        updateTimeout = setTimeout(() => {
            slider.value = value;
            iconLabel.label = getVolumeIcon(value);
            iconLabel.css = getVolumeCSS(value);
            updateTimeout = null;
        }, 50);
    };

    // Initial value
    updateValue(Audio.speaker?.volume || 0);

    return {
        widget,
        updateValue,
    };
};

export default VolumeIndicator;