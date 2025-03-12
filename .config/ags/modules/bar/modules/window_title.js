import App from "resource:///com/github/Aylur/ags/app.js";
import Widget from "resource:///com/github/Aylur/ags/widget.js";
import Brightness from "../../../services/brightness.js";
import Indicator from "../../../services/indicator.js";
import GLib from "gi://GLib";

const BRIGHTNESS_STEP = 0.05;
const DEFAULT_WORKSPACE_LABEL = "HyprLuna";

const createClassWindow = async () => {
  try {
    const Hyprland = (
      await import("resource:///com/github/Aylur/ags/service/hyprland.js")
    ).default;

    const baseCSS = 'transition: opacity 0.1s ease-in-out;';

    return Widget.Label({
      className: " txt-norm onSurfaceVariant",
      css: baseCSS + 'opacity: 1;',
      setup: (self) => {
        let timeoutId = 0;

        self.hook(Hyprland.active.client, () => {
          // Cancel any pending animation
          if (timeoutId) {
            GLib.Source.remove(timeoutId);
            timeoutId = 0;
          }

          // Start fade out
          self.css = baseCSS + 'opacity: 0;';

          // Schedule text update and fade in
          timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            self.label = Hyprland.active.client.class || DEFAULT_WORKSPACE_LABEL;
            self.css = baseCSS + 'opacity: 1;';
            timeoutId = 0;
            return GLib.SOURCE_REMOVE;
          });
        });
      },
    });
  } catch {
    return null;
  }
};

export default async (monitor = 0) => {
  const topLabel = await createClassWindow();
  if (!topLabel) return null;

  const handleScroll = (direction) => {
    Indicator.popup(1);
    Brightness[monitor].screen_value += direction * BRIGHTNESS_STEP;
  };

  return Widget.EventBox({
    onScrollUp: () => handleScroll(1),
    onScrollDown: () => handleScroll(-1),
    onPrimaryClick: () => App.toggleWindow("sideleft"),
    child: Widget.Box({
      children: [topLabel],
    }),
  });
};
