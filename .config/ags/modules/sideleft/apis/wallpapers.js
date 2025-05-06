const { Gtk, GLib } = imports.gi;
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';
import { setupCursorHover } from '../../.widgetutils/cursorhover.js';
import WallpaperService from '../../../services/wallpaper.js';
import { chatEntry } from '../apiwidgets.js';

const { Box, Button, Label, Scrollable, Revealer } = Widget;

// Read custom prompts from config
const getCustomPrompts = () => {
    try {
        // Check for both .json and .jsonc files
        const configBasePath = `${Utils.HOME}/.ags/config`;
        const configPath = (() => {
            const jsonFile = configBasePath + '.json';
            const jsoncFile = configBasePath + '.jsonc';

            // Use GLib.file_test to check if files exist
            const jsonExists = GLib.file_test(jsonFile, GLib.FileTest.EXISTS);
            const jsoncExists = GLib.file_test(jsoncFile, GLib.FileTest.EXISTS);

            return jsonExists ? jsonFile :
                   jsoncExists ? jsoncFile :
                   configBasePath + '.json';
        })();
        const config = JSON.parse(Utils.readFile(configPath));
        return config.wallpapers?.customPrompts || [
            { icon: 'landscape', style: 'realistic landscape photography', tooltip: 'Realistic' },
            { icon: 'brush', style: 'oil painting', tooltip: 'Oil Painting' },
            { icon: 'architecture', style: 'architectural concept art', tooltip: 'Architecture' },
            { icon: 'palette', style: 'digital art', tooltip: 'Digital Art' },
            { icon: 'animation', style: 'anime style', tooltip: 'Anime' },
        ];
    } catch (error) {
        console.error('Error reading custom prompts:', error);
        return [
            { icon: 'landscape', style: 'realistic landscape photography', tooltip: 'Realistic' },
            { icon: 'brush', style: 'oil painting', tooltip: 'Oil Painting' },
            { icon: 'architecture', style: 'architectural concept art', tooltip: 'Architecture' },
            { icon: 'palette', style: 'digital art', tooltip: 'Digital Art' },
            { icon: 'animation', style: 'anime style', tooltip: 'Anime' },
        ];
    }
};

export const wallpaperTabIcon = MaterialIcon('wallpaper', 'norm');

const StyleButton = ({ icon, onClick, tooltip }) => Button({
    className: 'sidebar-chat-chip txt-norm sec-txt',
    tooltipText: tooltip,
    css: `
        padding: 2px 6px;
        min-height: 24px;
        margin: 0 2px;
    `,
    child: MaterialIcon(icon, 'norm', {
        css: 'font-size: 14px;'
    }),
    onClicked: onClick,
    setup: setupCursorHover,
});

const WallpaperInfo = () => {
    const wallpaperLogo = MaterialIcon('wallpaper', 'norm', {
        className: 'sidebar-chat-welcome-logo',
        css: `
            font-size: 42px;
            margin: 8px 0;
            color: #7289da;
        `,
    });

    return Box({
        vertical: true,
        className: 'wallpaper-welcome-container spacing-v-10',
        css: `
            padding: 16px;
            border-radius: 16px;
            background-color: rgba(30, 30, 30, 0.4);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
            margin: 10px 0;
        `,
        children: [
            wallpaperLogo,
            Label({
                className: 'txt txt-title-small sidebar-chat-welcome-txt',
                wrap: true,
                justify: Gtk.Justification.CENTER,
                label: 'AI Wallpaper Generator',
                css: 'font-weight: bold; margin-bottom: 4px; color: #ffffff;',
            }),
            Label({
                className: 'txt-smallie txt-subtext',
                wrap: true,
                justify: Gtk.Justification.CENTER,
                label: 'Enter a prompt to create beautiful wallpapers\nUse style buttons below for inspiration',
                css: 'color: #cccccc;',
            }),
            Box({
                className: 'spacing-h-5',
                hpack: 'center',
                css: 'margin-top: 5px;',
                children: [
                    Label({
                        className: 'txt-smallie txt-subtext',
                        label: 'No API key required',
                        css: 'font-size: 11px; color: #aaaaaa;',
                    }),
                    MaterialIcon('check_circle', 'norm', {
                        css: 'font-size: 14px; color: #7289da;'
                    }),
                ],
            }),
        ],
    });
}

