import Widget from "resource:///com/github/Aylur/ags/widget.js";
import WallpaperImage from "./wallpaper.js";
import SystemWidget from "./onscreenwidgets/system.js";
import Normal from "./onscreenwidgets/simpleclock.js";
import Auva from "./onscreenwidgets/auva.js";
import { zaWizeCat } from "./onscreenwidgets/zaWizeCat.js";

export default (monitor) =>
  Widget.Window({
    name: `desktopbackground${monitor}`,
    layer: "background",
    exclusivity: "ignore",
    visible: userOptions.asyncGet().desktopBackground.visible ? true : false,
    keymode: "on-demand",
    child: Widget.Overlay({
      child: WallpaperImage(monitor),
      overlays: [
        // Main content box (horizontal)
        Widget.Box({
          children: [
            userOptions.asyncGet().desktopBackground.Auva ? Auva() : Normal(),
            Widget.Box({ hexpand: true }),
            userOptions.asyncGet().desktopBackground.resources
              ? SystemWidget()
              : null,
          ],
        }),

        // Add zaWizeCat as a separate overlay, positioned at the top-right edge
        userOptions.asyncGet().desktopBackground.enableWisecat
          ? Widget.Box({
              hpack: "end", // Position at right
              vpack: "start", // Position at top
              vexpand: false,
              hexpand: false,
              // Position at the top with no right margin to stick to the edge
              css: "margin-top: 40px; margin-right: 0px;",
              child: zaWizeCat,
            })
          : null,
      ],
      setup: (self) => {
        // Make all overlays pass-through for mouse events
        const overlays = self.get_children();
        for (let i = 1; i < overlays.length; i++) {
          self.set_overlay_pass_through(overlays[i], true);
        }
      },
    }),
  });
