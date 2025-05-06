import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Bluetooth from 'resource:///com/github/Aylur/ags/service/bluetooth.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import App from 'resource:///com/github/Aylur/ags/app.js';
import userOptions from '../../.configuration/user_options.js';
const { Box, Button, Label, Scrollable, Stack, Overlay, Revealer } = Widget;
const { execAsync, timeout } = Utils;
const { GLib, Gtk } = imports.gi;
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';
import { setupCursorHover } from '../../.widgetutils/cursorhover.js';
import { ConfigToggle } from '../../.commonwidgets/configwidgets.js';

// Ensure bluetooth options exist in userOptions
if (!userOptions.bluetooth) {
    userOptions.bluetooth = {
        debug: false // Set to true to enable debug logging
    };
}

// Note about DBUSMENU-GLIB warnings:
// These warnings are harmless and can be ignored. They're related to
// a known issue with GTK4 and DBusMenu. To fully suppress them, you can run:
// G_MESSAGES_DEBUG='' ags

// Helper function to get localized strings (placeholder for now)
const getString = (str) => str;

// Helper function to close sidebar
const closeEverything = () => {
    App.closeWindow('sideright');
};

// can't connect: sync_problem

const BluetoothDevice = (device) => {
    // Check if this is a custom device or an AGS device
    const isCustomDevice = device.fromBluetooth || device.fromBlueman;

    // For custom devices, we need to create a wrapper that has the necessary methods
    // that AGS expects for the hook function
    const deviceWrapper = isCustomDevice ? {
        // Original device properties
        ...device,
        // Add connect method for hook function
        connect: (/* signal, callback */) => {
            // This is a no-op for custom devices
            return 0; // Return a fake connection ID
        },
        // Add disconnect method for hook function
        disconnect: (/* id */) => {
            // This is a no-op for custom devices
        },
        // Add setConnection method - using our custom connect function
        setConnection: (connect) => {
            if (connect) {
                // Use our custom connect function directly
                return connectDevice(device.address);
            } else {
                // Disconnect using bluetoothctl directly
                return Utils.execAsync(['bluetoothctl', 'disconnect', device.address])
                    .catch(e => {
                        console.error('Error disconnecting:', e);
                        return false;
                    });
            }
        },
        // Default values for missing properties
        iconName: device.icon || 'bluetooth',
        batteryPercentage: device.batteryPercentage || 0,
        trusted: device.trusted || false,
        blocked: device.blocked || false
    } : device;

    // Device icon with battery indicator if available
    const deviceIcon = Box({
        vpack: 'center',
        className: 'sidebar-bluetooth-device-icon-container',
        css: 'margin-right: 8px;',
        children: [
            Box({
                className: 'sidebar-bluetooth-icon-box',
                hpack: 'center',
                vpack: 'center',
                children: [
                    // Use MaterialIcon with appropriate icon based on device type and state
                    MaterialIcon(getDeviceIcon(deviceWrapper), 'norm', {
                        className: 'icon-material sidebar-bluetooth-icon',
                        css: 'color: @onSecondaryContainer; font-size: 16px;'
                    }),
                ],
            }),
        ],
    });

    // We'll use deviceNameLabel instead of deviceStatus

    // Toggle connection button - using our custom connect function
    const deviceConnectButton = ConfigToggle({
        vpack: 'center',
        expandWidget: false,
        desc: 'Toggle connection',
        initValue: deviceWrapper.connected,
        onChange: (self, newValue) => {
            if (newValue) {
                // Use our custom connect function directly
                connectDevice(deviceWrapper.address).then(success => {
                    if (!success) {
                        // If connection failed, reset the toggle
                        self.enabled.value = false;
                    }
                }).catch(() => {
                    self.enabled.value = false;
                });
            } else {
                // Disconnect using bluetoothctl directly
                Utils.execAsync(['bluetoothctl', 'disconnect', deviceWrapper.address])
                    .catch(e => console.error('Error disconnecting:', e));
            }
        },
    });

    // Device actions revealer
    const actionsRevealer = Revealer({
        revealChild: false,
        transition: 'slide_down',
        transitionDuration: 200,
        child: Box({
            vertical: true,
            className: 'sidebar-bluetooth-device-actions spacing-v-5 margin-top-5',
            children: [
                // Trust/Untrust device button
                Button({
                    className: 'sidebar-bluetooth-action-button material-button',
                    child: Box({
                        className: 'spacing-h-5',
                        children: [
                            MaterialIcon(deviceWrapper.trusted ? 'cancel' : 'verified_user', 'norm', {
                                css: 'color: @primary;'
                            }),
                            Label({
                                label: deviceWrapper.trusted ? getString('Untrust device') : getString('Trust device'),
                                xalign: 0,
                                hexpand: true,
                            }),
                        ],
                    }),
                    setup: setupCursorHover,
                    onClicked: async () => {
                        if (deviceWrapper.trusted) {
                            await untrustDevice(deviceWrapper.address);
                        } else {
                            await trustDevice(deviceWrapper.address);
                        }
                    },
                }),

                // Block/Unblock device button
                Button({
                    className: 'sidebar-bluetooth-action-button material-button',
                    child: Box({
                        className: 'spacing-h-5',
                        children: [
                            MaterialIcon(deviceWrapper.blocked ? 'check_circle' : 'block', 'norm', {
                                css: 'color: @error;'
                            }),
                            Label({
                                label: deviceWrapper.blocked ? getString('Unblock device') : getString('Block device'),
                                xalign: 0,
                                hexpand: true,
                            }),
                        ],
                    }),
                    setup: setupCursorHover,
                    onClicked: async () => {
                        if (deviceWrapper.blocked) {
                            await unblockDevice(deviceWrapper.address);
                        } else {
                            await blockDevice(deviceWrapper.address);
                        }
                    },
                }),

                // Pair device button (only show if not paired)
                !deviceWrapper.paired ? Button({
                    className: 'sidebar-bluetooth-action-button material-button',
                    child: Box({
                        className: 'spacing-h-5',
                        children: [
                            MaterialIcon('link', 'norm', {
                                css: 'color: @tertiary;'
                            }),
                            Label({
                                label: getString('Pair device'),
                                xalign: 0,
                                hexpand: true,
                            }),
                        ],
                    }),
                    setup: setupCursorHover,
                    onClicked: async () => {
                        await pairDevice(deviceWrapper.address);
                    },
                }) : null,
            ].filter(Boolean),
        }),
    });

    // More actions button
    const moreActionsButton = Button({
        vpack: 'center',
        className: 'sidebar-bluetooth-device-action material-icon-button',
        child: Box({
            hpack: 'center',
            vpack: 'center',
            children: [
                MaterialIcon('more_vert', 'tiny', {
                    className: 'icon-material',
                    css: 'font-size: 12px;'
                })
            ]
        }),
        tooltipText: getString('More actions'),
        setup: setupCursorHover,
        onClicked: () => {
            // Toggle the actions revealer
            actionsRevealer.revealChild = !actionsRevealer.revealChild;
        },
    });

    // Remove device button
    const deviceRemoveButton = Button({
        vpack: 'center',
        className: 'sidebar-bluetooth-device-remove material-icon-button',
        child: Box({
            hpack: 'center',
            vpack: 'center',
            children: [
                MaterialIcon('delete', 'tiny', {
                    className: 'icon-material',
                    css: 'font-size: 12px;'
                })
            ]
        }),
        tooltipText: getString('Remove device'),
        setup: setupCursorHover,
        onClicked: () => execAsync(['bluetoothctl', 'remove', deviceWrapper.address]).catch(print),
    });

    // Create a device name label
    const deviceNameLabel = Label({
        xalign: 0,
        yalign: 0.5,
        vpack: 'center',
        hexpand: true,
        maxWidthChars: 20,
        truncate: 'end',
        label: deviceWrapper.name,
        className: 'txt-small bluetooth-device-name',
        css: 'font-weight: 500; padding-top: 0; padding-bottom: 0;',
    });

    return Box({
        vertical: true,
        className: `sidebar-bluetooth-device material-card ${deviceWrapper.connected ? 'connected' : ''}`,
        css: 'padding: 8px 12px; margin-bottom: 6px;',
        children: [
            // Main device row - similar to the toggle rows
            Box({
                className: 'spacing-h-10 bluetooth-device-row',
                vpack: 'center',
                children: [
                    // Icon on the left
                    deviceIcon,
                    // Device name in the center
                    deviceNameLabel,
                    // Controls on the right
                    Box({
                        className: 'spacing-h-3 bluetooth-device-controls',
                        vpack: 'center',
                        halign: 'end',
                        children: [
                            deviceConnectButton,
                            moreActionsButton,
                            deviceRemoveButton,
                        ]
                    })
                ]
            }),
            // Expandable actions
            actionsRevealer,
        ]
    })
}

