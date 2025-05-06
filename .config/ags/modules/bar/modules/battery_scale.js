import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import Battery from "resource:///com/github/Aylur/ags/service/battery.js";
import { MaterialIcon } from "../../.commonwidgets/materialicon.js";
const { Box, Label, Button, Overlay, Revealer, Stack, EventBox, ProgressBar } = Widget;
const { execAsync } = Utils;
const { GLib } = imports.gi;

const BatteryScale = () => {
    let isRevealed = false;
    let batteryHook = null;

    const percentageLabel = Label({
        className: "txt-smallie sec-txt txt-semibold",
        truncate: "end",
        wrap: true,
        css: "margin-left: 8px;",
    });

    const percentageRevealer = Revealer({
        transitionDuration: userOptions.asyncGet().animations.durationLarge,
        transition: "slide_right",
        revealChild: false,
        child: percentageLabel,
    });

    const batteryIcon = MaterialIcon("battery_full", "small");
    const batteryProgress = ProgressBar({
        className: "battery-scale-bar",
        vpack: "center",
        tooltipText: "0%",
    });

    // Track last values to prevent unnecessary updates
    let lastPercent = -1;
    let lastCharging = null;
    let lastLow = null;

    const updateBatteryInfo = () => {
        // Check if battery is available
        if (!Battery?.available) {
            if (lastPercent !== 0) {
                batteryProgress.fraction = 0;
                batteryProgress.tooltipText = "No battery";
                percentageLabel.label = "No battery";
                lastPercent = 0;
            }
            return;
        }

        const percent = Math.max(0, Math.min(100, Battery.percent));
        const isCharging = Battery.charging;
        const isLow = percent <= userOptions.asyncGet().battery.low;

        // Only update values when they change
        if (lastLow !== isLow) {
            batteryIcon.toggleClassName("bar-batt-low", isLow);
            batteryProgress.toggleClassName("bar-batt-low", isLow);
            lastLow = isLow;
        }

        if (lastCharging !== isCharging) {
            batteryIcon.toggleClassName("bar-batt-charging", isCharging);
            batteryProgress.toggleClassName("bar-batt-charging", isCharging);
            lastCharging = isCharging;
        }

        if (lastPercent !== percent) {
            batteryProgress.fraction = Math.max(0, Math.min(1, percent / 100));
            batteryProgress.tooltipText = `${percent}%${isCharging ? " Charging" : ""}`;

            const chargingText = isCharging ? "  " : "";
            percentageLabel.label = `${percent} % ${chargingText} `;
            lastPercent = percent;
        }
    };

    const widget = Box({
        className: "battery-scale-container spacing-h-10",
        setup: (self) => {
            // Clean up previous hooks if they exist
            if (batteryHook) {
                if (globalThis.safeDisconnect) {
                    globalThis.safeDisconnect(Battery, batteryHook);
                } else if (Battery && batteryHook > 0) {
                    try {
                        Battery.disconnect(batteryHook);
                    } catch (e) {
                        console.log("Failed to disconnect battery hook:", e);
                    }
                }
                batteryHook = 0;
            }

            // Set up new hooks
            batteryHook = Battery.connect('changed', updateBatteryInfo);

            self.connect('destroy', () => {
                if (batteryHook) {
                    if (globalThis.safeDisconnect) {
                        globalThis.safeDisconnect(Battery, batteryHook);
                    } else if (Battery && batteryHook > 0) {
                        try {
                            Battery.disconnect(batteryHook);
                        } catch (e) {
                            console.log("Failed to disconnect battery hook:", e);
                        }
                    }
                    batteryHook = 0;
                }
            });
        },
        children: [
            EventBox({
                onPrimaryClick: () => {
                    isRevealed = !isRevealed;
                    percentageRevealer.revealChild = isRevealed;
                },
                child: Box({
                    className: "battery-scale-box",
                    children: [
                        batteryProgress,
                    ],
                }),
            }),
            percentageRevealer,
        ],
    });

    // Initial update
    updateBatteryInfo();
    return widget;
};

const BatteryScaleModule = () => {
    // Create a container that will show/hide based on battery availability
    const batteryContainer = Widget.Box({
        visible: Battery?.available || false,
        setup: (self) => {
            // Update visibility when battery availability changes
            self.hook(Battery, () => {
                self.visible = Battery?.available || false;
            });
        },
        child: Box({
            className: "spacing-h-4",
            children: [BatteryScale()],
        }),
    });

    return batteryContainer;
};

// Export both the function and the module directly
export default () => {
    return BatteryScaleModule();
};

// Export the module directly for use in bar modes
export { BatteryScaleModule };
