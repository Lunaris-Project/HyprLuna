import Widget from "resource:///com/github/Aylur/ags/widget.js";
import { Tray } from "../modules/tray.js";
import { bluetoothPill, NotificationIndicator } from "../../.commonwidgets/statusicons.js";
import Clock from "../modules/clock.js";
import NetworkSpeed from "../../.commonwidgets/networkspeed.js";
import PrayerTimesWidget from "../modules/prayertimes.js";
import WeatherOnly from "../modules/weatherOnly.js";
import NormalOptionalWorkspaces from "../normal/workspaces_hyprland.js";
import SystemResources from "../normal/resources.js";
import BatteryScaleModule from "../modules/battery_scale.js";
import scrolledmodule from "../../.commonwidgets/scrolledmodule.js";
const Box = Widget.Box;

const Power = Widget.Button({
  child: Widget.Label({
    label: "power_settings_new",
    className: "txt-large group-saadi icon-material onSurfaceVariant",
  }),
  onClicked: () => {
    App.toggleWindow('session0');
  }
});
export const SaadiBar = Widget.CenterBox({
  className: "bar-saadi",
  css: `padding:0 2rem`,
  startWidget: Widget.Box({
    className: "spacing-h-4",
    children: [
      // Update,
      Box({
        className: "group-saadi",
        children: [
          Tray(),
        ]
      }),
      Box({
        hexpand: false,
        hpack: 'start',
        css: `padding : 0; min-width:20px`,
        className: "group-saadi",
        children: [
          NetworkSpeed()
        ]
      }),
      Box({
        className: "group-saadi",
        css: `padding-left: 0`,
        children: [
          BatteryScaleModule()
        ]
      })
    ]
  }),
  centerWidget: Widget.Button({
    child: Widget.Box({
      className: "group-saadi",
      children: [
        NotificationIndicator(),
        Clock(),
      ],
    }),
    onClicked: () => {
      App.toggleWindow('sideright')
    }
  }),
  endWidget: Widget.Box({
    children: [
      Widget.Box({
        hexpand: true,
        hpack: 'end',
        children: [
          userOptions.asyncGet().muslim.enabled ? scrolledmodule({
            children: [
              Widget.Box({
                hpack: 'end',
                hexpand: true,
                className: "group-saadi",
                children: [
                  PrayerTimesWidget()
                ],
              }),
              Widget.Box({
                hpack: 'end',
                hexpand: true,
                className: "group-saadi",
                children: [
                  WeatherOnly()
                ],
              }),
            ]
          }) : Widget.Box({
            hpack: 'end',
            hexpand: true,
            className: "group-saadi",
            children: [
              WeatherOnly()
            ],
          }), ,
          Widget.Box({
            hpack: 'end',
            hexpand: true,
            className: "group-saadi",
            children: [
              SystemResources()
            ],
          }),
          Widget.Box({
            hpack: 'end',
            hexpand: true,
            className: "group-saadi",
            children: [
              NormalOptionalWorkspaces(),
            ]
          }),
          Widget.Button({ onClicked: () => App.toggleWindow(`sideright`), child: bluetoothPill({ className: "prim-txt group-saadi" }) }),
          Power
        ]
      }),
    ]
  }),
});
