import Widget from "resource:///com/github/Aylur/ags/widget.js";
import { currentShellMode, barPosition } from "../../variables.js";
import { RoundedCorner } from "../.commonwidgets/cairo_roundedcorner.js";
import { enableClickthrough } from "../.widgetutils/clickthrough.js";
import { NormalBar } from "./modes/normal.js";
import { FocusBar } from "./modes/focus.js";
import { FloatingBar } from "./modes/floating.js";
import { MinimalBar } from "./modes/minimal.js";
import { AnoonBar } from "./modes/anoon.js";
import { WindowsTaskbar } from "./modes/windows.js";
import { VerticalBar } from "./modes/vertical.js";
import { VerticalBarPinned } from "./modes/verticalPinned.js";
import { IslandBar } from "./modes/macLike.js";
import { NotchBar } from "./modes/notch.js";
import { SaadiBar } from "./modes/saadi.js";

const horizontalModes = new Map([
  ["0", [await NormalBar, true, "Normal"]],
  ["1", [await FocusBar, true, "Focus"]],
  ["2", [await FloatingBar, false, "Floating"]],
  ["3", [await MinimalBar, true, "Minimal"]],
  ["4", [await AnoonBar, false, "Anoon"]],
  ["5", [await WindowsTaskbar, false, "Windows Taskbar"]],
  ["6", [await IslandBar, false, "Dynamic"]],
  ["7", [await NotchBar, false, "Notch"]],
  ["8", [await SaadiBar, true, "Saadi"]],
]);

const verticalModes = new Map([
  ["9", [await VerticalBar, false, "Vertical Bar"]],
  ["10", [await VerticalBarPinned, true, "Vertical Bar Pinned"]],
]);

const modes = new Map([...horizontalModes, ...verticalModes]);

const shouldShowCorners = (monitor) => {
  const mode = currentShellMode.value[monitor] || "1";
  const shouldShow = modes.get(mode)?.[1] ?? false;
  return shouldShow;
};

const getValidPosition = (mode, currentPos) => {
  const isVerticalMode = verticalModes.has(mode);
  if (isVerticalMode) {
    return (currentPos === 'left' || currentPos === 'right') ? currentPos : 'left';
  } else {
    return (currentPos === 'top' || currentPos === 'bottom') ? currentPos : 'top';
  }
};

const createCorner = (monitor, side) => {
  const getCornerStyle = (pos, isVert) => {
    if (isVert) {
      return pos === "left"
        ? side === "left" ? "topleft" : "bottomleft"
        : side === "left" ? "topright" : "bottomright";
    }
    return pos === "top"
      ? side === "left" ? "topleft" : "topright"
      : side === "left" ? "bottomleft" : "bottomright";
  };

  const cornerWindow = Widget.Window({
    monitor,
    name: `barcorner${side[0]}${monitor}`,
    layer: "top",
    anchor: [
      getValidPosition(currentShellMode.value[monitor] || "1", barPosition.value),
      verticalModes.has(currentShellMode.value[monitor] || "1")
        ? side === "left" ? "top" : "bottom"
        : side
    ],
    exclusivity: "normal",
    visible: shouldShowCorners(monitor),
    child: RoundedCorner(
      getCornerStyle(
        getValidPosition(currentShellMode.value[monitor] || "1", barPosition.value),
        verticalModes.has(currentShellMode.value[monitor] || "1")
      ),
      { className: "corner" }
    ),
    setup: (self) => {
      enableClickthrough(self);
      const updateCorner = () => {
        const mode = currentShellMode.value[monitor] || "1";
        const pos = getValidPosition(mode, barPosition.value);
        const isVert = verticalModes.has(mode);
        const shouldShow = shouldShowCorners(monitor);

        // First update visibility
        if (shouldShow) {
          self.child = RoundedCorner(getCornerStyle(pos, isVert), { className: "corner" });
          self.anchor = [pos, isVert ? side === "left" ? "top" : "bottom" : side];
          self.show_all();
        }
        self.visible = shouldShow;
      };
      self.hook(currentShellMode, updateCorner);
      self.hook(barPosition, updateCorner);
    },
  });

  return cornerWindow;
};

const getAnchor = (monitor, mode) => {
  const currentPos = barPosition.value;
  const position = getValidPosition(mode, currentPos);

  if (position !== currentPos) {
    barPosition.value = position;
  }

  return verticalModes.has(mode)
    ? [position, "top", "bottom"]
    : [position, "left", "right"];
};

export const BarCornerTopleft = (monitor = 0) => createCorner(monitor, "left");
export const BarCornerTopright = (monitor = 0) => createCorner(monitor, "right");

export const Bar = async (monitor = 0) => {
  const opts = userOptions.asyncGet();
  const mode = currentShellMode.value[monitor] || "1";

  const corners = ["left", "right"].map((side) => createCorner(monitor, side));

  const children = {};
  for (const [key, [component]] of modes) {
    try {
      children[key] = component;
    } catch (error) {
    }
  }

  const stack = Widget.Stack({
    homogeneous: false,
    transition: "slide_up_down",
    transitionDuration: opts.animations.durationSmall,
    children: children,
    setup: (self) => {
      self.hook(currentShellMode, () => {
        const newMode = currentShellMode.value[monitor] || "1";
        self.shown = newMode;
      });
      self.shown = mode;
    },
  });

  const bar = Widget.Window({
    monitor,
    name: `bar${monitor}`,
    anchor: getAnchor(monitor, mode),
    exclusivity: "exclusive",
    visible: true,
    child: stack,
    setup: (self) => {
      self.hook(currentShellMode, (w) => {
        const newMode = currentShellMode.value[monitor] || "1";
        w.anchor = getAnchor(monitor, newMode);
      });
      self.hook(barPosition, (w) => {
        const currentMode = currentShellMode.value[monitor] || "1";
        w.anchor = getAnchor(monitor, currentMode);
      });
    },
  });

  return [bar, ...corners];
};
