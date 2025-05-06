const { Gtk, GLib } = imports.gi;
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const { EventBox} = Widget;
import { RoundedCorner } from './../.commonwidgets/cairo_roundedcorner.js';
import Hyprland from 'resource:///com/github/Aylur/ags/service/hyprland.js';
import Applications from 'resource:///com/github/Aylur/ags/service/applications.js';
const { Box, Revealer } = Widget;
import { setupCursorHover } from '../.widgetutils/cursorhover.js';
import { getAllFiles } from './icons.js'
import { getValidIcon } from '../.miscutils/icon_handling.js';

// Simple file to store dock pin state
const DOCK_PIN_FILE = GLib.build_filenamev([GLib.get_user_cache_dir(), 'ags', 'dock_pinned']);

// Function to load pin state from file
const loadPinState = () => {
    try {
        if (GLib.file_test(DOCK_PIN_FILE, GLib.FileTest.EXISTS)) {
            const [success, contents] = GLib.file_get_contents(DOCK_PIN_FILE);
            if (success) {
                const text = new TextDecoder().decode(contents).trim();
                return text === 'true';
            }
        }
    } catch (error) {
        console.error('Error loading dock pin state:', error);
    }
    return false;
};

// Function to save pin state to file
const savePinState = (pinned) => {
    try {
        // Ensure directory exists
        const dir = GLib.path_get_dirname(DOCK_PIN_FILE);
        if (!GLib.file_test(dir, GLib.FileTest.EXISTS)) {
            GLib.mkdir_with_parents(dir, 0o755);
        }

        // Write state to file
        const data = new TextEncoder().encode(pinned ? 'true' : 'false');
        GLib.file_set_contents(DOCK_PIN_FILE, data);
    } catch (error) {
        console.error('Error saving dock pin state:', error);
    }
};

const icon_files = userOptions.asyncGet().icons.searchPaths.map(e => getAllFiles(e)).flat(1)
let dockSize = userOptions.asyncGet().dock.dockSize
const elevate = userOptions.asyncGet().etc.widgetCorners ? "dock-bg dock-round " : "elevation dock-bg"
let appSpacing = dockSize / 15

// Export isPinned as a variable that can be accessed from outside
// Initialize from saved state
export let isPinned = loadPinState();
let cachePath = new Map()

// Create a list of callbacks to be called when isPinned changes
const pinStateCallbacks = []

// Function to register a callback for pin state changes
export function onPinStateChanged(callback) {
    pinStateCallbacks.push(callback)
    return pinStateCallbacks.length - 1 // Return the index for potential removal
}

// Function to remove a callback
export function removePinStateCallback(index) {
    if (index >= 0 && index < pinStateCallbacks.length) {
        pinStateCallbacks[index] = null
    }
}

let timers = []

function clearTimes() {
    timers.forEach(e => GLib.source_remove(e))
    timers = []
}

function ExclusiveWindow(client) {
    const fn = [
        (client) => !(client !== null && client !== undefined),
        // Jetbrains
        (client) => client.title.includes("win"),
        // Vscode
        (client) => client.title === '' && client.class === ''
    ]

    for (const item of fn) { if (item(client)) { return true } }
    return false
}

const focus = ({ address }) => Utils.execAsync(`hyprctl dispatch focuswindow address:${address}`).catch(print);

const getIconPath = (appClass, fromCache = true) => {
    // Try to find the app in Applications.list to get its icon_name
    const app = Applications.list.find(a =>
        a.name?.toLowerCase() === appClass?.toLowerCase() ||
        a.desktop?.toLowerCase().includes(appClass?.toLowerCase())
    );

    // If found and has icon_name, use it directly
    if (app && app.icon_name) {
        if (fromCache && cachePath.has(appClass.toLowerCase())) {
            return cachePath.get(appClass.toLowerCase());
        }

        if (fromCache) {
            cachePath.set(appClass.toLowerCase(), app.icon_name);
        }

        return app.icon_name;
    }

    // Otherwise fall back to the standard icon lookup
    return getValidIcon(appClass, icon_files, fromCache, cachePath);
};

const DockSeparator = (props = {}) => Box({
    ...props,
    className: 'dock-separator',
})

