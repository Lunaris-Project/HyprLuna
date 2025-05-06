const { Gtk, Gio, GLib } = imports.gi;
import Gdk from "gi://Gdk";
import App from "resource:///com/github/Aylur/ags/app.js";
import Hyprland from "resource:///com/github/Aylur/ags/service/hyprland.js";
import Mpris from "resource:///com/github/Aylur/ags/service/mpris.js";
import Variable from "resource:///com/github/Aylur/ags/variable.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";

import { init as i18n_init, getString } from "./i18n/i18n.js";
//init i18n, Load language file
i18n_init();
Gtk.IconTheme.get_default().append_search_path(`${App.configDir}/assets/icons`);
Gtk.IconTheme.get_default().append_search_path(`${App.configDir}/assets/anime`);

// Import monitor detection
import { monitorSetup } from "./modules/.commondata/monitordetection.js";

// Read initial mode from gsettings
const SCHEMA_ID = "org.gnome.shell.extensions.ags";
const KEY_BAR_MODE = "bar-mode";
const KEY_BAR_POSITION = "bar-position";
const settings = new Gio.Settings({ schema_id: SCHEMA_ID });

const getInitialMode = () => {
  const monitors = Hyprland.monitors;
  const modes = {};
  const savedMode = settings.get_string(KEY_BAR_MODE) || "0";

  // We'll set modes for all monitors regardless of target

  // Set the mode for all monitors
  monitors.forEach((monitor) => {
    const monitorId = monitor.id;
    // Initialize all monitors with the saved mode for consistency
    modes[monitorId] = savedMode;
  });

  // Ensure monitor 0 has the saved mode (for compatibility)
  modes[0] = savedMode;

  return modes;
};

// Initialize bar modes directly
export const currentShellMode = Variable(getInitialMode());
export const barPosition = Variable(
  settings.get_string(KEY_BAR_POSITION) || "top",
);

// Initialize bar monitor mode from user options
import userOptions from "./modules/.configuration/user_options.js";

// Function to find a monitor by name or fall back to any available monitor
export const findMonitorByName = (monitorName) => {
  // Get all available monitors
  const allMonitors = Hyprland.monitors;

  // If there's only one monitor, just return monitor 0 without any logging
  if (allMonitors.length <= 1) {
    return 0;
  }

  // If monitorName is "primary", return the primary monitor ID
  if (monitorName === "primary") {
    return monitorSetup.value.primary;
  }

  // Try to find the monitor by name
  const foundMonitor = allMonitors.find(monitor => monitor.name === monitorName);

  if (foundMonitor) {
    return foundMonitor.id;
  }

  // If monitor not found, fall back to any available monitor without logging
  // First try primary, then monitor 0
  return monitorSetup.value.primary || 0;
};

export const barMonitorMode = Variable(
  userOptions.asyncGet().bar.monitorMode || "primary",
);

// Mode switching
export const updateMonitorShellMode = (monitorShellModes, monitor, mode) => {
  // Get all available monitors
  const allMonitors = Hyprland.monitors;

  // Get the target monitor based on barMonitorMode
  const targetMonitorName = barMonitorMode.value;
  const targetMonitor = findMonitorByName(targetMonitorName);

  // Update the mode for the specified monitor
  const newValue = { ...monitorShellModes.value };

  // Update the target monitor with the new mode
  newValue[targetMonitor] = mode;

  // Also update monitor 0 for keybinding compatibility
  newValue[0] = mode;

  // If the monitor parameter is different from targetMonitor, update it too
  if (monitor !== targetMonitor && monitor !== 0) {
    newValue[monitor] = mode;
  }

  // Update all monitors with the new mode when there's only one monitor
  // This ensures mode switching works properly in single monitor setup
  if (allMonitors.length <= 1) {
    allMonitors.forEach((mon) => {
      newValue[mon.id] = mode;
    });
  }

  monitorShellModes.value = newValue;

  // Save the mode to gsettings
  settings.set_string(KEY_BAR_MODE, mode);

  // Log the mode change regardless of monitor count
  console.log(`Bar mode updated to ${mode} for monitor ${targetMonitorName} (ID: ${targetMonitor})`);
};

// Bar position toggle
globalThis["toggleBarPosition"] = () => {
  // Get the target monitor based on barMonitorMode
  const targetMonitorName = barMonitorMode.value;
  const targetMonitor = findMonitorByName(targetMonitorName);

  // Get the current mode from the target monitor
  const currentMode = parseInt(currentShellMode.value[targetMonitor]) || 0;
  const isVerticalMode = currentMode >= 9;

  const currentPosition = barPosition.value;
  let newPosition;

  if (isVerticalMode) {
    // Vertical modes can only toggle between left and right
    newPosition = currentPosition === "left" ? "right" : "left";
  } else {
    // Horizontal modes can only toggle between top and bottom
    newPosition = currentPosition === "top" ? "bottom" : "top";
  }

  // Update both the gsettings and the variable value
  settings.set_string(KEY_BAR_POSITION, newPosition);
  barPosition.value = newPosition;

  // Log the position change regardless of monitor count
  console.log(`Toggled bar position to ${newPosition} for monitor ${targetMonitorName} (ID: ${targetMonitor})`);
};

