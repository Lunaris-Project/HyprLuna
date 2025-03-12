const { Gtk } = imports.gi;
import App from 'resource:///com/github/Aylur/ags/app.js';
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const { execAsync, exec } = Utils;
import { searchItem } from './searchitem.js';
import { execAndClose, couldBeMath, launchCustomCommand, expandTilde } from './miscfunctions.js';
import GeminiService from '../../services/gemini.js';
import ChatGPTService from '../../services/gpt.js';

// Кэшируем часто используемые опции
const options = userOptions.asyncGet();
const animations = options.animations;
const searchConfig = options.search;
const aiConfig = options.ai;

export const NoResultButton = () => searchItem({
    materialIconName: 'Error',
    name: "Search invalid",
    content: "No results found!",
    onActivate: () => App.closeWindow('overview'),
});

export const DirectoryButton = ({ parentPath, name, type, icon }) => {
    const actionText = Widget.Revealer({
        revealChild: false,
        transition: "crossfade", 
        transitionDuration: animations.durationLarge,
        child: Widget.Label({
            className: 'overview-search-results-txt txt txt-small txt-action',
            label: 'Open',
        })
    });
    
    const actionTextRevealer = Widget.Revealer({
        revealChild: false,
        transition: "slide_left",
        transitionDuration: animations.durationHuge,
        child: actionText,
    });

    return Widget.Button({
        className: 'overview-search-result-btn',
        onClicked: () => {
            App.closeWindow('overview');
            execAsync(['xdg-open', `${parentPath}/${name}`]).catch(print);
        },
        child: Widget.Box({
            children: [
                Widget.Box({
                    vertical: false,
                    children: [
                        Widget.Box({
                            className: 'overview-search-results-icon',
                            homogeneous: true,
                            child: Widget.Icon({ icon }),
                        }),
                        Widget.Label({
                            className: 'overview-search-results-txt txt txt-norm',
                            label: name,
                        }),
                        Widget.Box({ hexpand: true }),
                        actionTextRevealer,
                    ]
                })
            ]
        }),
        setup: (self) => self
            .on('focus-in-event', () => {
                actionText.revealChild = true;
                actionTextRevealer.revealChild = true;
            })
            .on('focus-out-event', () => {
                actionText.revealChild = false;
                actionTextRevealer.revealChild = false;
            }),
    })
}

export const CalculationResultButton = ({ result, text }) => searchItem({
    materialIconName: 'calculate',
    name: 'Math result',
    actionName: "Copy",
    content: `${result}`,
    onActivate: () => {
        App.closeWindow('overview');
        execAsync(['wl-copy', `${result}`]).catch(print);
    },
});

export const DesktopEntryButton = (app) => {
    const actionText = Widget.Revealer({
        revealChild: false,
        transition: "crossfade",
        transitionDuration: animations.durationLarge,
        child: Widget.Label({
            className: 'overview-search-results-txt txt txt-small txt-action',
            label: 'Launch',
        })
    });

    const actionTextRevealer = Widget.Revealer({
        revealChild: false,
        transition: "slide_left",
        transitionDuration: animations.durationHuge,
        child: actionText,
    });
    const isFile = app.iconName !== null && app.iconName.startsWith('~') || app.iconName.startsWith('.') || app.iconName.startsWith('/');
    const css = `background-size:cover;background-image:${isFile ? `url('${expandTilde(app.iconName)}')` : 'none'};`;
    return Widget.Button({
        className: 'overview-search-result-btn',
        onClicked: () => {
            App.closeWindow('overview');
            app.launch();
        },
        child: Widget.Box({
            children: [
                Widget.Box({
                    vertical: false,
                    children: [
                        Widget.Box({
                            className: 'overview-search-results-icon',
                            homogeneous: true,
                            css: css,
                            children: isFile ? [] : [Widget.Icon ({
                                icon: app.iconName
                            })],
                        }),
                        Widget.Label({
                            className: 'overview-search-results-txt txt txt-norm',
                            label: app.name,
                        }),
                        Widget.Box({ hexpand: true }),
                        actionTextRevealer,
                    ]
                })
            ]
        }),
        setup: (self) => self
            .on('focus-in-event', () => {
                actionText.revealChild = true;
                actionTextRevealer.revealChild = true;
            })
            .on('focus-out-event', () => {
                actionText.revealChild = false;
                actionTextRevealer.revealChild = false;
            }),
    })
}

export const ExecuteCommandButton = ({ command, terminal = false }) => searchItem({
    materialIconName: terminal ? 'terminal' : 'settings_b_roll',
    name: 'Run command',
    actionName: `Execute ${terminal ? 'in terminal' : ''}`,
    content: command,
    onActivate: () => execAndClose(command, terminal),
    extraClassName: 'techfont',
})

export const CustomCommandButton = ({ text = '' }) => searchItem({
    materialIconName: 'settings_suggest',
    name: 'Action',
    actionName: 'Run',
    content: text,
    onActivate: () => {
        App.closeWindow('overview');
        launchCustomCommand(text);
    },
});

export const SearchButton = ({ text = '' }) => {
    const search = searchConfig.engineBaseUrl + text + 
        searchConfig.excludedSites.reduce((acc, site) => site ? acc + ` -site:${site}` : acc, '');

    return searchItem({
        materialIconName: 'travel_explore',
        name: 'Search the web',
        actionName: 'Go',
        content: text,
        onActivate: () => {
            App.closeWindow('overview');
            execAsync(['xdg-open', search]).catch(print);
        },
    });
}

export const WallpaperButton = ({ text = '' }) => {
    const search = 'https://wallhaven.cc/search?q=' + text;
    return searchItem({
        materialIconName: 'image',
        name: 'Search wallpapers',
        actionName: 'Go',
        content: text,
        onActivate: () => {
            App.closeWindow('overview');
            execAsync(['xdg-open', search]).catch(print);
        },
    });
}
export const AiButton = ({ text }) => searchItem({
    materialIconName: 'chat_paste_go',
    name: aiConfig.onSearch == 'gemini' ? 'Ask Gemini' : 'Ask ChatGPT',
    actionName: 'Ask',
    content: text,
    onActivate: () => {
        (aiConfig.onSearch == 'gemini' ? GeminiService : ChatGPTService).send(text);
        App.closeWindow('overview');
        App.openWindow('sideleft');
    },
});