// Function to trust a device
const trustDevice = async (address) => {
    try {
        await execAsync(`bluetoothctl trust ${address}`);
        return true;
    } catch (error) {
        console.error('Error trusting device:', error);
        return false;
    }
};

// Function to untrust a device
const untrustDevice = async (address) => {
    try {
        await execAsync(`bluetoothctl untrust ${address}`);
        return true;
    } catch (error) {
        console.error('Error untrusting device:', error);
        return false;
    }
};

// Function to block a device
const blockDevice = async (address) => {
    try {
        await execAsync(`bluetoothctl block ${address}`);
        return true;
    } catch (error) {
        console.error('Error blocking device:', error);
        return false;
    }
};

// Function to unblock a device
const unblockDevice = async (address) => {
    try {
        await execAsync(`bluetoothctl unblock ${address}`);
        return true;
    } catch (error) {
        console.error('Error unblocking device:', error);
        return false;
    }
};

// Set up Bluetooth to be discoverable and ready for pairing
const setupBluetooth = async () => {
    try {
        // Make sure Bluetooth is powered on
        await Utils.execAsync(['bluetoothctl', 'power', 'on']);

        // Set up agent for handling pairing requests
        await Utils.execAsync(['bluetoothctl', 'agent', 'on']);
        await Utils.execAsync(['bluetoothctl', 'default-agent']);

        // Make the device discoverable
        await Utils.execAsync(['bluetoothctl', 'discoverable', 'on']);

        // Set pairable on
        await Utils.execAsync(['bluetoothctl', 'pairable', 'on']);

        // Don't log anything to avoid console messages
    } catch (error) {
        // Silently handle errors to avoid console messages
    }
};

// Call this when the module loads
setupBluetooth().catch(() => {});



// Function to pair with a device using bluetoothctl - optimized version
const pairDevice = async (address) => {
    try {
        // Get device name
        const deviceInfo = await Utils.execAsync(['bash', '-c', `bluetoothctl info ${address} 2>/dev/null || echo "Unknown device"`]);
        const nameMatch = deviceInfo.match(/Name: (.+)/);
        const deviceName = nameMatch ? nameMatch[1] : 'Unknown device';

        // Show a notification that we're starting the pairing process
        Utils.notify({
            summary: 'Bluetooth Pairing',
            body: `Starting pairing process with "${deviceName}"...`,
            iconName: 'bluetooth_connected',
        });

        // Trust the device first to improve pairing success
        await Utils.execAsync(['bluetoothctl', 'trust', address]).catch(() => {});

        // Make sure agent is on and we're pairable
        await Utils.execAsync(['bluetoothctl', 'agent', 'on']).catch(() => {});
        await Utils.execAsync(['bluetoothctl', 'default-agent']).catch(() => {});
        await Utils.execAsync(['bluetoothctl', 'pairable', 'on']).catch(() => {});

        // Show a notification about the pairing process
        Utils.notify({
            summary: 'Bluetooth Pairing',
            body: `If prompted, please confirm the pairing on your device.`,
            iconName: 'bluetooth_connected',
            urgency: 'critical',
        });

        // Use a script to handle the pairing process with timeout
        const pairingScript = `
            # Trust the device
            bluetoothctl trust ${address}

            # Try pairing with timeout
            timeout 15 bluetoothctl pair ${address}

            # Check if pairing was successful
            if bluetoothctl info ${address} | grep -q "Paired: yes"; then
                echo "PAIRING_SUCCESS"
                exit 0
            fi

            # If not successful, try again with a different approach
            bluetoothctl remove ${address} 2>/dev/null
            sleep 1
            bluetoothctl trust ${address}
            timeout 15 bluetoothctl pair ${address}

            # Final check
            if bluetoothctl info ${address} | grep -q "Paired: yes"; then
                echo "PAIRING_SUCCESS"
                exit 0
            else
                echo "PAIRING_FAILED"
                exit 1
            fi
        `;

        const pairingResult = await Utils.execAsync(['bash', '-c', pairingScript]);

        if (pairingResult.includes('PAIRING_SUCCESS')) {
            // Show success notification
            Utils.notify({
                summary: 'Bluetooth Pairing Successful',
                body: `Device "${deviceName}" paired successfully. You can now connect to it.`,
                iconName: 'bluetooth_connected',
            });
            return true;
        } else {
            throw new Error("Pairing verification failed");
        }
    } catch (error) {
        // Show error notification without logging to console
        Utils.notify({
            summary: 'Bluetooth Pairing Failed',
            body: 'Failed to pair with the device. Please try again.',
            iconName: 'bluetooth_disabled',
        });

        return false;
    }
};

