import Widget from "resource:///com/github/Aylur/ags/widget.js";
import Mpris from "resource:///com/github/Aylur/ags/service/mpris.js";

const MediaIndicator = () => Widget.Box({
    className: 'bar-media-indicator',
    visible: false,
    homogeneous: false,
    setup: self => {
        const label = Widget.Label({
            className: 'onSurfaceVariant txt-smallie',
        });

        const icon = Widget.Icon({
            className: 'onSurfaceVariant txt-smallie',
            icon: '', // Default icon
        });

        self.children = [icon, label];
        self.spacing = 8;
        const updateWidget = () => {
            const player = Mpris.players.find(p => p.identity === 'spotify') || Mpris.getPlayer();
            const trackInfo = player?.trackTitle;
            const playbackStatus = player?.playBackStatus;

            if (!player || !trackInfo) {
                self.visible = false;
                return;
            }

            self.visible = true;
            label.label = trackInfo;

            // Update the icon based on playback status
            if (playbackStatus === 'Playing') {
                icon.icon = 'media-playback-pause-symbolic';
            } else if (playbackStatus === 'Paused') {
                icon.icon = 'media-playback-start-symbolic';
            } else {
                icon.icon = 'media-playback-start-symbolic'; // Default icon
            }
        };

        const handlers = [
            Mpris.connect('player-changed', updateWidget),
            Mpris.connect('changed', updateWidget),
        ];

        self.connect('destroy', () => {
            handlers.forEach(handler => {
                try {
                    Mpris.disconnect(handler);
                } catch (error) {
                    console.error('Error disconnecting handler:', error);
                }
            });
        });

        updateWidget();
    },
});

export default () => Widget.EventBox({
    className: 'onSurfaceVariant txt-smallie',
    hpack: "center",
    hexpand: true,
    onPrimaryClick: () => {
        const player = Mpris.players.find(p => p.identity === 'spotify') || Mpris.getPlayer();
        if (player) {
            player.playPause();
        }
    },
    onSecondaryClick: () => App.toggleWindow('music'),
    child: MediaIndicator(),
});
