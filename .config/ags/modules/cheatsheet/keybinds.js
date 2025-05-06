const { GLib } = imports.gi;
import App from "resource:///com/github/Aylur/ags/app.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import Widget from "resource:///com/github/Aylur/ags/widget.js";
import { IconTabContainer } from "../.commonwidgets/tabcontainer.js";
import { getString } from '../../i18n/i18n.js';
const { Box, Label, Entry } = Widget;

const HYPRLAND_KEYBIND_CONFIG_FILE = userOptions.asyncGet().cheatsheet.keybinds.configPath ?
    userOptions.asyncGet().cheatsheet.keybinds.configPath : `${GLib.get_user_config_dir()}/hypr/hyprland/keybinds/default.conf`;
const KEYBIND_SECTIONS_PER_PAGE = 3;
const getKeybindList = () => {
    let data = Utils.exec(`${App.configDir}/scripts/hyprland/get_keybinds.py --path ${HYPRLAND_KEYBIND_CONFIG_FILE}`);
    if (data == "\"error\"") {
        Utils.timeout(2000, () => Utils.execAsync(['notify-send',
            'Update path to keybinds',
            'Keybinds hyprland config file not found. Check your user options.',
            '-a', 'ags',
        ]).catch(print))
        return { children: [] };
    }
    return JSON.parse(data);
};
const keybindList = getKeybindList();

const keySubstitutions = {
    "Super": "󰖳",
    "mouse_up": "Scroll ↓",    // ikr, weird
    "mouse_down": "Scroll ↑",  // trust me bro
    "mouse:272": "LMB",
    "mouse:273": "RMB",
    "mouse:275": "MouseBack",
    "Slash": "/",
    "Hash": "#"
}

const substituteKey = (key) => {
    return keySubstitutions[key] || key;
}

const Keybind = (keybindData, type) => { // type: either "keys" or "actions"
    const Key = (key) => Label({ // Specific keys
        vpack: 'center',
        className: `${['OR', '+'].includes(key) ? 'cheatsheet-key-notkey' : 'cheatsheet-key'} txt-small`,
        label: substituteKey(key),
    });
    const Action = (text) => Label({ // Binds
        xalign: 0,
        label: getString(text),
        className: "txt txt-small cheatsheet-action",
    })
    return Widget.Box({
        className: "spacing-h-10 cheatsheet-bind-lineheight",
        children: type == "keys" ? [
            ...(keybindData.mods.length > 0 ? [
                ...keybindData.mods.map(Key),
                Key("+"),
            ] : []),
            Key(keybindData.key),
        ] : [Action(keybindData.comment)],
    })
}

const Section = (sectionData, scope) => {
    const keys = Box({
        vertical: true,
        className: 'spacing-v-3',
        children: sectionData.keybinds.map((data) => Keybind(data, "keys"))
    })
    const actions = Box({
        vertical: true,
        className: 'spacing-v-3',
        children: sectionData.keybinds.map((data) => Keybind(data, "actions"))
    })
    const name = Label({
        xalign: 0.5,
        className: "cheatsheet-category-title txt",
        label: getString(sectionData.name),
    })
    const binds = Box({
        className: 'spacing-h-15',
        hpack: 'center',
        children: [
            keys,
            actions,
        ]
    })
    const childrenSections = Box({
        vertical: true,
        className: 'spacing-v-10',
        children: sectionData.children.map((data) => Section(data, scope + 1))
    })
    return Box({
        vertical: true,
        className: 'cheatsheet-section',
        children: [
            ...((sectionData.name && sectionData.name.length > 0) ? [name] : []),
            Box({
                className: 'spacing-v-5',
                children: [
                    binds,
                    childrenSections,
                ]
            })
        ]
    })
};

// Function to collect all keybinds from all sections
const getAllKeybinds = (sections) => {
    const allKeybinds = [];

    const processSection = (section, parentName = '') => {
        const sectionName = parentName ? `${parentName} > ${section.name}` : section.name;

        // Add keybinds from this section
        section.keybinds.forEach(keybind => {
            allKeybinds.push({
                section: sectionName,
                keybind: keybind
            });
        });

        // Process child sections
        section.children.forEach(child => {
            processSection(child, sectionName);
        });
    };

    sections.forEach(section => {
        processSection(section);
    });

    return allKeybinds;
};

// Function to check if a keybind matches the search query
const keybindMatchesSearch = (keybind, query) => {
    // Check comment (action description)
    if (keybind.comment && keybind.comment.toLowerCase().includes(query)) {
        return true;
    }

    // Check key
    if (keybind.key && keybind.key.toLowerCase().includes(query)) {
        return true;
    }

    // Check modifiers
    if (keybind.mods && keybind.mods.some(mod => mod && mod.toLowerCase().includes(query))) {
        return true;
    }

    return false;
};

