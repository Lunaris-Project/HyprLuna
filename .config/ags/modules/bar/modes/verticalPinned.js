const { Gtk } = imports.gi;
import Widget from "resource:///com/github/Aylur/ags/widget.js";
import BarBattery from "../vertical_modules/battery.js";
import { StatusIcons } from "../vertical_modules/statusicons.js";
import VerticalClock from "../vertical_modules/vertical_clock.js"
import VerticalPinnedApps from "../vertical_modules/vertical_pinned_apps.js";
import BarToggles from "../vertical_modules/bar_toggles.js"
import KbLayout from "../modules/kb_layout.js";
import VerticalOptionalWorkspace from "../vertical_modules/workspaces_hyprland.js"
import ScrolledModule from "../../.commonwidgets/scrolledmodule.js";
import { MediaControls } from "../vertical_modules/bar_toggles.js";
import { VolumeControl } from "../vertical_modules/empty_area.js";
export const VerticalBarPinned = Widget.CenterBox({
  className: "bar-bg",
  css: `min-width:3rem`,
  vertical: true,
  startWidget: Widget.Box({
    css: "margin-top: 1.5rem",
    hpack: 'center',
    vpack: 'start',
    vertical: true,
    spacing: 15,
    children: [
      BarBattery(),
      ScrolledModule({
        hpack: "center",
        children: [
          Widget.Box({ vpack: "center", className: "bar-group-pad-vertical bar-group", child: MediaControls() }),
          Widget.Box({ vpack: "center", className: "bar-group-pad-vertical bar-group", child: BarToggles() }),
        ]
      })
    ],
  }),
  centerWidget:
    ScrolledModule({
      hpack: "center",
      children: [
        Widget.Box({ className: "bar-group-pad-vertical bar-group", child: VerticalOptionalWorkspace() }),
        Widget.Box({ className: "bar-group-pad-vertical bar-group", child: VerticalPinnedApps() }),
      ]
    }),
  endWidget:
    Widget.Box({
      hpack: "center",
      css: "margin-bottom: 1.5rem",
      hexpand: true,
      vpack: "end",
      vertical: true,
      vexpand: true,
      spacing: 15,
      children: [
        VolumeControl(),
        StatusIcons(),
        KbLayout(),
        VerticalClock(),

      ]
    })
});
