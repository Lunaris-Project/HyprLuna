import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const { execAsync, exec } = Utils;
const { Overlay,Box, EventBox, Label } = Widget;
import InlineClock from '../bar/modules/inline_clock.js'
import { RoundedCorner } from '../.commonwidgets/cairo_roundedcorner.js';
// import {
//     ToggleIconBluetooth,
//     ToggleIconWifi,
//     ModuleNightLight,
//     ModuleIdleInhibitor,
//     //HyprToggleIcon,
//     ModuleReloadIcon,
//     ToggleIconCalendar,
//     ModuleSettingsIcon,
//     ModulePowerIcon,
//     ModuleRawInput,
//     ModuleGameMode,
//     ModuleCloudflareWarp,
// } from "./modules/quicktoggles.js";
import ModuleNotificationList from "./centermodules/notificationlist.js";
import ModuleAudioControls from "./centermodules/audiocontrols.js";
import ModuleWifiNetworks from "./centermodules/wifinetworks.js";
import ModulePowerProfiles from './centermodules/powerprofiles.js';
import ModuleBluetooth from "./centermodules/bluetooth.js";
import { TodoWidget } from './modules/todolist.js';
import { ModuleCalendar } from "./modules/calendar.js";
import ModulePrayerTimes from './centermodules/prayertimes.js';
import { getDistroIcon } from '../.miscutils/system.js';
import { MaterialIcon } from '../.commonwidgets/materialicon.js';
import { ExpandingIconTabContainer } from '../.commonwidgets/tabcontainer.js';
import { checkKeybind } from '../.widgetutils/keybind.js';
// import { WWO_CODE, WEATHER_SYMBOL, NIGHT_WEATHER_SYMBOL } from '../.commondata/weather.js';
import GLib from 'gi://GLib';
// import Battery from 'resource:///com/github/Aylur/ags/service/battery.js';
import VPN from './centermodules/vpn.js';
import taskmanager from './centermodules/taskmanager.js';
import { PrayerTimesWidget } from './modules/prayertimes.js';
import inline_clock from '../bar/modules/inline_clock.js';
const config = userOptions.asyncGet();
const elevate = userOptions.asyncGet().etc.widgetCorners ? "sidebar-r sidebar-bottom"  : "sidebar-r elevation " ;
const modulesList = {
    vpnGate: {
        name: 'VPN Gate',
        materialIcon: 'vpn_key',
        contentWidget: VPN, // Renamed vpn to VPN
    },
    notifications: {
        name: getString('Notifications'),
        materialIcon: 'notifications',
        contentWidget: ModuleNotificationList,
    },
    audioControls: {
        name: getString('Audio controls'),
        materialIcon: 'volume_up',
        contentWidget: ModuleAudioControls,
    },
    powerProfiles: {
        name: 'Power Profiles',
        materialIcon: 'speed',
        contentWidget: ModulePowerProfiles,
    },
    taskManager: {
        name: getString('Tasks Manager'),
        materialIcon: 'check',
        contentWidget: taskmanager,
    },
    bluetooth: {
        name: getString('Bluetooth'),
        materialIcon: 'bluetooth',
        contentWidget: ModuleBluetooth,
    },
    wifiNetworks: {
        name: getString('Wifi networks'),
        materialIcon: 'wifi',
        contentWidget: ModuleWifiNetworks,
        onFocus: () => execAsync('nmcli dev wifi list').catch(print),
    },
    prayerTimes: {
        name: 'Prayer Times',
        materialIcon: 'mosque',
        contentWidget: ModulePrayerTimes,
    },
};

// Get enabled modules from config
const getEnabledModules = () => {
    const enabledModules = config.sidebar.centerModules.enabled || [];
    return enabledModules
        .filter(moduleId => {
            const moduleConfig = config.sidebar.centerModules[moduleId];
            return moduleConfig && moduleConfig.enabled;
        })
        .map(moduleId => modulesList[moduleId])
        .filter(module => module !== undefined);
};


// const togglesBox = Widget.Box({
//     hpack: 'center',
//     spacing:8,
//     css:`margin-top:1rem;`,
//     className: 'sidebar-togglesbox',
//     children: [
//         ToggleIconWifi(),
//         ToggleIconBluetooth(),
//         await ModuleNightLight(),
//         await ModuleGameMode(),
//         ModuleIdleInhibitor(),
//         ModuleSettingsIcon(),
//         await ModuleCloudflareWarp(),
//     ]
// })

export const sidebarOptionsStack = ExpandingIconTabContainer({
    tabsHpack: 'center',
    tabSwitcherClassName: 'sidebar-icontabswitcher',
    icons: getEnabledModules().map((api) => api.materialIcon),
    names: getEnabledModules().map((api) => api.name),
    children: getEnabledModules().map((api) => api.contentWidget()),
    onChange: (self, id) => {
        self.shown = getEnabledModules()[id].name;
        if (getEnabledModules()[id].onFocus) getEnabledModules()[id].onFocus();
    }
});
const images = [
    // '1',
    // '2',
    '3',
    '4',
    '5',
    '6',
    // '7',
    // '8',
    // '9',
    // '10'
];


let content = Box({
    vertical: true,
    children: [
        Box({
            hexpand:true,
            hpack:"center",
            vpack:"center",
            child:inline_clock({
            css:`font-size:3rem`,
        }),
        }),
        Box({vexpand:true}),
        userOptions.asyncGet().etc.widgetCorners ? RoundedCorner('bottomright', {hpack:"end", vpack: 'end', className: 'corner corner-colorscheme'}) : null,
        Box({
        className: `${elevate}`,
        spacing:14,
        hexpand:true,
        children:[
            Box({
                className: 'sidebar-group',
                vexpand: true,
                hexpand:true,
                child:Box({
                    hexpand:true,
                    child:sidebarOptionsStack,
                }),
            }),
            ModuleCalendar({vexpand:true}),
       

    ]
})
    ]
});
export default () => Box({
    vexpand: true,
    hexpand: true,
    css:`min-width:900px`,
    children: [
        userOptions.asyncGet().etc.widgetCorners ? RoundedCorner('bottomright', {hpack: "start", vpack: 'end', className: 'corner corner-colorscheme'}) : null,
        Box({
            vertical:true,
            children:[
                content,
                
            ]
        }),
    ],
    setup: (self) => self
        .on('key-press-event', (widget, event) => { // Handle keybinds
            if (checkKeybind(event, userOptions.asyncGet().keybinds.sidebar.options.nextTab)) {
                sidebarOptionsStack.nextTab();
            }
            else if (checkKeybind(event, userOptions.asyncGet().keybinds.sidebar.options.prevTab)) {
                sidebarOptionsStack.prevTab();
            }
        })
    ,
});
