import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import { getString } from '../../i18n/i18n.js';

const { Box, Label, Entry, Scrollable } = Widget;

// Key substitution mapping
const keySubstitutions = {
    "Super": "󰖳",
    "mouse_up": "Scroll ↓",    // ikr, weird
    "mouse_down": "Scroll ↑",  // trust me bro
    "mouse:272": "LMB",
    "mouse:273": "RMB",
    "mouse:275": "MouseBack",
    "Slash": "/",
    "Hash": "#"
};

// Function to substitute key names with symbols
const substituteKey = (key) => {
    return keySubstitutions[key] || key;
};

// Function to create a keybind row
const KeybindRow = (keybind) => {
    // Create the keys part
    const keysBox = Box({
        className: 'cheatsheet-keybind-keys',
        children: [
            // Modifiers
            ...(keybind.mods || []).map(mod => Label({
                className: 'cheatsheet-key txt-small',
                label: mod ? substituteKey(mod) : '',
            })),
            // Plus sign if there are modifiers and a key
            ...(keybind.mods && keybind.mods.length > 0 && keybind.key ? [
                Label({
                    className: 'cheatsheet-key-notkey txt-small',
                    label: '+',
                })
            ] : []),
            // Key
            ...(keybind.key ? [
                Label({
                    className: 'cheatsheet-key txt-small',
                    label: keybind.key ? substituteKey(keybind.key) : '',
                })
            ] : [])
        ]
    });

    // Create the action part
    const actionBox = Box({
        hexpand: true,
        child: Label({
            xalign: 0,
            className: 'txt-small',
            label: keybind.comment || '',
        })
    });

    // Return the complete row
    return Box({
        className: 'cheatsheet-keybind-row spacing-h-15',
        children: [keysBox, actionBox]
    });
};

// Function to create a section with keybinds
const KeybindSection = (sectionName, keybinds) => {
    return Box({
        vertical: true,
        className: 'spacing-v-10',
        children: [
            // Section header
            Label({
                xalign: 0,
                className: 'cheatsheet-category-title txt margin-bottom-5',
                label: getString(sectionName),
            }),
            // Keybinds
            Box({
                vertical: true,
                className: 'spacing-v-5',
                children: keybinds.map(KeybindRow)
            })
        ]
    });
};

// Function to create a "no results" message
const NoResultsMessage = () => {
    return Box({
        vertical: true,
        hpack: 'center',
        vpack: 'center',
        className: 'spacing-v-15 margin-top-30',
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
};

// Main search widget
export default (keybindList) => {
    // Create a search entry
    const searchEntry = Entry({
        hpack: 'center',
        className: 'cheatsheet-search-entry',
        placeholderText: getString('Search keybinds...'),
        primaryIconName: 'search-symbolic',
    });

    // Create a container for search results
    const resultsContainer = Box({
        vertical: true,
        className: 'spacing-v-20',
    });

    // Create a scrollable container for the results
    const scrollableResults = Scrollable({
        vexpand: true,
        child: resultsContainer,
    });

    // Function to collect all keybinds from all sections
    const collectAllKeybinds = (sections) => {
        const allKeybinds = [];

        const processSection = (section) => {
            // Add keybinds from this section
            if (section.keybinds && section.keybinds.length > 0) {
                allKeybinds.push({
                    section: section.name,
                    keybinds: section.keybinds
                });
            }

            // Process child sections
            if (section.children && section.children.length > 0) {
                section.children.forEach(processSection);
            }
        };

        sections.forEach(processSection);
        return allKeybinds;
    };

    // Get all keybinds
    const allKeybindGroups = collectAllKeybinds(keybindList.children);

    // Function to search keybinds
    const searchKeybinds = (query) => {
        // Clear previous results
        resultsContainer.children = [];

        if (!query) {
            // Show a message when search is empty
            resultsContainer.add(Label({
                hpack: 'center',
                className: 'txt',
                label: getString('Type to search keybinds...'),
            }));
            return;
        }

        // Filter keybinds that match the query
        const matchingGroups = [];

        allKeybindGroups.forEach(group => {
            const matchingKeybinds = group.keybinds.filter(keybind => {
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

                // Check substituted keys
                if (keybind.key && substituteKey(keybind.key).toLowerCase().includes(query)) {
                    return true;
                }

                // Check substituted modifiers
                if (keybind.mods && keybind.mods.some(mod => mod && substituteKey(mod).toLowerCase().includes(query))) {
                    return true;
                }

                return false;
            });

            if (matchingKeybinds.length > 0) {
                matchingGroups.push({
                    section: group.section,
                    keybinds: matchingKeybinds
                });
            }
        });

        // Display results or "no results" message
        if (matchingGroups.length === 0) {
            resultsContainer.add(NoResultsMessage());
        } else {
            matchingGroups.forEach(group => {
                resultsContainer.add(KeybindSection(group.section, group.keybinds));
            });
        }
    };

    // Connect search entry to search function
    searchEntry.on('changed', () => {
        const query = searchEntry.text.toLowerCase();
        searchKeybinds(query);
    });

    // Initialize with empty search
    searchKeybinds('');

    // Return the complete search widget
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

            // Results container
            scrollableResults,
        ],
    });
};
