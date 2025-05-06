// This file is for popup notifications
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Notifications from 'resource:///com/github/Aylur/ags/service/notifications.js';
const { Box } = Widget;
import Notification from '../.commonwidgets/notification.js';

export default () => Box({
    vertical: true,
    hpack: 'center',
    className: 'osd-notifs spacing-v-5-revealer',
    attribute: {
        'map': new Map(),
        'dismiss': (box, id, force = false) => {
            if (!id || !box.attribute.map.has(id))
                return;
                
            try {
                const notifWidget = box.attribute.map.get(id);
                
                // Remove from map first to prevent any further attempts to access it
                box.attribute.map.delete(id);
                
                // Check if widget is still valid
                if (!notifWidget) return;
                
                // Set a flag to prevent hover state changes during dismissal
                try {
                    if (notifWidget.attribute) {
                        notifWidget.attribute.isDestroying = true;
                    }
                } catch (e) {
                    // Widget is likely already destroyed - nothing more to do
                    return;
                }
                
                // Don't dismiss if hovered unless forced
                if (notifWidget.attribute?.hovered && !force) return; 
                
                // Try to initiate a safe dismissal
                try {
                    // First check if the widget exists in the widget tree
                    let isWidgetConnected = false;
                    
                    try {
                        // This will throw an error if widget is already disposed
                        isWidgetConnected = notifWidget.get_parent() !== null;
                    } catch (e) {
                        // Widget is already disposed, nothing more to do
                        return;
                    }
                    
                    if (isWidgetConnected) {
                        // Start the dismissal animation
                        try {
                            notifWidget.revealChild = false;
                        } catch (e) {
                            // If setting revealChild fails, the widget might be in a bad state
                            // Try to destroy it directly
                            try {
                                notifWidget.destroy();
                            } catch (e) {
                                // Silent failure - widget is likely already being destroyed
                            }
                            return;
                        }
                        
                        // If widget is still valid, try to use its destroyWithAnims method
                        if (typeof notifWidget.attribute?.destroyWithAnims === 'function') {
                            try {
                                notifWidget.attribute.destroyWithAnims();
                            } catch (e) {
                                console.log(`Error in destroyWithAnims: ${e.message}`);
                                // Fallback: try direct destruction
                                try {
                                    notifWidget.destroy();
                                } catch (e) {
                                    // Silent fail
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.log(`Error dismissing notification ${id}: ${e.message}`);
                    // Last resort: try to forcibly destroy the widget
                    try {
                        notifWidget.destroy();
                    } catch (e) {
                        // Silent fail
                    }
                }
            } catch (e) {
                console.log(`Error in notification dismiss: ${e.message}`);
                // Clean up the map entry anyway
                box.attribute.map.delete(id);
            }
        },
        'notify': (box, id) => {
            if (!id || Notifications.dnd) return;
            
            const notif = Notifications.getNotification(id);
            if (!notif) return;
            
            // Remove any existing notification with this ID
            if (box.attribute.map.has(id)) {
                try {
                    const oldNotif = box.attribute.map.get(id);
                    if (oldNotif && oldNotif.get_parent()) {
                        oldNotif.get_parent().remove(oldNotif);
                    }
                } catch (e) {
                    console.log(`Error removing old notification ${id}: ${e.message}`);
                }
                box.attribute.map.delete(id);
            }

            try {
                const newNotif = Notification({
                    notifObject: notif,
                    isPopup: true,
                });
                
                box.attribute.map.set(id, newNotif);
                box.pack_end(newNotif, false, false, 0);
                box.show_all();
            } catch (e) {
                console.log(`Error creating notification ${id}: ${e.message}`);
            }
        },
    },
    setup: (self) => self
        .hook(Notifications, (box, id) => box.attribute.notify(box, id), 'notified')
        .hook(Notifications, (box, id) => box.attribute.dismiss(box, id), 'dismissed')
        .hook(Notifications, (box, id) => box.attribute.dismiss(box, id, true), 'closed')
    ,
});