const { Pango } = imports.gi;
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Network from "resource:///com/github/Aylur/ags/service/network.js";
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import GLib from 'gi://GLib';
const { Box, Button, Entry, Icon, Label, Revealer, Scrollable, Slider, Stack, Overlay } = Widget;
const { execAsync, exec } = Utils;
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';
import { setupCursorHover } from '../../.widgetutils/cursorhover.js';
import { ConfigToggle } from '../../.commonwidgets/configwidgets.js';
// import { download , upload } from '../../.commonwidgets/networkspeed.js';
const MATERIAL_SYMBOL_SIGNAL_STRENGTH = {
    'network-wireless-signal-excellent-symbolic': "signal_wifi_4_bar",
    'network-wireless-signal-good-symbolic': "network_wifi_3_bar",
    'network-wireless-signal-ok-symbolic': "network_wifi_2_bar",
    'network-wireless-signal-weak-symbolic': "network_wifi_1_bar",
    'network-wireless-signal-none-symbolic': "signal_wifi_0_bar",
}

// Helper function for translations
function getString(str) {
    // This is a simple implementation - in a real app, this would connect to a translation system
    return str;
}

// Global hook management system to prevent garbage collection issues
class SafeNetworkHooks {
    constructor() {
        // Use a simple array instead of Maps to avoid potential GC issues
        this._widgets = [];
        this._callbacks = [];
        this._isDestroyed = false;
        this._updateTimeout = null;
        this._cleanupInterval = null;
        
        // Setup a global Network signal handler with debouncing
        this._networkChangedHandler = Network.connect('changed', () => {
            if (this._isDestroyed) return;
            
            // Debounce network updates
            if (this._updateTimeout) {
                GLib.source_remove(this._updateTimeout);
                this._updateTimeout = null;
            }
            
            this._updateTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                if (this._isDestroyed) return false;
                this._updateTimeout = null;
                this._safeDispatch();
                return false; // Don't repeat
            });
        });
        
        // Setup a less frequent cleanup interval
        this._cleanupInterval = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
            if (this._isDestroyed) return false;
            this._cleanup();
            return true; // Keep the interval running
        });
    }
    
    // Properly destroy this class and clean up all resources
    destroy() {
        if (this._isDestroyed) return;
        this._isDestroyed = true;
        
        // Clear all timeouts
        if (this._updateTimeout) {
            GLib.source_remove(this._updateTimeout);
            this._updateTimeout = null;
        }
        
        if (this._cleanupInterval) {
            GLib.source_remove(this._cleanupInterval);
            this._cleanupInterval = null;
        }
        
        // Disconnect from Network
        if (this._networkChangedHandler) {
            try {
                Network.disconnect(this._networkChangedHandler);
            } catch (e) {
                // Silent error handling
            }
            this._networkChangedHandler = null;
        }
        
        // Clear all references
        this._widgets = [];
        this._callbacks = [];
    }
    
    // Register a widget to receive Network updates
    register(widget, callback) {
        if (!widget || !callback || this._isDestroyed) {
            return -1;
        }
        
        // Find an empty slot or add to the end
        let index = this._widgets.indexOf(null);
        if (index === -1) {
            index = this._widgets.length;
            this._widgets.push(widget);
            this._callbacks.push(callback);
        } else {
            this._widgets[index] = widget;
            this._callbacks[index] = callback;
        }
        
        // Setup destroy handler
        const destroyHandler = widget.connect('destroy', () => {
            // When widget is destroyed, clear the reference but keep the array slot
            if (index >= 0 && index < this._widgets.length) {
                this._widgets[index] = null;
                this._callbacks[index] = null;
            }
        });
        
        // Store the index on the widget for later reference
        widget._networkHookIndex = index;
        widget._networkDestroyHandler = destroyHandler;
        
        // Schedule an initial update
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
            if (this._isDestroyed) return false;
            
            if (index >= 0 && index < this._widgets.length && this._widgets[index]) {
                try {
                    callback(Network);
            } catch (e) {
                    // Silent error handling
                }
            }
            return false; // Don't repeat
        });
        
        return index;
    }
    
    // Safely dispatch Network updates to all registered widgets
    _safeDispatch() {
        if (this._isDestroyed) return;
        
        for (let i = 0; i < this._widgets.length; i++) {
            const widget = this._widgets[i];
            const callback = this._callbacks[i];
            
            if (!widget || !callback) continue;
            
            try {
                // Check if widget is still valid
                if (this._isWidgetValid(widget)) {
                callback(Network);
                } else {
                    // Clear invalid widgets
                    this._widgets[i] = null;
                    this._callbacks[i] = null;
                }
            } catch (e) {
                // If any error occurs, clear the reference
                this._widgets[i] = null;
                this._callbacks[i] = null;
            }
        }
    }
    
    // Helper to check if a widget is valid
    _isWidgetValid(widget) {
        if (!widget) return false;
        
        try {
            // Try to access a property
            const test = widget.css;
            
            // Try to check if it has a parent
            try {
                return !!widget.get_parent();
            } catch (e) {
                return false;
            }
        } catch (e) {
            return false;
        }
    }
    
    // Cleanup method to remove null references
    _cleanup() {
        if (this._isDestroyed) return false;
        
        // Compact the arrays by removing null entries
        // This is more efficient than filtering in-place
        let compactWidgets = [];
        let compactCallbacks = [];
        
        for (let i = 0; i < this._widgets.length; i++) {
            const widget = this._widgets[i];
            const callback = this._callbacks[i];
            
            if (widget && callback && this._isWidgetValid(widget)) {
                // Update the index on the widget
                widget._networkHookIndex = compactWidgets.length;
                
                compactWidgets.push(widget);
                compactCallbacks.push(callback);
            } else if (widget) {
                // Disconnect the destroy handler if the widget still exists
                try {
                    if (widget._networkDestroyHandler) {
                        widget.disconnect(widget._networkDestroyHandler);
                        widget._networkDestroyHandler = null;
                    }
            } catch (e) {
                    // Silent error handling
                }
            }
        }
        
        this._widgets = compactWidgets;
        this._callbacks = compactCallbacks;
        
        return true;
    }
    
    // Unregister a widget by index
    unregister(index) {
        if (this._isDestroyed || index < 0 || index >= this._widgets.length) {
            return false;
        }
        
        const widget = this._widgets[index];
        
        // Clear the reference
        this._widgets[index] = null;
        this._callbacks[index] = null;
        
        // Clean up the widget if it still exists
        if (widget) {
            try {
                if (widget._networkDestroyHandler) {
                    widget.disconnect(widget._networkDestroyHandler);
                    widget._networkDestroyHandler = null;
                }
                widget._networkHookIndex = -1;
            } catch (e) {
                // Silent error handling
            }
        }
        
        return true;
    }
}