export const PinButton = () => Widget.Button({
    tooltipText: 'Pin Dock',
    css: `margin: 0 ${appSpacing}px;padding: 0 10px`,
    child: Widget.Box({
        homogeneous: true,
        child: Widget.Icon({
            icon:"logo-symbolic",
            size:dockSize
        })
    }),
    onClicked: (self) => {
        // Toggle the pin state
        isPinned = !isPinned

        // Update the button appearance
        self.className = `${isPinned ? "pinned-dock-app-btn dock-app-btn-animate" : " dock-app-btn-animate"}`

        // Save the pin state to file to persist across reboots
        savePinState(isPinned);

        // Notify all registered callbacks about the pin state change
        pinStateCallbacks.forEach(callback => {
            if (callback) callback(isPinned)
        })
    },
    setup: (self) => {
        setupCursorHover(self);

        // Set initial button state based on loaded pin state
        self.className = `${isPinned ? "pinned-dock-app-btn dock-app-btn-animate" : " dock-app-btn-animate"}`;
    },
})

const AppButton = ({ icon, ...rest }) => Widget.Revealer({
    attribute: {
        'workspace': 0
    },
    revealChild: false,
    transition: 'slide_right',
    transitionDuration: userOptions.asyncGet().animations.durationLarge,
    child: Widget.Button({
        ...rest,
        className: 'dock-app-btn dock-app-btn-animate',
        css: `margin: 0 ${appSpacing}px`,
        child: Widget.Box({
            child: Widget.Overlay({
                child: Widget.Box({
                    homogeneous: true,
                    className: 'dock-app-icon',
                    child: Widget.Icon({
                        icon: icon,
                        size:dockSize
                    }),
                }),
                overlays: [Widget.Box({
                    class_name: 'indicator',
                    vpack: 'end',
                    hpack: 'center',
                })],
            }),
        }),
        setup: (button) => {
            setupCursorHover(button);
        }
    })
});

const Taskbar = (monitor) => Widget.Box({
    className: 'dock-apps',
    attribute: {
        monitor: monitor,
        'map': new Map(),
        'clientSortFunc': (a, b) => {
            return a.attribute.workspace > b.attribute.workspace;
        },
        'update': (box) => {
            for (let i = 0; i < Hyprland.clients.length; i++) {
                const client = Hyprland.clients[i];
                if (client["pid"] == -1) return;
                const appClass = client.class;
                // Try to get icon from icon pack, if not found it will fall back to the app's original icon
                const path = getIconPath(appClass);
                const newButton = AppButton({
                    icon: path,
                    tooltipText: `${client.title} (${appClass})`,
                    onClicked: () => focus(client),
                });
                newButton.attribute.workspace = client.workspace.id;
                newButton.revealChild = true;
                box.attribute.map.set(client.address, newButton);
            }
            box.children = Array.from(box.attribute.map.values());
        },
        'add': (box, address) => {
            if (!address) {
                box.attribute.update(box);
                return;
            }
            const newClient = Hyprland.clients.find(client => {
                return client.address == address;
            });
            if (ExclusiveWindow(newClient)) { return }
            const appClass = newClient.class;
            // Try to get icon from icon pack, if not found it will fall back to the app's original icon
            const path = getIconPath(appClass);
            const newButton = AppButton({
                icon: path,
                tooltipText: `${newClient.title} (${appClass})`,
                onClicked: () => focus(newClient),
            })
            newButton.attribute.workspace = newClient.workspace.id;
            box.attribute.map.set(address, newButton);
            box.children = Array.from(box.attribute.map.values());
            newButton.revealChild = true;
        },
        'remove': (box, address) => {
            if (!address) return;

            const removedButton = box.attribute.map.get(address);
            if (!removedButton) return;
            removedButton.revealChild = false;

            // Store the timeout ID so we can clean it up if needed
            const timeoutId = Utils.timeout(userOptions.asyncGet().animations.durationLarge, () => {
                // Check if the widget still exists before trying to destroy it
                if (removedButton && !removedButton.is_destroyed) {
                    try {
                        removedButton.destroy();
                    } catch (error) {
                        console.log(`Error destroying button: ${error.message}`);
                    }
                }

                // Update the map and children only if the box still exists
                if (box && !box.is_destroyed) {
                    box.attribute.map.delete(address);
                    try {
                        box.children = Array.from(box.attribute.map.values());
                    } catch (error) {
                        console.log(`Error updating box children: ${error.message}`);
                    }
                }
            })

            // Register the timeout for cleanup
            if (globalThis.cleanupRegistry) {
                globalThis.cleanupRegistry.registerTimeout(timeoutId);
            }
        },
    },
    setup: (self) => {
        self.hook(Hyprland, (box, address) => box.attribute.add(box, address), 'client-added')
            .hook(Hyprland, (box, address) => box.attribute.remove(box, address), 'client-removed')
        Utils.timeout(100, () => self.attribute.update(self));
    },
});

/**
 * Find an application by its ID or name
 * @param {string} term - The application ID or name to search for
 * @returns {object|null} - The found application or null
 */
