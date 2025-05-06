import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import { languages } from "../../.commonwidgets/statusicons_languages.js";
import Hyprland from "resource:///com/github/Aylur/ags/service/hyprland.js";

const ANIMATION_DURATION = 200;

/**
 * Creates a keyboard layout widget for Hyprland
 */
const createKeyboardWidget = () => {
    // Get configured layouts
    const deviceData = JSON.parse(Utils.exec("hyprctl -j devices"));
    const mainKeyboard = deviceData.keyboards.find(kb => kb.main);
    const layouts = mainKeyboard?.layout.split(",").map(l => l.trim()) || ["us"];
    
    // Build name-to-layout mapping from languages data for easier lookup
    const nameToLayout = {};
    languages.forEach(lang => {
        if (lang.name && lang.layout) {
            nameToLayout[lang.name.toLowerCase()] = lang.layout;
        }
    });
    
    // Create layout labels
    const layoutLabels = {};
    
    // Create a label for each configured layout
    layouts.forEach(layout => {
        const lang = languages.find(l => l.layout === layout);
        const label = lang ? lang.layout.toUpperCase() : layout.toUpperCase();
        
        layoutLabels[layout] = Widget.Label({
            label,
            className: 'txt-tiny onSurfaceVariant',
            vpack: 'center',
            justify: 'center'
        });
    });
    
    // Also add an unknown label
    layoutLabels.unknown = Widget.Label({
        label: "?",
        className: 'txt-tiny onSurfaceVariant',
        hpack: 'center',
        vpack: 'center',
        justify: 'center'
    });
    
    // Create the stack for labels
    const labelStack = Widget.Stack({
        transition: "slide_up_down",
        transitionDuration: ANIMATION_DURATION,
        vpack: 'center',
        children: layoutLabels,
        setup: self => {
            // Show initial layout
            const initialLayout = getCurrentLayout(layouts, nameToLayout);
            self.shown = initialLayout in layoutLabels ? initialLayout : "unknown";
            
            // Listen for layout changes
            self.hook(Hyprland, () => {
                const currentLayout = getCurrentLayout(layouts, nameToLayout);
                if (currentLayout in layoutLabels) {
                    self.shown = currentLayout;
                } else {
                    self.shown = "unknown";
                }
            }, "keyboard-layout");
        }
    });
    
    // Create the final widget
    return Widget.Box({
        vertical: true,
        vpack: 'center',
        hpack: 'center',
        homogeneous: false,
        children: [
            Widget.EventBox({
                onPrimaryClick: () => {
                    App.toggleWindow("osk");
                },
                hpack: 'center',
                child: Widget.Label({
                    label: 'keyboard',
                    className: 'txt-small onSurfaceVariant icon-material',
                })
            }),
            Widget.Box({ child: labelStack })
        ]
    });
};

/**
 * Gets the current keyboard layout using language data for mapping
 */
function getCurrentLayout(configuredLayouts, nameToLayout) {
    try {
        // Get current keyboard info
        const deviceData = JSON.parse(Utils.exec("hyprctl -j devices"));
        const mainKeyboard = deviceData.keyboards.find(kb => kb.main);
        
        if (!mainKeyboard || !mainKeyboard.active_keymap) {
            return configuredLayouts[0] || "us";
        }
        
        // Get the active keymap name
        const activeKeymap = mainKeyboard.active_keymap;
        const activeKeymapLower = activeKeymap.toLowerCase();
        
        // Method 1: Try direct mapping from language name
        if (nameToLayout[activeKeymapLower]) {
            return nameToLayout[activeKeymapLower];
        }
        
        // Method 2: Try partial matching with language names
        for (const [name, code] of Object.entries(nameToLayout)) {
            if (activeKeymapLower.includes(name.split(' ')[0].toLowerCase())) {
                return code;
            }
        }
        
        // Method 3: Look for layout code directly in configured layouts
        for (const layout of configuredLayouts) {
            if (activeKeymapLower.includes(layout.toLowerCase())) {
                return layout;
            }
        }
        
        // Fallback to first configured layout
        console.log(`No layout match for keymap: ${activeKeymap}, defaulting to ${configuredLayouts[0]}`);
        return configuredLayouts[0] || "us";
    } catch (error) {
        console.error(`Error getting current layout: ${error}`);
        return "unknown";
    }
}

export default () => Widget.Box({
    vpack: 'center',
    hpack: 'center',
    css: 'margin-left: 0.9rem; margin-right: 0.9rem;',
    children: [createKeyboardWidget()],
});