// Function to connect to a device using bluetoothctl - optimized version
const connectDevice = async (address) => {
    try {
        // First check if the device is already connected
        const infoOutput = await Utils.execAsync(['bash', '-c', `bluetoothctl info ${address} 2>/dev/null || echo "Not connected"`]);
        if (infoOutput.includes('Connected: yes')) {
            return true;
        }

        // Get device name
        const nameMatch = infoOutput.match(/Name: (.+)/);
        const deviceName = nameMatch ? nameMatch[1] : 'Unknown device';

        // Check if device is paired, if not, try to pair first
        if (!infoOutput.includes('Paired: yes')) {
            // Show a notification that we're trying to pair first
            Utils.notify({
                summary: 'Bluetooth Connection',
                body: `Device "${deviceName}" needs to be paired first. Starting pairing process...`,
                iconName: 'bluetooth_connected',
            });

            // Try to pair the device
            const pairingResult = await pairDevice(address);
            if (!pairingResult) {
                return false;
            }

            // Wait a moment after pairing before trying to connect
            await new Promise(resolve => Utils.timeout(2000, resolve));
        }

        // Trust the device first
        await Utils.execAsync(['bluetoothctl', 'trust', address]).catch(() => {});

        // Show connecting notification
        Utils.notify({
            summary: 'Bluetooth Connection',
            body: `Connecting to "${deviceName}"...`,
            iconName: 'bluetooth_searching',
        });

        // Use a script to handle the connection process with timeout
        const connectScript = `
            # Trust the device
            bluetoothctl trust ${address}

            # Try connecting with timeout
            timeout 10 bluetoothctl connect ${address}

            # Check if connection was successful
            if bluetoothctl info ${address} | grep -q "Connected: yes"; then
                echo "CONNECTION_SUCCESS"
                exit 0
            fi

            # If first attempt failed, try a second approach
            bluetoothctl disconnect ${address} 2>/dev/null
            sleep 1
            timeout 10 bluetoothctl connect ${address}

            # Check if second attempt was successful
            if bluetoothctl info ${address} | grep -q "Connected: yes"; then
                echo "CONNECTION_SUCCESS"
                exit 0
            fi

            # If both attempts failed, try one more time with a different approach
            bluetoothctl remove ${address} 2>/dev/null
            sleep 1
            bluetoothctl scan on &
            SCAN_PID=$!
            sleep 3
            kill $SCAN_PID 2>/dev/null
            bluetoothctl scan off
            bluetoothctl trust ${address}
            bluetoothctl pair ${address}
            sleep 2
            timeout 10 bluetoothctl connect ${address}

            # Final check
            if bluetoothctl info ${address} | grep -q "Connected: yes"; then
                echo "CONNECTION_SUCCESS"
                exit 0
            else
                echo "CONNECTION_FAILED"
                exit 1
            fi
        `;

        const connectResult = await Utils.execAsync(['bash', '-c', connectScript]);

        if (connectResult.includes('CONNECTION_SUCCESS')) {
            // Show success notification
            Utils.notify({
                summary: 'Bluetooth Connection Successful',
                body: `Device "${deviceName}" connected successfully.`,
                iconName: 'bluetooth_connected',
            });
            return true;
        } else {
            // If all attempts failed, show a more helpful message
            Utils.notify({
                summary: 'Bluetooth Connection Failed',
                body: 'Failed to connect to the device. The device might be out of range or not ready to connect.',
                iconName: 'bluetooth_disabled',
            });
            return false;
        }
    } catch (error) {
        // Show error notification without logging to console
        Utils.notify({
            summary: 'Bluetooth Connection Failed',
            body: 'Failed to connect to the device. The device might be out of range or not ready to connect.',
            iconName: 'bluetooth_disabled',
        });

        return false;
    }
};

// Create a simplified version of BluetoothDevice that follows Material You 3 design
// NOTE: This function is currently not used, but kept for reference and potential future use.
// We're using BluetoothDevice for all devices to ensure consistent styling.
// eslint-disable-next-line no-unused-vars
const createSimpleBluetoothDevice = (device) => {
    // Device icon with battery indicator if available
    const deviceIcon = Box({
        vpack: 'center',
        className: 'sidebar-bluetooth-device-icon-container',
        css: 'margin-right: 6px;',
        children: [
            Box({
                className: 'sidebar-bluetooth-icon-box',
                hpack: 'center',
                vpack: 'center',
                children: [
                    // Use MaterialIcon with appropriate icon based on device type and state
                    MaterialIcon(getDeviceIcon(device), 'tiny', {
                        className: 'icon-material sidebar-bluetooth-icon',
                        css: 'color: @onSecondaryContainer; font-size: 14px;'
                    }),
                ],
            }),
        ],
    });

    // Device name label
    const deviceNameLabel = Label({
        xalign: 0,
        yalign: 0.5,
        vpack: 'center',
        hexpand: true,
        maxWidthChars: 20,
        truncate: 'end',
        label: device.name,
        className: 'txt-small bluetooth-device-name',
        css: 'font-weight: 500; padding-top: 0; padding-bottom: 0;',
    });

    // Toggle connection button - using our custom connect function
    const deviceConnectButton = ConfigToggle({
        vpack: 'center',
        expandWidget: false,
        desc: 'Toggle connection',
        initValue: device.connected,
        css: 'margin-right: 0px;',

        onChange: (self, newValue) => {
            if (newValue) {
                // Use our custom connect function
                connectDevice(device.address).then(success => {
                    if (!success) {
                        // If connection failed, reset the toggle
                        self.enabled.value = false;
                    }
                }).catch(() => {
                    self.enabled.value = false;
                });
            } else {
                // Disconnect using bluetoothctl directly
                Utils.execAsync(['bluetoothctl', 'disconnect', device.address])
                    .catch(e => console.error('Error disconnecting:', e));
            }
        },
    });

    // Trust/Block button
    const trustBlockButton = Button({
        vpack: 'center',
        className: 'sidebar-bluetooth-device-action material-icon-button',
        child: Box({
            hpack: 'center',
            vpack: 'center',
            children: [
                MaterialIcon(device.trusted ? 'verified_user' : 'shield', 'tiny', {
                    className: 'icon-material',
                    css: 'font-size: 12px;'
                })
            ]
        }),
        tooltipText: device.trusted ? getString('Trusted device') : getString('Trust device'),
        setup: setupCursorHover,
        onClicked: () => {
            if (device.trusted) {
                untrustDevice(device.address);
            } else {
                trustDevice(device.address);
            }
        },
    });

    // Actions menu button
    const actionsButton = Button({
        vpack: 'center',
        className: 'sidebar-bluetooth-device-action material-icon-button',
        child: Box({
            hpack: 'center',
            vpack: 'center',
            children: [
                MaterialIcon('more_vert', 'tiny', {
                    className: 'icon-material',
                    css: 'font-size: 12px;'
                })
            ]
        }),
        tooltipText: getString('Device actions'),
        setup: setupCursorHover,
        onClicked: () => {
            // Create a revealer for the actions menu
            const actionsRevealer = Revealer({
                revealChild: true,
                transition: 'slide_down',
                transitionDuration: 200,
                child: Box({
                    vertical: true,
                    className: 'sidebar-bluetooth-device-actions spacing-v-5 margin-top-5',
                    children: [
                        // Trust/Untrust device button
                        Button({
                            className: 'sidebar-bluetooth-action-button material-button',
                            child: Box({
                                className: 'spacing-h-5',
                                children: [
                                    MaterialIcon(device.trusted ? 'cancel' : 'verified_user', 'norm', {
                                        css: 'color: #ffcc00;'
                                    }),
                                    Label({
                                        label: device.trusted ? getString('Untrust device') : getString('Trust device'),
                                        xalign: 0,
                                        hexpand: true,
                                    }),
                                ],
                            }),
                            setup: setupCursorHover,
                            onClicked: async () => {
                                if (device.trusted) {
                                    await untrustDevice(device.address);
                                } else {
                                    await trustDevice(device.address);
                                }
                            },
                        }),

                        // Block/Unblock device button
                        Button({
                            className: 'sidebar-bluetooth-action-button material-button',
                            child: Box({
                                className: 'spacing-h-5',
                                children: [
                                    MaterialIcon(device.blocked ? 'check_circle' : 'block', 'norm', {
                                        css: 'color: #ffcc00;'
                                    }),
                                    Label({
                                        label: device.blocked ? getString('Unblock device') : getString('Block device'),
                                        xalign: 0,
                                        hexpand: true,
                                    }),
                                ],
                            }),
                            setup: setupCursorHover,
                            onClicked: async () => {
                                if (device.blocked) {
                                    await unblockDevice(device.address);
                                } else {
                                    await blockDevice(device.address);
                                }
                            },
                        }),

                        // Pair device button (only show if not paired)
                        !device.paired ? Button({
                            className: 'sidebar-bluetooth-action-button material-button',
                            child: Box({
                                className: 'spacing-h-5',
                                children: [
                                    MaterialIcon('link', 'norm', {
                                        css: 'color: #ffcc00;'
                                    }),
                                    Label({
                                        label: getString('Pair device'),
                                        xalign: 0,
                                        hexpand: true,
                                    }),
                                ],
                            }),
                            setup: setupCursorHover,
                            onClicked: async () => {
                                await pairDevice(device.address);
                            },
                        }) : null,
                    ].filter(Boolean),
                }),
            });

            // Show the menu as a popup
            const popup = new Gtk.Popover({
                child: actionsRevealer,
                position: Gtk.PositionType.BOTTOM,
            });
            popup.set_parent(actionsButton);
            popup.popup();
        },
    });

    // Remove device button
    const deviceRemoveButton = Button({
        vpack: 'center',
        className: 'sidebar-bluetooth-device-remove material-icon-button',
        child: Box({
            hpack: 'center',
            vpack: 'center',
            children: [
                MaterialIcon('delete', 'tiny', {
                    className: 'icon-material',
                    css: 'font-size: 12px;'
                })
            ]
        }),
        tooltipText: getString('Remove device'),
        setup: setupCursorHover,
        onClicked: () => execAsync(['bluetoothctl', 'remove', device.address]).catch(print),
    });

    return Box({
        vertical: true,
        className: `sidebar-bluetooth-device material-card ${device.connected ? 'connected' : ''}`,
        css: 'padding: 6px 10px; margin-bottom: 4px;',
        children: [
            // Main device row - similar to the toggle rows
            Box({
                className: 'spacing-h-5 bluetooth-device-row',
                vpack: 'center',
                children: [
                    // Icon on the left
                    deviceIcon,
                    // Device name in the center
                    deviceNameLabel,
                    // Controls on the right
                    Box({
                        className: 'spacing-h-3 bluetooth-device-controls',
                        vpack: 'center',
                        halign: 'end',
                        children: [
                            deviceConnectButton,
                            trustBlockButton,
                            actionsButton,
                            deviceRemoveButton,
                        ]
                    })
                ]
            }),
        ]
    })
};

