const { Gtk } = imports.gi;
import Widget from "resource:///com/github/Aylur/ags/widget.js";
import Indicators from "../normal/spaceright.js";
import BarBattery from "../modules/battery.js";
import ScrolledModule from "../../.commonwidgets/scrolledmodule.js";
import NormalOptionalWorkspaces from "../normal/workspaces_hyprland.js";
import FocusOptionalWorkspaces from "../normal/workspaces_hyprland.js";
import Utils from "../modules/utils.js";
import media from "../modules/media.js";
import { getDistroIcon } from "../../.miscutils/system.js";
import Clock from "../modules/clock.js";
const { Box, EventBox } = Widget;
const createMinimalBar = async () => {
  const opts = userOptions.asyncGet();
  const workspaces = opts.bar.elements.showWorkspaces;
  const indicators = opts.bar.elements.showIndicators;
  return Widget.CenterBox({
    className: "bar-bg",
    startWidget: Widget.Box({
      css: "margin-left:1.8rem;",
      children: [
        ScrolledModule({
          hpack: "center",
          children: [
            Box({ child: BarBattery(), css: `margin-right:1rem` }),
            EventBox({
              child: Widget.Icon({
                icon: getDistroIcon(),
                className: 'txt txt-larger',
              }),
              onPrimaryClick: () => {
                App.toggleWindow("sideleft");
              },
            }),
          ],
        }),
        ...(workspaces ? [await NormalOptionalWorkspaces()] : []),
      ],
    }),
    centerWidget: ScrolledModule({
      hpack: 'center',
      children: [
        media(),
        Clock({ hexpand: true, hpack: 'center' }),
        Box()
      ]
    }),
    endWidget: Widget.Box({
      children: [
        ScrolledModule({
          children: [
            ...(indicators ? [Indicators()] : []),
            Widget.Box({
              hexpand: true,
              css: "margin-right:1.5rem",
              hpack: "end",
              child: Utils(),
            }),
          ],
        }),
      ],
    }),
  });
};

export const MinimalBar = await createMinimalBar();