const wallpaperWelcome = Box({
    vertical: true,
    vpack: 'center',
    className: 'spacing-v-15',
    children: [
        WallpaperInfo(),
    ],
});

const LoadingIndicator = () => Box({
    className: 'wallpaper-loading spacing-v-15',
    vertical: true,
    vpack: 'center',
    hpack: 'center',
    css: `
        min-height: 80px;
        padding: 15px;
        margin: 10px 0;
        border-radius: 16px;
        background-color: rgba(30, 30, 30, 0.3);
    `,
    children: [
        // Animated loading spinner
        Box({
            className: 'wallpaper-loading-spinner',
            hpack: 'center',
            css: `
                min-height: 36px;
                min-width: 36px;
                border-radius: 50%;
                border: 3px solid rgba(114, 137, 218, 0.3);
                border-top-color: #7289da;
                animation: spin 1s linear infinite;
            `,
        }),
        // Loading text
        Label({
            className: 'txt-norm',
            label: 'Generating your wallpaper...',
            css: 'margin-top: 12px; color: #cccccc;',
        }),
    ],
});

const PreviewBox = (tempFile) => {
    const preview = Box({
        vertical: true,
        className: 'wallpaper-preview-container spacing-v-10',
        css: 'margin: 5px 0;',
        children: [
            // Image container with enhanced styling
            Box({
                className: 'wallpaper-preview-image',
                css: `
                    background-image: url('${tempFile}');
                    background-size: cover;
                    background-position: center;
                    border-radius: 12px;
                    min-height: 220px;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
                    transition: all 0.2s ease;
                `,
            }),

            // Action buttons with improved styling
            Box({
                className: 'wallpaper-preview-actions spacing-h-10',
                hpack: 'center',
                css: 'margin-top: 5px;',
                children: [
                    Box({ hexpand: true }), // Spacer to push buttons to center
                    StyleButton({
                        icon: 'save',
                        tooltip: 'Save to ~/Pictures/Wallpapers',
                        onClick: (button) => {
                            button.toggleClassName('sidebar-chat-chip-active', true);
                            WallpaperService.saveWallpaper(tempFile)
                                .then(() => {
                                    button.setCss('transition: all 0.2s ease;');
                                    button.toggleClassName('success', true);
                                    Utils.timeout(1000, () => {
                                        button.toggleClassName('success', false);
                                        button.toggleClassName('sidebar-chat-chip-active', false);
                                    });
                                })
                                .catch(error => {
                                    button.toggleClassName('error', true);
                                    button.toggleClassName('sidebar-chat-chip-active', false);
                                    Utils.timeout(1000, () => {
                                        button.toggleClassName('error', false);
                                    });
                                    console.error('Error saving wallpaper:', error);
                                });
                        },
                    }),
                    StyleButton({
                        icon: 'wallpaper',
                        tooltip: 'Set as desktop wallpaper',
                        onClick: (button) => {
                            button.toggleClassName('sidebar-chat-chip-active', true);
                            WallpaperService.setWallpaper(tempFile)
                                .then(() => {
                                    button.setCss('transition: all 0.2s ease;');
                                    button.toggleClassName('success', true);
                                    Utils.timeout(1000, () => {
                                        button.toggleClassName('success', false);
                                        button.toggleClassName('sidebar-chat-chip-active', false);
                                    });
                                })
                                .catch(error => {
                                    button.toggleClassName('error', true);
                                    button.toggleClassName('sidebar-chat-chip-active', false);
                                    Utils.timeout(1000, () => {
                                        button.toggleClassName('error', false);
                                    });
                                    console.error('Error setting wallpaper:', error);
                                });
                        },
                    }),
                    StyleButton({
                        icon: 'account_circle',
                        tooltip: 'Set as profile photo',
                        onClick: (button) => {
                            button.toggleClassName('sidebar-chat-chip-active', true);
                            WallpaperService.setAsProfilePhoto(tempFile)
                                .then(() => {
                                    button.setCss('transition: all 0.2s ease;');
                                    button.toggleClassName('success', true);
                                    Utils.timeout(1000, () => {
                                        button.toggleClassName('success', false);
                                        button.toggleClassName('sidebar-chat-chip-active', false);
                                    });
                                })
                                .catch(error => {
                                    button.toggleClassName('error', true);
                                    button.toggleClassName('sidebar-chat-chip-active', false);
                                    Utils.timeout(1000, () => {
                                        button.toggleClassName('error', false);
                                    });
                                    console.error('Error setting profile photo:', error);
                                });
                        },
                    }),
                    // Add a download button to save the original image
                    StyleButton({
                        icon: 'file_download',
                        tooltip: 'Download original image',
                        onClick: (button) => {
                            button.toggleClassName('sidebar-chat-chip-active', true);
                            // Copy to Downloads folder
                            const downloadsPath = GLib.build_filenamev([GLib.get_home_dir(), 'Downloads', `wallpaper-${Date.now()}.png`]);
                            Utils.execAsync(['cp', tempFile, downloadsPath])
                                .then(() => {
                                    button.setCss('transition: all 0.2s ease;');
                                    button.toggleClassName('success', true);
                                    Utils.timeout(1000, () => {
                                        button.toggleClassName('success', false);
                                        button.toggleClassName('sidebar-chat-chip-active', false);
                                    });
                                    console.log(`Downloaded image to ${downloadsPath}`);
                                })
                                .catch(error => {
                                    button.toggleClassName('error', true);
                                    button.toggleClassName('sidebar-chat-chip-active', false);
                                    Utils.timeout(1000, () => {
                                        button.toggleClassName('error', false);
                                    });
                                    console.error('Error downloading image:', error);
                                });
                        },
                    }),
                    Box({ hexpand: true }), // Spacer to push buttons to center
                ],
            }),
        ],
    });

    return preview;
};

