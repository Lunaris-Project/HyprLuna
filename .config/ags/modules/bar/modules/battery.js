// External dependencies
import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import Battery from "resource:///com/github/Aylur/ags/service/battery.js";
const { Box, Label, Overlay, Revealer, EventBox, Button } = Widget;
const { execAsync } = Utils;
const { GLib } = imports.gi;
import { RevealerState } from "./revealercontrol.js";
import { AnimatedCircProg } from "../../.commonwidgets/cairo_circularprogress.js";

// Constants - Reduce polling frequency to save resources
const POWER_DRAW = {
    CACHE_DURATION: 30000, // Increased from 5000 to 30000 (30 seconds)
    PATHS: {
        CURRENT: "/sys/class/power_supply/BAT0/current_now",
        VOLTAGE: "/sys/class/power_supply/BAT0/voltage_now"
    },
    CONVERSION: {
        TO_AMPS: 1000000,
        TO_VOLTS: 1000000
    }
};

// Cache state
const powerDrawCache = {
    value: "N/A",
    timestamp: 0
};

// Utility functions
const fetchPowerDraw = async () => {
    // Skip on systems without battery
    if (!Battery?.available) {
        return 'N/A';
    }

    const now = Date.now();
    if (powerDrawCache.timestamp + POWER_DRAW.CACHE_DURATION > now) {
        return powerDrawCache.value;
    }

    try {
        const current = parseInt(await Utils.execAsync(`cat ${POWER_DRAW.PATHS.CURRENT}`), 10);
        const voltage = parseInt(await Utils.execAsync(`cat ${POWER_DRAW.PATHS.VOLTAGE}`), 10);

        const currentInAmps = current / POWER_DRAW.CONVERSION.TO_AMPS;
        const voltageInVolts = voltage / POWER_DRAW.CONVERSION.TO_VOLTS;
        const powerInWatts = (currentInAmps * voltageInVolts).toFixed(2);

        powerDrawCache.value = `${powerInWatts} W`;
        powerDrawCache.timestamp = now;
        return powerDrawCache.value;
    } catch (error) {
        return 'N/A';
    }
};

const BarBatteryProgress = () => {
    const _updateProgress = (circprog) => {
        // Check if battery service has a valid percent - otherwise default to 0
        const percent = Battery?.available ? Battery.percent : 0;

        // Ensure percent is never negative
        const safePercent = Math.max(0, percent);

        // Only update CSS when value changed to reduce redraws
        if (circprog._lastPercent !== safePercent) {
            circprog.css = `font-size: ${safePercent}px;`;
            circprog._lastPercent = safePercent;
        }

        // Only apply these classes if battery is available
        if (Battery?.available) {
            const lowBattery = Battery.percent <= (userOptions.battery?.low || 20);
            if (circprog._lastLowBattery !== lowBattery) {
                circprog.toggleClassName("bar-bat-circprog-low", lowBattery);
                circprog._lastLowBattery = lowBattery;
            }

            if (circprog._lastCharged !== Battery.charged) {
                circprog.toggleClassName("bar-bat-circprog-full", Battery.charged);
                circprog._lastCharged = Battery.charged;
            }

            if (circprog._lastCharging !== Battery.charging) {
                circprog.toggleClassName("bar-bat-circprog-charging", Battery.charging);
                circprog._lastCharging = Battery.charging;
            }
        }
    };
    return AnimatedCircProg({
        className: "bar-bat-circprog",
        vpack: "center",
        hpack: "center",
        extraSetup: (self) => {
            self._lastPercent = -1;
            self._lastLowBattery = null;
            self._lastCharged = null;
            self._lastCharging = null;
            self._batteryHandler = Battery.connect("changed", () => _updateProgress(self));

            // Ensure proper cleanup
            self.connect('destroy', () => {
                if (self._batteryHandler) {
                    if (globalThis.safeDisconnect) {
                        globalThis.safeDisconnect(Battery, self._batteryHandler);
                    } else {
                        try {
                            Battery.disconnect(self._batteryHandler);
                        } catch (e) {
                            console.log("Failed to disconnect battery handler:", e);
                        }
                    }
                    self._batteryHandler = 0;
                }
            });

            // Initial update
            _updateProgress(self);
        },
    });
};

