const { GLib, Gio } = imports.gi;
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const { Box, Label, Scrollable } = Widget;
const { execAsync, exec } = Utils;
import { ConfigGap, ConfigSpinButton, ConfigSeparator, ConfigToggle } from '../../.commonwidgets/configwidgets.js';
import { initBorder, initBorderVal, initTransparencyVal, initVibrancy, initVibrancyVal, initTransparency, initScheme, initSchemeIndex, initGowall, initGowallIndex, initTransparencyModeVal } from '../../indicators/colorscheme.js';

const HyprlandToggle = ({ icon, name, desc = null, option, enableValue = 1, disableValue = 0, extraOnChange = () => { } }) => ConfigToggle({
    icon: icon,
    name: name,
    desc: desc,
    initValue: JSON.parse(exec(`hyprctl getoption -j ${option}`))["int"] != 0,
    onChange: (self, newValue) => {
        execAsync(['hyprctl', 'keyword', option, `${newValue ? enableValue : disableValue}`]).catch(print);
        extraOnChange(self, newValue);
    }
});

const HyprlandSpinButton = ({ icon, name, desc = null, option, ...rest }) => ConfigSpinButton({
    icon: icon,
    name: name,
    desc: desc,
    initValue: Number(JSON.parse(exec(`hyprctl getoption -j ${option}`))["int"]),
    onChange: (self, newValue) => {
        execAsync(['hyprctl', 'keyword', option, `${newValue}`]).catch(print);
    },
    ...rest,
});

const Subcategory = (children) => Box({
    className: 'margin-left-20',
    vertical: true,
    children
});

const ConfigSection = ({ name, children }) => Box({
    vertical: true,
    className: 'spacing-v-5',
    children: [
        Label({
            hpack: 'center',
            className: 'txt txt-large margin-left-10',
            label: name,
        }),
        Box({
            className: 'margin-left-10 margin-right-10',
            vertical: true,
            children,
        })
    ]
});

