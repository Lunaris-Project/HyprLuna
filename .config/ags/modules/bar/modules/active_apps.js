const { Gtk } = imports.gi;
import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
const { Box, Button } = Widget;
import Hyprland from "resource:///com/github/Aylur/ags/service/hyprland.js";
import { setupCursorHover } from "../../.widgetutils/cursorhover.js";
import GLib from "gi://GLib";

/**
 * Cache for icon validation to avoid repeated checks
 */
const iconValidityCache = new Map();

/**
 * Check if an icon name is valid, with caching for performance
 * @param {string} iconName - The icon name to check
 * @returns {boolean} - Whether the icon is valid
 */
const isIconValid = (iconName) => {
  if (iconValidityCache.has(iconName)) {
    return iconValidityCache.get(iconName);
  }

  const isValid = Gtk.IconTheme.get_default().has_icon(iconName);
  iconValidityCache.set(iconName, isValid);
  return isValid;
};

// Cache for app buttons to avoid recreating them
const appButtonCache = new Map();

/**
 * Creates a button for an application with proper cleanup
 * @param {object} client - The client object from Hyprland
 * @returns {Widget.Button} - The app button
 */
const AppButton = ({ client }) => {
  // Create a cache key based on client address
  const cacheKey = client.address;

  // Check if we already have a cached button
  if (appButtonCache.has(cacheKey)) {
    return appButtonCache.get(cacheKey);
  }

  // Determine icon name with fallback
  const iconName = client.class
    ? `${client.class.toLowerCase()}`
    : "application-default";

  // Check if icon is valid using cached function
  const isValidIcon = isIconValid(iconName);

  // Create the button with proper cleanup
  const button = Button({
    className: `bar-active-app ${client.class === Hyprland.active.client.class ? "focused" : ""}`,
    onClicked: () => {
      Utils.execAsync([
        "hyprctl",
        "dispatch",
        "focuswindow",
        `address:${client.address}`,
      ]).catch(print);
    },
    child: Box({
      vertical: true,
      tooltipText: client.title || client.class || "Unknown",
      setup: setupCursorHover,
      spacing: 5,
      vpack: "end",
      children: [
        Box({
          vpack: "center",
          spacing: 5,
          className: "spacing-h-5 txt-norm",
          children: [
            Widget.Icon({
              icon: isValidIcon ? iconName : "windows-exe-symbolic",
              size: 22,
            }),
            Widget.Label({
              truncate: "end",
              maxWidthChars: 10,
              className: "txt-small onSurfaceVariant",
              label: client.title || client.class || "Unknown",
            }),
          ],
        }),
        Box({
          vpack: "end",
          css: `min-width:10rem`,
          className: "active-window-tb"
        })
      ],
      // Add proper cleanup for the box
      setup: (self) => {
        // Handle destruction to prevent GC issues
        self.connect('destroy', () => {
          // Remove from cache when destroyed
          if (appButtonCache.has(cacheKey)) {
            appButtonCache.delete(cacheKey);
          }

          // Clear children to help GC
          if (self.children) {
            self.children = [];
          }
        });
      }
    }),
    // Add proper cleanup for the button
    setup: (self) => {
      // Handle destruction to prevent GC issues
      self.connect('destroy', () => {
        // Remove from cache when destroyed
        if (appButtonCache.has(cacheKey)) {
          appButtonCache.delete(cacheKey);
        }
      });
    }
  });

  // Cache the button
  appButtonCache.set(cacheKey, button);

  return button;
};

/**
 * Creates the active apps widget with performance optimizations
 * @returns {Widget.Box} - The active apps widget
 */
export default () => {
  const box = Box({
    className: "bar-active-apps spacing-h-5",
    setup: (self) => {
      // Debounced update function to avoid excessive updates
      let updateTimeout = 0;

      const updateApps = () => {
        // Cancel any pending update
        if (updateTimeout) {
          GLib.source_remove(updateTimeout);
          updateTimeout = 0;
        }

        // Schedule a new update with debouncing
        updateTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
          const clients = Hyprland.clients;

          // Only update if there are changes
          const filteredClients = clients.filter((client) => !client.class?.includes("unset"));
          const newChildren = filteredClients.map((client) => AppButton({ client }));

          // Check if we need to update (different number of clients or different clients)
          const needsUpdate = self.children.length !== newChildren.length;

          if (needsUpdate) {
            self.children = newChildren;
          }

          updateTimeout = 0;
          return GLib.SOURCE_REMOVE;
        });
      };

      // Use reactive hooks instead of polling
      const hookId1 = self.hook(Hyprland, updateApps, "client-added");
      const hookId2 = self.hook(Hyprland, updateApps, "client-removed");
      const hookId3 = self.hook(Hyprland.active.client, updateApps, "changed");

      // Initial update
      updateApps();

      // Properly handle destruction to prevent GC issues
      self.connect('destroy', () => {
        if (updateTimeout) {
          GLib.source_remove(updateTimeout);
          updateTimeout = 0;
        }

        // Unhook to prevent memory leaks
        if (hookId1) self.unhook(hookId1);
        if (hookId2) self.unhook(hookId2);
        if (hookId3) self.unhook(hookId3);

        // Clear children to help GC
        if (self.children) {
          // Explicitly destroy each child widget
          self.children.forEach(child => {
            if (child && typeof child.destroy === 'function') {
              child.destroy();
            }
          });
          self.children = [];
        }

        // Clear the app button cache
        appButtonCache.clear();
      });
    }
  });

  return box;
};
