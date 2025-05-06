// This is for the cool memory indicator on the sidebar
// For the right pill of the bar, see system.js
const { Gdk, Gtk } = imports.gi;
import App from 'resource:///com/github/Aylur/ags/app.js';
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import { monitors } from '../.commondata/hyprlanddata.js';

const { exec, execAsync } = Utils;

// Make sure closeWindowOnAllMonitors is defined
// This function is defined globally in variables.js but we'll check for it here
if (!globalThis.closeWindowOnAllMonitors) {
    globalThis.closeWindowOnAllMonitors = (name) => {
        const range = (length, start = 0) => Array.from({ length }, (_, i) => i + start);
        const numMonitors = Gdk.Display.get_default()?.get_n_monitors() || 1;
        range(numMonitors).forEach((id) => {
            App.closeWindow(`${name}${id}`);
        });
    };
}

// Utility function for system actions
const systemAction = async (action, fallback = null) => {
    try {
        // First try systemctl (systemd)
        const systemctlCmd = {
            'lock': null, // No systemctl equivalent, use loginctl
            'logout': null, // No systemctl equivalent, handle separately
            'suspend': 'systemctl suspend',
            'hibernate': 'systemctl hibernate',
            'reboot': 'systemctl reboot',
            'shutdown': 'systemctl poweroff'
        };

        // Fallback to loginctl if systemctl fails
        const loginctlCmd = {
            'lock': 'loginctl lock-session',
            'logout': 'loginctl terminate-user $USER',
            'suspend': 'loginctl suspend',
            'hibernate': 'loginctl hibernate',
            'reboot': 'loginctl reboot',
            'shutdown': 'loginctl poweroff'
        };

        // Special case for logout which needs to handle different WMs
        if (action === 'logout') {
            await execAsync(['bash', '-c', 'pkill Hyprland || pkill sway || pkill niri || loginctl terminate-user $USER']).catch(print);
            return;
        }

        // For lock, just use loginctl directly
        if (action === 'lock') {
            await execAsync(['loginctl', 'lock-session']).catch(print);
            return;
        }

        // Try systemctl first if available
        if (systemctlCmd[action]) {
            try {
                await execAsync(['bash', '-c', systemctlCmd[action]]);
                return;
            } catch (e) {
                console.log(`systemctl ${action} failed, trying loginctl...`);
            }
        }

        // Fall back to loginctl
        await execAsync(['bash', '-c', loginctlCmd[action]]).catch(print);

    } catch (e) {
        console.error(`Failed to execute ${action}:`, e);
        // Try custom fallback if provided
        if (fallback) {
            try {
                await execAsync(['bash', '-c', fallback]).catch(print);
            } catch (e) {
                console.error(`Fallback for ${action} also failed:`, e);
            }
        }
    }
};

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

export default ({ id = 0 }) => {
    // lock, logout, sleep
    const lockButton = SessionButton(
        getString('Lock'),
        'lock',
        () => {
            App.closeWindow(`session${id}`);
            systemAction('lock');
        },
        {},
        1
    );

    const logoutButton = SessionButton(
        getString('Logout'),
        'logout',
        () => {
            App.closeWindow(`session${id}`);
            systemAction('logout');
        },
        {},
        2
    );

    const sleepButton = SessionButton(
        getString('Sleep'),
        'bedtime', // Better icon for sleep/suspend
        () => {
            App.closeWindow(`session${id}`);
            systemAction('suspend');
        },
        {},
        3
    );

    // hibernate, shutdown, reboot
    const hibernateButton = SessionButton(
        getString('Hibernate'),
        'mode_standby', // Better icon for hibernate
        () => {
            App.closeWindow(`session${id}`);
            systemAction('hibernate');
        },
        {},
        4
    );

    const shutdownButton = SessionButton(
        getString('Shutdown'),
        'power_settings_new',
        () => {
            App.closeWindow(`session${id}`);
            systemAction('shutdown');
        },
        {},
        5
    );

    const rebootButton = SessionButton(
        getString('Reboot'),
        'restart_alt',
        () => {
            App.closeWindow(`session${id}`);
            systemAction('reboot');
        },
        {},
        6
    );

    const cancelButton = SessionButton(
        getString('Cancel'),
        'close',
        () => App.closeWindow(`session${id}`),
        { className: 'session-button-cancel' },
        7
    );

    const sessionDescription = Widget.Box({
        vertical: true,
        css: 'margin-bottom: 0.682rem;',
        children: [
            Widget.Label({
                className: 'txt-title txt',
                label: getString('Session'),
            }),
            Widget.Label({
                justify: Gtk.Justification.CENTER,
                className: 'txt-small txt',
                label: getString('Use arrow keys to navigate.\nEnter to select, Esc to cancel.')
            }),
        ]
    });
    const SessionButtonRow = (children) => Widget.Box({
        hpack: 'center',
        className: 'spacing-h-15',
        children: children,
    });
    // Arrange buttons in a more logical order
    const sessionButtonRows = [
        // First row: Lock, Sleep, Hibernate (user state actions)
        SessionButtonRow([lockButton, sleepButton, hibernateButton]),
        // Second row: Logout, Reboot, Shutdown (system state actions)
        SessionButtonRow([logoutButton, rebootButton, shutdownButton]),
        // Third row: Cancel button
        SessionButtonRow([cancelButton]),
    ]
    return Widget.Box({
        className: 'session-bg',
        css: `
        min-width: ${monitors[id].width}px;
        min-height: ${monitors[id].height}px;
        `, // idk why but height = screen height doesn't fill
        vertical: true,
        children: [
            Widget.EventBox({
                onPrimaryClick: () => App.closeWindow(`session${id}`),
                onSecondaryClick: () => App.closeWindow(`session${id}`),
                onMiddleClick: () => App.closeWindow(`session${id}`),
            }),
            Widget.Box({
                hpack: 'center',
                vexpand: true,
                vertical: true,
                children: [
                    Widget.Box({
                        vpack: 'center',
                        vertical: true,
                        className: 'spacing-v-15',
                        children: [
                            sessionDescription,
                            ...sessionButtonRows,
                        ]
                    })
                ]
            })
        ],
        setup: (self) => self
            .hook(App, (_b, _name, visible) => {
                if (visible) lockButton.grab_focus(); // Lock is the safest default option
            })
        ,
    });
}
