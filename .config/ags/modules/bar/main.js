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
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";

// Get the saved mode from gsettings
const SCHEMA_ID = "org.gnome.shell.extensions.ags";
const KEY_BAR_MODE = "bar-mode";
const settings = new Gio.Settings({ schema_id: SCHEMA_ID });
const DEFAULT_MODE = settings.get_string(KEY_BAR_MODE) || "0";

// Performance optimization: Cache bar components
const barComponentCache = new Map();

// Define bar modes as factory functions to avoid widget reuse issues
const horizontalModes = new Map([
  ["0", [NormalBar, true, "Normal"]],
  ["1", [FocusBar, true, "Focus"]],
  ["2", [FloatingBar, false, "Floating"]],
  ["3", [MinimalBar, true, "Minimal"]],
  ["4", [AnoonBar, false, "Anoon"]],
  ["5", [WindowsTaskbar, false, "Windows Taskbar"]],
  ["6", [IslandBar, false, "Dynamic"]],
  ["7", [NotchBar, false, "Notch"]],
  ["8", [SaadiBar, true, "Saadi"]],
]);

const verticalModes = new Map([
  ["9", [VerticalBar, false, "Vertical Bar"]],
  ["10", [VerticalBarPinned, true, "Vertical Bar Pinned"]],
]);

const modes = new Map([...horizontalModes, ...verticalModes]);

const shouldShowCorners = (monitor) => {
  const mode = currentShellMode.value[monitor] || DEFAULT_MODE;
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

/**
 * Cache for corner windows to avoid recreating them
 */
const cornerCache = new Map();

/**
 * Creates a corner for the bar with performance optimizations
 * @param {number} monitor - Monitor ID
 * @param {string} side - Side of the corner ("left" or "right")
 * @returns {Widget.Window} - Corner window
 */
const createCorner = (monitor, side) => {
  // Check if we already have a cached corner
  const cacheKey = `corner-${monitor}-${side}`;
  if (cornerCache.has(cacheKey)) {
    return cornerCache.get(cacheKey);
  }

  // Helper function to determine corner style
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

  // Create the corner window with optimized hooks
  const cornerWindow = Widget.Window({
    monitor,
    name: `barcorner${side[0]}${monitor}`,
    layer: "top",
    anchor: [
      getValidPosition(currentShellMode.value[monitor] || DEFAULT_MODE, barPosition.value),
      verticalModes.has(currentShellMode.value[monitor] || DEFAULT_MODE)
        ? side === "left" ? "top" : "bottom"
        : side
    ],
    exclusivity: "normal",
    visible: shouldShowCorners(monitor),
    child: (() => {
      // Create a fresh instance of RoundedCorner to avoid widget reuse issues
      return RoundedCorner(
        getCornerStyle(
          getValidPosition(currentShellMode.value[monitor] || DEFAULT_MODE, barPosition.value),
          verticalModes.has(currentShellMode.value[monitor] || DEFAULT_MODE)
        ),
        { className: "corner" }
      );
    })(),
    setup: (self) => {
      enableClickthrough(self);

      // Use a debounced update function for better performance
      let updateTimeout = 0;

      // Store the last state to avoid redundant updates
      let lastMode = currentShellMode.value[monitor] || DEFAULT_MODE;
      let lastPosition = barPosition.value;
      let lastVisibility = shouldShowCorners(monitor);
      let lastCornerStyle = getCornerStyle(
        getValidPosition(lastMode, lastPosition),
        verticalModes.has(lastMode)
      );
      let lastAnchorString = JSON.stringify([
        getValidPosition(lastMode, lastPosition),
        verticalModes.has(lastMode) ? side === "left" ? "top" : "bottom" : side
      ]);

      const updateCorner = () => {
        // Cancel any pending update
        if (updateTimeout) {
          GLib.source_remove(updateTimeout);
          updateTimeout = 0;
        }

        // Schedule a new update with debouncing (longer timeout)
        updateTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
          const mode = currentShellMode.value[monitor] || DEFAULT_MODE;
          const pos = getValidPosition(mode, barPosition.value);
          const isVert = verticalModes.has(mode);
          const shouldShow = shouldShowCorners(monitor);

          // Check if anything has actually changed
          const hasStateChanged =
            mode !== lastMode ||
            pos !== getValidPosition(lastMode, lastPosition) ||
            shouldShow !== lastVisibility;

          if (hasStateChanged) {
            // Only update if visibility changed
            if (self.visible !== shouldShow) {
              self.visible = shouldShow;
              lastVisibility = shouldShow;

              // Only update child and anchor if visible
              if (shouldShow) {
                const newCornerStyle = getCornerStyle(pos, isVert);
                // Destroy old child first to prevent widget reuse issues
                if (self.child && typeof self.child.destroy === 'function') {
                  self.child.destroy();
                }
                self.child = RoundedCorner(newCornerStyle, { className: "corner" });
                lastCornerStyle = newCornerStyle;

                const newAnchor = [pos, isVert ? side === "left" ? "top" : "bottom" : side];
                self.anchor = newAnchor;
                lastAnchorString = JSON.stringify(newAnchor);

                self.show_all();
              }
            } else if (shouldShow) {
              // If visibility didn't change but we're visible, check if we need to update the corner style
              const newCornerStyle = getCornerStyle(pos, isVert);
              const newAnchor = [pos, isVert ? side === "left" ? "top" : "bottom" : side];
              const newAnchorString = JSON.stringify(newAnchor);

              // Only update if necessary
              if ((self.child && lastCornerStyle !== newCornerStyle) ||
                  lastAnchorString !== newAnchorString) {
                // Destroy old child first to prevent widget reuse issues
                if (self.child && typeof self.child.destroy === 'function') {
                  self.child.destroy();
                }
                self.child = RoundedCorner(newCornerStyle, { className: "corner" });
                self.anchor = newAnchor;

                // Update cached values
                lastCornerStyle = newCornerStyle;
                lastAnchorString = newAnchorString;

                self.show_all();
              }
            }

            // Update cached mode and position
            lastMode = mode;
            lastPosition = barPosition.value;
          }

          updateTimeout = 0;
          return GLib.SOURCE_REMOVE;
        });
      };

      // Use a single hook for both variables to reduce redundant updates
      const hookId1 = self.hook(currentShellMode, updateCorner);
      const hookId2 = self.hook(barPosition, updateCorner);

      // Properly handle destruction to prevent GC issues
      self.connect('destroy', () => {
        if (updateTimeout) {
          GLib.source_remove(updateTimeout);
          updateTimeout = 0;
        }

        // Unhook to prevent memory leaks
        if (hookId1) self.unhook(hookId1);
        if (hookId2) self.unhook(hookId2);

        // Properly destroy child widget
        if (self.child && typeof self.child.destroy === 'function') {
          self.child.destroy();
        }

        // Clear child reference to help GC
        self.child = null;

        // Remove from cache
        cornerCache.delete(cacheKey);
      });
    },
  });

  // Cache the corner window
  cornerCache.set(cacheKey, cornerWindow);

  return cornerWindow;
};

