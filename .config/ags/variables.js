const { Gdk, Gtk, GLib, Gio } = imports.gi;
import App from 'resource:///com/github/Aylur/ags/app.js'
import Hyprland from 'resource:///com/github/Aylur/ags/service/hyprland.js';
import Mpris from 'resource:///com/github/Aylur/ags/service/mpris.js';
import Variable from 'resource:///com/github/Aylur/ags/variable.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const { exec, execAsync } = Utils;

import { init as i18n_init, getString } from './i18n/i18n.js'
//init i18n, Load language file
i18n_init()
Gtk.IconTheme.get_default().append_search_path(`${App.configDir}/assets/icons`);
Gtk.IconTheme.get_default().append_search_path(`${App.configDir}/assets/anime`);

// Read initial mode from gsettings
const SCHEMA_ID = 'org.gnome.shell.extensions.ags';
const KEY_BAR_MODE = 'bar-mode';
const KEY_BAR_POSITION = 'bar-position';
const settings = new Gio.Settings({ schema_id: SCHEMA_ID });

const getInitialMode = () => {
    const monitors = Hyprland.monitors;
    const modes = {};
    const currentMode = settings.get_string(KEY_BAR_MODE) || "0";
    monitors.forEach((_, index) => modes[index] = currentMode);
    return modes;
};

// Initialize bar modes directly
export const currentShellMode = Variable(getInitialMode());
export const barPosition = Variable(settings.get_string(KEY_BAR_POSITION) || 'top');

// Mode switching
export const updateMonitorShellMode = (monitorShellModes, monitor, mode) => {
    const newValue = { ...monitorShellModes.value };
    newValue[monitor] = mode;
    monitorShellModes.value = newValue;
    settings.set_string(KEY_BAR_MODE, mode);
}

// Bar position toggle
globalThis['toggleBarPosition'] = () => {
    const currentMode = parseInt(currentShellMode.value[0]) || 0;
    const isVerticalMode = currentMode >= 9;

    const currentPosition = barPosition.value;
    let newPosition;

    if (isVerticalMode) {
        // Vertical modes can only toggle between left and right
        newPosition = currentPosition === 'left' ? 'right' : 'left';
    } else {
        // Horizontal modes can only toggle between top and bottom
        newPosition = currentPosition === 'top' ? 'bottom' : 'top';
    }

    settings.set_string(KEY_BAR_POSITION, newPosition);
    barPosition.value = newPosition;
};

// Global vars for external control (through keybinds)
export const showColorScheme = Variable(false, {})
globalThis['openColorScheme'] = showColorScheme;

globalThis['mpris'] = Mpris;
globalThis['getString'] = getString;
globalThis['currentShellMode'] = currentShellMode;
globalThis['updateMonitorShellMode'] = updateMonitorShellMode;
globalThis['barPosition'] = barPosition;
globalThis.runMatugen = async () => {
    try {
        await Utils.execAsync([`bash`, `-c`, `${App.configDir}/scripts/color_generation/colorgen.sh`]);
    } catch (error) {
        console.error("Error during color generation:", error);
    }
};

// Window controls
const range = (length, start = 1) => Array.from({ length }, (_, i) => i + start);
globalThis['toggleWindowOnAllMonitors'] = (name) => {
    range(Gdk.Display.get_default()?.get_n_monitors() || 1, 0).forEach(id => {
        App.toggleWindow(`${name}${id}`);
    });
}
globalThis['closeWindowOnAllMonitors'] = (name) => {
    range(Gdk.Display.get_default()?.get_n_monitors() || 1, 0).forEach(id => {
        App.closeWindow(`${name}${id}`);
    });
}
globalThis['openWindowOnAllMonitors'] = (name) => {
    range(Gdk.Display.get_default()?.get_n_monitors() || 1, 0).forEach(id => {
        App.openWindow(`${name}${id}`);
    });
}

globalThis['closeEverything'] = () => {
    const numMonitors = Gdk.Display.get_default()?.get_n_monitors() || 1;
    for (let i = 0; i < numMonitors; i++) {
        App.closeWindow(`cheatsheet${i}`);
        App.closeWindow(`session${i}`);
    }
    Utils.execAsync(`pkill rofi`);
    App.closeWindow('sideleft');
    App.closeWindow('sideright');
    App.closeWindow('overview');
    App.closeWindow('music');
    App.closeWindow('glance');
    App.closeWindow('recorder');
    App.closeWindow('wallselect');
};

// Watch for monitor changes and update modes
Hyprland.connect('notify::monitors', () => {
    const currentModes = currentShellMode.value;
    const newModes = {};

    // Keep existing modes for current monitors
    Hyprland.monitors.forEach((_, index) => {
        newModes[index] = currentModes[index];
    });

    currentShellMode.value = newModes;
});

globalThis['cycleMode'] = () => {
    const monitor = Hyprland.active.monitor.id || 0;
    const currentNum = parseInt(currentShellMode.value[monitor]) || 0;
    const nextMode = (currentNum + 1) % 6;
    updateMonitorShellMode(currentShellMode, monitor, nextMode.toString());
};

// Force immediate update to ensure mode is set
Utils.timeout(0, () => {
    const modes = currentShellMode.value;
    currentShellMode.value = { ...modes };
});