// Helper function to get the appropriate icon for a device
const getDeviceIcon = (device) => {
    // If the device has a specific icon, use it
    if (device.icon) {
        return device.icon;
    }

    // If device is null or undefined, return a default icon
    if (!device) return 'bluetooth';

    // Check if device name exists
    if (!device.name) {
        // Return default icon if name is missing
        return device.connected ? 'bluetooth_connected' : 'bluetooth';
    }

    // Determine icon based on device name or address
    const name = device.name.toLowerCase();

    // Use the most reliable Material Icons that are available in all versions
    if (name.includes('phone') || name.includes('pixel') || name.includes('galaxy') || name.includes('iphone')) {
        // 'smartphone' might not be available in all Material Icon fonts, use 'phone_android' as it's more common
        return device.connected ? 'phone_android' : 'phone_android_disabled';
    } else if (name.includes('headphone') || name.includes('earphone') || name.includes('airpod') || name.includes('buds')) {
        // 'headphones' might not be available, use 'headset' which is more common
        return device.connected ? 'headset' : 'headset_off';
    } else if (name.includes('speaker') || name.includes('sound') || name.includes('audio')) {
        return device.connected ? 'speaker' : 'speaker_off';
    } else if (name.includes('keyboard')) {
        return device.connected ? 'keyboard' : 'keyboard_off';
    } else if (name.includes('mouse')) {
        return device.connected ? 'mouse' : 'mouse_off';
    } else if (name.includes('watch') || name.includes('band')) {
        return device.connected ? 'watch' : 'watch_off';
    } else if (name.includes('tv') || name.includes('television')) {
        return device.connected ? 'tv' : 'tv_off';
    } else if (name.includes('car') || name.includes('auto')) {
        return device.connected ? 'directions_car' : 'directions_car_off';
    }

    // Default icon - use standard icon names instead of Unicode
    return device.connected ? 'bluetooth_connected' : 'bluetooth';
};

// Removed unused function getDeviceBattery

// Create a reference to the scan button label that will be defined later
let scanButtonLabel;

// Global variables for Bluetooth state
let isScanning = false;
let lastScanTime = 0;

// Store discovered devices from bluetoothctl
let customDevices = [];

// Store Bluetooth controller information
let controllerInfo = {
    address: '',
    name: '',
    powered: false,
    discoverable: false,
    pairable: false,
    discovering: false
};

// Function to get controller information
const getControllerInfo = async () => {
    try {
        // Get controller list
        const listOutput = await Utils.execAsync(['bash', '-c', 'bluetoothctl list 2>/dev/null || echo ""']);
        const controllerMatch = listOutput.match(/Controller\s+([0-9A-F:]+)\s+(.+)/);

        if (controllerMatch) {
            controllerInfo.address = controllerMatch[1];
            controllerInfo.name = controllerMatch[2].replace('[default]', '').trim();

            // Get controller status
            const showOutput = await Utils.execAsync(['bash', '-c', 'bluetoothctl show 2>/dev/null || echo ""']);
            controllerInfo.powered = showOutput.includes('Powered: yes');
            controllerInfo.discoverable = showOutput.includes('Discoverable: yes');
            controllerInfo.pairable = showOutput.includes('Pairable: yes');
            controllerInfo.discovering = showOutput.includes('Discovering: yes');

            // Only log controller info when debugging is enabled
            if (userOptions.bluetooth?.debug) {
                console.log(`Controller: ${controllerInfo.name} (${controllerInfo.address})`);
                console.log(`  Powered: ${controllerInfo.powered}, Discoverable: ${controllerInfo.discoverable}, Pairable: ${controllerInfo.pairable}`);
            }
        } else if (userOptions.bluetooth?.debug) {
            console.log('No Bluetooth controller found');
        }
    } catch (error) {
        if (userOptions.bluetooth?.debug) {
            console.log('Error getting controller info:', error);
        }
    }
};