export default (props) => {
    const mainContent = Scrollable({
        vexpand: true,
        child: Box({
            vertical: true,
            css: `margin-top:2rem`,
            className: 'spacing-v-10',
            children: [
                ConfigSection({
                    name: getString('Effects'),
                    children: [
                        ConfigToggle({
                            icon: 'dark_mode',
                            name: getString('Dark Mode'),
                            desc: getString('Ya should go to sleep!'),
                            initValue: darkMode.value,
                            onChange: (_, newValue) => {
                                darkMode.value = !!newValue;
                            },
                            extraSetup: (self) => self.hook(darkMode, (self) => {
                                self.enabled.value = darkMode.value;
                            }),
                        }),
                        ConfigToggle({
                            icon: 'border_clear',
                            name: getString('Transparency'),
                            desc: getString('Make Everything transparent'),
                            initValue: initTransparencyVal,
                            onChange: async (self, newValue) => {
                                try {
                                    const transparency = newValue == 0 ? "opaque" : "transparent";
                                    await execAsync([`bash`, `-c`, `mkdir -p ${GLib.get_user_state_dir()}/ags/user && sed -i "2s/.*/${transparency}/"  ${GLib.get_user_state_dir()}/ags/user/colormode.txt`]);
                                    await execAsync([`bash`, `-c`, `go run ${App.configDir}/scripts/color_generation/applycolor.go`]);
                                } catch (error) {
                                    console.error('Error changing transparency:', error);
                                }
                            },
                        }),
                        ConfigToggle({
                            icon: 'format_paint',
                            name: getString('Vibrancy'),
                            desc: getString('Make Everything Vibrant'),
                            initValue: initVibrancyVal,
                            onChange: async (self, newValue) => {
                                try {
                                    const vibrancy = newValue == 0 ? "normal" : "vibrant";
                                    await execAsync([`bash`, `-c`, `mkdir -p ${GLib.get_user_state_dir()}/ags/user && sed -i "6s/.*/${vibrancy}/"  ${GLib.get_user_state_dir()}/ags/user/colormode.txt`]);
                                    await execAsync([`bash`, `-c`,`go run ${App.configDir}/scripts/color_generation/applycolor.go`]);
                                } catch (error) {
                                    console.error('Error changing vibrancy:', error);
                                }
                            },
                        }),
                        ConfigToggle({
                            icon: 'border_clear',
                            name: getString('Glass Transparency'),
                            desc: getString('intense transparent mode'),
                            initValue: initTransparencyModeVal,
                            onChange: async (self, newValue) => {
                                try {
                                    const transparencyMode = newValue == 0 ? "normal" : "intense";
                                    await execAsync([`bash`, `-c`, `mkdir -p ${GLib.get_user_state_dir()}/ags/user && sed -i "7s/.*/${transparencyMode}/"  ${GLib.get_user_state_dir()}/ags/user/colormode.txt`]);
                                    await execAsync([`bash`, `-c`, `go run ${App.configDir}/scripts/color_generation/applycolor.go`]);
                                } catch (error) {
                                    console.error('Error changing transparency:', error);
                                }
                            },
                        }),
                        ConfigToggle({
                            icon: 'ripples',
                            name: getString('Borders'),
                            desc: getString('Make Everything Bordered'),
                            initValue: initBorderVal,
                            onChange: async (self, newValue) => {
                                try {
                                    const border = newValue == 0 ? "noborder" : "border";
                                    await execAsync([`bash`, `-c`, `mkdir -p ${GLib.get_user_state_dir()}/ags/user && sed -i "5s/.*/${border}/"  ${GLib.get_user_state_dir()}/ags/user/colormode.txt`]);
                                    await execAsync([`bash`, `-c`, `go run ${App.configDir}/scripts/color_generation/applycolor.go`]);
                                } catch (error) {
                                    console.error('Error changing border mode:', error);
                                }
                            },
                        }),
                        ConfigSpinButton({
                            icon: 'clear_all',
                            name: getString('Choreography delay'),
                            desc: getString('In milliseconds, the delay between animations of a series'),
                            initValue: userOptions.asyncGet().animations.choreographyDelay,
                            step: 10, minValue: 0, maxValue: 1000,
                            onChange: (self, newValue) => {
                                userOptions.asyncGet().animations.choreographyDelay = newValue
                            },
                        }),
                        ConfigSeparator(),

                        ConfigSection({
                            name: getString('Hyprland'),
                            children: [
                                HyprlandToggle({ icon: 'blur_on', name: getString('Blur'), desc: getString("[Hyprland]\nEnable blur on transparent elements\nDoesn't affect performance/power consumption unless you have transparent windows."), option: "decoration:blur:enabled" }),
                                Subcategory([
                                    HyprlandToggle({ icon: 'stack_off', name: getString('X-ray'), desc: getString("[Hyprland]\nMake everything behind a window/layer except the wallpaper not rendered on its blurred surface\nRecommended to improve performance (if you don't abuse transparency/blur) "), option: "decoration:blur:xray" }),
                                    HyprlandSpinButton({ icon: 'target', name: getString('Size'), desc: getString('[Hyprland]\nAdjust the blur radius. Generally doesn\'t affect performance\nHigher = more color spread'), option: 'decoration:blur:size', minValue: 1, maxValue: 1000 }),
                                    HyprlandSpinButton({ icon: 'repeat', name: getString('Passes'), desc: getString('[Hyprland] Adjust the number of runs of the blur algorithm\nMore passes = more spread and power consumption\n4 is recommended\n2- would look weird and 6+ would look lame.'), option: 'decoration:blur:passes', minValue: 1, maxValue: 10 }),
                                    HyprlandToggle({
                                        icon: 'animation', name: getString('Animations'), desc: getString('[Hyprland] [GTK]\nEnable animations'), option: 'animations:enabled',
                                        extraOnChange: (self, newValue) => execAsync(['gsettings', 'set', 'org.gnome.desktop.interface', 'enable-animations', `${newValue}`])
                                    }),

                                ]),

                            ]
                        }),
                    ]
                }),
                ConfigSeparator(),
                ConfigSection({
                    name: getString('Developer'), children: [
                        ConfigToggle({
                            icon: 'developer_mode',
                            name: getString('Developer mode'),
                            desc: getString("Show development widgets\nCurrently controls battery widget visibility"),
                            initValue: globalThis.devMode.value,
                            onChange: (self, newValue) => {
                                globalThis.devMode.setValue(newValue);
                            },
                        }),
                        HyprlandToggle({ icon: 'speed', name: getString('Show FPS'), desc: getString("[Hyprland]\nShow FPS overlay on top-left corner"), option: "debug:overlay" }),
                        HyprlandToggle({ icon: 'sort', name: getString('Log to stdout'), desc: getString("[Hyprland]\nPrint LOG, ERR, WARN, etc. messages to the console"), option: "debug:enable_stdout_logs" }),
                        HyprlandToggle({ icon: 'motion_sensor_active', name: getString('Damage tracking'), desc: getString("[Hyprland]\nEnable damage tracking\nGenerally, leave it on.\nTurn off only when a shader doesn't work"), option: "debug:damage_tracking", enableValue: 2 }),
                        HyprlandToggle({ icon: 'destruction', name: getString('Damage blink'), desc: getString("[Hyprland] [Epilepsy warning!]\nShow screen damage flashes"), option: "debug:damage_blink" }),
                    ]
                }),
            ]
        })
    });
    return Box({
        ...props,
        className: 'spacing-v-5',
        vertical: true,
        child: mainContent
    });
}
