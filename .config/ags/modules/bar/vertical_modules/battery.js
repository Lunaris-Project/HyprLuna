// External dependencies
import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import Battery from "resource:///com/github/Aylur/ags/service/battery.js";
const { Box, Label, Overlay, EventBox, Button } = Widget;
const { execAsync } = Utils;
const { GLib } = imports.gi;
import { AnimatedCircProg } from "../../.commonwidgets/cairo_circularprogress.js";

// Configuration
const { userOptions } = globalThis;

// Power draw monitoring - Increased cache duration to reduce overhead
const POWER_PATHS = {
    CURRENT: "/sys/class/power_supply/BAT0/current_now",
    VOLTAGE: "/sys/class/power_supply/BAT0/voltage_now"
};

const powerDrawCache = {
    value: "N/A",
    timestamp: 0,
    duration: 30000 // 30 seconds instead of 5
};

const fetchPowerDraw = async () => {
    // Skip on systems without battery
    if (!Battery?.available) {
        return 'N/A';
    }

    if (powerDrawCache.timestamp + powerDrawCache.duration > Date.now()) {
        return powerDrawCache.value;
    }

    try {
        const current = parseInt(await execAsync(`cat ${POWER_PATHS.CURRENT}`), 10);
        const voltage = parseInt(await execAsync(`cat ${POWER_PATHS.VOLTAGE}`), 10);
        const powerInWatts = ((current * voltage) / 1e12).toFixed(2);

        powerDrawCache.value = `${powerInWatts} W`;
        powerDrawCache.timestamp = Date.now();
        return powerDrawCache.value;
    } catch (error) {
        return 'N/A';
    }
};

// Battery progress indicator - with performance optimizations
const BarBatteryProgress = () => AnimatedCircProg({
    className: "bar-bat-circprog",
    vpack: "center",
    hpack: "center",
    extraSetup: (self) => {
        self._lastPercent = -1;
        self._lastLowBattery = null;
        self._lastCharged = null;
        self._lastCharging = null;

        self.hook(Battery, (circprog) => {
            // Check if battery is available
            if (!Battery?.available) {
                if (self._lastPercent !== 0) {
                    circprog.css = `font-size: 0px;`;
                    self._lastPercent = 0;
                }
                return;
            }

            // Ensure percent is never negative
            const percent = Math.max(0, Battery.percent);

            // Only update CSS when needed
            if (self._lastPercent !== percent) {
                circprog.css = `font-size: ${percent}px;`;
                self._lastPercent = percent;
            }

            const lowBattery = percent <= (userOptions.battery?.low || 20);
            if (self._lastLowBattery !== lowBattery) {
                circprog.toggleClassName("bar-bat-circprog-low", lowBattery);
                self._lastLowBattery = lowBattery;
            }

            if (self._lastCharged !== Battery.charged) {
                circprog.toggleClassName("bar-bat-circprog-full", Battery.charged);
                self._lastCharged = Battery.charged;
            }

            if (self._lastCharging !== Battery.charging) {
                circprog.toggleClassName("bar-bat-circprog-charging", Battery.charging);
                self._lastCharging = Battery.charging;
            }
        });
    }
});

// Battery content
const BatteryContent = () => {
    let tooltipUpdateTimeout = 0;
    let tooltipText = "";

    // Battery icon with percentage/charging indicator
    const batteryIcon = Button({
        tooltipText: "",
        child: Overlay({
            child: Box({
                vpack: "center",
                className: "bar-bat",
                homogeneous: true,
                children: [Label({
                    setup: (self) => {
                        self._lastLabel = '';
                        self._lastClassName = '';

                        self.hook(Battery, (label) => {
                            // Check if battery is available
                            if (!Battery?.available) {
                                if (self._lastLabel !== 'N/A') {
                                    label.className = "sec-txt";
                                    label.label = "N/A";
                                    self._lastLabel = 'N/A';
                                    self._lastClassName = "sec-txt";
                                }
                                return;
                            }

                            if (Battery.charging) {
                                const newClassName = "icon-material sec-txt txt-bold txt-small";
                                if (self._lastClassName !== newClassName) {
                                    label.className = newClassName;
                                    self._lastClassName = newClassName;
                                }

                                if (self._lastLabel !== "bolt") {
                                    label.label = "bolt";
                                    self._lastLabel = "bolt";
                                }
                            } else {
                                const newClassName = "sec-txt";
                                if (self._lastClassName !== newClassName) {
                                    label.className = newClassName;
                                    self._lastClassName = newClassName;
                                }

                                const newLabel = `${Battery.percent.toFixed(0)}`;
                                if (self._lastLabel !== newLabel) {
                                    label.label = newLabel;
                                    self._lastLabel = newLabel;
                                }
                            }
                        });
                    }
                })],
                setup: (self) => {
                    self._lastLowBattery = null;
                    self._lastCharged = null;
                    self._lastCharging = null;

                    self.hook(Battery, (box) => {
                        // Only apply classes if battery is available
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
    });

    // Update battery details only on hover (to save resources)
    const updateTooltip = async () => {
        // Skip on systems without battery
        if (!Battery?.available) {
            batteryIcon.tooltipText = "No battery";
            return;
        }

        const powerDraw = await fetchPowerDraw();
        try {
            const result = await execAsync("upower -i /org/freedesktop/UPower/devices/battery_BAT0");
            const timeInfo = result.split('\n').find(line => line.includes("time to"));
            const timeText = timeInfo ? timeInfo.split(":")[1].trim() : "N/A";

            tooltipText = `Battery: ${Battery.percent.toFixed(0)}%\nPower: ${powerDraw}\n${timeText}`;
            batteryIcon.tooltipText = tooltipText;
        } catch (error) {
            tooltipText = `Battery: ${Battery.percent.toFixed(0)}%\nPower: ${powerDraw}\nTime: Error`;
            batteryIcon.tooltipText = tooltipText;
        }
    };

    batteryIcon.connect('query-tooltip', () => {
        // Only update tooltip when needed
        if (!tooltipUpdateTimeout) {
            updateTooltip();
            tooltipUpdateTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 30000, () => {
                tooltipUpdateTimeout = 0;
                return GLib.SOURCE_REMOVE;
            });
        }
        return true;
    });

    return EventBox({
        child: Box({
            css: "font-size: 11px; font-weight: 700; margin: 0;",
            className: "battery-module spacing-h-5 ",
            vertical: true,
            children: [batteryIcon],
        }),
        setup: (self) => {
            // Clean up any timeouts when the widget is destroyed
            self.connect('destroy', () => {
                if (tooltipUpdateTimeout) {
                    GLib.source_remove(tooltipUpdateTimeout);
                    tooltipUpdateTimeout = 0;
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
        child: EventBox({
        onPrimaryClick: () => {
            App.toggleWindow("sideleft");
        },
        onSecondaryClick: () => {
            execAsync(["bash", "-c", userOptions.asyncGet().apps.taskManager]);
        },
        child: BatteryContent(),
    }),
    });

    return batteryContainer;
};