// Bar monitor mode toggle - implemented in modules/bar/multimonitor.js
// This is just a placeholder that will be replaced at runtime
globalThis["toggleBarMonitorMode"] = () => {
  console.log("toggleBarMonitorMode placeholder - will be replaced at runtime");
};

// Global vars for external control (through keybinds)
export const showColorScheme = Variable(false, {});
globalThis["openColorScheme"] = showColorScheme;

globalThis["mpris"] = Mpris;
globalThis["getString"] = getString;
globalThis["currentShellMode"] = currentShellMode;
globalThis["updateMonitorShellMode"] = updateMonitorShellMode;
globalThis["barPosition"] = barPosition;
globalThis["barMonitorMode"] = barMonitorMode;
globalThis.runMatugen = async () => {
  try {
    await Utils.execAsync([
      `bash`,
      `-c`,
      `${App.configDir}/scripts/color_generation/colorgen.sh`,
    ]);
  } catch (error) {
    console.error("Error during color generation:", error);
  }
};

// Window controls
const range = (length, start = 1) =>
  Array.from({ length }, (_, i) => i + start);
globalThis["toggleWindowOnAllMonitors"] = (name) => {
  range(Gdk.Display.get_default()?.get_n_monitors() || 1, 0).forEach((id) => {
    App.toggleWindow(`${name}${id}`);
  });
};
globalThis["closeWindowOnAllMonitors"] = (name) => {
  range(Gdk.Display.get_default()?.get_n_monitors() || 1, 0).forEach((id) => {
    const windowName = `${name}${id}`;
    // Check if the window exists before trying to close it
    if (App.windows[windowName]) {
      App.closeWindow(windowName);
    }
  });
};
globalThis["openWindowOnAllMonitors"] = (name) => {
  range(Gdk.Display.get_default()?.get_n_monitors() || 1, 0).forEach((id) => {
    App.openWindow(`${name}${id}`);
  });
};

globalThis["closeEverything"] = async () => {
  const numMonitors = Gdk.Display.get_default()?.get_n_monitors() || 1;
  for (let i = 0; i < numMonitors; i++) {
    // Check if windows exist before trying to close them
    if (App.windows[`cheatsheet${i}`]) App.closeWindow(`cheatsheet${i}`);
    if (App.windows[`session${i}`]) App.closeWindow(`session${i}`);
    if (App.windows[`glance${i}`]) App.closeWindow(`glance${i}`);
  }

  try {
    // Use await to properly handle the promise
    await Utils.execAsync(`pkill rofi`).catch(() => {
      // Ignore errors if rofi is not running
      console.log("No rofi process to kill");
    });
  } catch (error) {
    console.log("Error killing rofi: " + error.message);
  }

  // Check if windows exist before trying to close them
  if (App.windows["sideleft"]) App.closeWindow("sideleft");
  if (App.windows["sideright"]) App.closeWindow("sideright");
  if (App.windows["overview"]) App.closeWindow("overview");
  if (App.windows["music"]) App.closeWindow("music");
  if (App.windows["glance"]) App.closeWindow("glance"); // Keep this for backward compatibility
  if (App.windows["recorder"]) App.closeWindow("recorder");
  if (App.windows["wallselect"]) App.closeWindow("wallselect");
};

// Watch for monitor changes and update modes
Hyprland.connect("notify::monitors", () => {
  const currentModes = currentShellMode.value;
  const newModes = {};

  // Get the saved mode from gsettings
  const savedMode = settings.get_string(KEY_BAR_MODE) || "0";

  // Get all available monitors
  const allMonitors = Hyprland.monitors;

  // Get the target monitor based on barMonitorMode
  const targetMonitorName = barMonitorMode.value;
  const targetMonitor = findMonitorByName(targetMonitorName);

  // Keep existing modes for current monitors
  allMonitors.forEach((monitor) => {
    const monitorId = monitor.id;

    // If this is the target monitor, ensure it has the saved mode
    if (monitorId === targetMonitor) {
      // Use the saved mode from gsettings for the target monitor
      newModes[monitorId] = savedMode;
    } else {
      // For other monitors, keep their existing mode if available, otherwise use the saved mode
      newModes[monitorId] = currentModes[monitorId] || savedMode;
    }
  });

  // Update the modes
  currentShellMode.value = newModes;
});

globalThis["cycleMode"] = () => {
  // Get the target monitor based on barMonitorMode
  const targetMonitorName = barMonitorMode.value;
  const targetMonitor = findMonitorByName(targetMonitorName);

  // Get the current mode from the target monitor
  const currentNum = parseInt(currentShellMode.value[targetMonitor]) || 0;

  // Calculate the next mode (cycle through all 11 modes, 0-10)
  const nextMode = (currentNum + 1) % 11;

  // Update the mode for the target monitor
  updateMonitorShellMode(currentShellMode, targetMonitor, nextMode.toString());

  // Log the mode change regardless of monitor count
  console.log(`Cycled bar mode to ${nextMode} on monitor ${targetMonitorName} (ID: ${targetMonitor})`);
};

