const { GLib } = imports.gi;
import App from 'resource:///com/github/Aylur/ags/app.js';
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import Bluetooth from 'resource:///com/github/Aylur/ags/service/bluetooth.js';
import Network from 'resource:///com/github/Aylur/ags/service/network.js';
import { BluetoothIndicator, NetworkIndicator } from '../../.commonwidgets/statusicons.js';
import { setupCursorHover } from '../../.widgetutils/cursorhover.js';
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';
import { calendarRevealer } from '../sideright.js';


const { execAsync, exec } = Utils;
const userOpts = userOptions.asyncGet();
const configDir = App.configDir;

export const ToggleIconWifi = (props = {}) => {
    const button = Widget.Button({
        className: 'txt-small sidebar-iconbutton',
        tooltipText: getString('Wifi | Right-click to configure'),
        onClicked: Network.toggleWifi,
        onSecondaryClickRelease: () => {
            execAsync(['bash', '-c', userOpts.apps.network]).catch(print);
            closeEverything();
        },
        child: NetworkIndicator(),
        setup: (self) => {
            setupCursorHover(self);
            self.hook(Network, button => {
                const isConnected = [Network.wifi?.internet, Network.wired?.internet].includes('connected');
                button.toggleClassName('sidebar-button-active', isConnected);
                button.tooltipText = `${Network.wifi?.ssid || getString('Unknown')} | ${getString("Right-click to configure")}`;
            });
        },
        ...props,
    });
    return button;
};

export const ToggleIconBluetooth = (props = {}) => {
    const button = Widget.Button({
        className: 'txt-small sidebar-iconbutton', 
        tooltipText: getString('Bluetooth | Right-click to configure'),
        onClicked: () => {
            exec(Bluetooth?.enabled ? 'rfkill block bluetooth' : 'rfkill unblock bluetooth');
        },
        onSecondaryClickRelease: () => {
            execAsync(['bash', '-c', userOpts.apps.bluetooth]).catch(print);
            closeEverything();
        },
        child: BluetoothIndicator(),
        setup: (self) => {
            setupCursorHover(self);
            self.hook(Bluetooth, button => {
                button.toggleClassName('sidebar-button-active', Bluetooth?.enabled)
            });
        },
        ...props,
    });
    return button;
};

const hyprctl = (cmd) => execAsync(['hyprctl', ...cmd.split(' ')]).catch(print);
const getHyprOption = async (opt) => JSON.parse(await Utils.execAsync(`hyprctl -j getoption ${opt}`));

export const HyprToggleIcon = async (icon, name, hyprlandConfigValue, props = {}) => {
    try {
        const button = Widget.Button({
            className: 'txt-small sidebar-iconbutton',
            tooltipText: name,
            onClicked: async (button) => {
                const currentOption = (await getHyprOption(hyprlandConfigValue)).int;
                await hyprctl(`keyword ${hyprlandConfigValue} ${1 - currentOption}`);
                button.toggleClassName('sidebar-button-active', currentOption == 0);
            },
            child: MaterialIcon(icon, 'norm', { hpack: 'center' }),
            setup: async (button) => {
                const value = (await getHyprOption(hyprlandConfigValue)).int == 1;
                button.toggleClassName('sidebar-button-active', value);
                setupCursorHover(button);
            },
            ...props,
        });
        return button;
    } catch {
        return null;
    }
}

export const ModuleNightLight = async (props = {}) => {
    if (!exec(`bash -c 'command -v gammastep'`)) return null;
    
    const button = Widget.Button({
        attribute: { enabled: false },
        className: 'txt-small sidebar-iconbutton',
        tooltipText: getString('Night Light'),
        onClicked: async (self) => {
            self.attribute.enabled = !self.attribute.enabled;
            self.toggleClassName('sidebar-button-active', self.attribute.enabled);
            
            if (self.attribute.enabled) {
                await execAsync('gammastep').catch(print);
            } else {
                self.sensitive = false;
                await execAsync('pkill gammastep').catch(print);
                const checkInterval = setInterval(() => {
                    execAsync('pkill -0 gammastep').catch(() => {
                        self.sensitive = true;
                        clearInterval(checkInterval);
                    });
                }, 500);
            }
        },
        child: MaterialIcon('nightlight', 'norm'),
        setup: (self) => {
            setupCursorHover(self);
            self.attribute.enabled = !!exec('pidof gammastep');
            self.toggleClassName('sidebar-button-active', self.attribute.enabled);
        },
        ...props,
    });
    return button;
}

export const ModuleCloudflareWarp = async (props = {}) => {
    if (!exec(`bash -c 'command -v warp-cli'`)) return null;
    
    const button = Widget.Button({
        attribute: { enabled: false },
        className: 'txt-small sidebar-iconbutton',
        tooltipText: getString('Cloudflare WARP'),
        onClicked: async (self) => {
            self.attribute.enabled = !self.attribute.enabled;
            self.toggleClassName('sidebar-button-active', self.attribute.enabled);
            await execAsync(`warp-cli ${self.attribute.enabled ? 'connect' : 'disconnect'}`).catch(print);
        },
        child: Widget.Icon({
            icon: 'cloudflare-dns-symbolic',
            className: 'txt-norm',
        }),
        setup: (self) => {
            setupCursorHover(self);
            self.attribute.enabled = !exec(`bash -c 'warp-cli status | grep Disconnected'`);
            self.toggleClassName('sidebar-button-active', self.attribute.enabled);
        },
        ...props,
    });
    return button;
}


