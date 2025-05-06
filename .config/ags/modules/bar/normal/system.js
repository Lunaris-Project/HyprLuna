import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const { Box, Label, Button, Overlay, Revealer, Stack } = Widget;
const { execAsync } = Utils;
const { GLib } = imports.gi;
import Battery from 'resource:///com/github/Aylur/ags/service/battery.js';
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';
import { AnimatedCircProg } from "../../.commonwidgets/cairo_circularprogress.js";
// import WeatherWidget from '../modules/weather.js';
// import ActiveApps from '../modules/active_apps.js';
import scrolledmodule from '../../.commonwidgets/scrolledmodule.js';
import BatteryScaleModule from '../modules/battery_scale.js';
const options = userOptions.asyncGet();
import { BarGroup } from '../../.commonwidgets/bargroup.js';
const batteryProgressCache = new Map();
const BarBatteryProgress = () => {
    const _updateProgress = (circprog) => {
        const percent = Battery.percent;
        const key = `${percent}-${Battery.charged}`;

        if (!batteryProgressCache.has(key)) {
            const css = `font-size: ${Math.abs(percent)}px;`;
            batteryProgressCache.set(key, css);
        }

        circprog.css = batteryProgressCache.get(key);
        circprog.toggleClassName('bar-batt-circprog-low', percent <= options.battery.low);
        circprog.toggleClassName('bar-batt-circprog-full', Battery.charged);
    }

    return AnimatedCircProg({
        className: 'bar-batt-circprog',
        vpack: 'center',
        hpack: 'center',
        extraSetup: (self) => self.hook(Battery, _updateProgress),
    })
}

const timeFormat = options.time.format;
const dateFormat = options.time.dateFormatLong;

const time = Variable('', {
    poll: [
        options.time.interval,
        () => GLib.DateTime.new_now_local().format(timeFormat),
    ],
})

const date = Variable('', {
    poll: [
        options.time.dateInterval,
        () => GLib.DateTime.new_now_local().format(dateFormat),
    ],
})

const BarClock = () => Widget.Box({
    vpack: 'center',
    className: 'spacing-h-4 bar-clock-box',
    children: [
        Widget.Label({
            className: 'bar-time',
            label: time.bind(),
        }),
        Widget.Label({
            className: 'txt-norm txt-onLayer1',
            label: '•',
        }),
        Widget.Label({
            className: 'txt-smallie bar-date',
            label: date.bind(),
        }),
    ],
});

const utilButtonCache = new Map();
const UtilButton = ({ name, icon, onClicked }) => {
    const key = `${name}-${icon}`;
    if (!utilButtonCache.has(key)) {
        utilButtonCache.set(key, Button({
            vpack: 'center',
            tooltipText: name,
            onClicked: onClicked,
            className: 'bar-util-btn icon-material txt-norm',
            label: `${icon}`,
        }));
    }
    return utilButtonCache.get(key);
}

const Utilities = () => {
    const box = Box({
        hpack: 'center',
        className: 'spacing-h-4',
        children: [
            UtilButton({
                name: getString('Change wallpaper'),
                icon: 'image',
                onClicked: () => App.toggleWindow('wallselect'),
            }),
            UtilButton({
                name: getString('Screen snip'), icon: 'screenshot_region', onClicked: () => {
                    Utils.execAsync(`${App.configDir}/scripts/grimblast.sh copy area`)
                        .catch(print)
                }
            }),
            UtilButton({
                name: getString('Color picker'), icon: 'colorize', onClicked: () => {
                    Utils.execAsync(['hyprpicker', '-a']).catch(print)
                }
            }),
        ]
    });
    return box;
}

const BarBattery = () => Box({
    className: 'spacing-h-4 bar-batt-txt',
    children: [
        Revealer({
            transitionDuration: userOptions.asyncGet().animations.durationSmall,
            revealChild: false,
            transition: 'slide_right',
            child: MaterialIcon('bolt', 'norm', { tooltipText: "Charging" }),
            setup: (self) => self.hook(Battery, revealer => {
                self.revealChild = Battery.charging;
            }),
        }),
        Label({
            className: 'txt-smallie',
            setup: (self) => self.hook(Battery, label => {
                label.label = `${Number.parseFloat(Battery.percent.toFixed(1))}%`;
            }),
        }),
        Overlay({
            child: Widget.Box({
                vpack: 'center',
                className: 'bar-batt',
                homogeneous: true,
                children: [
                    MaterialIcon('battery_full', 'small'),
                ],
                setup: (self) => self.hook(Battery, box => {
                    box.toggleClassName('bar-batt-low', Battery.percent <= userOptions.asyncGet().battery.low);
                    box.toggleClassName('bar-batt-full', Battery.charged);
                }),
            }),
            overlays: [
                BarBatteryProgress(),
            ]
        }),
    ]
});


const BatteryModule = () => Box({
    spacing:5,
    hexpand: true,
    children: [
        ...(userOptions.asyncGet().bar.elements.showClock ? [BarGroup({ child: BarClock() })] : []),
        // ...(userOptions.asyncGet().bar.elements.showWeather ? [
        //     scrolledmodule({
        //         hexpand: true,
        //         children:[
        //             BarGroup({ hexpand:true,child: WeatherWidget() }),
        //             BarGroup({ hexpand:true,child: ActiveApps() })
        //         ]
        //     })
        // ] : []),
        ...(userOptions.asyncGet().bar.elements.showUtils ? [BarGroup({ child: Utilities() })] : []),
        scrolledmodule({
            children:[
                // Only show battery if available and enabled in settings
                ...(Battery?.available && userOptions.asyncGet().bar.elements.showBattery ?
                    [Widget.Box({ vexpand: true, children:[ BarGroup({ child: BarBattery() })] })] :
                    [Widget.Box({})]
                ),
                BatteryScaleModule(),
            ]
        })
    ]
});

const switchToRelativeWorkspace = async (self, num) => {
    try {
        const Hyprland = (await import('resource:///com/github/Aylur/ags/service/hyprland.js')).default;
        Hyprland.messageAsync(`dispatch workspace ${num > 0 ? '+' : ''}${num}`).catch(print);
    } catch {
        execAsync([`${App.configDir}/scripts/sway/swayToRelativeWs.sh`, `${num}`]).catch(print);
    }
}

export default () => Widget.EventBox({
    // onScrollUp: (self) => switchToRelativeWorkspace(self, -1),
    // onScrollDown: (self) => switchToRelativeWorkspace(self, +1),
    // onPrimaryClick: () => App.toggleWindow('sideright'),
    child: Widget.Box({
        className: 'spacing-h-4',
        children: [
            BatteryModule(),
        ]
    })
});