const MessageContent = (content, type) => Box({
    className: 'sidebar-chat-msg spacing-v-5',
    vertical: true,
    css: 'margin: 5px 0;',
    children: [
        Box({
            className: type === 'user' ? 'sidebar-chat-msg-bubble' : 'sidebar-chat-msg-bubble-error',
            css: `
                padding: 8px 12px;
                border-radius: 12px;
                background-color: ${type === 'user' ? 'rgba(114, 137, 218, 0.2)' : 'rgba(240, 71, 71, 0.2)'}
            `,
            child: Label({
                hpack: 'start',
                wrap: true,
                className: type === 'user' ? 'txt' : 'error-text',
                label: content,
            }),
        }),
    ],
});

const chatContent = Box({
    vertical: true,
    className: 'spacing-v-5',
});

export const wallpaperView = Box({
    vertical: true,
    className: 'spacing-v-15',
    attribute: {
        'pinnedDown': true
    },
    setup: self => {
        // Create a reference to the loading indicator
        const loadingIndicator = LoadingIndicator();
        let loadingAdded = false;

        // Hook into the WallpaperService loading signal
        self.hook(WallpaperService, () => {
            // Update visibility based on loading state
            if (WallpaperService.loading && !loadingAdded) {
                // Add loading indicator to chat content if not already there
                chatContent.add(loadingIndicator);
                loadingAdded = true;
            } else if (!WallpaperService.loading && loadingAdded) {
                // Remove loading indicator from chat content
                chatContent.remove(loadingIndicator);
                loadingAdded = false;
            }

            // Show welcome message if no content and not loading
            const contentChildren = chatContent.get_children();
            wallpaperWelcome.visible = !WallpaperService.loading &&
                (contentChildren.length === 0 || (contentChildren.length === 1 && contentChildren[0] === loadingIndicator));
        }, 'loading');
    },
    children: [
        Box({
            className: 'spacing-v-10',
            vertical: true,
            children: [
                Box({
                    className: 'sidebar-chat-viewport-container',
                    vexpand: true,
                    vertical: true,
                    setup: box => {
                        // Create a content box first
                        const contentBox = Box({
                            vertical: true,
                            className: 'spacing-h-10',
                        });

                        // Add welcome and chat content to the content box
                        contentBox.add(wallpaperWelcome);
                        contentBox.add(chatContent);

                        // Create scrolled window
                        const scrolledWindow = Scrollable({
                            className: 'sidebar-chat-viewport',
                            vexpand: true,
                        });

                        // Show scrollbar
                        scrolledWindow.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
                        const vScrollbar = scrolledWindow.get_vscrollbar();
                        vScrollbar.get_style_context().add_class('sidebar-scrollbar');

                        // Add the content box to the scrolled window
                        scrolledWindow.add(contentBox);

                        // Add the scrolled window to the container box
                        box.add(scrolledWindow);

                        // Set up scrolling behavior
                        Utils.timeout(1, () => {
                            // Avoid click-to-scroll-widget-to-view behavior
                            const viewport = scrolledWindow.get_child();
                            if (viewport) {
                                viewport.set_focus_vadjustment(new Gtk.Adjustment(undefined));
                            }

                            // Always scroll to bottom with new content when pinned down
                            const adjustment = scrolledWindow.get_vadjustment();

                            adjustment.connect("changed", () => {
                                if (!wallpaperView.attribute.pinnedDown) return;
                                Utils.timeout(1, () => {
                                    adjustment.set_value(adjustment.get_upper() - adjustment.get_page_size());
                                });
                            });

                            // Track if we're scrolled to the bottom
                            adjustment.connect("value-changed", () => {
                                wallpaperView.attribute.pinnedDown =
                                    adjustment.get_value() >= (adjustment.get_upper() - adjustment.get_page_size() - 10);
                            });
                        });
                    }
                }),
            ],
        }),
    ],
});