export const ModuleRawInput = async (props = {}) => {
    try {
        const Hyprland = (await import('resource:///com/github/Aylur/ags/service/hyprland.js')).default;
        
        return Widget.Button({
            className: 'txt-small sidebar-iconbutton',
            tooltipText: 'Raw input',
            onClicked: async (button) => {
                const output = await Hyprland.messageAsync('j/getoption input:accel_profile');
                const value = JSON.parse(output)["str"].trim();
                const newValue = (value != "[[EMPTY]]" && value != "") ? '[[EMPTY]]' : 'flat';
                
                await Hyprland.messageAsync(`j/keyword input:accel_profile ${newValue}`).catch(print);
                button.toggleClassName('sidebar-button-active', newValue !== '[[EMPTY]]');
            },
            child: MaterialIcon('mouse', 'norm'),
            setup: setupCursorHover,
            ...props,
        });
    } catch {
        return null;
    }
}

export const ToggleIconCalendar = (props = {}) => Widget.Button({
    className: 'txt-small sidebar-iconbutton',
    onClicked: (self) => {
        calendarRevealer.revealChild = !calendarRevealer.revealChild;
        self.toggleClassName('sidebar-button-active', calendarRevealer.revealChild);
    },
    child: MaterialIcon('calendar_month', 'norm'),
    setup: (self) => {
        setupCursorHover(self);
        
        // Set initial state from revealer's current status
        self.toggleClassName(
            'sidebar-button-active', 
            calendarRevealer.revealChild
        );

        // Update button state when revealer changes
        self.hook(calendarRevealer, () => {
            self.toggleClassName(
                'sidebar-button-active',
                calendarRevealer.revealChild
            );
        }, 'notify::reveal-child');
    },
});
export const ModuleIdleInhibitor = (props = {}) => {
    const scriptPath = `${configDir}/scripts/wayland-idle-inhibitor.py`;
    
    return Widget.Button({
        attribute: { enabled: false },
        className: 'txt-small sidebar-iconbutton',
        tooltipText: getString('Keep system awake'),
        onClicked: async (self) => {
            self.attribute.enabled = !self.attribute.enabled;
            self.toggleClassName('sidebar-button-active', self.attribute.enabled);
            
            if (self.attribute.enabled) {
                await execAsync(['bash', '-c', `pidof wayland-idle-inhibitor.py || ${scriptPath}`]).catch(print);
            } else {
                await execAsync('pkill -f wayland-idle-inhibitor.py').catch(print);
            }
        },
        child: MaterialIcon('coffee', 'norm'),
        setup: (self) => {
            setupCursorHover(self);
            self.attribute.enabled = !!exec('pidof wayland-idle-inhibitor.py');
            self.toggleClassName('sidebar-button-active', self.attribute.enabled);
        },
        ...props,
    });
}

export const ModuleReloadIcon = (props = {}) => Widget.Button({
    ...props,
    className: 'txt-small sidebar-iconbutton',
    tooltipText: getString('Reload Environment config'),
    onClicked: async () => {
        await execAsync(['bash', '-c', 'hyprctl reload || swaymsg reload &']);
        App.closeWindow('sideright');
    },
    child: MaterialIcon('refresh', 'norm'),
    setup: setupCursorHover
});

export const ModuleSettingsIcon = ({ hpack = 'center' } = {}) => Widget.Button({
    hpack: hpack,
    className: 'txt-norm icon-material sidebar-iconbutton',
    tooltipText: 'AGS Settings',
    label: 'settings',
    onClicked: () => {
        App.closeWindow('sideright');
        Utils.execAsync(['bash', '-c', `${GLib.get_home_dir()}/.local/bin/ags-tweaks`]).catch(print);
    }
});
export const ModuleGameMode = async (props = {}) => {
    try {
        return Widget.Button({
            className: 'txt-small sidebar-iconbutton',
            tooltipText: getString('Hyprland Game Mode'),
            onClicked: (button) => {
                Utils.execAsync(`hyprctl -j getoption animations:enabled`)
                    .then((output) => {
                        const enabled = JSON.parse(output)["int"] === 1;
                        if (enabled) {
                            execAsync(['bash', '-c', `hyprctl --batch "keyword animations:enabled 0; keyword decoration:shadow:enabled 0; keyword decoration:blur:enabled 0; keyword general:gaps_in 0; keyword general:gaps_out 0; keyword general:border_size 1; keyword decoration:rounding 0; keyword general:allow_tearing 1"`]).catch(print);
                        } else {
                            execAsync(['bash', '-c', `hyprctl reload`]).catch(print);
                        }
                        button.toggleClassName('sidebar-button-active', enabled);
                    })
            },
            child: Widget.Label({label: 'gamepad', hpack: 'center', className: 'onSurfaceVariant icon-material txt-norm'}),
            setup: setupCursorHover,
            ...props,
        })
    } catch {
        return null;
    };
}

export const ModulePowerIcon = async  (props = {}) => Widget.Button({
    ...props,
    className: 'txt-small sidebar-iconbutton',
    tooltipText: getString('Session'),
    onClicked: () => {
        closeEverything();
        Utils.timeout(1, () => openWindowOnAllMonitors('session'));
    },
    child: MaterialIcon('power_settings_new', 'norm'),
    setup: setupCursorHover
});