// Function to get devices from bluetoothctl - simplified version
const getBluetoothctlDevices = async () => {
    try {
        // Update controller info first
        await getControllerInfo();

        // Get all devices (paired and scanned)
        const devices = [];

        // If controller is not powered, return empty list
        if (!controllerInfo.powered) {
            if (userOptions.bluetooth?.debug) {
            console.log('Bluetooth is powered off');
        }
            return [];
        }

        // Get all devices with a single command
        const output = await Utils.execAsync(['bash', '-c', 'bluetoothctl devices']);
        const lines = output.split('\n');

        for (const line of lines) {
            const match = line.match(/Device\s+([0-9A-F:]+)\s+(.+)/);
            if (match) {
                const address = match[1];
                const name = match[2];

                // Get device info
                let isConnected = false;
                let isPaired = false;

                try {
                    const infoOutput = await Utils.execAsync(['bash', '-c', `bluetoothctl info ${address}`]);
                    isConnected = infoOutput.includes('Connected: yes');
                    isPaired = infoOutput.includes('Paired: yes');
                } catch (e) {}

                devices.push({
                    address: address,
                    name: name,
                    paired: isPaired,
                    trusted: false,
                    connected: isConnected,
                    icon: isConnected ? 'bluetooth_connected' : (isPaired ? 'bluetooth' : 'bluetooth'),
                    fromBluetooth: true
                });
            }
        }


        if (userOptions.bluetooth?.debug) {
            console.log(`Found ${devices.length} real devices`);
        }
        return devices;
    } catch (error) {
        if (userOptions.bluetooth?.debug) {
            console.log('Error getting devices from bluetoothctl:', error);
        }
        return [];
    }
};

// Function to discover devices - simplified version
const discoverDevices = async () => {
    if (isScanning) {
        return;
    }

    isScanning = true;
    if (userOptions.bluetooth?.debug) {
        console.log('Starting Bluetooth discovery...');
    }

    try {
        // Update button to show scanning state
        if (scanButtonLabel && !scanButtonLabel.is_destroyed) {
            scanButtonLabel.label = getString('Scanning...');
        }

        // Try to power on Bluetooth if it's not already on
        await Utils.execAsync(['rfkill', 'unblock', 'bluetooth']).catch(() => {});
        await Utils.execAsync(['bluetoothctl', 'power', 'on']).catch(() => {});

        // Run the scan and device collection in a single script to reduce UI updates
        const scriptContent = `
            # Start scanning
            bluetoothctl --timeout 3 scan on > /dev/null 2>&1

            # Get all devices
            echo "DEVICES_START"
            bluetoothctl devices
            echo "DEVICES_END"

            # Get paired devices
            echo "PAIRED_START"
            bluetoothctl paired-devices
            echo "PAIRED_END"

            # Get connected devices
            echo "CONNECTED_START"
            bluetoothctl devices Connected
            echo "CONNECTED_END"
        `;

        // Execute the script
        const output = await Utils.execAsync(['bash', '-c', scriptContent]);

        // Parse the output
        const devicesMatch = output.match(/DEVICES_START\n([\s\S]*?)\nDEVICES_END/);
        const pairedMatch = output.match(/PAIRED_START\n([\s\S]*?)\nPAIRED_END/);
        const connectedMatch = output.match(/CONNECTED_START\n([\s\S]*?)\nCONNECTED_END/);

        // Get device lists
        const devicesOutput = devicesMatch ? devicesMatch[1] : '';
        const pairedOutput = pairedMatch ? pairedMatch[1] : '';
        const connectedOutput = connectedMatch ? connectedMatch[1] : '';

        if (userOptions.bluetooth?.debug) {
            console.log('Raw device output:', devicesOutput);
        }

        // Process devices
        const devices = [];
        const deviceMap = new Map();

        // Helper function to process device lines
        const processDeviceLines = (text, isPaired = false, isConnected = false) => {
            const lines = text.split('\n');
            for (const line of lines) {
                const match = line.match(/Device\s+([0-9A-F:]+)\s+(.+)/);
                if (match) {
                    const address = match[1];
                    const name = match[2];

                    // Check if we already have this device
                    if (!deviceMap.has(address)) {
                        const device = {
                            address: address,
                            name: name,
                            paired: isPaired,
                            connected: isConnected,
                            icon: isConnected ? 'bluetooth_connected' : (isPaired ? 'bluetooth' : 'bluetooth'),
                            fromBluetooth: true
                        };
                        devices.push(device);
                        deviceMap.set(address, device);
                    } else {
                        // Update existing device
                        const device = deviceMap.get(address);
                        if (isPaired) device.paired = true;
                        if (isConnected) device.connected = true;
                        if (isConnected) device.icon = 'bluetooth_connected';
                        else if (isPaired && !device.connected) device.icon = 'bluetooth';
                    }
                }
            }
        };

        // Process paired devices first
        processDeviceLines(pairedOutput, true, false);

        // Then update connected devices
        processDeviceLines(connectedOutput, true, true);

        // Process all discovered devices
        // This will show nearby devices that are discovered during scanning
        processDeviceLines(devicesOutput);

        if (userOptions.bluetooth?.debug) {
            console.log(`Found ${devices.length} devices`);
        }

        // Update our custom devices list
        if (devices.length > 0) {
            customDevices = devices;
        }

        // Reset scanning state
        isScanning = false;
        if (scanButtonLabel && !scanButtonLabel.is_destroyed) {
            scanButtonLabel.label = getString('Scan for devices');
        }
    } catch (error) {
        if (userOptions.bluetooth?.debug) {
            console.log('Error in discovery process:', error);
        }
        isScanning = false;
        if (scanButtonLabel && !scanButtonLabel.is_destroyed) {
            scanButtonLabel.label = getString('Scan for devices');
        }
    }
};

// Function to scan for devices (called when scan button is clicked)
const scanForDevices = (scanButton) => {
    // Update button to show scanning state
    if (scanButtonLabel && !scanButtonLabel.is_destroyed) {
        scanButtonLabel.label = getString('Scanning...');
    }

    if (scanButton && !scanButton.is_destroyed) {
        scanButton.sensitive = false;
        scanButton.className = 'sidebar-bluetooth-scan-button material-button scanning';
    }

    // Start discovery directly
    discoverDevices();

    // Reset button state after 5 seconds
    timeout(5000, () => {
        if (scanButton && !scanButton.is_destroyed) {
            scanButton.sensitive = true;
            scanButton.className = 'sidebar-bluetooth-scan-button material-button';
        }
    });
};