const styles = [
    { icon: 'camera', style: 'photographic, 4k, high quality', tooltip: 'High quality photo' },
    { icon: 'palette', style: 'digital art, artistic, vibrant colors', tooltip: 'Digital art' },
    { icon: 'landscape', style: 'landscape photography, wide angle, scenic view', tooltip: 'Landscape photo' },
    { icon: 'architecture', style: 'urban photography, cityscape, modern architecture', tooltip: 'Urban/City' },
    { icon: 'brush', style: 'anime art style, high quality illustration', tooltip: 'Anime style' },
    { icon: 'auto_fix_high', style: 'fantasy art, magical, ethereal atmosphere', tooltip: 'Fantasy art' },
];

const randomPrompts = [
    'mystical forest at twilight',
    'futuristic neon city',
    'serene mountain lake',
    'abstract cosmic patterns',
    'cherry blossoms in spring',
    'underwater coral reef',
    'northern lights over mountains',
    'cyberpunk street scene',
    'peaceful zen garden',
    'dramatic storm clouds',
    'colorful autumn forest',
    'geometric abstract patterns',
    'desert sand dunes at sunset',
    'misty waterfall in jungle',
    'starry night over ocean',
];

// Create a revealer for additional style buttons using standard Revealer
const additionalStylesBox = Box({
    className: 'wallpaper-additional-styles spacing-h-5',
    hpack: 'center',
    homogeneous: false,
    css: 'margin: 0; padding: 0;',
});

const additionalStylesRevealer = Widget.Revealer({
    transition: 'slide_down',
    transitionDuration: 200,
    revealChild: false,
    child: additionalStylesBox,
});

