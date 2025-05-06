import Widget from "resource:///com/github/Aylur/ags/widget.js";
import WindowTitle from "../normal/spaceleft.js";
import Music from "../normal/mixed.js";
import System from "../normal/system.js";
import Indicators from "../normal/spaceright.js";
import { SideModule } from "./../../.commonwidgets/sidemodule.js";
import NormalOptionalWorkspaces  from "../normal/workspaces_hyprland.js";
import ScrolledModule from "../../.commonwidgets/scrolledmodule.js";
import PinnedApps from "../modules/pinned_apps.js";
import kb_layout from "../modules/kb_layout.js";
import { BarGroup } from "../../.commonwidgets/bargroup.js";
const opts = userOptions.asyncGet();
  const workspaces = opts.bar.elements.showWorkspaces;
  const indicators = opts.bar.elements.showIndicators;

export const NormalBar = Widget.CenterBox({
  className: "bar-bg shadow-window",
  css: `padding:0.2rem 1rem`,
  startWidget: Widget.Box({
    className: "spacing-h-4",
    children: [
      ...(userOptions.asyncGet().bar.elements.showWindowTitle ? [await WindowTitle()] : []),
    ]
  }),
  centerWidget: Widget.Box({
    // spacing: 3,
    children: [
      SideModule([Music()]),
      ScrolledModule({
        hexpand:true,
        children:[
        Widget.Box({
          hexpand:true,
          className: "bar-group bar-group-standalone",
          css: `padding:0 12px;margin: 4px 5px`,
          children: [...(workspaces ? [NormalOptionalWorkspaces()] : []),]
        }),
          BarGroup({child:PinnedApps()})
      ]}),
      SideModule([System()]),
    ],
  }),
  endWidget: Widget.Box({
    children: [
      ...(indicators ? [Indicators()] : []),
    ]
  }),
});