// Create a singleton instance
const networkHooks = new SafeNetworkHooks();

// Helper function to safely update a label with Network data
function safeUpdateLabel(label, value, defaultValue = '') {
    if (!label) return;
    
    try {
        // Check if the label is still valid
        const isValid = () => {
            try {
                // Try to access a property
                const test = label.css;
                
                // Try to check if it has a parent
                try {
                    return !!label.get_parent();
                } catch (e) {
                    return false;
                }
            } catch (e) {
                return false;
            }
        };
        
        if (!isValid()) return;
        
        // Try to update the label
        try {
        if (typeof label.set_label === 'function') {
            label.set_label(value || defaultValue);
        } else if (typeof label.setLabel === 'function') {
            label.setLabel(value || defaultValue);
        } else if (label.label !== undefined) {
            label.label = value || defaultValue;
        }
    } catch (e) {
            // Silent error handling
        }
    } catch (e) {
        // Silent error handling
    }
}

// Track active password entry to prevent it from disappearing
let activePasswordEntry = null;
let activePasswordSSID = null;
let connectAttempt = '';

// Helper function to check if a network is already registered
async function isNetworkRegistered(ssid) {
    try {
        // Get all connection profiles
        const result = await execAsync(['nmcli', '-t', '-f', 'NAME,TYPE', 'connection', 'show']);
        const connections = result.split('\n').filter(Boolean);
        
        // Check for exact matches and case-insensitive matches
        const isRegistered = connections.some(conn => {
            const [name, type] = conn.split(':');
            if (type !== 'wifi') return false;
            
            // Check for exact match or case-insensitive match
            return name === ssid || 
                   name.startsWith(`${ssid}_`) || 
                   name.toLowerCase() === ssid.toLowerCase() ||
                   name.toLowerCase().startsWith(`${ssid.toLowerCase()}_`);
        });
        
        // If we found a match, log it and return true
        if (isRegistered) {
            return true;
        }
        
        return false;
    } catch (e) {
        // Silent error handling
        return false;
    }
}

// Helper function to get all connection profiles for a specific SSID
async function getConnectionsForSSID(ssid) {
    try {
        const result = await execAsync(['nmcli', '-t', '-f', 'NAME,TYPE', 'connection', 'show']);
        const connections = result.split('\n').filter(Boolean);
        return connections
            .filter(conn => {
                const [name, type] = conn.split(':');
                return type === 'wifi' && (name === ssid || name.startsWith(`${ssid}_`));
            })
            .map(conn => conn.split(':')[0]);
    } catch (e) {
        // Silent error handling
        return [];
    }
}

const NetResource = (icon, command) => {
    const resourceLabel = Label({
        className: `txt-smaller txt-subtext`,
    });
    const widget = Button({
        child: Box({
            hpack: 'start',
            className: `spacing-h-4`,
            children: [
                MaterialIcon(icon, 'very-small'),
                resourceLabel,
            ],
            setup: (self) => self.poll(2000, () => execAsync(['bash', '-c', command])
                .then((output) => {
                    resourceLabel.label = output;
                }).catch(print))
            ,
        })
    });
    return widget;
}

