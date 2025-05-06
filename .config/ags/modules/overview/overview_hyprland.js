// TODO
// - Make client destroy/create not destroy and recreate the whole thing
// - Active ws hook optimization: only update when moving to next group
//
const { Gdk, Gtk } = imports.gi;
const { Gravity } = imports.gi.Gdk;
import App from 'resource:///com/github/Aylur/ags/app.js';
import Variable from 'resource:///com/github/Aylur/ags/variable.js';
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';

import Hyprland from 'resource:///com/github/Aylur/ags/service/hyprland.js';
const { execAsync, exec } = Utils;
import { setupCursorHoverGrab } from '../.widgetutils/cursorhover.js';
import { dumpToWorkspace, swapWorkspace } from "./actions.js";
import { iconExists, substitute } from "../.miscutils/icons.js";
import { monitors } from '../.commondata/hyprlanddata.js';
import { MaterialIcon } from '../.commonwidgets/materialicon.js';
import { RoundedCorner } from '../.commonwidgets/cairo_roundedcorner.js';
// Cache user options
const userOpts = userOptions.asyncGet();
const NUM_OF_WORKSPACES_SHOWN = 5 * userOpts.overview.numOfRows;
const TARGET = [Gtk.TargetEntry.new('text/plain', Gtk.TargetFlags.SAME_APP, 0)];

const overviewTick = Variable(false);