const getAnchor = (mode) => {
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


// Cache user options to avoid repeated calls to asyncGet()
let cachedOptions = null;
const getOptions = () => {
  if (!cachedOptions) {
    cachedOptions = userOptions.asyncGet();

    // Set up a timer to refresh the cache periodically (every 30 seconds)
    const intervalId = Utils.interval(30000, () => {
      cachedOptions = userOptions.asyncGet();
      return true; // Continue the interval
    });

    // Register the interval for cleanup
    if (globalThis.cleanupRegistry && typeof globalThis.cleanupRegistry.registerInterval === 'function') {
      globalThis.cleanupRegistry.registerInterval(intervalId);
    }
  }
  return cachedOptions;
};

/**
 * Creates a bar for the specified monitor
 * Performance optimized version that:
 * 1. Caches components to avoid recreating them
 * 2. Reduces logging to improve performance
 * 3. Uses more efficient reactivity patterns
 * 4. Properly handles widget destruction to prevent GC issues
 */
export const Bar = async (monitor = 0) => {
  // Check if we already have a cached bar for this monitor
  const cacheKey = `bar-${monitor}`;
  if (barComponentCache.has(cacheKey)) {
    // Log bar usage for debugging
    console.log(`Using cached bar for monitor ${monitor}`);
    return barComponentCache.get(cacheKey);
  }

  const opts = getOptions();
  const mode = currentShellMode.value[monitor] || DEFAULT_MODE;

  // Create corners only once and cache them
  const corners = ["left", "right"].map((side) => createCorner(monitor, side));

  // Create stack children only once, with proper cleanup
  const children = {};
  for (const [key, [component]] of modes) {
    try {
      // Use the component directly, it's already a widget
      children[key] = component;
    } catch (error) {
      // Log errors in component creation
      console.log(`Error creating component for mode ${key}: ${error}`);
    }
  }

  // Create the stack with optimized hooks
  const stack = Widget.Stack({
    homogeneous: false,
    transition: "slide_up_down",
    transitionDuration: opts.animations.durationSmall,
    children: children,
    setup: (self) => {
      // Use a single hook with a debounced update
      let updateTimeout = 0;

      // Store the last mode to avoid redundant updates
      let lastMode = currentShellMode.value[monitor] || DEFAULT_MODE;

      const updateStack = () => {
        if (updateTimeout) {
          GLib.source_remove(updateTimeout);
          updateTimeout = 0;
        }

        // Use a longer debounce time to reduce frequency of updates
        updateTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
          const newMode = currentShellMode.value[monitor] || DEFAULT_MODE;

          // Only update if the mode has actually changed
          if (self.shown !== newMode && lastMode !== newMode) {
            self.shown = newMode;
            lastMode = newMode;

            // Log bar mode updates
            console.log(`Bar stack for monitor ${monitor} updated to mode ${newMode}`);
          }

          updateTimeout = 0;
          return GLib.SOURCE_REMOVE;
        });
      };

      // Connect to the hook
      const hookId = self.hook(currentShellMode, updateStack);
      self.shown = mode;

      // Properly handle destruction to prevent GC issues
      self.connect('destroy', () => {
        if (updateTimeout) {
          GLib.source_remove(updateTimeout);
          updateTimeout = 0;
        }

        // Unhook to prevent memory leaks
        if (hookId) {
          self.unhook(hookId);
        }

        // Properly clean up all children
        if (self.children) {
          // Explicitly destroy each child widget
          Object.values(self.children).forEach(child => {
            if (child && typeof child.destroy === 'function') {
              child.destroy();
            }
          });
          self.children = {};
        }
      });
    },
  });

  // Create the bar window with optimized hooks
  const bar = Widget.Window({
    monitor,
    name: `bar${monitor}`,
    anchor: getAnchor(mode),
    exclusivity: "exclusive",
    visible: true,
    child: stack,
    setup: (self) => {
      // Use a single hook with a debounced update for both currentShellMode and barPosition
      let updateTimeout = 0;

      // Store the last mode and anchor to avoid redundant updates
      let lastMode = currentShellMode.value[monitor] || DEFAULT_MODE;
      let lastPosition = barPosition.value;
      let lastAnchorString = JSON.stringify(getAnchor(lastMode));

      const updateAnchor = () => {
        // Cancel any pending update
        if (updateTimeout) {
          GLib.source_remove(updateTimeout);
          updateTimeout = 0;
        }

        // Use a longer debounce time to reduce frequency of updates
        updateTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
          const newMode = currentShellMode.value[monitor] || DEFAULT_MODE;
          const newPosition = barPosition.value;

          // Only proceed if mode or position has actually changed
          if (newMode !== lastMode || newPosition !== lastPosition) {
            const newAnchor = getAnchor(newMode);
            const newAnchorString = JSON.stringify(newAnchor);

            // Only update if the anchor has actually changed
            if (newAnchorString !== lastAnchorString) {
              self.anchor = newAnchor;

              // Log bar anchor updates
              console.log(`Bar window for monitor ${monitor} anchor updated for mode ${newMode}`);

              // Update the stored values
              lastMode = newMode;
              lastPosition = newPosition;
              lastAnchorString = newAnchorString;
            }
          }

          updateTimeout = 0;
          return GLib.SOURCE_REMOVE;
        });
      };

      // Use a single hook for both variables and store the hook IDs
      const hookId1 = self.hook(currentShellMode, updateAnchor);
      const hookId2 = self.hook(barPosition, updateAnchor);

      // Properly handle destruction to prevent GC issues
      self.connect('destroy', () => {
        if (updateTimeout) {
          GLib.source_remove(updateTimeout);
          updateTimeout = 0;
        }

        // Unhook to prevent memory leaks
        if (hookId1) self.unhook(hookId1);
        if (hookId2) self.unhook(hookId2);

        // Properly destroy child widget
        if (self.child && typeof self.child.destroy === 'function') {
          self.child.destroy();
        }

        // Clear child reference to help GC
        self.child = null;

        // Remove from cache
        barComponentCache.delete(cacheKey);
      });
    },
  });

  // Cache the result
  const result = [bar, ...corners];
  barComponentCache.set(cacheKey, result);

  return result;
};
