import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import Hyprland from 'resource:///com/github/Aylur/ags/service/hyprland.js';
import Gdk from "gi://Gdk";
import userOptions from "../.configuration/user_options.js";
import { monitors } from './hyprlanddata.js';
import Variable from "resource:///com/github/Aylur/ags/variable.js";
import App from "resource:///com/github/Aylur/ags/app.js";

const { exec, execAsync } = Utils;

// Function to detect the primary monitor using Hyprland
export const detectPrimaryMonitor = () => {
    try {
        // First check if there's a manual override in user options
        // const manualMonitorId = userOptions.asyncGet().bar.primaryMonitorId;
        // if (manualMonitorId !== undefined && manualMonitorId !== null) {
        //     console.log(`Using manually configured primary monitor ID: ${manualMonitorId}`);
        //     return manualMonitorId;
        // }

        // Try to get the focused monitor from Hyprland
        const focusedMonitor = Hyprland.active.monitor.id;
        if (focusedMonitor !== undefined && focusedMonitor !== null) {
            return focusedMonitor;
        }

        // Fallback to GDK's primary monitor detection
        const gdkPrimary = Gdk.Display.get_default()?.get_primary_monitor() || 0;
        return gdkPrimary;
    } catch (error) {
        console.error('Error detecting primary monitor:', error);
        return 0; // Default to first monitor on error
    }
};

// Function to get all available monitors
export const getAllMonitors = () => {
    try {
        return Hyprland.monitors;
    } catch (error) {
        console.error('Error getting all monitors:', error);
        const n = Gdk.Display.get_default()?.get_n_monitors() || 1;
        return Array.from({ length: n }, (_, i) => ({ id: i }));
    }
};

// Create a Variable that can be observed for changes
export const monitorSetup = Variable({
    primary: detectPrimaryMonitor(),
    all: getAllMonitors(),
});

// Function to restart AGS to apply monitor changes
const restartAgs = () => {
    console.log("Restarting AGS to apply monitor changes...");
    Utils.execAsync(['bash', '-c', `${App.configDir}/scripts/restart_ags.sh`]).catch(print);
};

// Update monitor information when Hyprland monitors change
Hyprland.connect("notify::monitors", () => {
    const newPrimary = detectPrimaryMonitor();
    const newAll = getAllMonitors();

    // Check if primary monitor has changed
    if (monitorSetup.value.primary !== newPrimary) {
        // Update the variable without logging
        monitorSetup.value = {
            primary: newPrimary,
            all: newAll,
        };

        // Restart AGS to apply the changes
      //  restartAgs();
    } else {
        // Just update the variable without restart if only the monitor list changed
        monitorSetup.value = {
            primary: newPrimary,
            all: newAll,
        };
    }
});

// Also update when active monitor changes
Hyprland.active.connect("changed", () => {
    // Only update if we're using the active monitor as primary (no manual override)
    if (userOptions.asyncGet().bar.primaryMonitorId === undefined) {
        const newPrimary = detectPrimaryMonitor();

        // Check if primary monitor has changed
        if (monitorSetup.value.primary !== newPrimary) {
            // Update the variable without logging
            monitorSetup.value = {
                ...monitorSetup.value,
                primary: newPrimary,
            };

            // Restart AGS to apply the changes
          //  restartAgs();
        }
    }
});
