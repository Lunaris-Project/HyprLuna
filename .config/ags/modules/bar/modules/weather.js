import Widget from "resource:///com/github/Aylur/ags/widget.js";
const { Box, EventBox, Stack } = Widget;
const { GLib } = imports.gi;
import { MaterialIcon } from "../../.commonwidgets/materialicon.js";
import PrayerTimesWidget from './prayertimes.js';
import WeatherOnly from './weatherOnly.js';
import Media from 'resource:///com/github/Aylur/ags/service/mpris.js';
import Notifications from 'resource:///com/github/Aylur/ags/service/notifications.js';
import Clock from './inline_clock.js';

const userName = GLib.get_real_name() + " ~ " + GLib.get_user_name();

const WeatherWidget = () => {
    const CYCLE_INTERVAL = 10000;
    const PRIORITY_DISPLAY_TIME = 3000; // Duration to display the notification mode

    let displayMode = 'weather';
    let previousMode = displayMode;
    let lastTitle = null;
    let cycleTimeout = null;

    // Media components
    const mediaIcon = MaterialIcon('music_note', 'large txt-norm txt-onLayer1');
    const mediaTitleLabel = Widget.Label({
        className: 'txt-norm txt-onLayer1',
    });

    // Notification components (stacked vertically)
    const notificationIcon = MaterialIcon('notifications', 'large txt-norm txt-onLayer1');
    const notificationTitleLabel = Widget.Label({
        className: 'txt-norm txt-onLayer1',
    });
    const notificationBodyLabel = Widget.Label({
        className: 'txt-small txt-onLayer1',
    });
    // Use CSS class "spacing-v-4" (for example) to vertically space elements
    const notificationContent = Box({
        className: 'content-box spacing-v-4', // CSS should handle vertical layout here
        children: [
            notificationIcon,
            notificationTitleLabel,
            notificationBodyLabel
        ]
    });

    const usernameContent = Box({
        className: 'content-box',
        hpack: 'center',
        child: Widget.Label({ className: 'txt-norm txt-onLayer1', label: userName })
    });

    const clockContent = Box({
        className: 'content-box',
        hpack: "center",
        child: Clock()
    });

    // Main content stack with various modes
    const contentStack = Stack({
        transition: 'slide_up_down',
        transitionDuration: userOptions.asyncGet().animations.durationSmall,
        css: `padding: 0 20px`,
        hpack: 'center',
        hexpand: true,
        children: {
            'weather': WeatherOnly(),
            'prayer': PrayerTimesWidget(),
            'media': Box({
                className: 'content-box spacing-h-4',
                hpack: 'center',
                children: [mediaIcon, mediaTitleLabel]
            }),
            'notification': notificationContent,
            'clock': clockContent,
            'username': usernameContent,
        },
        shown: displayMode
    });

    const cycleModes = () => {
        const modes = ['weather', 'prayer', 'media', 'clock', 'username'];
        const currentIndex = modes.indexOf(displayMode);
        previousMode = displayMode;
        displayMode = modes[(currentIndex + 1) % modes.length];
        contentStack.shown = displayMode;
    };

    const startAutoCycle = () => {
        if (cycleTimeout) GLib.source_remove(cycleTimeout);
        cycleTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, CYCLE_INTERVAL, () => {
            cycleModes();
            return GLib.SOURCE_CONTINUE;
        });
    };

    return Widget.EventBox({
        onPrimaryClick: () => {
            cycleModes();
            startAutoCycle();
        },
        child: Box({
            className: 'complex-status',
            hexpand: true,
            hpack: 'center',
            child: contentStack,
            setup: self => {
                // Hook into Media changes
                self.hook(Media, () => {
                    const title = Media.title || 'Silent Mode';
                    if (title !== lastTitle) {
                        mediaTitleLabel.label = title;
                    }
                    lastTitle = title;
                }, 'changed');

                // Hook into Notifications
                self.hook(Notifications, (box, id) => {
                    const notifications = Notifications.notifications;
                    if (notifications.length > 0) {
                        // Set the notification title and body separately.
                        notificationTitleLabel.label = notifications[0].summary || "Unknown Notification";
                        // notificationBodyLabel.label = notifications[0].body || "";
                        previousMode = displayMode;
                        displayMode = 'notification';
                        contentStack.shown = 'notification';
                        self.toggleClassName('notification-active', true);
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, PRIORITY_DISPLAY_TIME, () => {
                            displayMode = previousMode;
                            contentStack.shown = previousMode;
                            self.toggleClassName('notification-active', false);
                            GLib.timeout_add(GLib.PRIORITY_DEFAULT, PRIORITY_DISPLAY_TIME, () => {
                                self.toggleClassName('notification-deactivate', true);
                                return GLib.SOURCE_REMOVE;
                            });
                            return GLib.SOURCE_REMOVE;
                        });
                    }
                }, 'notified');

                startAutoCycle();
            }
        })
    });
};

export default WeatherWidget;
