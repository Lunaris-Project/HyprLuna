// This file is for the actual widget for each single notification
const { GLib, Gdk, Gtk } = imports.gi;
import Widget from 'resource:///com/github/Aylur/ags/widget.js'
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js'
const { Box, EventBox, Icon, Overlay, Label, Button, Revealer } = Widget;
import { MaterialIcon } from './materialicon.js';
import { setupCursorHover } from "../.widgetutils/cursorhover.js";
import { AnimatedCircProg } from "./cairo_circularprogress.js";

function guessMessageType(summary) {
    const str = summary.toLowerCase();
    if (str.includes('reboot')) return 'restart_alt';
    if (str.includes('recording')) return 'screen_record';
    if (str.includes('battery') || summary.includes('power')) return 'power';
    if (str.includes('screenshot')) return 'screenshot_monitor';
    if (str.includes('welcome')) return 'waving_hand';
    if (str.includes('time')) return 'scheduleb';
    if (str.includes('installed')) return 'download';
    if (str.includes('update')) return 'update';
    if (str.startsWith('file')) return 'folder_copy';
    return 'chat';
}

function exists(widget) {
    return widget !== null;
}

const getFriendlyNotifTimeString = (timeObject) => {
    const messageTime = GLib.DateTime.new_from_unix_local(timeObject);
    const oneMinuteAgo = GLib.DateTime.new_now_local().add_seconds(-60);
    if (messageTime.compare(oneMinuteAgo) > 0)
        return getString('Now');
    else if (messageTime.get_day_of_year() == GLib.DateTime.new_now_local().get_day_of_year())
        return messageTime.format(userOptions.asyncGet().time.format);
    else if (messageTime.get_day_of_year() == GLib.DateTime.new_now_local().get_day_of_year() - 1)
        return getString('Yesterday');
    else
        return messageTime.format(userOptions.asyncGet().time.dateFormat);
}

const NotificationIcon = (notifObject) => {
    // { appEntry, appIcon, image }, urgency = 'normal'
    if (notifObject.image) {
        return Box({
            valign: Gtk.Align.CENTER,
            hexpand: false,
            className: 'notif-icon',
            css: `
                background-image: url("${notifObject.image}");
                background-size: auto 100%;
                background-repeat: no-repeat;
                background-position: center;
            `,
        });
    }

    let icon = 'NO_ICON';
    if (Utils.lookUpIcon(notifObject.appIcon))
        icon = notifObject.appIcon;
    if (Utils.lookUpIcon(notifObject.appEntry))
        icon = notifObject.appEntry;

    return Box({
        vpack: 'center',
        hexpand: false,
        className: `notif-icon notif-icon-material-${notifObject.urgency}`,
        homogeneous: true,
        children: [
            (icon != 'NO_ICON' ?
                Icon({
                    vpack: 'center',
                    icon: icon,
                })
                :
                MaterialIcon(`${notifObject.urgency == 'critical' ? 'release_alert' : guessMessageType(notifObject.summary.toLowerCase())}`, 'hugerass', {
                    hexpand: true,
                })
            )
        ],
    });
};

