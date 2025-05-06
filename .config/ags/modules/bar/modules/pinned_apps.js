const { Gtk } = imports.gi;
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
const { Box, Button } = Widget;
import Applications from 'resource:///com/github/Aylur/ags/service/applications.js';
import { setupCursorHover } from '../../.widgetutils/cursorhover.js';
import userOptions from "../../.configuration/user_options.js";

// Cache for app buttons to avoid recreating them
const appButtonCache = new Map();

/**
 * Creates an app button with performance optimizations and proper cleanup
 * @param {object} props - Button properties
 * @returns {Widget.Button} - The app button
 */
const AppButton = ({ icon, name, ...rest }) => {
    // Create a cache key based on icon and name
    const cacheKey = `${icon}-${name}`;

    // Check if we already have a cached button
    if (appButtonCache.has(cacheKey)) {
        return appButtonCache.get(cacheKey);
    }

    // Create a new button with proper cleanup
    const button = Button({
        className: 'bar-pinned-btn',
        child: Box({
            className: 'spacing-h-5 txt-norm',
            hpack: 'center',
            hexpand: true,
            children: [
                Widget.Icon({
                    icon: icon || '',
                    size: 28,
                }),
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
        tooltipText: name,
        setup: (self) => {
            // Apply cursor hover effect
            setupCursorHover(self);

            // Handle destruction to prevent GC issues
            self.connect('destroy', () => {
                // Remove from cache when destroyed
                if (appButtonCache.has(cacheKey)) {
                    appButtonCache.delete(cacheKey);
                }
            });
        },
        ...rest,
    });

    // Cache the button
    appButtonCache.set(cacheKey, button);

    return button;
};

// Cache for user options
let cachedOptions = null;
let cachedPinnedApps = [];

/**
 * Get pinned apps from user options with caching
 * @returns {string[]} - Array of pinned app IDs
 */
const getPinnedApps = () => {
    if (!cachedOptions) {
        cachedOptions = userOptions.asyncGet();
        cachedPinnedApps = cachedOptions.bar?.pinnedApps || [];

        // Set up a timer to refresh the cache periodically (every 30 seconds)
        const intervalId = Utils.interval(30000, () => {
            const newOptions = userOptions.asyncGet();
            const newPinnedApps = newOptions.bar?.pinnedApps || [];

            // Only update if the pinned apps have changed
            if (JSON.stringify(cachedPinnedApps) !== JSON.stringify(newPinnedApps)) {
                cachedOptions = newOptions;
                cachedPinnedApps = newPinnedApps;
                return true; // Continue the interval
            }

            return true; // Continue the interval
        });

        // Register the interval for cleanup
        if (globalThis.cleanupRegistry && typeof globalThis.cleanupRegistry.registerInterval === 'function') {
            globalThis.cleanupRegistry.registerInterval(intervalId);
        }
    }

    return cachedPinnedApps;
};

/**
 * Creates the pinned apps widget with performance optimizations
 * @returns {Widget.Box} - The pinned apps widget
 */
export default () => {
    const pinnedApps = getPinnedApps();

    // Create the box with reactive updates
    const box = Box({
        hexpand: true,
        hpack: 'center',
        className: 'bar-pinned-apps',
        spacing: 10,
        setup: (self) => {
            // Update the children when Applications.list changes
            const hookId = self.hook(Applications, () => {
                self.children = pinnedApps.map(appId => {
                    const app = Applications.list.find(a =>
                        a.desktop?.toLowerCase().includes(appId.toLowerCase()) ||
                        a.name?.toLowerCase().includes(appId.toLowerCase())
                    );

                    if (!app) return null;

                    return AppButton({
                        icon: app.icon_name,
                        name: app.name,
                        onClicked: () => {
                            app.launch();
                        },
                    });
                }).filter(Boolean);
            });

            // Properly handle destruction to prevent GC issues
            self.connect('destroy', () => {
                // Unhook to prevent memory leaks
                if (hookId) self.unhook(hookId);

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

                // Clear the app button cache when the widget is destroyed
                appButtonCache.clear();
            });
        },
        children: pinnedApps.map(appId => {
            const app = Applications.list.find(a =>
                a.desktop?.toLowerCase().includes(appId.toLowerCase()) ||
                a.name?.toLowerCase().includes(appId.toLowerCase())
            );

            if (!app) return null;

            return AppButton({
                icon: app.icon_name,
                name: app.name,
                onClicked: () => {
                    app.launch();
                },
            });
        }).filter(Boolean),
    });

    return box;
};