const findApp = (term) => {
    // First try direct query
    const queryResult = Applications.query(term)?.[0];
    if (queryResult) return { app: queryResult, term };

    // Handle special cases
    let searchTerm = term.toLowerCase();

    // Special case for Ghostty
    if (searchTerm === 'com.mitchellh.ghostty' || searchTerm === 'ghostty') {
        searchTerm = 'ghostty';
    }

    // Special case for JetBrains products
    if (searchTerm.includes('jetbrains')) {
        searchTerm = searchTerm.replace('jetbrains-', '');
    }

    // Try to find by desktop file or name with the possibly modified search term
    const app = Applications.list.find(a =>
        a.desktop?.toLowerCase().includes(searchTerm) ||
        a.name?.toLowerCase().includes(searchTerm)
    );

    if (app) return { app, term };

    return null;
};

const PinnedApps = () => Widget.Box({
    class_name: 'dock-apps',
    homogeneous: true,
    children: userOptions.asyncGet().dock.pinnedApps
        .map(findApp)
        .filter(result => result !== null)
        .map(({ app, term = true }) => {
            // Get the icon for the application
            // Our improved getIconPath will try app.icon_name first, then fall back to icon theme
            const icon = app.icon_name || getIconPath(app.name, false);

            const newButton = AppButton({
                icon: icon,
                onClicked: () => {
                    for (const client of Hyprland.clients) {
                        if (client.class.toLowerCase().includes(term))
                            return focus(client);
                    }
                    app.launch();
                },
                onMiddleClick: () => app.launch(),
                tooltipText: app.name,
                setup: (self) => {
                    self.revealChild = true;
                    self.hook(Hyprland, button => {
                        const running = Hyprland.clients
                            .find(client => client.class.toLowerCase().includes(term)) || false;

                        button.toggleClassName('notrunning', !running);
                        button.toggleClassName('focused', Hyprland.active.client.address == running?.address);
                        button.set_tooltip_text(running ? running.title : app.name);
                    }, 'notify::clients')
                },
            });
            newButton.revealChild = true;
            return newButton;
        }),
});
export default (monitor = 0) => {
    const dockContent = Box({
        children:[
            userOptions.asyncGet().etc.widgetCorners ? RoundedCorner('bottomright', {vpack:"end",className: 'corner corner-colorscheme'}) : null,
            Box({
                className: `${elevate}`,
                css:`padding:${dockSize / 85}rem`,
                children:[
                    PinButton(),
                    PinnedApps(),
                    DockSeparator(),
                    Taskbar(),
                ]}),
            userOptions.asyncGet().etc.widgetCorners ? RoundedCorner('bottomleft',{vpack:"end", className: 'corner corner-colorscheme'}) : null,
        ]
    })
    const dockRevealer = Revealer({
        attribute: {
            'updateShow': self => { // I only use mouse to resize. I don't care about keyboard resize if that's a thing
                if (userOptions.asyncGet().dock.monitorExclusivity)
                    self.revealChild = Hyprland.active.monitor.id === monitor;
                else
                    self.revealChild = true;

                return self.revealChild
            }
        },
        // Set initial reveal state based on pin status
        revealChild: isPinned,
        transition: 'slide_up',
        transitionDuration: userOptions.asyncGet().animations.durationSmall,
        child: dockContent,
        setup: (self) => {
            const callback = (self, trigger) => {
                if (!userOptions.asyncGet().dock.trigger.includes(trigger)) return
                const flag = self.attribute.updateShow(self)

                if (flag) clearTimes();

                const hidden = userOptions.asyncGet().dock.autoHide.find(e => e["trigger"] === trigger)

                if (hidden) {
                    let id = Utils.timeout(hidden.interval, () => {
                        if (!isPinned) { self.revealChild = false }
                        timers = timers.filter(e => e !== id)
                    })
                    timers.push(id)
                }
            }

            self
                // .hook(Hyprland, (self) => self.attribute.updateShow(self))
                .hook(Hyprland.active.workspace, self => callback(self, "workspace-active"))
                .hook(Hyprland.active.client, self => callback(self, "client-active"))
                .hook(Hyprland, self => callback(self, "client-added"), "client-added")
                .hook(Hyprland, self => callback(self, "client-removed"), "client-removed")
        },
    })
    return EventBox({
        onHover: () => {
            dockRevealer.revealChild = true;
            clearTimes()
        },
        child: Box({
            homogeneous: true,
            css: `min-height: ${userOptions.asyncGet().dock.hiddenThickness}px;`,
            children: [dockRevealer],
        }),
        setup: self => self.on("leave-notify-event", () => {
            if (!isPinned) dockRevealer.revealChild = false;
            clearTimes()
        })
    })
}
