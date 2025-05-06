import App from "resource:///com/github/Aylur/ags/app.js";
import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import Audio from 'resource:///com/github/Aylur/ags/service/audio.js';
const { execAsync } = Utils;
import Indicator from "../../../services/indicator.js";
import { StatusIcons } from "../../.commonwidgets/statusicons.js";
import { Tray } from "../modules/tray.js";
import KbLayout from "../modules/kb_layout.js";

// Volume constants
const VOLUME_STEP = 0.02;
const VOLUME_SMALL_STEP = 0.001;
const VOLUME_LARGE_STEP = 0.01;
const VOLUME_THRESHOLD = 0.05;


export default (monitor = 0) => {
  const barTray = Tray();
  const barStatusIcons = StatusIcons(
    {
      className: "bar-statusicons",
      setup: (self) =>
        self.hook(App, (self, currentName, visible) => {
          if (currentName === "sideright") {
            self.toggleClassName("bar-statusicons-active", visible);
          }
        }),
    },
    monitor,
  );

  // Create common click handler
  const handleClicks = (child) =>
    Widget.EventBox({
      onHover: () =>
        barStatusIcons.toggleClassName("bar-statusicons-hover", true),
      onHoverLost: () =>
        barStatusIcons.toggleClassName("bar-statusicons-hover", false),
      onPrimaryClick: () => App.toggleWindow("sideright"),
      onSecondaryClick: () =>
        execAsync([
          "bash",
          "-c",
          'playerctl next || playerctl position `bc <<< "100 * $(playerctl metadata mpris:length) / 1000000 / 100"` &',
        ]).catch(print),
      onMiddleClick: () => execAsync("playerctl play-pause").catch(print),
      setup: (self) =>
        self.on("button-press-event", (_, event) => {
          if (event.get_button()[1] === 8) {
            execAsync("playerctl previous").catch(print);
          }
        }),
      child: child,
    });

  const emptyArea = handleClicks(Widget.Box({ hexpand: true }));
  const indicatorArea = handleClicks(
    Widget.Box({
      children: [barStatusIcons],
    }),
  );

  // Create scroll handler
  const handleScroll = (direction) => {
    if (!Audio.speaker) return;
    const step =
      Audio.speaker.volume <= VOLUME_THRESHOLD
        ? VOLUME_SMALL_STEP
        : VOLUME_LARGE_STEP;
    Audio.speaker.volume += direction * step;
    Indicator.popup(1);
  };

  // Get user options for showing tray and keyboard layout
  const opts = userOptions.asyncGet();
  const showTray = opts.bar.elements.showTray !== false;
  const showKbdLayout = opts.bar.elements.showKbdLayout !== false;

  // Create keyboard layout widget if enabled
  const kbdLayoutWidget = showKbdLayout ? KbLayout() : null;

  return Widget.EventBox({
    onScrollUp: () => handleScroll(1),
    onScrollDown: () => handleScroll(-1),
    child: Widget.Box({
      children: [
        Widget.Box({
          hexpand: true,
          className: "spacing-h-5 bar-spaceright",
          children: [
            emptyArea,
            ...(showKbdLayout ? [kbdLayoutWidget] : []),
            ...(showTray ? [barTray] : []),
            indicatorArea,
          ],
        }),
      ],
    }),
  });
};