export default ({
    notifObject,
    isPopup = false,
    props = {},
} = {}) => {
    const popupTimeout = notifObject.timeout || (notifObject.urgency == 'critical' ? 8000 : 3000);
    const command = (isPopup ?
        () => notifObject.dismiss() :
        () => notifObject.close()
    );
    
    // Create a central widget reference state tracker
    const widgetState = {
        active: true,
        widget: null,
        timeouts: [],
        // Add a cleanup function that can be called from anywhere
        cleanup: function() {
            this.active = false;
            this.widget = null;
            
            try {
                // Call command as final action
                command();
            } catch (e) {
                console.log(`Notification command error during cleanup: ${e.message}`);
            }
        }
    };
    
    // Safe timeout creator that automatically tracks IDs
    const createSafeTimeout = (ms, callback) => {
        if (!widgetState.active) return null;
        
        const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            if (!widgetState.active) return GLib.SOURCE_REMOVE;
            
            try {
                callback();
            } catch (e) {
                console.log(`Error in notification timeout: ${e.message}`);
            }
            
            return GLib.SOURCE_REMOVE;
        });
        
        // Track timeout for cleanup
        if (timeoutId) widgetState.timeouts.push(timeoutId);
        
        return timeoutId;
    };
    
    // Function to remove all timeouts
    const cleanupTimeouts = () => {
        if (widgetState.timeouts.length > 0) {
            widgetState.timeouts.forEach(id => {
                try {
                    if (id) GLib.source_remove(id);
                } catch (e) {
                    // Silent fail for source removal
                }
            });
            widgetState.timeouts = [];
        }
    };
    
    const destroyWithAnims = () => {
        // Check if the widget is already being destroyed or has been destroyed
        if (!widget || !wholeThing || !widgetState.active) return;
        
        try {
            // Clean up any existing timeouts first
            cleanupTimeouts();
            
            // Mark as being destroyed
            if (wholeThing.attribute) {
                wholeThing.attribute.isDestroying = true;
            }
            
            // Only try to modify widgets if they're still valid
            try {
                if (widget && widget.get_parent()) {
                    widget.sensitive = false;
                }
                
                if (notificationBox && notificationBox.get_parent()) {
                    notificationBox.setCss(middleClickClose);
                }
            } catch (e) {
                console.log(`Error modifying widgets: ${e.message}`);
            }
            
            // Schedule animation start
            createSafeTimeout(userOptions.asyncGet().animations.durationSmall, () => {
                if (!widgetState.active) return;
                
                try {
                    // Only modify if widget is still valid
                    if (wholeThing && 
                        typeof wholeThing.get_parent === 'function' && 
                        wholeThing.get_parent() !== null && 
                        'revealChild' in wholeThing) {
                        
                        // Don't use property access more than once
                        wholeThing.revealChild = false;
                    }
                } catch (e) {
                    console.log(`Error in animation start: ${e.message}`);
                    
                    // Try immediate destruction as fallback
                    try {
                        widgetState.cleanup();
                        if (wholeThing) {
                            wholeThing.destroy();
                            wholeThing = null;
                        }
                    } catch (error) {
                        // Last resort - just null the reference
                        wholeThing = null;
                    }
                    
                    return;
                }
                
                // Schedule final cleanup
                createSafeTimeout(userOptions.asyncGet().animations.durationSmall, () => {
                    try {
                        // Call cleanup first to prevent any further accesses
                        widgetState.cleanup();
                        
                        // Then destroy widget if it still exists
                        if (wholeThing) {
                            wholeThing.destroy();
                            wholeThing = null;
                        }
                    } catch (e) {
                        console.log(`Error in final cleanup: ${e.message}`);
                        wholeThing = null;
                    }
                });
            });
        } catch (e) {
            console.log(`Error in destroyWithAnims: ${e.message}`);
            
            // Last resort cleanup
            widgetState.cleanup();
            if (wholeThing) {
                try {
                    wholeThing.destroy();
                } catch (e) {
                    // Silent fail
                }
                wholeThing = null;
            }
        }
    }
    const widget = EventBox({
        onHover: (self) => {
            try {
                if (!self || !self.window || !wholeThing) return;
                
                self.window.set_cursor(Gdk.Cursor.new_from_name(display, 'grab'));
                
                if (wholeThing.attribute && !wholeThing.attribute.hovered) {
                    wholeThing.attribute.hovered = true;
                }
            } catch (e) {
                console.log(`Error in notification hover: ${e.message}`);
            }
        },
        onHoverLost: (self) => {
            try {
                if (!self || !self.window || !wholeThing) return;
                
                self.window.set_cursor(null);
                
                if (wholeThing.attribute && wholeThing.attribute.hovered) {
                    wholeThing.attribute.hovered = false;
                }
                
                if (isPopup && !wholeThing.attribute?.isDestroying) {
                    command();
                }
            } catch (e) {
                console.log(`Error in notification hover lost: ${e.message}`);
            }
        },
        onMiddleClick: (self) => {
            destroyWithAnims();
        },
        setup: (self) => {
            self.on("button-press-event", () => {
                wholeThing.attribute.held = true;
                notificationContent.toggleClassName(`${isPopup ? 'popup-' : ''}notif-clicked-${notifObject.urgency}`, true);
                Utils.timeout(800, () => {
                    if (wholeThing?.attribute.held) {
                        Utils.execAsync(['wl-copy', `${notifObject.body}`]).catch(print);
                        notifTextSummary.label = notifObject.summary + " (copied)";
                        Utils.timeout(3000, () => notifTextSummary.label = notifObject.summary)
                    }
                })
            }).on("button-release-event", () => {
                wholeThing.attribute.held = false;
                notificationContent.toggleClassName(`${isPopup ? 'popup-' : ''}notif-clicked-${notifObject.urgency}`, false);
            })
        }
    });
    let wholeThing = Revealer({
        attribute: {
            'close': undefined,
            'destroyWithAnims': destroyWithAnims,
            'dragging': false,
            'held': false,
            'hovered': false,
            'id': notifObject.id,
        },
        revealChild: false,
        transition: 'slide_down',
        transitionDuration: userOptions.asyncGet().animations.durationLarge,
        child: Box({ // Box to make sure css-based spacing works
            homogeneous: true,
        }),
    });

    const display = Gdk.Display.get_default();
    const notifTextPreview = Revealer({
        transition: 'slide_down',
        transitionDuration: userOptions.asyncGet().animations.durationSmall,
        revealChild: true,
        child: Label({
            xalign: 0,
            className: `txt-smallie notif-body-${notifObject.urgency}`,
            useMarkup: true,
            xalign: 0,
            justify: Gtk.Justification.LEFT,
            maxWidthChars: 1,
            truncate: 'end',
            label: notifObject.body.split("\n")[0],
        }),
    });
    const notifTextExpanded = Revealer({
        transition: 'slide_up',
        transitionDuration: userOptions.asyncGet().animations.durationSmall,
        revealChild: false,
        child: Box({
            vertical: true,
            className: 'spacing-v-10',
            children: [
                Label({
                    xalign: 0,
                    className: `txt-smallie notif-body-${notifObject.urgency}`,
                    useMarkup: true,
                    xalign: 0,
                    justify: Gtk.Justification.LEFT,
                    maxWidthChars: 1,
                    wrap: true,
                    label: notifObject.body,
                }),
                Box({
                    className: 'notif-actions spacing-h-5',
                    children: [
                        Button({
                            hexpand: true,
                            className: `notif-action notif-action-${notifObject.urgency}`,
                            onClicked: () => destroyWithAnims(),
                            setup: setupCursorHover,
                            child: Label({
                                label: getString('Close'),
                            }),
                        }),
                        ...notifObject.actions.map(action => Widget.Button({
                            hexpand: true,
                            className: `notif-action notif-action-${notifObject.urgency}`,
                            onClicked: () => notifObject.invoke(action.id),
                            setup: setupCursorHover,
                            child: Label({
                                label: action.label,
                            }),
                        }))
                    ],
                })
            ]
        }),
    });
    const notifIcon = Box({
        vpack: 'start',
        homogeneous: true,
        children: [
            Overlay({
                child: NotificationIcon(notifObject),
                overlays: isPopup ? [AnimatedCircProg({
                    className: `notif-circprog-${notifObject.urgency}`,
                    vpack: 'center', hpack: 'center',
                    initFrom: (isPopup ? 100 : 0),
                    initTo: 0,
                    initAnimTime: popupTimeout,
                })] : [],
            }),
        ]
    });

    const notifTextSummary = Label({
        xalign: 0,
        className: 'txt-small txt-semibold titlefont',
        justify: Gtk.Justification.LEFT,
        hexpand: true,
        maxWidthChars: 1,
        truncate: 'end',
        ellipsize: 3,
        useMarkup: notifObject.summary.startsWith('<'),
        label: notifObject.summary,
    });
    const initTimeString = getFriendlyNotifTimeString(notifObject.time);
    const notifTextBody = Label({
        vpack: 'center',
        justification: 'right',
        className: 'txt-smaller txt-semibold',
        label: initTimeString,
        setup: initTimeString == 'Now' ? (self) => {
            // Store timeout ID in widget attribute for proper cleanup
            self.attribute = self.attribute || {};
            self.attribute.timeoutId = null;
            
            if (initTimeString == 'Now') {
                self.attribute.timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 60000, () => {
                    // Safely update label if widget still exists
                    try {
                        if (self && !self.is_destroyed) {
                            self.label = getFriendlyNotifTimeString(notifObject.time);
                        }
                    } catch (e) {
                        console.log(`Error updating notification time: ${e.message}`);
                    }
                    
                    // Remove the source
                    self.attribute.timeoutId = null;
                    return GLib.SOURCE_REMOVE;
                });
                
                // Connect destroy signal with proper disconnect
                self.connect('destroy', () => {
                    try {
                        // Clear timeout if it exists
                        if (self.attribute?.timeoutId) {
                            GLib.source_remove(self.attribute.timeoutId);
                            self.attribute.timeoutId = null;
                        }
                    } catch (e) {
                        // Silent fail for source removal
                    }
                });
            }
        } : () => { },
    });
    const notifText = Box({
        valign: Gtk.Align.CENTER,
        vertical: true,
        hexpand: true,
        children: [
            Box({
                children: [
                    notifTextSummary,
                    notifTextBody,
                ]
            }),
            notifTextPreview,
            notifTextExpanded,
        ]
    });
    const notifExpandButton = Button({
        vpack: 'start',
        className: 'notif-expand-btn',
        onClicked: (self) => {
            if (notifTextPreview.revealChild) { // Expanding...
                notifTextPreview.revealChild = false;
                notifTextExpanded.revealChild = true;
                self.child.label = 'expand_less';
                expanded = true;
            }
            else {
                notifTextPreview.revealChild = true;
                notifTextExpanded.revealChild = false;
                self.child.label = 'expand_more';
                expanded = false;
            }
        },
        child: MaterialIcon('expand_more', 'norm', {
            vpack: 'center',
        }),
        setup: setupCursorHover,
    });
    const notificationContent = Box({
        ...props,
        className: `${isPopup ? 'popup-' : ''}notif-${notifObject.urgency} spacing-h-10`,
        children: [
            notifIcon,
            Box({
                className: 'spacing-h-5',
                children: [
                    notifText,
                    notifExpandButton,
                ]
            })
        ]
    })

    // Gesture stuff
    const gesture = Gtk.GestureDrag.new(widget);
    var initDirX = 0;
    var initDirVertical = -1; // -1: unset, 0: horizontal, 1: vertical
    var expanded = false;
    // in px
    const startMargin = 0;
    const MOVE_THRESHOLD = 10;
    const DRAG_CONFIRM_THRESHOLD = 100;
    // in rem
    const maxOffset = 10.227;
    const endMargin = 20.455;
    const disappearHeight = 6.818;
    const leftAnim1 = `transition: ${userOptions.asyncGet().animations.durationSmall}ms cubic-bezier(0.05, 0.7, 0.1, 1);
                       margin-left: -${Number(maxOffset + endMargin)}rem;
                       margin-right: ${Number(maxOffset + endMargin)}rem;
                       opacity: 0;`;

    const rightAnim1 = `transition: ${userOptions.asyncGet().animations.durationSmall}ms cubic-bezier(0.05, 0.7, 0.1, 1);
                        margin-left:   ${Number(maxOffset + endMargin)}rem;
                        margin-right: -${Number(maxOffset + endMargin)}rem;
                        opacity: 0;`;

    const middleClickClose = `transition: ${userOptions.asyncGet().animations.durationSmall}ms cubic-bezier(0.85, 0, 0.15, 1);
                              margin-left:   ${Number(maxOffset + endMargin)}rem;
                              margin-right: -${Number(maxOffset + endMargin)}rem;
                              opacity: 0;`;

    const notificationBox = Box({
        attribute: {
            'leftAnim1': leftAnim1,
            'rightAnim1': rightAnim1,
            'middleClickClose': middleClickClose,
            'ready': false,
        },
        homogeneous: true,
        children: [notificationContent],
        setup: (self) => self
            .hook(gesture, self => {
                var offset_x = gesture.get_offset()[1];
                var offset_y = gesture.get_offset()[2];
                // Which dir?
                if (initDirVertical == -1) {
                    if (Math.abs(offset_y) > MOVE_THRESHOLD)
                        initDirVertical = 1;
                    if (initDirX == 0 && Math.abs(offset_x) > MOVE_THRESHOLD) {
                        initDirVertical = 0;
                        initDirX = (offset_x > 0 ? 1 : -1);
                    }
                }
                // Horizontal drag
                if (initDirVertical == 0 && offset_x > MOVE_THRESHOLD) {
                    if (initDirX < 0)
                        self.setCss(`margin-left: 0px; margin-right: 0px;`);
                    else
                        self.setCss(`
                            margin-left:   ${Number(offset_x + startMargin - MOVE_THRESHOLD)}px;
                            margin-right: -${Number(offset_x + startMargin - MOVE_THRESHOLD)}px;
                        `);
                }
                else if (initDirVertical == 0 && offset_x < -MOVE_THRESHOLD) {
                    if (initDirX > 0)
                        self.setCss(`margin-left: 0px; margin-right: 0px;`);
                    else {
                        offset_x = Math.abs(offset_x);
                        self.setCss(`
                            margin-right: ${Number(offset_x + startMargin - MOVE_THRESHOLD)}px;
                            margin-left: -${Number(offset_x + startMargin - MOVE_THRESHOLD)}px;
                        `);
                    }
                }
                // Update dragging
                wholeThing.attribute.dragging = Math.abs(offset_x) > MOVE_THRESHOLD;
                if (Math.abs(offset_x) > MOVE_THRESHOLD ||
                    Math.abs(offset_y) > MOVE_THRESHOLD) wholeThing.attribute.held = false;
                widget.window?.set_cursor(Gdk.Cursor.new_from_name(display, 'grabbing'));
                // Vertical drag
                if (initDirVertical == 1 && offset_y > MOVE_THRESHOLD && !expanded) {
                    notifTextPreview.revealChild = false;
                    notifTextExpanded.revealChild = true;
                    expanded = true;
                    notifExpandButton.child.label = 'expand_less';
                }
                else if (initDirVertical == 1 && offset_y < -MOVE_THRESHOLD && expanded) {
                    notifTextPreview.revealChild = true;
                    notifTextExpanded.revealChild = false;
                    expanded = false;
                    notifExpandButton.child.label = 'expand_more';
                }

            }, 'drag-update')
            .hook(gesture, self => {
                if (!self.attribute.ready) {
                    wholeThing.revealChild = true;
                    self.attribute.ready = true;
                    return;
                }
                const offset_h = gesture.get_offset()[1];

                if (Math.abs(offset_h) > DRAG_CONFIRM_THRESHOLD && offset_h * initDirX > 0) {
                    if (offset_h > 0) {
                        self.setCss(rightAnim1);
                        widget.sensitive = false;
                    }
                    else {
                        self.setCss(leftAnim1);
                        widget.sensitive = false;
                    }
                    Utils.timeout(userOptions.asyncGet().animations.durationSmall, () => {
                        if (wholeThing) wholeThing.revealChild = false;
                    }, wholeThing);
                    Utils.timeout(userOptions.asyncGet().animations.durationSmall * 2, () => {
                        command();
                        if (wholeThing) {
                            wholeThing.destroy();
                            wholeThing = null;
                        }
                    }, wholeThing);
                }
                else {
                    self.setCss(`transition: margin 200ms cubic-bezier(0.05, 0.7, 0.1, 1), opacity 200ms cubic-bezier(0.05, 0.7, 0.1, 1);
                                   margin-left:  ${startMargin}px;
                                   margin-right: ${startMargin}px;
                                   margin-bottom: unset; margin-top: unset;
                                   opacity: 1;`);
                    if (widget.window)
                        widget.window.set_cursor(Gdk.Cursor.new_from_name(display, 'grab'));

                    wholeThing.attribute.dragging = false;
                }
                initDirX = 0;
                initDirVertical = -1;
            }, 'drag-end')
        ,
    })
    widget.add(notificationBox);
    wholeThing.child.children = [widget];
    
    // Setup widget reference in state
    widgetState.widget = wholeThing;
    
    // Improve widget's destroy mechanism
    widget.connect('destroy', () => {
        try {
            // Clean up the gesture
            if (gesture) {
                // Set the state to denied to cancel any active gestures
                gesture.set_state(Gtk.EventSequenceState.DENIED);
                
                // Don't try to unref in JS - this causes errors
            }
        } catch (e) {
            console.log(`Error cleaning up gesture: ${e.message}`);
        }
    });

    // Better cleanup for revealer destruction
    wholeThing.connect('destroy', () => {
        // Mark state as inactive
        if (widgetState.active) {
            widgetState.active = false;
            widgetState.widget = null;
            
            // Clean up timeouts
            cleanupTimeouts();
            
            // Clean up any listeners
            try {
                if (gesture) {
                    // Set the state to denied to cancel any active gestures
                    gesture.set_state(Gtk.EventSequenceState.DENIED);
                    
                    // Don't try to unref in JS - this causes errors
                }
            } catch (e) {
                // Silent fail
            }
        }
        
        // Clear global reference
        wholeThing = null;
    });
    
    // Ensure the drag gesture is properly initialized
    gesture.connect('cancel', () => {
        try {
            notificationBox.setCss(`transition: margin 200ms cubic-bezier(0.05, 0.7, 0.1, 1), opacity 200ms cubic-bezier(0.05, 0.7, 0.1, 1);
                            margin-left:  ${startMargin}px;
                            margin-right: ${startMargin}px;
                            margin-bottom: unset; margin-top: unset;
                            opacity: 1;`);
            
            if (widget?.window)
                widget.window.set_cursor(Gdk.Cursor.new_from_name(display, 'grab'));
            
            if (wholeThing?.attribute)
                wholeThing.attribute.dragging = false;
                
            initDirX = 0;
            initDirVertical = -1;
        } catch (e) {
            console.log(`Error in gesture cancel: ${e.message}`);
        }
    });
    
    // Create popup timeout if needed
    if (isPopup) {
        createSafeTimeout(popupTimeout, () => {
            // Skip if widget not active
            if (!widgetState.active) return;
            
            // Check widget state
            let isHovered = false;
            let isDestroying = false;
            
            try {
                if (wholeThing && wholeThing.attribute) {
                    isHovered = !!wholeThing.attribute.hovered;
                    isDestroying = !!wholeThing.attribute.isDestroying;
                }
            } catch (e) {
                console.log(`Error checking widget state: ${e.message}`);
                return;
            }
            
            // Skip if hovered or already being destroyed
            if (isHovered || isDestroying) return;
            
            // Start hiding animation
            try {
                // Safe property access with existence checks
                if (wholeThing && 
                    typeof wholeThing.get_parent === 'function' && 
                    wholeThing.get_parent() !== null &&
                    'revealChild' in wholeThing) {
                    
                    // Set only once
                    wholeThing.revealChild = false;
                    
                    // Schedule final cleanup
                    createSafeTimeout(userOptions.asyncGet().animations.durationSmall, () => {
                        if (!widgetState.active) return;
                        
                        try {
                            // Mark as destroying
                            if (wholeThing && wholeThing.attribute) {
                                wholeThing.attribute.isDestroying = true;
                            }
                        } catch (e) {
                            // Ignore
                        }
                        
                        // Call cleanup functions
                        widgetState.cleanup();
                        
                        // Final destroy if needed
                        try {
                            if (wholeThing) {
                                wholeThing.destroy();
                                wholeThing = null;
                            }
                        } catch (e) {
                            console.log(`Error in final popup destroy: ${e.message}`);
                            wholeThing = null;
                        }
                    });
                }
            } catch (e) {
                console.log(`Error starting hide animation: ${e.message}`);
                
                // Fallback cleanup
                widgetState.cleanup();
                
                // Try to destroy widget
                try {
                    if (wholeThing) {
                        wholeThing.destroy();
                        wholeThing = null;
                    }
                } catch (e) {
                    // Silent fail
                    wholeThing = null;
                }
            }
        });
    }
    
    return wholeThing;
}