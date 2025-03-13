const { Pango } = imports.gi;
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Notifications from 'resource:///com/github/Aylur/ags/service/notifications.js';
const { Box, Button, Label, Revealer, Scrollable, Stack } = Widget;
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';
import { setupCursorHover } from '../../.widgetutils/cursorhover.js';
import Notification from '../../.commonwidgets/notification.js';

export default (props) => {
    const notificationList = Box({
        vertical: true,
        vpack: 'start',
        className: 'spacing-v-5-revealer',
        setup: (self) => {
            Notifications.notifications.forEach(n => {
                self.pack_end(Notification({
                    notifObject: n,
                    isPopup: false,
                }), false, false, 0);
            });
            self.show_all();

            const notifiedId = Notifications.connect('notified', (_, id) => {
                const notif = Notifications.getNotification(id);
                if (notif) {
                    const newNotif = Notification({
                        notifObject: notif,
                        isPopup: false,
                    });
                    self.pack_end(newNotif, false, false, 0);
                    self.show_all();
                }
            });

            const closedId = Notifications.connect('closed', (_, id) => {
                if (!id) return;
                for (const ch of self.children) {
                    if (ch._id === id) {
                        ch.attribute.destroyWithAnims();
                        break;
                    }
                }
            });

            // Cleanup signals on widget destruction
            self.connect('destroy', () => {
                Notifications.disconnect(notifiedId);
                Notifications.disconnect(closedId);
            });
        },
    });

    const ListActionButton = (icon, name, action) => Button({
        className: 'sidebar-centermodules-bottombar-button',
        onClicked: action,
        child: Box({
            hpack: 'center',
            className: 'spacing-h-5',
            children: [
                MaterialIcon(icon, 'norm'),
                Label({
                    className: 'txt-small',
                    label: name,
                    wrapMode: Pango.WrapMode.WORD_CHAR,
                }),
            ],
        }),
        setup: setupCursorHover,
    });

    const clearButton = Revealer({
        transition: 'slide_right',
        transitionDuration: userOptions.asyncGet().animations.durationSmall,
        setup: (self) => {
            const updateVisibility = () => {
                self.revealChild = Notifications.notifications.length > 0;
            };
            const notifiedId = Notifications.connect('notified', updateVisibility);
            const closedId = Notifications.connect('closed', updateVisibility);
            self.connect('destroy', () => {
                Notifications.disconnect(notifiedId);
                Notifications.disconnect(closedId);
            });

            // Initial update
            updateVisibility();
        },
        child: ListActionButton('clear_all', getString('Clear'), () => {
            Notifications.clear();
            const kids = notificationList.get_children();
            for (let i = 0; i < kids.length; i++) {
                const kid = kids[i];
                Utils.timeout(userOptions.asyncGet().animations.choreographyDelay * i, () => {
                    if (kid.attribute && kid.attribute.destroyWithAnims) {
                        kid.attribute.destroyWithAnims();
                    }
                });
            }
        }),
    });
    const listTitle = Box({
        vpack: 'start',
        className: 'txt spacing-h-5',
        children: [
            Box({ hexpand: true }),
            clearButton,
        ],
    });

    const notifList = Scrollable({
        hexpand: true,
        hscroll: 'never',
        vscroll: 'automatic',
        child: Box({
            vexpand: true,
            homogeneous: true,
            children: [notificationList],
        }),
        setup: (self) => {
            const vScrollbar = self.get_vscrollbar();
            vScrollbar.get_style_context().add_class('sidebar-scrollbar');
        },
    });
    // const notifEmptyContent = Box({
    //     children: [
    //         Box({
    //             vertical: true,
    //             vpack: 'center',
    //             children: [
    //                 Box({
    //                     vertical: true,
    //                     className: 'txt-primary',
    //                     opacity: 0.3,
    //                     hpack: 'end',
    //                     children: [
    //                         MaterialIcon('relax', 'gigantic', { css: `font-size: 6rem` }),
    //                         Label({ label: getString('No notifications'), className: 'txt-norm', wrapMode: Pango.WrapMode.WORD_CHAR, }),
    //                     ]
    //                 }),
    //             ]
    //         })]
    // });

    const listContents = Stack({
        transition: 'crossfade',
        transitionDuration: userOptions.asyncGet().animations.durationLarge,
        children: {
            'empty': Box(),
            'list': notifList,
        },
        setup: (self) => {
            const updateVisibility = () => {
                self.shown = Notifications.notifications.length > 0 ? 'list' : 'empty';
            };

            // Hook into notification signals
            const notifiedId = Notifications.connect('notified', updateVisibility);
            const closedId = Notifications.connect('closed', updateVisibility);

            // Cleanup signals on widget destruction
            self.connect('destroy', () => {
                Notifications.disconnect(notifiedId);
                Notifications.disconnect(closedId);
            });

            // Initial update
            updateVisibility();
        },
    });

    return Box({
        ...props,
        className: 'spacing-v-5',
        vertical: true,
        children: [
            listContents,
            listTitle,
        ],
    });
};