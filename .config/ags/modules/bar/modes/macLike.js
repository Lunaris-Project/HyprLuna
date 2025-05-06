import Widget from "resource:///com/github/Aylur/ags/widget.js";
import { StatusIcons } from "../../.commonwidgets/statusicons.js";
import BarBattery from "../modules/battery.js";
import SimpleWS from "../normal/workspaces_simple.js";
import InLineClock from "../modules/inline_clock.js";
import { getDistroIcon } from "../../.miscutils/system.js";
import Scrolledmodule from "../../.commonwidgets/scrolledmodule.js";
import Shortcuts from "../modules/utils.js";
const { Box, EventBox } = Widget;

const barStatusIcons = StatusIcons({
  className: "onSurfaceVariant",
  setup: (self) =>
    self.hook(App, (self, currentName, visible) => {
      if (currentName === "sideright") {
        self.toggleClassName("bar-statusicons-active", visible);
      }
    }),
});
const IslandBarContent = async () => {
  return Widget.CenterBox({
    startWidget: Widget.Box({
      className: "bar-floating",
      css: "margin: 1rem 10rem; padding: 0.3rem 1rem;",
      spacing: 20,
     hpack: "start",
      homogeneous: true,
      children: [
        Scrolledmodule({
          children: [
            EventBox({
              child: Widget.Icon({
                icon: getDistroIcon(),
                className: "txt onSurfaceVariant txt-larger",
              }),
              onPrimaryClick: () => {
                App.toggleWindow("sideleft");
              },
            }),
            Widget.Overlay({
              child: BarBattery(),
              overlays: [SimpleWS()],
            }),
          ],
        }),

        InLineClock(),
        barStatusIcons,
      ],
    }),
    centerWidget: Scrolledmodule({
      children: [Widget.Box(), Shortcuts()],
    }),
    endWidget: null,
  });
};

export const IslandBar = await IslandBarContent();