const BatteryContent = () => {
    let timeoutId = 0;

    const percentageLabel = Label({
        className: "sec-txt bar-date",
        setup: (self) => {
            self._lastValue = '';
            self.hook(Battery, (label) => {
                // Check if battery service is available
                if (Battery?.available) {
                    const newValue = `${Battery.percent.toFixed(0)}`;
                    if (self._lastValue !== newValue) {
                        label.label = newValue;
                        self._lastValue = newValue;
                    }
                } else {
                    if (self._lastValue !== 'N/A') {
                        label.label = 'N/A';
                        self._lastValue = 'N/A';
                    }
                }
            });
        }
    });

    const timeToEmptyFullLabel = Label({ hpack: "start", className: "sec-txt txt-smallie" });
    const powerDrawLabel = Label({ hpack: "start", className: "sec-txt txt-smallie" });

    const detailsBox = Box({
        hpack: "start",
        vertical: true,
        children: [timeToEmptyFullLabel, powerDrawLabel],
    });

    const percentageBox = Box({
        vpack: "center",
        children: [detailsBox],
    });

    const detailsRevealer = RevealerState.register(Revealer({
        transitionDuration: userOptions.animations?.durationLarge || 150,
        transition: "slide_right",
        vpack: "center",
        revealChild: false, // Default to hidden to save resources
        child: percentageBox,
    }));

    const batteryIcon = Button({
        child: Overlay({
            child: Box({
                vpack: "center",
                className: "bar-bat",
                homogeneous: true,
                children: [],
                setup: (self) => {
                    self._lastLowBattery = null;
                    self._lastCharging = null;
                    self._lastCharged = null;

                    self.hook(Battery, (box) => {
                        // Only apply these classes if battery is available
                        if (Battery?.available) {
                            const lowBattery = Battery.percent <= (userOptions.battery?.low || 20);
                            if (self._lastLowBattery !== lowBattery) {
                                box.toggleClassName("bar-bat-low", lowBattery);
                                self._lastLowBattery = lowBattery;
                            }

                            if (self._lastCharged !== Battery.charged) {
                                box.toggleClassName("bar-bat-full", Battery.charged);
                                self._lastCharged = Battery.charged;
                            }

                            if (self._lastCharging !== Battery.charging) {
                                box.toggleClassName("bar-bat-charging", Battery.charging);
                                self._lastCharging = Battery.charging;
                            }
                        }
                    });
                },
            }),
            overlays: [BarBatteryProgress()],
        }),
        onClicked: () => {
            detailsRevealer.revealChild = !detailsRevealer.revealChild;
            // Only update battery details when revealer is opened
            if (detailsRevealer.revealChild) {
                updateBatteryDetails();
            }
        },
    });

    const updateBatteryDetails = async () => {
        // Skip updates if not visible
        if (!detailsRevealer.revealChild) return;

        // Skip on systems without battery
        if (!Battery?.available) {
            powerDrawLabel.label = 'Power: N/A';
            timeToEmptyFullLabel.label = 'N/A';
            return;
        }

        const powerDraw = await fetchPowerDraw();
        powerDrawLabel.label = `Power: ${powerDraw}`;

        try {
            const result = await Utils.execAsync("upower -i /org/freedesktop/UPower/devices/battery_BAT0");
            const lines = result.split('\n');
            let timeToEmptyFull = "N/A";

            for (const line of lines) {
                if (line.includes("time to")) {
                    timeToEmptyFull = line.split(":")[1].trim();
                    break;
                }
            }
            timeToEmptyFullLabel.label = timeToEmptyFull;
        } catch (error) {
            timeToEmptyFullLabel.label = "Error";
        }
    };

    // Don't update initially, only when opened
    // updateBatteryDetails();

    // Periodic updates with longer interval
    const startPeriodicUpdates = () => {
        if (timeoutId) return;
        timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30000, () => { // 30 seconds instead of 10
            if (detailsRevealer.revealChild) {
                updateBatteryDetails();
            }
            return GLib.SOURCE_CONTINUE;
        });
    };

    startPeriodicUpdates();

    return EventBox({
        onPrimaryClick: () => {
            detailsRevealer.revealChild = !detailsRevealer.revealChild;
            // Only update battery details when revealer is opened
            if (detailsRevealer.revealChild) {
                updateBatteryDetails();
            }
        },
        child: Box({
            css: "font-size: 11px; font-weight: 700; margin: 0;",
            className: "battery-module spacing-h-5",
            children: [
                Overlay({
                    child: batteryIcon,
                    overlays: [percentageLabel],
                }),
                detailsRevealer,
            ],
        }),
        setup: (self) => {
            // Clean up the timeout when the widget is destroyed
            self.connect('destroy', () => {
                if (timeoutId) {
                    GLib.source_remove(timeoutId);
                    timeoutId = 0;
                }
            });
        }
    });
};

export default () => {
    // Create a container that will show/hide based on battery availability
    const batteryContainer = Widget.Box({
        visible: Battery?.available || false,
        setup: (self) => {
            // Update visibility when battery availability changes
            self.hook(Battery, () => {
                self.visible = Battery?.available || false;
            });
        },
        child: Widget.EventBox({
        onSecondaryClick: () => {
            execAsync(["bash", "-c", userOptions.asyncGet().apps.taskManager]);
        },
        child: BatteryContent(),
    }),
    });

    return batteryContainer;
};