// Create the main style buttons container
export const wallpaperCommands = Box({
    vertical: true,
    className: 'wallpaper-commands-container spacing-v-10',
    css: 'margin-top: 5px;',
    setup: self => {
        // Main buttons row
        const mainButtonsRow = Box({
            className: 'wallpaper-main-commands spacing-h-10',
            hpack: 'center',
        });

        // Add spacer to push buttons to center
        mainButtonsRow.add(Box({ hexpand: true }));

        // Add clear button
        mainButtonsRow.add(StyleButton({
            icon: 'clear_all',
            tooltip: 'Clear messages',
            onClick: () => {
                // Clear all children
                const children = chatContent.get_children();
                for (let i = 0; i < children.length; i++) {
                    chatContent.remove(children[i]);
                }
                wallpaperWelcome.visible = true;
            },
        }));

        // Add random wallpaper button
        mainButtonsRow.add(StyleButton({
            icon: 'casino',
            tooltip: 'Generate random wallpaper',
            onClick: () => {
                const randomStyle = styles[Math.floor(Math.random() * styles.length)];
                const randomPrompt = randomPrompts[Math.floor(Math.random() * randomPrompts.length)];
                const buffer = chatEntry.get_buffer();
                buffer.set_text(`${randomPrompt}, ${randomStyle.style}`, -1);
                // Send the message directly
                sendMessage(`${randomPrompt}, ${randomStyle.style}`);
                buffer.set_text('', -1);
            },
        }));

        // Add the first 3 style buttons
        styles.slice(0, 3).forEach(({icon, style, tooltip}) => {
            mainButtonsRow.add(StyleButton({
                icon,
                tooltip,
                onClick: () => {
                    const buffer = chatEntry.get_buffer();
                    const [start, end] = buffer.get_bounds();
                    const text = buffer.get_text(start, end, true);
                    // Send the message directly
                    sendMessage(`${text}, ${style}`);
                    buffer.set_text('', -1);
                },
            }));
        });

        // Add the main buttons row to the container
        self.add(mainButtonsRow);

        // Create the toggle button
        const toggleButton = Button({
            className: 'sidebar-chat-chip txt-norm sec-txt',
            tooltipText: 'Show more styles',
            css: `
                padding: 2px 6px;
                min-height: 24px;
                margin: 0 2px;
            `,
            child: Box({
                className: 'spacing-h-3',
                homogeneous: false,
            }),
            onClicked: (button) => {
                // Toggle the revealer
                additionalStylesRevealer.revealChild = !additionalStylesRevealer.revealChild;

                // Update the icon based on the revealer state
                const icon = additionalStylesRevealer.revealChild ? 'expand_less' : 'expand_more';
                button.child.get_children()[1].icon = icon;

                // Update the label text
                button.child.get_children()[0].label = additionalStylesRevealer.revealChild ? 'Less' : 'More';

                // Update the tooltip
                button.tooltipText = additionalStylesRevealer.revealChild ? 'Show less styles' : 'Show more styles';
            },
            setup: setupCursorHover,
        });

        // Add label and icon to the toggle button
        toggleButton.child.add(Label({
            className: 'txt-small',
            css: 'font-size: 12px;',
            label: 'More',
        }));
        toggleButton.child.add(MaterialIcon('expand_more', 'norm', {
            css: 'font-size: 14px;'
        }));

        // Add the toggle button to the main buttons row
        mainButtonsRow.add(toggleButton);

        // Add the revealer to the container
        self.add(additionalStylesRevealer);
    },
});

// Define sendMessage function before it's used
export const sendMessage = (text) => {
    // Check if text is valid
    if (!text || text.length == 0) return;

    // Add user message using add method
    const userMessage = MessageContent(text, 'user');
    chatContent.add(userMessage);
    wallpaperWelcome.visible = false;

    // Generate wallpaper
    WallpaperService.generateWallpaper(text)
        .catch(error => {
            // Add error message using add method
            const errorMessage = MessageContent(error.message, 'error');
            chatContent.add(errorMessage);
        });
};

// Populate the additional styles revealer with buttons
const setupAdditionalButtons = () => {
    // Create a horizontal box for the buttons
    const buttonsBox = Box({
        className: 'spacing-h-5',
        hpack: 'center',
        homogeneous: false,
    });

    // Add remaining style buttons
    styles.slice(3).forEach(({icon, style, tooltip}) => {
        buttonsBox.add(StyleButton({
            icon,
            tooltip,
            onClick: () => {
                const buffer = chatEntry.get_buffer();
                const [start, end] = buffer.get_bounds();
                const text = buffer.get_text(start, end, true);
                // Send the message directly
                sendMessage(`${text}, ${style}`);
                buffer.set_text('', -1);
            },
        }));
    });

    // Add custom prompt buttons
    getCustomPrompts().forEach(({icon, style, tooltip}) => {
        buttonsBox.add(StyleButton({
            icon,
            tooltip,
            onClick: () => {
                const buffer = chatEntry.get_buffer();
                const [start, end] = buffer.get_bounds();
                const text = buffer.get_text(start, end, true);
                // Send the message directly
                sendMessage(`${text}, ${style}`);
                buffer.set_text('', -1);
            },
        }));
    });

    // Add the buttons box to the revealer's child
    additionalStylesBox.add(buttonsBox);
};

// Set up the additional buttons
setupAdditionalButtons();

// Connect to the preview-ready signal
WallpaperService.connect('preview-ready', () => {
    // Get the preview file from the service's property
    const tempFile = WallpaperService._previewFile;
    // Create and add the preview box
    const previewBox = PreviewBox(tempFile);
    chatContent.add(previewBox);
});