const WifiNetwork = (accessPoint) => {
    // State for password input
    let passwordRevealer = null;
    let passwordEntry = null;
    
    // Function to hide password entry
    const hidePasswordEntry = () => {
        if (passwordRevealer) {
            passwordRevealer.revealChild = false;
        }
        if (passwordEntry) {
            passwordEntry.text = '';
        }
        
        // Clear global references if they match this network
        if (activePasswordSSID === accessPoint.ssid) {
            activePasswordEntry = null;
            activePasswordSSID = null;
        }
    };
    
    const networkStrength = MaterialIcon(MATERIAL_SYMBOL_SIGNAL_STRENGTH[accessPoint.iconName], 'hugerass')
    const networkName = Box({
        vertical: true,
        children: [
            Label({
                hpack: 'start',
                label: accessPoint.ssid
            }),
            accessPoint.active ? Label({
                wrapMode: Pango.WrapMode.WORD_CHAR,
                hpack: 'start',
                className: 'txt-smaller txt-subtext',
                label: getString("Selected"),
            }) : null,
        ]
    });
    
    // Create password entry
    passwordEntry = Entry({
        className: 'sidebar-wifinetworks-auth-entry',
        visibility: false,
        hexpand: true,
        placeholderText: getString("Enter network password here"),
        onAccept: (self) => {
            // Hide password entry
            hidePasswordEntry();
            
            // Connect with password - use a more reliable approach
            // First create a connection profile with the password
            const ssid = accessPoint.ssid;
            const password = self.text;
            
            // Create a temporary file to store the connection command
            const tempScript = `/tmp/wifi_connect_${Math.random().toString(36).substring(2, 9)}.sh`;
            const connectionName = ssid;
            
            // Create the script content
            const scriptContent = `#!/bin/bash
set -e

# Disconnect from any existing connections first
nmcli device disconnect wlan0 || true

# Check for existing connections with this SSID
EXISTING_CONNECTIONS=$(nmcli -t -f NAME,TYPE connection show | grep ":wifi$" | grep "^${ssid}\\(_\\|:\\|$\\)" | cut -d':' -f1)

# If there are existing connections, delete them all
if [ -n "$EXISTING_CONNECTIONS" ]; then
    echo "Removing existing connections for ${ssid}..."
    for conn in $EXISTING_CONNECTIONS; do
        nmcli connection delete "$conn" || true
    done
fi

# Create a new connection
echo "Creating new connection profile..."
nmcli connection add type wifi con-name "${connectionName}" ifname wlan0 ssid "${ssid}" 

# Set the password
echo "Setting up security..."
nmcli connection modify "${connectionName}" wifi-sec.key-mgmt wpa-psk wifi-sec.psk "${password}"

# Additional settings for better stability
nmcli connection modify "${connectionName}" connection.autoconnect yes
nmcli connection modify "${connectionName}" connection.autoconnect-priority 10
nmcli connection modify "${connectionName}" ipv4.method auto
nmcli connection modify "${connectionName}" ipv6.method auto

# Wait a moment before connecting
sleep 1

# Connect to the network
echo "Connecting to network..."
nmcli connection up "${connectionName}"

# Self-delete this script for security
rm "$0"
`;
            
            // Write the script to the temp file
            Utils.writeFile(scriptContent, tempScript)
                .then(() => {
                    // Make the script executable
                    return execAsync(['chmod', '+x', tempScript]);
                })
                .then(() => {
                    // Execute the script
                    return execAsync([tempScript]);
                })
                .then(() => {
                    // Clear password after successful connection
                    self.text = '';
                })
                .catch(error => {
                    // Show error message
                    Utils.timeout(500, () => {
                        self.text = '';
                        self.placeholderText = getString("Connection failed, try again");
                        passwordRevealer.revealChild = true;
                        activePasswordEntry = passwordEntry;
                        activePasswordSSID = accessPoint.ssid;
                        
                        // Create a notification
                        Utils.notify({
                            summary: getString("WiFi Connection Failed"),
                            body: `${getString("Could not connect to")} ${ssid}. ${getString("Please try again.")}`,
                            iconName: 'network-wireless-disconnected-symbolic',
                            urgency: 'critical',
                        });
                    });
                });
        }
    });
    
    // Create password revealer
    passwordRevealer = Revealer({
        transition: 'slide_down',
        transitionDuration: userOptions.asyncGet().animations.durationSmall,
        revealChild: false,
        child: Box({
            className: 'margin-top-5 wifi-password-container',
            vertical: true,
            children: [
                Label({
                    className: 'txt-bold margin-bottom-5',
                    hpack: 'start',
                    label: `${getString("Enter Password for")} "${accessPoint.ssid}"`,
                }),
                Box({
                    className: 'spacing-h-5',
                    children: [
                        passwordEntry,
                        Button({
                            className: 'sidebar-wifinetworks-password-toggle',
                            child: MaterialIcon('visibility', 'small'),
                            setup: setupCursorHover,
                            onClicked: (self) => {
                                // Find the entry and toggle visibility
                                const entry = self.get_parent().get_children()[0];
                                if (entry) {
                                    entry.visibility = !entry.visibility;
                                    // Update icon
                                    self.child = MaterialIcon(
                                        entry.visibility ? 'visibility_off' : 'visibility', 
                                        'small'
                                    );
                                }
                            },
                        }),
                    ],
                }),
                Box({
                    className: 'spacing-h-5 margin-top-5',
                    homogeneous: true,
                    children: [
                        Button({
                            className: 'sidebar-wifinetworks-cancel-button',
                            label: getString('Cancel'),
                            setup: setupCursorHover,
                            onClicked: () => {
                                hidePasswordEntry();
                            },
                        }),
                        Button({
                            className: 'sidebar-wifinetworks-connect-button',
                            label: getString('Connect'),
                            setup: setupCursorHover,
                            onClicked: () => {
                                // Trigger the onAccept handler
                                passwordEntry.onAccept(passwordEntry);
                            },
                        }),
                    ],
                }),
            ]
        }),
    });
    
    // Function to handle connection attempt
    const handleConnectionAttempt = () => {
        if (accessPoint.active) return;
        
        // First check if this network is already registered
        isNetworkRegistered(accessPoint.ssid).then(isRegistered => {
            if (isRegistered) {
                // If already registered, connect directly without asking for password
                // Use the exact SSID for the connection
                const tempScript = `/tmp/wifi_connect_registered_${Math.random().toString(36).substring(2, 9)}.sh`;
                const scriptContent = `#!/bin/bash
# Try to find the exact connection name for this SSID
CONN_NAME=$(nmcli -t -f NAME,TYPE connection show | grep ":wifi$" | grep -i "^${accessPoint.ssid}\\(_\\|:\\|$\\)" | head -n 1 | cut -d':' -f1)

if [ -n "$CONN_NAME" ]; then
    # Connection exists, make sure autoconnect is enabled
    nmcli connection modify "$CONN_NAME" connection.autoconnect yes
    
    # Connect to it
    echo "Connecting to existing profile: $CONN_NAME"
    nmcli connection up "$CONN_NAME"
else
    # Fallback to direct connection by SSID
    echo "Connecting directly to: ${accessPoint.ssid}"
    nmcli device wifi connect "${accessPoint.ssid}"
fi

# Self-delete this script
rm "$0"
`;
                
                // Show a temporary connecting message
                Utils.notify({
                    summary: getString("Connecting to WiFi"),
                    body: `${getString("Connecting to")} ${accessPoint.ssid}...`,
                    iconName: 'network-wireless-acquiring-symbolic',
                });
                
                // Make sure password entry is hidden
                hidePasswordEntry();
                
                Utils.writeFile(scriptContent, tempScript)
                    .then(() => {
                        // Make the script executable
                        return execAsync(['chmod', '+x', tempScript]);
                    })
                    .then(() => {
                        // Execute the script
                        return execAsync([tempScript]);
                    })
                    .catch(error => {
                        // If connection fails, it might be due to password change
                        // Only show password entry if the error specifically mentions password issues
                        if (error.toString().toLowerCase().includes('password') || 
                            error.toString().toLowerCase().includes('auth') || 
                            error.toString().toLowerCase().includes('secrets')) {
                            showPasswordEntry();
                        } else {
                            // Create a notification for other errors
                            Utils.notify({
                                summary: getString("WiFi Connection Failed"),
                                body: `${getString("Could not connect to")} ${accessPoint.ssid}. ${getString("Please try again.")}`,
                                iconName: 'network-wireless-disconnected-symbolic',
                                urgency: 'critical',
                            });
                        }
                    });
                return;
            }
            
            // If not registered, proceed with normal flow
            // Improved check for secured networks
            // Most networks are secured, so default to true unless we're sure it's open
            const isSecured = !(
                // Only consider it open if it explicitly has no security
                (accessPoint.security && accessPoint.security.length === 0) ||
                // Or if it's explicitly marked as an open network
                accessPoint.iconName === 'network-wireless-signal-none-symbolic'
            );
            
            if (isSecured) {
                showPasswordEntry();
            } else {
                // Connect directly to open networks
                connectToOpenNetwork();
            }
        });
    };
    
    // Function to show password entry
    const showPasswordEntry = () => {
        // Show password entry for secured networks
        passwordRevealer.revealChild = true;
        passwordEntry.text = '';
        passwordEntry.placeholderText = getString("Enter password for") + " " + accessPoint.ssid;
        
        // Store active password entry to prevent it from disappearing
        activePasswordEntry = passwordEntry;
        activePasswordSSID = accessPoint.ssid;
        
        // Focus the password entry
        Utils.timeout(100, () => {
            try {
                passwordEntry.grab_focus();
            } catch (e) {
                // Silent error handling
            }
        });
        
        // Make sure the password entry is visible by scrolling to it
        Utils.timeout(200, () => {
            try {
                const parent = passwordEntry.get_parent();
                if (parent && typeof parent.get_allocation_box === 'function') {
                    parent.get_allocation_box();
                }
            } catch (e) {
                // Silent error handling
            }
        });
    };
    
    // Function to connect to open network
    const connectToOpenNetwork = () => {
        // Connect directly to open networks
        const ssid = accessPoint.ssid;
        const connectionName = ssid;
        
        // Create a temporary file to store the connection command
        const tempScript = `/tmp/wifi_connect_${Math.random().toString(36).substring(2, 9)}.sh`;
        
        // Create the script content for open networks
        const scriptContent = `#!/bin/bash
set -e

# Disconnect from any existing connections first
nmcli device disconnect wlan0 || true

# Check for existing connections with this SSID
EXISTING_CONNECTIONS=$(nmcli -t -f NAME,TYPE connection show | grep ":wifi$" | grep "^${ssid}\\(_\\|:\\|$\\)" | cut -d':' -f1)

# If there are existing connections, delete them all
if [ -n "$EXISTING_CONNECTIONS" ]; then
    echo "Removing existing connections for ${ssid}..."
    for conn in $EXISTING_CONNECTIONS; do
        nmcli connection delete "$conn" || true
    done
fi

# Create a new connection for open network
echo "Creating new connection profile..."
nmcli connection add type wifi con-name "${connectionName}" ifname wlan0 ssid "${ssid}" 

# Additional settings for better stability
nmcli connection modify "${connectionName}" connection.autoconnect yes
nmcli connection modify "${connectionName}" connection.autoconnect-priority 10
nmcli connection modify "${connectionName}" ipv4.method auto
nmcli connection modify "${connectionName}" ipv6.method auto

# Wait a moment before connecting
sleep 1

# Connect to the network
echo "Connecting to network..."
nmcli connection up "${connectionName}"

# Self-delete this script for security
rm "$0"
`;
        
        // Write the script to the temp file
        Utils.writeFile(scriptContent, tempScript)
            .then(() => {
                // Make the script executable
                return execAsync(['chmod', '+x', tempScript]);
            })
            .then(() => {
                // Execute the script
                return execAsync([tempScript]);
            })
            .catch(error => {
                // Create a notification
                Utils.notify({
                    summary: getString("WiFi Connection Failed"),
                    body: `${getString("Could not connect to")} ${ssid}. ${getString("Please try again.")}`,
                    iconName: 'network-wireless-disconnected-symbolic',
                    urgency: 'critical',
                });
            });
    };
    
    // Check if this is the active password entry and restore it
    if (activePasswordSSID === accessPoint.ssid && activePasswordEntry) {
        Utils.timeout(10, () => {
            passwordRevealer.revealChild = true;
        });
    }
    
    return Box({
        vertical: true,
        children: [
            Button({
                onClicked: handleConnectionAttempt,
        child: Box({
            className: 'sidebar-wifinetworks-network spacing-h-10',
            children: [
                networkStrength,
                networkName,
                Box({ hexpand: true }),
                        // Show a lock icon for secured networks
                        !(accessPoint.security && accessPoint.security.length === 0) && 
                        accessPoint.iconName !== 'network-wireless-signal-none-symbolic' ? 
                            MaterialIcon('lock', 'small') : null,
                accessPoint.active ? MaterialIcon('check', 'large') : null,
            ],
        }),
        setup: accessPoint.active ? () => { } : setupCursorHover,
            }),
            passwordRevealer,
        ]
    });
}

