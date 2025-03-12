import Widget from "resource:///com/github/Aylur/ags/widget.js";
import WallpaperImage from "./wallpaper.js";
import SystemWidget from "./onscreenwidgets/system.js";
import Normal from "./onscreenwidgets/simpleclock.js";
import Auva from "./onscreenwidgets/auva.js";
// import { zaWiseCat } from "./onscreenwidgets/zaWizeCat.js";

export default (monitor) =>
  Widget.Window({
    name: `desktopbackground${monitor}`,
    layer: "background",
    exclusivity: 'ignore',
    visible: userOptions.asyncGet().desktopBackground.visible ? true : false,
    keymode: "on-demand",
    child: Widget.Overlay({
      child: WallpaperImage(monitor),
      overlays: [
        Widget.Box({
          children: [
            Auva(),
            // Normal(),
            Widget.Box({ hexpand: true }),
            userOptions.asyncGet().desktopBackground.resources ? SystemWidget() : null,
            userOptions.asyncGet().desktopBackground.enableWisecat ? Widget.Box({ vertical: true, children: [zaWiseCat, Widget.Box({ vexpand: true })] }) : null
          ],
        }),
      ],
      setup: (self) => {
        self.set_overlay_pass_through(self.get_children()[1], true);
      },
    }),
  });
