const { Gio, GLib } = imports.gi;
import Variable from 'resource:///com/github/Aylur/ags/variable.js';
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import { ConfigToggle, ConfigMulipleSelection } from '../.commonwidgets/configwidgets.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const { execAsync } = Utils;
import { setupCursorHover } from '../.widgetutils/cursorhover.js';
import { showColorScheme } from '../../variables.js';
import { MaterialIcon } from '../.commonwidgets/materialicon.js';
import { darkMode } from '../.miscutils/system.js';
import { RoundedCorner } from '../.commonwidgets/cairo_roundedcorner.js';

const SessionButton = (name, icon, command, props = {}, colorid = 0) => {
    const buttonDescription = Widget.Revealer({
        vpack: 'end',
        transitionDuration: userOptions.asyncGet().animations.durationSmall,
        transition: 'slide_down',
        revealChild: false,
        child: Widget.Label({
            className: 'txt-smaller session-button-desc',
            label: name,
        }),
    });
    return Widget.Button({
        onClicked: command,
        className: `session-button session-color-${colorid}`,
        child: Widget.Overlay({
            className: 'session-button-box',
            child: Widget.Label({
                vexpand: true,
                className: 'icon-material',
                label: icon,
            }),
            overlays: [
                buttonDescription,
            ]
        }),
        onHover: (button) => {
            const display = Gdk.Display.get_default();
            const cursor = Gdk.Cursor.new_from_name(display, 'pointer');
            button.get_window().set_cursor(cursor);
            buttonDescription.revealChild = true;
        },
        onHoverLost: (button) => {
            const display = Gdk.Display.get_default();
            const cursor = Gdk.Cursor.new_from_name(display, 'default');
            button.get_window().set_cursor(cursor);
            buttonDescription.revealChild = false;
        },
        setup: (self) => self
            .on('focus-in-event', (self) => {
                buttonDescription.revealChild = true;
                self.toggleClassName('session-button-focused', true);
            })
            .on('focus-out-event', (self) => {
                buttonDescription.revealChild = false;
                self.toggleClassName('session-button-focused', false);
            })
        ,
        ...props,
    });
}

const lockButton = SessionButton(getString('Lock'), 'lock', () => { closeWindowOnAllMonitors('session'); execAsync(['loginctl', 'lock-session']).catch(print) }, {}, 1);
const logoutButton = SessionButton(getString('Logout'), 'logout', () => { closeWindowOnAllMonitors('session'); execAsync(['bash', '-c', 'pkill Hyprland || pkill sway || pkill niri || loginctl terminate-user $USER']).catch(print) }, {}, 2);
const sleepButton = SessionButton(getString('Sleep'), 'sleep', () => { closeWindowOnAllMonitors('session'); execAsync(['bash', '-c', 'systemctl suspend || loginctl suspend']).catch(print) }, {}, 3);
// hibernate, shutdown, reboot
const hibernateButton = SessionButton(getString('Hibernate'), 'downloading', () => { closeWindowOnAllMonitors('session'); execAsync(['bash', '-c', 'systemctl hibernate || loginctl hibernate']).catch(print) }, {}, 4);
const shutdownButton = SessionButton(getString('Shutdown'), 'power_settings_new', () => { closeWindowOnAllMonitors('session'); execAsync(['bash', '-c', 'systemctl poweroff || loginctl poweroff']).catch(print) }, {}, 5);
const rebootButton = SessionButton(getString('Reboot'), 'restart_alt', () => { closeWindowOnAllMonitors('session'); execAsync(['bash', '-c', 'systemctl reboot || loginctl reboot']).catch(print) }, {}, 6);
const cancelButton = SessionButton(getString('Cancel'), 'close', () => closeWindowOnAllMonitors('session'), { className: 'session-button-cancel' }, 7);

const PowerMenu = () => Widget.Box({
    className: 'power-menu ',
    children: [
        lockButton,
         logoutButton,
        sleepButton,
         hibernateButton,
        shutdownButton,
        rebootButton,
         cancelButton,
    ],
})
export default () => Widget.Revealer({
    transition: 'slide_down',
    transitionDuration: userOptions.asyncGet().animations.durationLarge,
    child: PowerMenu(),
})
