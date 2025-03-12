// External dependencies
import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import Battery from "resource:///com/github/Aylur/ags/service/battery.js";
const { Box, Label, Overlay, Revealer, EventBox, Button } = Widget;
const { execAsync, exec } = Utils;
const { GLib } = imports.gi;
import { RevealerState } from "./revealercontrol.js";
import { AnimatedCircProg } from "../../.commonwidgets/cairo_circularprogress.js";

// Constants
const POWER_DRAW = {
    CACHE_DURATION: 5000,
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
        const percent = Battery.percent;
        const css = `font-size: ${percent}px;`;
        circprog.css = css;
        circprog.toggleClassName("bar-bat-circprog-low", Battery.percent <= (userOptions.battery?.low || 20));
        circprog.toggleClassName("bar-bat-circprog-full", Battery.charged);
        circprog.toggleClassName("bar-bat-circprog-charging", Battery.charging);
    };
    return AnimatedCircProg({
        className: "bar-bat-circprog",
        vpack: "center",
        hpack: "center",
        extraSetup: (self) => self.hook(Battery, _updateProgress),
    });
};

const BatteryContent = () => {
    let timeoutId = 0;

    const percentageLabel = Label({
        className: "sec-txt bar-date",
        setup: (self) => self.hook(Battery, (label) => {
            label.label = `${Battery.percent.toFixed(0)}`;
        }),
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
        children: [
            detailsBox,
        ]
    });

    const detailsRevealer = RevealerState.register(Revealer({
        transitionDuration: userOptions.animations?.durationLarge || 150,
        transition: "slide_right",
        vpack: "center",
        revealChild: true,
        child: percentageBox,
    }));

    const batteryIcon = Button({
        child: Overlay({
            child: Box({
                vpack: "center",
                className: "bar-bat",
                homogeneous: true,
                children: [],
                setup: (self) =>
                    self.hook(Battery, (box) => {
                        box.toggleClassName("bar-bat-low", Battery.percent <= (userOptions.battery?.low || 20));
                        box.toggleClassName("bar-bat-full", Battery.charged);
                        box.toggleClassName("bar-bat-charging", Battery.charging);
                    }),
            }),
            overlays: [BarBatteryProgress()],
        }),
        onClicked: () => {
            detailsRevealer.revealChild = !detailsRevealer.revealChild;
        },
    });

    const updateBatteryDetails = async () => {
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

    // Initial update
    updateBatteryDetails();

    // Periodic updates
    const startPeriodicUpdates = () => {
        if (timeoutId) return;
        timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
            updateBatteryDetails();
            return GLib.SOURCE_CONTINUE;
        });
    };

    startPeriodicUpdates();

    return EventBox({
        onPrimaryClick: () => {
            detailsRevealer.revealChild = !detailsRevealer.revealChild;
        },
        child: Box({
            className: "battery-module spacing-h-5",
            children: [
                Overlay({
                    child: batteryIcon,
                    overlays: [
                        percentageLabel,
                    ]
                }),
                detailsRevealer,
            ],
        }),
    });
};

export default () => Widget.EventBox({
    // onPrimaryClick: (self) => {
    //     execAsync(["bash", "-c", userOptions.asyncGet().apps.taskManager]).catch(print);
    // },
    onSecondaryClick: () => {
        execAsync(["bash", "-c", userOptions.asyncGet().apps.taskManager]);
    },
    onMiddleClick: () => { },
    child: BatteryContent(),
});