// Function to perform an initial scan for devices
const performInitialScan = async () => {
    // Only perform initial scan if Bluetooth is enabled
    if (Bluetooth.enabled) {
        // Try to power on Bluetooth if it's not already on
        await Utils.execAsync(['rfkill', 'unblock', 'bluetooth']).catch(() => {});
        await Utils.execAsync(['bluetoothctl', 'power', 'on']).catch(() => {});

        // Get devices without scanning first to reduce warnings
        customDevices = await getBluetoothctlDevices();

        if (userOptions.bluetooth?.debug) {
            console.log(`Initial scan found ${customDevices.length} devices`);
        }

        // Only start a scan if we're actually showing the Bluetooth panel
        // and if we didn't find any devices initially
        if (customDevices.length === 0 && App.windows.some(w => w.name.includes('sideright') && w.visible)) {
            lastScanTime = Date.now();
            // Use a slight delay to reduce warnings during startup
            Utils.timeout(2000, () => {
                discoverDevices();
            });
        }
    }
};

export default (props) => {
    // Declare mainContent variable to be defined later
    let mainContent;

    // We'll use the direct approach from the old script instead of updateDeviceSections

    // No need for initial scan, the device list will update automatically
    // Scanning button with Material You 3 design
    scanButtonLabel = Label({
        label: getString('Scan for devices'),
        className: 'txt-medium',
    });

    const scanButton = Button({
        className: 'sidebar-bluetooth-scan-button',
        child: Box({
            className: 'spacing-h-5',
            children: [
                MaterialIcon('search', 'norm'),
                scanButtonLabel,
            ],
        }),
        setup: setupCursorHover,
        onClicked: (button) => scanForDevices(button),
    });



    // Receive files toggle with timeout options
    const receiveFilesToggle = Box({
        vpack: 'center',
        className: 'bluetooth-toggle-with-label',
        children: [
            ConfigToggle({
                vpack: 'center',
                expandWidget: false,
                desc: getString('Receive files'),
                initValue: false,
                onChange: async (self, newValue) => {
                    try {
                        if (newValue) {
                            // Make discoverable with 5-minute timeout
                            await execAsync('bluetoothctl discoverable on');
                            await execAsync('bluetoothctl discoverable-timeout 300');
                            timeout(500, () => self.enabled.value = true);
                        } else {
                            // Turn off discoverability
                            await execAsync('bluetoothctl discoverable off');
                            timeout(500, () => self.enabled.value = false);
                        }
                    } catch (error) {
                        console.error('Error toggling discoverability:', error);
                        timeout(500, () => self.enabled.value = false);
                    }
                },
            }),
            Label({
                label: getString('Receive files'),
                className: 'txt-small txt-subtext',
                tooltipText: getString('Make your device visible to receive files from other devices'),
                marginStart: 8,
            }),
        ],
    });

    // Auto-accept files toggle
    const autoAcceptToggle = Box({
        vpack: 'center',
        className: 'bluetooth-toggle-with-label',
        children: [
            ConfigToggle({
                vpack: 'center',
                expandWidget: false,
                desc: getString('Auto-accept files'),
                initValue: false,
                onChange: async (self, newValue) => {
                    // This would need to be implemented with obexd configuration
                    // For now, just show the toggle UI
                    self.enabled.value = newValue;
                },
            }),
            Label({
                label: getString('Auto-accept'),
                className: 'txt-small txt-subtext',
                tooltipText: getString('Automatically accept incoming file transfers without confirmation'),
                marginStart: 8,
            }),
        ],
    });

    // Removed settings button as it's redundant with the one in the bottom bar

    // Controls box with Material You 3 design
    const controlsBox = Box({
        vertical: true,
        className: 'sidebar-bluetooth-controls material-card',
        children: [
            // Top row with scan button and power toggle
            Box({
                className: 'spacing-h-10 bluetooth-controls-row',
                vpack: 'center',
                children: [
                    Box({
                        hexpand: true,
                        children: [scanButton],
                    }),
                    // No need for power toggle or settings button here
                ],
            }),
            // Second row with file options
            Box({
                className: 'spacing-h-10 bluetooth-controls-row',
                vpack: 'center',
                children: [
                    receiveFilesToggle,
                    Box({ hexpand: true }),
                    autoAcceptToggle,
                ],
            }),
        ],
    });

    // Empty content when no devices are available
    const emptyContent = Box({
        homogeneous: true,
        children: [Box({
            vertical: true,
            vpack: 'center',
            className: 'txt spacing-v-10 bluetooth-empty-state',
            children: [
                Box({
                    vertical: true,
                    className: 'spacing-v-5 txt-subtext',
                    children: [
                        MaterialIcon(controllerInfo.powered ? 'bluetooth_searching' : 'bluetooth_disabled', 'gigantic'),
                        Label({
                            label: getString('No Bluetooth devices'),
                            className: 'txt-small bluetooth-empty-title',
                            hpack: 'center',
                        }),
                        Label({
                            label: controllerInfo.powered ?
                                   getString('Click scan to find nearby devices') :
                                   getString('Bluetooth is turned off'),
                            className: 'txt-tiny bluetooth-empty-subtitle',
                            hpack: 'center'
                        }),

                        // Show controller info if available
                        controllerInfo.address ? Box({
                            vertical: true,
                            className: 'bluetooth-controller-info margin-top-10',
                            children: [
                                Label({
                                    label: `Controller: ${controllerInfo.name}`,
                                    className: 'txt-small',
                                    hpack: 'center',
                                }),
                                Label({
                                    label: controllerInfo.address,
                                    className: 'txt-tiny txt-subtext',
                                    hpack: 'center',
                                }),
                                Box({
                                    className: 'bluetooth-controller-status margin-top-5',
                                    hpack: 'center',
                                    spacing: 10,
                                    children: [
                                        Box({
                                            className: `bluetooth-status-indicator ${controllerInfo.powered ? 'active' : 'inactive'}`,
                                            tooltip: `Power: ${controllerInfo.powered ? 'On' : 'Off'}`,
                                            child: MaterialIcon('power_settings_new', 'small'),
                                        }),
                                        Box({
                                            className: `bluetooth-status-indicator ${controllerInfo.discoverable ? 'active' : 'inactive'}`,
                                            tooltip: `Discoverable: ${controllerInfo.discoverable ? 'On' : 'Off'}`,
                                            child: MaterialIcon('visibility', 'small'),
                                        }),
                                        Box({
                                            className: `bluetooth-status-indicator ${controllerInfo.pairable ? 'active' : 'inactive'}`,
                                            tooltip: `Pairable: ${controllerInfo.pairable ? 'On' : 'Off'}`,
                                            child: MaterialIcon('link', 'small'),
                                        }),
                                    ],
                                }),
                            ],
                        }) : null,

                        // Add a direct scan button in the empty state (only if Bluetooth is powered on)
                        controllerInfo.powered ? Button({
                            className: 'bluetooth-empty-scan-button',
                            label: getString('Scan for devices'),
                            onClicked: () => scanForDevices(scanButton),
                            setup: setupCursorHover,
                            hpack: 'center',
                            marginTop: 10,
                        }) : Button({
                            className: 'bluetooth-empty-scan-button',
                            label: getString('Turn on Bluetooth'),
                            onClicked: async () => {
                                await Utils.execAsync(['bluetoothctl', 'power', 'on']).catch(() => {});
                                await Utils.execAsync(['rfkill', 'unblock', 'bluetooth']).catch(() => {});
                                // Update controller info
                                await getControllerInfo();
                                // Refresh the UI
                                mainContent.shown = 'empty';
                            },
                            setup: setupCursorHover,
                            hpack: 'center',
                            marginTop: 10,
                        }),

                        // Add a button to open Bluetooth manager
                        Button({
                            className: 'bluetooth-empty-manager-button',
                            label: getString('Open Bluetooth Manager'),
                            onClicked: () => {
                                // Use the app specified in user options or fall back to system defaults
                                const bluetoothApp = userOptions.apps?.bluetooth || 'blueman-manager';
                                Utils.execAsync(['bash', '-c', bluetoothApp])
                                    .catch(() => {
                                        // If the preferred app fails, try GNOME Settings
                                        Utils.execAsync(['gnome-control-center', 'bluetooth'])
                                            .catch(() => {
                                                // Fall back to blueman-manager if GNOME Settings fails
                                                Utils.execAsync(['blueman-manager'])
                                                    .catch(() => {
                                                        // If all else fails, try to use the system's default Bluetooth settings
                                                        Utils.execAsync(['xdg-open', 'settings://bluetooth'])
                                                            .catch(print);
                                                    });
                                            });
                                    });
                            },
                            setup: setupCursorHover,
                            hpack: 'center',
                            marginTop: 10,
                        }),
                    ].filter(Boolean)
                }),
            ]
        })]
    });
    // We'll use the direct approach from the old script instead of sections

    // We'll use the existing BluetoothDevice function defined at the top of the file

    // mainContent will be defined later

    // Main device list with automatic updates
    const deviceList = Overlay({
        passThrough: true,
        child: Scrollable({
            vexpand: true,
            child: Box({
                vertical: true,
                className: 'spacing-v-5 margin-bottom-15',
                setup: (self) => {
                    // Function to update the device list
                    const updateDevices = () => {
                        // Combine devices from AGS and our custom list
                        const agsDevices = Bluetooth.devices || [];
                        const allDevices = [...agsDevices];

                        // Add custom devices that aren't already in the AGS list
                        customDevices.forEach(customDevice => {
                            if (!allDevices.some(d => d.address === customDevice.address)) {
                                allDevices.push(customDevice);
                            }
                        });

                        // Log devices for debugging
                        if (userOptions.bluetooth?.debug) {
                            console.log(`Updating device list with ${allDevices.length} devices (${agsDevices.length} from AGS, ${customDevices.length} custom)`);
                        }

                        // Separate paired/connected devices from other discovered devices
                        const pairedDevices = allDevices.filter(d => d.paired || d.connected);
                        const otherDevices = allDevices.filter(d => !d.paired && !d.connected);

                        // Sort paired devices so connected ones appear first
                        pairedDevices.sort((a, b) => {
                            if (a.connected && !b.connected) return -1;
                            if (!a.connected && b.connected) return 1;
                            return 0;
                        });

                        // Create sections for each type of device
                        const sections = [];

                        // Add paired devices section if there are any
                        if (pairedDevices.length > 0) {
                            sections.push(
                                Box({
                                    vertical: true,
                                    className: 'bluetooth-device-section',
                                    children: [
                                        // Paired devices separator with title
                                        Box({
                                            vertical: true,
                                            children: [
                                                Box({
                                                    className: 'bluetooth-section-separator',
                                                }),
                                                Label({
                                                    label: getString('Paired Devices'),
                                                    className: 'txt-small bluetooth-section-title',
                                                    xalign: 0,
                                                    css: 'margin: 5px 0; font-weight: 500; opacity: 0.8;'
                                                }),
                                            ]
                                        }),
                                        // Paired devices list
                                        ...pairedDevices.map(d => BluetoothDevice(d))
                                    ]
                                })
                            );
                        }

                        // Add other devices section if there are any
                        if (otherDevices.length > 0) {
                            sections.push(
                                Box({
                                    vertical: true,
                                    className: 'bluetooth-device-section',
                                    children: [
                                        // Available devices separator with title
                                        Box({
                                            vertical: true,
                                            children: [
                                                Box({
                                                    className: 'bluetooth-section-separator',
                                                }),
                                                Label({
                                                    label: getString('Available Devices'),
                                                    className: 'txt-small bluetooth-section-title',
                                                    xalign: 0,
                                                    css: 'margin: 5px 0; font-weight: 500; opacity: 0.8;'
                                                }),
                                            ]
                                        }),
                                        // Other devices list
                                        ...otherDevices.map(d => BluetoothDevice(d))
                                    ]
                                })
                            );
                        }

                        // Update the UI with all sections
                        self.children = sections;

                        // If we have devices but the UI isn't showing them, try to force a refresh
                        if (allDevices.length > 0 && mainContent.shown === 'empty') {
                            if (userOptions.bluetooth?.debug) {
                                console.log('Forcing stack to show device list');
                            }
                            mainContent.shown = 'list';
                        }
                    };

                    // Connect to all relevant signals
                    self.hook(Bluetooth, updateDevices);
                    self.hook(Bluetooth, updateDevices, 'device-added');
                    self.hook(Bluetooth, updateDevices, 'device-removed');
                    self.hook(Bluetooth, updateDevices, 'notify::devices');

                    // Initial update
                    updateDevices();

                    // Periodic updates to ensure UI is in sync - use a much longer interval to reduce DBUSMENU warnings
                    const interval = Utils.interval(30000, async () => {
                        if (Bluetooth.enabled) {
                            // Get devices from bluetoothctl
                            try {
                                // Only update if the sidebar is visible to reduce unnecessary updates
                                if (App.windows.some(w => w.name.includes('sideright') && w.visible)) {
                                    const newDevices = await getBluetoothctlDevices();
                                    if (newDevices.length > 0) {
                                        customDevices = newDevices;
                                        if (userOptions.bluetooth?.debug) {
                                            console.log(`Found ${customDevices.length} devices from bluetoothctl`);
                                        }
                                    }

                                    // If we found devices in bluetoothctl but not in AGS
                                    if (customDevices.length > 0 && Bluetooth.devices.length === 0) {
                                        if (userOptions.bluetooth?.debug) {
                                            console.log(`Found ${customDevices.length} devices in bluetoothctl but none in AGS`);
                                        }
                                    }

                                    // Update the UI
                                    updateDevices();

                                    // If we have no devices and we're not scanning, start a scan
                                    if (customDevices.length === 0 && !isScanning && !lastScanTime || (Date.now() - lastScanTime > 120000)) {
                                        lastScanTime = Date.now();
                                        discoverDevices();
                                    }
                                }
                            } catch (error) {
                                if (userOptions.bluetooth?.debug) {
                                    console.log('Error updating devices:', error);
                                }
                            }
                        }
                    });

                    // Clean up interval when widget is destroyed
                    self.connect('destroy', () => Utils.timeout.clearInterval(interval));
                },
            })
        }),
        overlays: [Box({
            className: 'sidebar-centermodules-scrollgradient-bottom'
        })]
    });
    // Create a stack to show either the empty state or device list
    mainContent = Stack({
        children: {
            'empty': emptyContent,
            'list': deviceList,
        },
        setup: (self) => {
            // Update the shown state when devices change
            const updateShown = () => {
                // Check both AGS devices and our custom devices
                const hasDevices = (Bluetooth.devices.length > 0 || customDevices.length > 0);
                self.shown = (hasDevices ? 'list' : 'empty');
                if (userOptions.bluetooth?.debug) {
                    console.log(`Stack shown: ${self.shown}, device count: AGS=${Bluetooth.devices.length}, custom=${customDevices.length}`);
                }
            };

            // Connect to all relevant signals
            self.hook(Bluetooth, updateShown);
            self.hook(Bluetooth, updateShown, 'device-added');
            self.hook(Bluetooth, updateShown, 'device-removed');
            self.hook(Bluetooth, updateShown, 'notify::devices');

            // Initial update
            updateShown();

            // Periodic updates to ensure UI is in sync - use a longer interval to reduce warnings
            const interval = Utils.interval(60000, () => {
                if (Bluetooth.enabled && App.windows.some(w => w.name.includes('sideright') && w.visible)) {
                    updateShown();
                }
            });

            // Clean up interval when widget is destroyed
            self.connect('destroy', () => Utils.timeout.clearInterval(interval));
        },
    })
    // Function to check if there are suitable devices for file transfer
    const hasSuitableDevices = () => {
        // Check both AGS devices and our custom devices
        const allDevices = [...(Bluetooth.devices || []), ...customDevices];

        // If there are no devices at all, return false
        if (allDevices.length === 0) {
            return false;
        }

        // Check if there are any connected devices suitable for file transfer
        return allDevices.some(device => {
            // Check if device is connected (not just paired) and not an input device
            return device.connected &&
                   !device.name.toLowerCase().includes('keyboard') &&
                   !device.name.toLowerCase().includes('mouse') &&
                   !device.name.toLowerCase().includes('input') &&
                   !device.name.toLowerCase().includes('audio') &&
                   !device.name.toLowerCase().includes('headset') &&
                   !device.name.toLowerCase().includes('headphone') &&
                   !device.name.toLowerCase().includes('speaker');
        });
    };

    // Send files button that only appears when suitable devices are connected - Material You 3 design
    const sendFilesButton = Button({
        hpack: 'center',
        className: 'sidebar-bluetooth-bottombar-button',
        visible: hasSuitableDevices(),
        child: Box({
            className: 'spacing-h-5',
            children: [
                MaterialIcon('send_to_mobile', 'small', { className: 'icon-material' }),
                Label({
                    label: getString('Send Files'),
                    className: 'txt-medium'
                }),
            ],
        }),
        tooltipText: getString('Send files to a connected device'),
        onClicked: () => {
            execAsync(['blueman-sendto']).catch(print);
        },
        setup: setupCursorHover,
    });

    // Track last update time to limit update frequency
    let lastBottomBarUpdate = 0;
    let bottomBarUpdateScheduled = false;

    // Function to update the bottom bar based on device availability
    const updateBottomBar = () => {
        const now = Date.now();
        const hasDevices = hasSuitableDevices();

        // Update the bottom bar with appropriate buttons
        const updateBar = () => {
            bottomBar.children = hasDevices
                ? [settingsButton, sendFilesButton, receivedFilesButton]
                : [settingsButton, receivedFilesButton];
            lastBottomBarUpdate = Date.now();
        };

        // Rate limit updates to prevent UI flickering
        if (now - lastBottomBarUpdate < 1000) {
            if (!bottomBarUpdateScheduled) {
                bottomBarUpdateScheduled = true;
                Utils.timeout(1000 - (now - lastBottomBarUpdate), () => {
                    updateBar();
                    bottomBarUpdateScheduled = false;
                });
            }
        } else {
            // Update immediately if enough time has passed
            updateBar();
        }
    };

    // Update when Bluetooth devices change
    Bluetooth.connect('device-added', updateBottomBar);
    Bluetooth.connect('device-removed', updateBottomBar);
    Bluetooth.connect('notify::devices', updateBottomBar);

    // Start scanning when Bluetooth is enabled
    Bluetooth.connect('notify::enabled', () => {
        if (Bluetooth.enabled) {
            // Wait a moment for Bluetooth to initialize
            timeout(1000, () => {
                performInitialScan();
            });
        }
    });

    // Initial scan if Bluetooth is already enabled
    if (Bluetooth.enabled) {
        timeout(1000, performInitialScan);
    }

    // Create buttons for the bottom bar
    const settingsButton = Button({
        hpack: 'center',
        className: 'sidebar-bluetooth-bottombar-button',
        child: Box({
            className: 'spacing-h-5',
            children: [
                MaterialIcon('settings', 'small', { className: 'icon-material' }),
                Label({
                    label: getString('Settings'),
                    className: 'txt-medium'
                }),
            ],
        }),
        tooltipText: getString('Open Bluetooth settings manager'),
        onClicked: () => {
            // Use the app specified in user options or blueman-manager as fallback
            const bluetoothApp = userOptions.apps?.bluetooth || 'blueman-manager';
            execAsync(['bash', '-c', bluetoothApp]).catch(print);
            closeEverything();
        },
        setup: setupCursorHover,
    });

    const receivedFilesButton = Button({
        hpack: 'center',
        className: 'sidebar-bluetooth-bottombar-button',
        child: Box({
            className: 'spacing-h-5',
            children: [
                MaterialIcon('folder', 'small', { className: 'icon-material' }),
                Label({
                    label: getString('Received Files'),
                    className: 'txt-medium'
                }),
            ],
        }),
        tooltipText: getString('Open folder with received Bluetooth files'),
        onClicked: () => {
            // Open the default Bluetooth received files directory
            execAsync(['xdg-open', `${GLib.get_home_dir()}/Downloads`]).catch(print);
        },
        setup: setupCursorHover,
    });

    // Bottom bar with additional actions - Material You 3 design
    const bottomBar = Box({
        className: 'sidebar-bluetooth-bottombar',
        homogeneous: true,
        spacing: 15,
        children: hasSuitableDevices()
            ? [settingsButton, sendFilesButton, receivedFilesButton] // Include Send Files button only when there are suitable devices
            : [settingsButton, receivedFilesButton] // Otherwise only show Settings and Received Files
    })
    return Box({
        ...props,
        className: 'spacing-v-5',
        vertical: true,
        children: [
            // Controls at the top
            controlsBox,
            // Main content (device list or empty state)
            mainContent,
            // Bottom bar with more options
            bottomBar
        ]
    });
}