export default (overviewMonitor = 0) => {
    const clientMap = new Map();
    const ContextMenuWorkspaceArray = ({ label, actionFunc, thisWorkspace }) => Widget.MenuItem({
        label: `${label}`,
        setup: (menuItem) => {
            let submenu = new Gtk.Menu();
            submenu.className = 'menu';

            const offset = Math.floor((Hyprland.active.workspace.id - 1) / NUM_OF_WORKSPACES_SHOWN) * NUM_OF_WORKSPACES_SHOWN;
            const startWorkspace = offset + 1;
            const endWorkspace = startWorkspace + NUM_OF_WORKSPACES_SHOWN - 1;
            for (let i = startWorkspace; i <= endWorkspace; i++) {
                let button = new Gtk.MenuItem({
                    label: `Workspace ${i}`
                });
                button.connect("activate", () => {
                    actionFunc(thisWorkspace, i);
                    overviewTick.setValue(!overviewTick.value);
                });
                submenu.append(button);
            }
            menuItem.set_reserve_indicator(true);
            menuItem.set_submenu(submenu);
        }
    })

    const Window = ({ address, at: [x, y], size: [w, h], workspace: { id }, class: c, initialClass, monitor, title, xwayland }, screenCoords) => {
        const scale = userOpts.overview.scale || 0.24;
        const revealInfoCondition = (Math.min(w, h) * scale > 70);
        if (w <= 0 || h <= 0 || (c === '' && title === '')) return null;

        // Screen coordinate adjustments
        if (screenCoords.x != 0) x -= screenCoords.x;
        if (screenCoords.y != 0) y -= screenCoords.y;
        if (x + w <= 0) x += (Math.floor(x / monitors[monitor].width) * monitors[monitor].width);
        else if (x < 0) { w = x + w; x = 0; }
        else if (y + h <= 0) x += (Math.floor(y / monitors[monitor].height) * monitors[monitor].height);
        else if (y < 0) { h = y + h; y = 0; }
        if (monitors.length - 1 < monitor) {
            monitor = monitors.length - 1;
        }
        if (x + w > monitors[monitor].width) w = monitors[monitor].width - x;
        if (y + h > monitors[monitor].height) h = monitors[monitor].height - y;

        if(c.length == 0) c = initialClass;
        const iconName = substitute(c);
        const iconSize = Math.min(w, h) * scale / 2.5;
        const appIcon = iconExists(iconName) ? Widget.Icon({
            icon: iconName,
            size: iconSize,
        }) : MaterialIcon('terminal', 'gigantic', {
            css: `font-size: ${iconSize}px`,
        });

        return Widget.Button({
            attribute: {
                address, x, y, w, h, ws: id,
                updateIconSize: (self) => {
                    appIcon.size = Math.min(self.attribute.w, self.attribute.h) * scale / 2.5;
                },
            },
            className: 'overview-tasks-window',
            hpack: 'start',
            vpack: 'start',
            css: `
                margin-left: ${Math.round(x * scale)}px;
                margin-top: ${Math.round(y * scale)}px;
                margin-right: -${Math.round((x + w) * scale)}px;
                margin-bottom: -${Math.round((y + h) * scale)}px;
            `,
            onClicked: (self) => {
                Hyprland.messageAsync(`dispatch focuswindow address:${address}`);
                App.closeWindow('overview');
            },
            onMiddleClickRelease: () => Hyprland.messageAsync(`dispatch closewindow address:${address}`),
            onSecondaryClick: (button) => {
                button.toggleClassName('overview-tasks-window-selected', true);
                const menu = Widget.Menu({
                    className: 'menu',
                    children: [
                        Widget.MenuItem({
                            child: Widget.Label({
                                xalign: 0,
                                label: "Close (Middle-click)",
                            }),
                            onActivate: () => Hyprland.messageAsync(`dispatch closewindow address:${address}`),
                        }),
                        ContextMenuWorkspaceArray({
                            label: "Dump windows to workspace",
                            actionFunc: dumpToWorkspace,
                            thisWorkspace: Number(id)
                        }),
                        ContextMenuWorkspaceArray({
                            label: "Swap windows with workspace",
                            actionFunc: swapWorkspace,
                            thisWorkspace: Number(id)
                        }),
                    ],
                });
                menu.connect("deactivate", () => {
                    button.toggleClassName('overview-tasks-window-selected', false);
                })
                menu.connect("selection-done", () => {
                    button.toggleClassName('overview-tasks-window-selected', false);
                })
                menu.popup_at_widget(button.get_parent(), Gravity.SOUTH, Gravity.NORTH, null);
                button.connect("destroy", () => menu.destroy());
            },
            child: Widget.Box({
                homogeneous: true,
                child: Widget.Box({
                    vertical: true,
                    vpack: 'center',
                    children: [
                        appIcon,
                        Widget.Revealer({
                            transition: 'slide_right',
                            revealChild: revealInfoCondition,
                            child: Widget.Revealer({
                                transition: 'slide_down',
                                revealChild: revealInfoCondition,
                                child: Widget.Label({
                                    maxWidthChars: 1,
                                    truncate: 'end',
                                    className: `margin-top-5 ${xwayland ? 'txt txt-italic' : 'txt'}`,
                                    css: `
                                        font-size: ${Math.min(monitors[monitor].width, monitors[monitor].height) * scale / 14.6}px;
                                        margin: 0px ${Math.min(monitors[monitor].width, monitors[monitor].height) * scale / 10}px;
                                    `,
                                    label: (title.length <= 1 ? `${c}: ${title}` : title),
                                })
                            })
                        })
                    ]
                })
            }),
            tooltipText: `${c}: ${title}`,
            setup: (button) => {
                setupCursorHoverGrab(button);
                button.drag_source_set(Gdk.ModifierType.BUTTON1_MASK, TARGET, Gdk.DragAction.MOVE);
                button.drag_source_set_icon_name(substitute(c));
                button.connect('drag-begin', (button) => {
                    button.toggleClassName('overview-tasks-window-dragging', true);
                });
                button.connect('drag-data-get', (_w, _c, data) => {
                    data.set_text(address, address.length);
                    button.toggleClassName('overview-tasks-window-dragging', false);
                });
            },
        });
    }

    const Workspace = (index) => {
        const fixed = Widget.Box({
            attribute: {
                put: (widget, x, y) => {
                    if (!widget.attribute) return;
                    const newCss = `
                        margin-left: ${Math.round(x)}px;
                        margin-top: ${Math.round(y)}px;
                        margin-right: -${Math.round(x + (widget.attribute.w * userOpts.overview.scale))}px;
                        margin-bottom: -${Math.round(y + (widget.attribute.h * userOpts.overview.scale))}px;
                    `;
                    widget.css = newCss;
                    fixed.pack_start(widget, false, false, 0);
                },
                move: (widget, x, y) => {
                    if (!widget?.attribute) return;
                    const newCss = `
                        margin-left: ${Math.round(x)}px;
                        margin-top: ${Math.round(y)}px;
                        margin-right: -${Math.round(x + (widget.attribute.w * userOpts.overview.scale))}px;
                        margin-bottom: -${Math.round(y + (widget.attribute.h * userOpts.overview.scale))}px;
                    `;
                    widget.css = newCss;
                },
            }
        })

        const WorkspaceNumber = ({ index, ...rest }) => Widget.Label({
            className: 'overview-tasks-workspace-number',
            label: `${index}`,
            css: `
                margin: ${Math.min(monitors[overviewMonitor].width, monitors[overviewMonitor].height) * userOpts.overview.scale * userOpts.overview.wsNumMarginScale}px;
                font-size: ${monitors[overviewMonitor].height * userOpts.overview.scale * userOpts.overview.wsNumScale}px;
            `,
            setup: (self) => self.hook(Hyprland.active.workspace, (self) => {
                const currentGroup = Math.floor((Hyprland.active.workspace.id - 1) / NUM_OF_WORKSPACES_SHOWN);
                self.label = `${currentGroup * NUM_OF_WORKSPACES_SHOWN + index}`;
            }),
            ...rest,
        })

        const widget = Widget.Box({
            className: 'overview-tasks-workspace',
            vpack: 'center',
            css: `
                min-width: ${1 + Math.round(monitors[overviewMonitor].width * userOpts.overview.scale)}px;
                min-height: ${1 + Math.round(monitors[overviewMonitor].height * userOpts.overview.scale)}px;
            `,
            children: [Widget.EventBox({
                hexpand: true,
                onPrimaryClick: () => {
                    Hyprland.messageAsync(`dispatch workspace ${index}`);
                    App.closeWindow('overview');
                },
                setup: (eventbox) => {
                    eventbox.drag_dest_set(Gtk.DestDefaults.ALL, TARGET, Gdk.DragAction.COPY);
                    eventbox.connect('drag-data-received', (_w, _c, _x, _y, data) => {
                        const offset = Math.floor((Hyprland.active.workspace.id - 1) / NUM_OF_WORKSPACES_SHOWN) * NUM_OF_WORKSPACES_SHOWN;
                        Hyprland.messageAsync(`dispatch movetoworkspacesilent ${index + offset},address:${data.get_text()}`)
                        overviewTick.setValue(!overviewTick.value);
                    });
                },
                child: Widget.Overlay({
                    child: Widget.Box({}),
                    overlays: [
                        WorkspaceNumber({ index: index, hpack: 'start', vpack: 'start' }),
                        fixed
                    ]
                }),
            })],
        });

        const offset = Math.floor((Hyprland.active.workspace.id - 1) / NUM_OF_WORKSPACES_SHOWN) * NUM_OF_WORKSPACES_SHOWN;
        fixed.attribute.put(WorkspaceNumber(offset + index), 0, 0);

        widget.clear = () => {
            const offset = Math.floor((Hyprland.active.workspace.id - 1) / NUM_OF_WORKSPACES_SHOWN) * NUM_OF_WORKSPACES_SHOWN;
            clientMap.forEach((client, address) => {
                if (!client) return;
                if ((client.attribute.ws <= offset || client.attribute.ws > offset + NUM_OF_WORKSPACES_SHOWN) ||
                    (client.attribute.ws == offset + index)) {
                    client.destroy();
                    clientMap.delete(address);
                }
            });
        }

        widget.set = (clientJson, screenCoords) => {
            let c = clientMap.get(clientJson.address);
            if (c) {
                if (c.attribute?.ws !== clientJson.workspace.id) {
                    c.destroy();
                    clientMap.delete(clientJson.address);
                }
                else {
                    c.attribute.w = clientJson.size[0];
                    c.attribute.h = clientJson.size[1];
                    c.attribute.updateIconSize(c);
                    fixed.attribute.move(c,
                        Math.max(0, clientJson.at[0] * userOpts.overview.scale),
                        Math.max(0, clientJson.at[1] * userOpts.overview.scale)
                    );
                    return;
                }
            }
            const newWindow = Window(clientJson, screenCoords);
            if (newWindow === null) return;
            fixed.attribute.put(newWindow,
                Math.max(0, newWindow.attribute.x * userOpts.overview.scale),
                Math.max(0, newWindow.attribute.y * userOpts.overview.scale)
            );
            clientMap.set(clientJson.address, newWindow);
        };

        widget.unset = (clientAddress) => {
            const c = clientMap.get(clientAddress);
            if (!c) return;
            c.destroy();
            clientMap.delete(clientAddress);
        };

        widget.show = () => fixed.show_all();
        return widget;
    };

    const arr = (s, n) => Array.from({length: n}, (_, i) => s + i);

    const OverviewRow = ({ startWorkspace, workspaces, windowName = 'overview' }) => Widget.Box({
        children: arr(startWorkspace, workspaces).map(Workspace),
        attribute: {
            workspaceGroup: Math.floor((Hyprland.active.workspace.id - 1) / NUM_OF_WORKSPACES_SHOWN),
            monitorMap: [],
            getMonitorMap: (box) => {
                execAsync('hyprctl -j monitors').then(monitors => {
                    box.attribute.monitorMap = JSON.parse(monitors).reduce((acc, item) => {
                        acc[item.id] = { x: item.x, y: item.y };
                        return acc;
                    }, {});
                });
            },
            update: (box) => {
                const offset = Math.floor((Hyprland.active.workspace.id - 1) / NUM_OF_WORKSPACES_SHOWN) * NUM_OF_WORKSPACES_SHOWN;
                Hyprland.messageAsync('j/clients').then(clients => {
                    const allClients = JSON.parse(clients);
                    const kids = box.get_children();
                    kids.forEach(kid => kid.clear());
                    allClients.forEach(client => {
                        const childID = client.workspace.id - (offset + startWorkspace);
                        if (offset + startWorkspace <= client.workspace.id &&
                            client.workspace.id <= offset + startWorkspace + workspaces) {
                            const screenCoords = box.attribute.monitorMap[client.monitor];
                            kids[childID]?.set(client, screenCoords);
                        }
                    });
                    kids.forEach(kid => kid.show());
                }).catch(print);
            },
            updateWorkspace: (box, id) => {
                const offset = Math.floor((Hyprland.active.workspace.id - 1) / NUM_OF_WORKSPACES_SHOWN) * NUM_OF_WORKSPACES_SHOWN;
                if (!(offset + startWorkspace <= id && id <= offset + startWorkspace + workspaces)) return;

                Hyprland.messageAsync('j/clients').then(clients => {
                    const allClients = JSON.parse(clients);
                    const kids = box.get_children();
                    allClients.forEach(client => {
                        if (client.workspace.id === id) {
                            const screenCoords = box.attribute.monitorMap[client.monitor];
                            kids[id - (offset + startWorkspace)]?.set(client, screenCoords);
                        }
                    });
                    kids[id - (offset + startWorkspace)]?.show();
                }).catch(print);
            },
        },
        setup: (box) => {
            box.attribute.getMonitorMap(box);
            box
                .hook(overviewTick, (box) => box.attribute.update(box))
                .hook(Hyprland, (box, clientAddress) => {
                    // Force a full update to ensure all workspaces are in sync
                    box.attribute.update(box);
                }, 'client-removed')
                .hook(Hyprland, (box, clientAddress) => {
                    // Force a full update to ensure all workspaces are in sync
                    box.attribute.update(box);
                }, 'client-added')
                .hook(Hyprland.active, (box) => {
                    // Update when active client or workspace changes
                    box.attribute.update(box);
                })
                .hook(App, (box, name, visible) => {
                    // When the glance window becomes visible, update immediately
                    if ((name === 'overview' || name === 'glance') && visible) {
                        // Immediately update when window becomes visible
                        box.attribute.getMonitorMap(box);
                        box.attribute.update(box);

                        // Then set up a one-time delayed update to catch any changes
                        // that might have happened during window opening
                        box.attribute.updateTimeout = Utils.timeout(100, () => {
                            box.attribute.getMonitorMap(box);
                            box.attribute.update(box);
                        });
                    }
                }, 'window-toggled')
                .hook(Hyprland.active.workspace, (box) => {
                    const previousGroup = box.attribute.workspaceGroup;
                    const currentGroup = Math.floor((Hyprland.active.workspace.id - 1) / NUM_OF_WORKSPACES_SHOWN);
                    if (currentGroup !== previousGroup) {
                        if (!App.getWindow(windowName)?.visible) return;
                        box.attribute.update(box);
                        box.attribute.workspaceGroup = currentGroup;
                    }
                })

        },
    });
    const elevate = userOptions.asyncGet().etc.widgetCorners ? "overview-tasks shadow-window overview-round"  : "overview-tasks shadow-window  elevation " ;
    return Widget.Revealer({
        revealChild: true,
        hpack: userOptions.asyncGet().etc.widgetCorners ? 'fill' : 'center',
        transition: 'slide_down',
        hexpand:true,
        transitionDuration: userOpts.animations.durationHuge,
        child:Widget.Box({
            vertical:true,
            hexpand:true,
            children:[
              Widget.Box({
                vertical: true,
                hexpand:true,
                className: `${elevate}`,
                children: Array.from({ length: userOpts.overview.numOfRows }, (_, index) =>
                    OverviewRow({
                        startWorkspace: 1 + index * 5,
                        workspaces: 5,
                     })
            )
        }),
        userOptions.asyncGet().etc.widgetCorners ? Widget.Box({
            children:[
                RoundedCorner('topleft', {className: 'corner corner-colorscheme'}),
                Widget.Box({hexpand:true}),
                RoundedCorner('topright', {className: 'corner corner-colorscheme'})
            ]
        }) : null ]})
    });
}