const CurrentNetwork = () => {
    let authLock = false;
    // console.log(Network.wifi);
    const bottomSeparator = Box({
        className: 'separator-line',
    });
    
    // State for expanded actions
    let actionsExpanded = false;
    let confirmationExpanded = false;
    let confirmationAction = '';
    
    // Create the action buttons revealer
    const actionButtons = Box({
        className: 'spacing-h-5 margin-top-5',
        homogeneous: true,
        children: [
            Button({
                className: 'sidebar-wifinetworks-action-button',
                label: getString('Forget'),
                setup: setupCursorHover,
                onClicked: () => {
                    confirmationAction = 'forget';
                    confirmationExpanded = true;
                    confirmationRevealer.revealChild = true;
                    actionsRevealer.revealChild = false;
                },
            }),
            Button({
                className: 'sidebar-wifinetworks-action-button',
                label: getString('Disconnect'),
                setup: setupCursorHover,
                onClicked: () => {
                    confirmationAction = 'disconnect';
                    confirmationExpanded = true;
                    confirmationRevealer.revealChild = true;
                    actionsRevealer.revealChild = false;
                },
            }),
        ],
    });
    
    // Create the confirmation buttons revealer
    const confirmationButtons = Box({
        className: 'spacing-h-5 margin-top-5',
        homogeneous: true,
        children: [
            Button({
                className: 'sidebar-wifinetworks-cancel-button',
                label: getString('Cancel'),
                setup: setupCursorHover,
                onClicked: () => {
                    confirmationExpanded = false;
                    confirmationRevealer.revealChild = false;
                    actionsRevealer.revealChild = true;
                },
            }),
            Button({
                className: 'sidebar-wifinetworks-confirm-button',
                label: getString('Confirm'),
                setup: setupCursorHover,
                onClicked: () => {
                    if (confirmationAction === 'forget') {
                        // Execute forget network command for all connections with this SSID
                        const ssid = Network.wifi?.ssid;
                        if (ssid) {
                            // Create a temporary script to remove all connections for this SSID
                            const tempScript = `/tmp/wifi_forget_${Math.random().toString(36).substring(2, 9)}.sh`;
                            const scriptContent = `#!/bin/bash
# First disconnect from the network
nmcli device disconnect wlan0 || true

# Find and remove all connections for this SSID
EXISTING_CONNECTIONS=$(nmcli -t -f NAME,TYPE connection show | grep ":wifi$" | grep -i "^${ssid}\\(_\\|:\\|$\\)" | cut -d':' -f1)

# If there are existing connections, delete them all
if [ -n "$EXISTING_CONNECTIONS" ]; then
    echo "Removing existing connections for ${ssid}..."
    for conn in $EXISTING_CONNECTIONS; do
        nmcli connection delete "$conn" || true
    done
fi

# Also check for connections with different case (case-insensitive search)
EXISTING_CONNECTIONS_CASE_INSENSITIVE=$(nmcli -t -f NAME,TYPE connection show | grep ":wifi$" | grep -i "${ssid}" | cut -d':' -f1)
if [ -n "$EXISTING_CONNECTIONS_CASE_INSENSITIVE" ]; then
    echo "Removing case-insensitive matches for ${ssid}..."
    for conn in $EXISTING_CONNECTIONS_CASE_INSENSITIVE; do
        nmcli connection delete "$conn" || true
    done
fi

# Make sure the device is disconnected
nmcli device disconnect wlan0 || true

# Remove any secrets stored for this network in the keyring
if command -v secret-tool &> /dev/null; then
    echo "Removing secrets from keyring..."
    secret-tool search --unlock network "${ssid}" 2>/dev/null || true
    secret-tool clear network "${ssid}" 2>/dev/null || true
fi

# Self-delete this script
rm "$0"
`;
                            
                            Utils.writeFile(scriptContent, tempScript)
                                .then(() => {
                                    // Make the script executable
                                    return execAsync(['chmod', '+x', tempScript]);
                                })
                                .then(() => {
                                    // Execute the script
                                    return execAsync([tempScript]);
                                })
                                .then(() => {
                                    // Create a notification for successful forget
                                    Utils.notify({
                                        summary: getString("WiFi Network Forgotten"),
                                        body: `${getString("Successfully forgot")} ${ssid}.`,
                                        iconName: 'network-wireless-disconnected-symbolic',
                                    });
                                })
                                .catch(error => {
                                    // Create a notification for error
                                    Utils.notify({
                                        summary: getString("Error"),
                                        body: `${getString("Failed to forget")} ${ssid}: ${error}`,
                                        iconName: 'dialog-error-symbolic',
                                        urgency: 'critical',
                                    });
                                });
                        }
                    } else if (confirmationAction === 'disconnect') {
                        // Execute disconnect command - only disconnect without affecting saved connections
                        const tempScript = `/tmp/wifi_disconnect_${Math.random().toString(36).substring(2, 9)}.sh`;
                        const scriptContent = `#!/bin/bash
# Get the current connection name and SSID
CONN_NAME=\$(nmcli -t -f NAME,DEVICE connection show --active | grep ":wlan0\$" | cut -d':' -f1)
SSID=\$(nmcli -t -f GENERAL.CONNECTION device show wlan0 | cut -d':' -f2)

if [ -n "\$CONN_NAME" ]; then
    # First, temporarily disable autoconnect to prevent immediate reconnection
    nmcli connection modify "\$CONN_NAME" connection.autoconnect no
    
    # Disconnect the device
    nmcli device disconnect wlan0
    
    # Wait a moment
    sleep 1
    
    # Re-enable autoconnect for next time
    nmcli connection modify "\$CONN_NAME" connection.autoconnect yes
    
    # Create a notification
    notify-send "WiFi Disconnected" "Successfully disconnected from \$SSID" --icon=network-wireless-disconnected-symbolic
else
    # If no active connection, just disconnect the device
    nmcli device disconnect wlan0
    notify-send "WiFi Disconnected" "Successfully disconnected WiFi" --icon=network-wireless-disconnected-symbolic
fi

# Self-delete this script
rm "\$0"
`;
                        
                        Utils.writeFile(scriptContent, tempScript)
                            .then(() => {
                                // Make the script executable
                                return execAsync(['chmod', '+x', tempScript]);
                            })
                            .then(() => {
                                // Execute the script
                                return execAsync([tempScript]);
                            })
                            .then(() => {
                                // Create a notification for successful disconnect
                                Utils.notify({
                                    summary: getString("WiFi Disconnected"),
                                    body: getString("Successfully disconnected from WiFi network."),
                                    iconName: 'network-wireless-disconnected-symbolic',
                                });
                            })
                            .catch(error => {
                                // Create a notification for error
                                Utils.notify({
                                    summary: getString("Error"),
                                    body: `${getString("Failed to disconnect")}: ${error}`,
                                    iconName: 'dialog-error-symbolic',
                                    urgency: 'critical',
                                });
                            });
                    }
                    
                    // Reset UI state
                    confirmationExpanded = false;
                    actionsExpanded = false;
                    confirmationRevealer.revealChild = false;
                    actionsRevealer.revealChild = false;
                },
            }),
        ],
    });
    
    // Create the revealers
    const actionsRevealer = Revealer({
        transition: 'slide_down',
        transitionDuration: userOptions.asyncGet().animations.durationSmall,
        revealChild: false,
        child: actionButtons,
    });
    
    const confirmationRevealer = Revealer({
        transition: 'slide_down',
        transitionDuration: userOptions.asyncGet().animations.durationSmall,
        revealChild: false,
        child: confirmationButtons,
    });
    
    const networkName = Box({
        vertical: true,
        hexpand: true,
        children: [
            Label({
                wrapMode: Pango.WrapMode.WORD_CHAR,
                hpack: 'start',
                className: 'txt-smaller txt-subtext',
                label: getString("Current network"),
            }),
            Label({
                wrapMode: Pango.WrapMode.WORD_CHAR,
                hpack: 'start',
                label: Network.wifi?.ssid,
                setup: (self) => {
                    // Register with the SafeNetworkHooks system instead of using direct hooks
                    networkHooks.register(self, (network) => {
                        if (!authLock) {
                            safeUpdateLabel(self, network.wifi?.ssid || getString('Not Connected'));
                        }
                    });
                },
            }),
        ]
    });
    
    // Create the X button for expanding actions
    const expandButton = Button({
        className: 'sidebar-wifinetworks-expand-button',
        child: MaterialIcon('more_vert', 'small'),
        setup: setupCursorHover,
        onClicked: () => {
            if (confirmationExpanded) {
                confirmationExpanded = false;
                confirmationRevealer.revealChild = false;
            } else if (actionsExpanded) {
                actionsExpanded = false;
                actionsRevealer.revealChild = false;
            } else {
                actionsExpanded = true;
                actionsRevealer.revealChild = true;
            }
        },
    });
  
    const networkStatus = Box({
        children: [Label({
            wrapMode: Pango.WrapMode.WORD_CHAR,
            vpack: 'center',
            className: 'txt-subtext',
            setup: (self) => {
                // Register with the SafeNetworkHooks system instead of using direct hooks
                networkHooks.register(self, (network) => {
                    if (!authLock) {
                        safeUpdateLabel(self, network.wifi.state);
                    }
                });
            },
        })]
    });
    
    const networkAuth = Revealer({
        transition: 'slide_down',
        transitionDuration: userOptions.asyncGet().animations.durationLarge,
        revealChild: false,
        child: Box({
            className: 'margin-top-10 spacing-v-5 wifi-password-container',
            vertical: true,
            children: [
                Label({
                    wrapMode: Pango.WrapMode.WORD_CHAR,
                    className: 'txt-bold margin-bottom-5',
                    hpack: 'start',
                    label: `${getString("Enter Password for")} "${connectAttempt}"`,
                    setup: (self) => {
                        // Update the label when connectAttempt changes
                        const updateLabel = () => {
                            if (typeof self.set_label === 'function') {
                                self.set_label(`${getString("Enter Password for")} "${connectAttempt}"`);
                            } else if (typeof self.setLabel === 'function') {
                                self.setLabel(`${getString("Enter Password for")} "${connectAttempt}"`);
                            } else if (self.label !== undefined) {
                                self.label = `${getString("Enter Password for")} "${connectAttempt}"`;
                            }
                        };
                        
                        // Set up a poll to update the label
                        self.poll(500, updateLabel);
                    },
                }),
                Box({
                    className: 'spacing-h-5',
                    children: [
                Entry({
                    className: 'sidebar-wifinetworks-auth-entry',
                    visibility: false,
                            hexpand: true,
                            placeholderText: getString("Enter network password here"),
                    onAccept: (self) => {
                        authLock = false;
                        networkAuth.revealChild = false;
                                
                                // Use the same reliable approach as in WifiNetwork
                                const ssid = connectAttempt;
                                const password = self.text;
                                
                                // Create a temporary file to store the connection command
                                const tempScript = `/tmp/wifi_connect_${Math.random().toString(36).substring(2, 9)}.sh`;
                                const connectionName = ssid;
                                
                                // Create the script content
                                const scriptContent = `#!/bin/bash
set -e

# Disconnect from any existing connections first
nmcli device disconnect wlan0 || true

# Check for existing connections with this SSID
EXISTING_CONNECTIONS=$(nmcli -t -f NAME,TYPE connection show | grep ":wifi$" | grep "^${ssid}\\(_\\|:\\|$\\)" | cut -d':' -f1)

# If there are existing connections, delete them all
if [ -n "$EXISTING_CONNECTIONS" ]; then
    echo "Removing existing connections for ${ssid}..."
    for conn in $EXISTING_CONNECTIONS; do
        nmcli connection delete "$conn" || true
    done
fi

# Create a new connection
echo "Creating new connection profile..."
nmcli connection add type wifi con-name "${connectionName}" ifname wlan0 ssid "${ssid}" 

# Set the password
echo "Setting up security..."
nmcli connection modify "${connectionName}" wifi-sec.key-mgmt wpa-psk wifi-sec.psk "${password}"

# Additional settings for better stability
nmcli connection modify "${connectionName}" connection.autoconnect yes
nmcli connection modify "${connectionName}" connection.autoconnect-priority 10
nmcli connection modify "${connectionName}" ipv4.method auto
nmcli connection modify "${connectionName}" ipv6.method auto

# Wait a moment before connecting
sleep 1

# Connect to the network
echo "Connecting to network..."
nmcli connection up "${connectionName}"

# Self-delete this script for security
rm "$0"
`;
                                
                                // Write the script to the temp file
                                Utils.writeFile(scriptContent, tempScript)
                                    .then(() => {
                                        // Make the script executable
                                        return execAsync(['chmod', '+x', tempScript]);
                                    })
                                    .then(() => {
                                        // Execute the script
                                        return execAsync([tempScript]);
                                    })
                                    .catch(error => {
                                        console.error(`Connection error: ${error}`);
                                        authLock = false;
                                        
                                        // Create a notification
                                        Utils.notify({
                                            summary: getString("WiFi Connection Failed"),
                                            body: `${getString("Could not connect to")} ${ssid}. ${getString("Please try again.")}`,
                                            iconName: 'network-wireless-disconnected-symbolic',
                                            urgency: 'critical',
                                        });
                                    });
                            }
                        }),
                        Button({
                            className: 'sidebar-wifinetworks-password-toggle',
                            child: MaterialIcon('visibility', 'small'),
                            setup: setupCursorHover,
                            onClicked: (self) => {
                                // Find the entry and toggle visibility
                                const entry = self.get_parent().get_children()[0];
                                if (entry) {
                                    entry.visibility = !entry.visibility;
                                    // Update icon
                                    self.child = MaterialIcon(
                                        entry.visibility ? 'visibility_off' : 'visibility', 
                                        'small'
                                    );
                                }
                            },
                        }),
                    ],
                }),
                Box({
                    className: 'spacing-h-5 margin-top-5',
                    homogeneous: true,
                    children: [
                        Button({
                            className: 'sidebar-wifinetworks-cancel-button',
                            label: getString('Cancel'),
                            setup: setupCursorHover,
                            onClicked: () => {
                                authLock = false;
                                networkAuth.revealChild = false;
                            },
                        }),
                        Button({
                            className: 'sidebar-wifinetworks-connect-button',
                            label: getString('Connect'),
                            setup: setupCursorHover,
                            onClicked: (self) => {
                                // Find the entry and trigger its onAccept handler
                                const entryBox = self.get_parent().get_parent().get_children()[1];
                                if (entryBox && entryBox.get_children) {
                                    const entry = entryBox.get_children()[0];
                                    if (entry && typeof entry.onAccept === 'function') {
                                        entry.onAccept(entry);
                                    }
                                }
                            },
                        }),
                    ],
                }),
            ]
        }),
        setup: (self) => {
            // Register with the SafeNetworkHooks system instead of using direct hooks
            networkHooks.register(self, (network) => {
                // Only show auth dialog if we're in a failed or need_auth state
                // AND we don't have a saved connection for this network
                if ((network.wifi.state == 'failed' || network.wifi.state == 'need_auth')) {
                    // Check if this network is already registered before showing auth dialog
                    if (network.wifi?.ssid) {
                        isNetworkRegistered(network.wifi.ssid).then(isRegistered => {
                            // Only show auth dialog if network is not registered
                            if (!isRegistered) {
                    authLock = true;
                    connectAttempt = network.wifi.ssid;
                    
                    try {
                        // Use a safer method to update the revealer
                        if (typeof self.set_reveal_child === 'function') {
                            self.set_reveal_child(true);
                        } else if (typeof self.setRevealChild === 'function') {
                            self.setRevealChild(true);
                        } else {
                            // Last resort, try direct property assignment
                            self.revealChild = true;
                        }
                                    
                                    // Focus the password entry
                                    Utils.timeout(100, () => {
                                        const entryBox = self.child.get_children()[1];
                                        if (entryBox && entryBox.get_children) {
                                            const entry = entryBox.get_children()[0];
                                            if (entry) {
                                                entry.grab_focus();
                                            }
                                        }
                                    });
                    } catch (e) {
                        console.error('Error setting revealChild property:', e);
                                }
                            }
                        }).catch(e => {
                            // If there's an error checking registration, default to showing auth dialog
                            authLock = true;
                            connectAttempt = network.wifi.ssid;
                            
                            try {
                                if (typeof self.set_reveal_child === 'function') {
                                    self.set_reveal_child(true);
                                } else if (typeof self.setRevealChild === 'function') {
                                    self.setRevealChild(true);
                                } else {
                                    self.revealChild = true;
                                }
                            } catch (e) {
                                console.error('Error setting revealChild property:', e);
                            }
                        });
                    }
                }
            });
            
            // Also manually show the revealer when connectAttempt is set
            self.poll(500, () => {
                if (authLock && connectAttempt) {
                    try {
                        if (typeof self.set_reveal_child === 'function') {
                            self.set_reveal_child(true);
                        } else if (typeof self.setRevealChild === 'function') {
                            self.setRevealChild(true);
                        } else {
                            self.revealChild = true;
                        }
                    } catch (e) {
                        // Silent error handling
                    }
                }
            });
        },
    });
    
    const actualContent = Box({
        vertical: true,
        className: 'spacing-v-10',
        children: [
            Box({
                className: 'sidebar-wifinetworks-network',
                vertical: true,
                children: [
                    Box({
                        className: 'spacing-h-10',
                        children: [
                            MaterialIcon('language', 'hugerass'),
                            networkName,
                            Box({ hexpand: true }),
                            expandButton,
                        ]
                    }),
                    actionsRevealer,
                    confirmationRevealer,
                    networkAuth,
                ]
            }),
            bottomSeparator,
        ]
    });
    
    return Box({
        vertical: true,
        children: [Revealer({
            transition: 'slide_down',
            transitionDuration: userOptions.asyncGet().animations.durationLarge,
            revealChild: Network.wifi,
            child: actualContent,
        })]
    });
}
export default (props) => {
    const networkList = Box({
        vertical: true,
        className: 'spacing-v-10',
        children: [Overlay({
            passThrough: true,
            child: Scrollable({
                vexpand: true,
                child: Box({
                    attribute: {
                        'updateNetworks': (self) => {
                            // Store current children to check for active password entry
                            const oldChildren = self.children || [];
                            
                            const accessPoints = Network.wifi?.access_points || [];
                            const newChildren = Object.values(accessPoints.reduce((a, accessPoint) => {
                                // Only keep max strength networks by ssid
                                if (!a[accessPoint.ssid] || a[accessPoint.ssid].strength < accessPoint.strength) {
                                    a[accessPoint.ssid] = accessPoint;
                                    a[accessPoint.ssid].active |= accessPoint.active;
                                }

                                return a;
                            }, {})).map(n => WifiNetwork(n));
                            
                            // If we have an active password entry, don't update the list
                            if (activePasswordEntry && activePasswordSSID) {
                                return;
                            }
                            
                            self.children = newChildren;
                        },
                    },
                    vertical: true,
                    className: 'spacing-v-5 margin-bottom-15',
                    setup: (self) => {
                        // Register with the SafeNetworkHooks system instead of using direct hooks
                        networkHooks.register(self, (network) => {
                            try {
                                if (self.attribute && typeof self.attribute.updateNetworks === 'function') {
                                    self.attribute.updateNetworks(self);
                                }
                            } catch (e) {
                                // Silent error handling
                            }
                        });
                    },
                })
            }),
            overlays: [Box({
                className: 'sidebar-centermodules-scrollgradient-bottom'
            })]
        })]
    });
    const bottomBar = Box({
        homogeneous: true,
        children: [Button({
            hpack: 'center',
            className: 'txt-small txt sidebar-centermodules-bottombar-button',
            onClicked: () => {
                execAsync(['bash', '-c', userOptions.asyncGet().apps.network]).catch(print);
                closeEverything();
            },
            label: getString('More'),
            setup: setupCursorHover,
        })],
    })
    return Box({
        ...props,
        className: 'spacing-v-10',
        vertical: true,
        children: [
            CurrentNetwork(),
            networkList,
            bottomBar,
        ]
    });
}