// Create a section that shows when no results are found
const NoResultsSection = () => Box({
    vertical: true,
    hpack: 'center',
    vpack: 'center',
    className: 'spacing-v-15 margin-top-30 cheatsheet-no-results',
    children: [
        Label({
            className: 'txt-title',
            label: getString('No matching keybinds found'),
        }),
        Label({
            className: 'txt',
            label: getString('Try a different search term'),
        })
    ]
});

export default () => {
    // Create the default keybind pages
    const numOfTabs = Math.ceil(keybindList.children.length / KEYBIND_SECTIONS_PER_PAGE);
    const keybindPages = Array.from({ length: numOfTabs }, (_, i) => ({
        iconWidget: Label({
            className: "txt txt-small",
            label: `${i + 1}`,
        }),
        name: `${i + 1}`,
        child: Box({
            className: 'spacing-h-15',
            hpack: 'center',
            children: keybindList.children.slice(
                KEYBIND_SECTIONS_PER_PAGE * i, 0 + KEYBIND_SECTIONS_PER_PAGE * (i + 1),
            ).map(data => Section(data, 1)),
        }),
    }));

    // Create the default tab container
    const tabContainer = IconTabContainer({
        iconWidgets: keybindPages.map((kbp) => kbp.iconWidget),
        names: keybindPages.map((kbp) => kbp.name),
        children: keybindPages.map((kbp) => kbp.child),
    });

    // Create a simple search entry
    const searchEntry = Entry({
        hpack: 'center',
        className: 'cheatsheet-search-entry',
        placeholderText: getString('Search keybinds...'),
        primaryIconName: 'search-symbolic',
    });

    // Create a container for search results
    const searchResultsBox = Box({
        vertical: true,
        vexpand: true,
        hpack: 'center',
    });

    // Create a scrollable container for search results
    const searchResultsScrollable = Widget.Scrollable({
        vexpand: true,
        className: 'cheatsheet-section',
        child: searchResultsBox,
    });

    // Create a container for the content
    const contentStack = Box({
        vertical: true,
        children: [
            tabContainer,
        ],
    });

    // We'll add the search results only when needed
    searchResultsScrollable.visible = false;

    // Get all keybinds for searching
    const allKeybinds = getAllKeybinds(keybindList.children);
    console.log(`Total keybinds loaded: ${allKeybinds.length}`);

    // Add search functionality
    searchEntry.on('changed', () => {
        const query = searchEntry.text.toLowerCase();
        console.log(`Search query: "${query}"`);

        if (!query) {
            // Show all keybinds when search is empty
            tabContainer.visible = true;

            // Remove search results from content stack if it's there
            if (contentStack.children.includes(searchResultsScrollable)) {
                contentStack.remove(searchResultsScrollable);
            }
            return;
        }

        // Filter keybinds based on search query
        const matchingKeybinds = allKeybinds.filter(item =>
            keybindMatchesSearch(item.keybind, query)
        );

        console.log(`Found ${matchingKeybinds.length} matching keybinds`);

        // Clear previous search results
        searchResultsBox.children = [];

        if (matchingKeybinds.length === 0) {
            // Show no results message
            console.log("No results found");
            searchResultsBox.add(NoResultsSection());
        } else {
            console.log("Creating search results");

            // Add a header
            searchResultsBox.add(Label({
                xalign: 0.5,
                className: "cheatsheet-category-title txt",
                label: `${matchingKeybinds.length} ${matchingKeybinds.length === 1 ? 'match' : 'matches'} found`,
            }));

            // Add each keybind directly
            matchingKeybinds.forEach(item => {
                const keybind = item.keybind;

                searchResultsBox.add(Box({
                    className: "cheatsheet-keybind-row spacing-h-15",
                    hpack: 'center',
                    children: [
                        // Keys
                        Keybind(keybind, "keys"),
                        // Action
                        Box({
                            hexpand: true,
                            child: Keybind(keybind, "actions"),
                        }),
                    ],
                }));
            });
        }

        // Show search results, hide default content
        tabContainer.visible = false;

        // Add search results to content stack if not already there
        if (!contentStack.children.includes(searchResultsScrollable)) {
            contentStack.add(searchResultsScrollable);
        }
        searchResultsScrollable.visible = true;
    });

    // Create the main container with search and content
    return Box({
        vertical: true,
        className: 'spacing-v-10',
        children: [
            // Search container
            Box({
                hpack: 'center',
                className: 'cheatsheet-search-container',
                children: [searchEntry],
            }),

            // Content container
            contentStack,
        ],
    });
};