// Add a debug function to list all monitors
globalThis["listMonitors"] = () => {
  // Get all available monitors
  const allMonitors = Hyprland.monitors;

  // Only log when explicitly called
  console.log("Available monitors:");
  allMonitors.forEach(monitor => {
    console.log(`- ID: ${monitor.id}, Name: ${monitor.name}, Description: ${monitor.description}`);
    console.log(`  Current mode: ${currentShellMode.value[monitor.id] || "not set"}`);
  });

  console.log(`\nCurrent barMonitorMode: ${barMonitorMode.value}`);
  console.log(`Target monitor ID: ${findMonitorByName(barMonitorMode.value)}`);
};

// Force immediate update to ensure mode is set
Utils.timeout(0, () => {
  const modes = currentShellMode.value;
  currentShellMode.value = { ...modes };
});

// Clean up timeouts and hooks properly to free memory
// Create a global registry for tracking timeouts and intervals
globalThis.cleanupRegistry = {
  timeouts: new Set(),
  intervals: new Set(),

  // Register a timeout to be cleaned up on app exit
  registerTimeout: (id) => {
    if (id) {
      globalThis.cleanupRegistry.timeouts.add(id);
      return id;
    }
    return 0;
  },

  // Register an interval to be cleaned up on app exit
  registerInterval: (id) => {
    if (id) {
      globalThis.cleanupRegistry.intervals.add(id);
      return id;
    }
    return 0;
  },

  // Cleanup a specific timeout
  clearTimeout: (id) => {
    if (id && globalThis.cleanupRegistry.timeouts.has(id)) {
      GLib.source_remove(id);
      globalThis.cleanupRegistry.timeouts.delete(id);
    }
  },

  // Cleanup a specific interval
  clearInterval: (id) => {
    if (id && globalThis.cleanupRegistry.intervals.has(id)) {
      GLib.source_remove(id);
      globalThis.cleanupRegistry.intervals.delete(id);
    }
  },

  // Cleanup all registered timeouts and intervals
  cleanupAll: () => {
    for (const id of globalThis.cleanupRegistry.timeouts) {
      GLib.source_remove(id);
    }
    for (const id of globalThis.cleanupRegistry.intervals) {
      GLib.source_remove(id);
    }
    globalThis.cleanupRegistry.timeouts.clear();
    globalThis.cleanupRegistry.intervals.clear();
  }
};

// Helper function to create a safe timeout (auto-cleared on app exit)
globalThis.setTimeout = (callback, timeout) => {
  const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeout, () => {
    globalThis.cleanupRegistry.timeouts.delete(id);
    return callback() || GLib.SOURCE_REMOVE;
  });
  return globalThis.cleanupRegistry.registerTimeout(id);
};

// Helper function to create a safe interval (auto-cleared on app exit)
globalThis.setInterval = (callback, interval) => {
  const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
    return callback() !== false ? GLib.SOURCE_CONTINUE : GLib.SOURCE_REMOVE;
  });
  return globalThis.cleanupRegistry.registerInterval(id);
};

// This ensures that any registered timeouts and intervals are properly cleaned up
// Register cleanup for main windows
globalThis.registerAppCleanup = () => {
  const windows = App.windows;
  for (const win of Object.values(windows)) {
    if (win && win.connect) {
      win.connect('destroy', () => {
        console.log('Cleaning up resources on window destroy');
        globalThis.cleanupRegistry.cleanupAll();
      });
    }
  }
};

// Run cleanup registration after a short delay to ensure windows are created
Utils.timeout(1000, () => {
  globalThis.registerAppCleanup();
  return GLib.SOURCE_REMOVE;
});

// Create a memory-efficient LRU cache
globalThis.createLRUCache = (maxSize = 50) => {
  const cache = new Map();

  return {
    get: (key) => {
      if (!cache.has(key)) return undefined;

      // Access refreshes position in LRU
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    },

    set: (key, value) => {
      // Remove oldest entry if cache is full
      if (cache.size >= maxSize) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }

      cache.set(key, value);
    },

    has: (key) => cache.has(key),

    delete: (key) => cache.delete(key),

    clear: () => cache.clear(),

    get size() {
      return cache.size;
    }
  };
};

// Add a safe signal disconnection utility
globalThis.safeDisconnect = (object, handlerId) => {
  if (!object || !handlerId || handlerId <= 0) return false;

  try {
    if (typeof object.handlerIsConnected === 'function' &&
        !object.handlerIsConnected(handlerId)) {
      console.log(`Signal ${handlerId} not connected to object ${object}`);
      return false;
    }
    object.disconnect(handlerId);
    console.log(`Signal ${handlerId} disconnected from object ${object}`);
    return true;
  } catch (error) {
    console.log(`Failed to disconnect signal: ${error.message}`);
    return false;
  }
};
