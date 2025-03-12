const { GLib } = imports.gi;
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import Mpris from 'resource:///com/github/Aylur/ags/service/mpris.js';
const { Box, Button, EventBox, Label, Overlay, Revealer, Scrollable } = Widget;
const { execAsync, exec } = Utils;
import { AnimatedCircProg } from "../../.commonwidgets/cairo_circularprogress.js";
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';
import scrolledmodule from '../../.commonwidgets/scrolledmodule.js';
const CUSTOM_MODULE_CONTENT_INTERVAL_FILE = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-interval.txt`;
const CUSTOM_MODULE_CONTENT_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-poll.sh`;
const CUSTOM_MODULE_LEFTCLICK_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-leftclick.sh`;
const CUSTOM_MODULE_RIGHTCLICK_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-rightclick.sh`;
const CUSTOM_MODULE_MIDDLECLICK_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-middleclick.sh`;
const CUSTOM_MODULE_SCROLLUP_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-scrollup.sh`;
const CUSTOM_MODULE_SCROLLDOWN_SCRIPT = `${GLib.get_user_cache_dir()}/ags/user/scripts/custom-module-scrolldown.sh`;

function trimTrackTitle(title) {
    if (!title) return getString ('No title');
    const cleanPatterns = [
        /【[^】]*】/,
        " [FREE DOWNLOAD]",
    ];
    return cleanPatterns.reduce((str, pattern) => str.replace(pattern, ''), title);
}

const BarGroup = ({ child }) => Box({
    className: 'bar-group-margin bar-sides',
    children: [
        Box({
            className: 'bar-group bar-group-standalone bar-group-pad-system',
            children: [child],
        }),
    ]
});

export const BarResource = (name, icon, command, circprogClassName = 'bar-batt-circprog', textClassName = 'txt-onSurfaceVariant', iconClassName = 'bar-batt') => {
    const resourceCircProg = AnimatedCircProg({
        className: `${circprogClassName}`,
        vpack: 'center',
        hpack: 'center',
    });
    const resourceLabel = Label({
        className: `txt-smallie ${textClassName}`,
    });
    const widget = Button({
        onClicked: () => Utils.execAsync(['bash', '-c', `${userOptions.asyncGet().apps.taskManager}`]).catch(print),
        child: Box({
            className: `spacing-h-4 ${textClassName}`,
            children: [
                Box({
                    homogeneous: true,
                    children: [Overlay({
                        child: Box({
                            vpack: 'center',
                            className: `${iconClassName}`,
                            homogeneous: true,
                            children: [MaterialIcon(icon, 'small')],
                        }),
                        overlays: [resourceCircProg]
                    })]
                }),
                resourceLabel,
            ],
            setup: (self) => self.poll(5000, () => {
                execAsync(['bash', '-c', command])
                    .then((output) => {
                        const value = Math.round(Number(output));
                        resourceCircProg.css = `font-size: ${value}px;`;
                        resourceLabel.label = `${value}%`;
                        widget.tooltipText = `${name}: ${value}%`;
                    }).catch(print);
            }),
        })
    });
    return widget;
}

const TrackProgress = () => {
    const _updateProgress = (circprog) => {
        const mpris = Mpris.getPlayer('');
        if (!mpris) return;
        circprog.css = `font-size: ${Math.max(mpris.position / mpris.length * 100, 0)}px;`
    }
    return AnimatedCircProg({
        className: 'bar-music-circprog',
        vpack: 'center', 
        hpack: 'center',
        setup: (self) => {
            self.hook(Mpris, () => _updateProgress(self), 'player-changed');
            self.hook(Mpris, () => _updateProgress(self), 'position');
            self.poll(3000, () => _updateProgress(self));
        },
    });
}

const switchToRelativeWorkspace = async (self, num) => {
    try {
        const Hyprland = (await import('resource:///com/github/Aylur/ags/service/hyprland.js')).default;
        Hyprland.messageAsync(`dispatch workspace ${num > 0 ? '+' : ''}${num}`).catch(print);
    } catch {
        execAsync([`${App.configDir}/scripts/sway/swayToRelativeWs.sh`, `${num}`]).catch(print);
    }
}

export default () => {
    const playingState = Box({
        homogeneous: true,
        children: [Overlay({
            child: Box({
                vpack: 'center',
                className: 'bar-music-playstate',
                homogeneous: true,
                children: [Label({
                    vpack: 'center',
                    className: 'bar-music-playstate-txt',
                    justification: 'center',
                    setup: (self) => self.hook(Mpris, () => {
                        const mpris = Mpris.getPlayer('');
                        self.label = mpris?.playBackStatus === 'Playing' ? 'pause' : 'play_arrow';
                    }),
                })],
                setup: (self) => self.hook(Mpris, () => {
                    const mpris = Mpris.getPlayer('');
                    if (!mpris) return;
                    self.toggleClassName('bar-music-playstate-playing', mpris.playBackStatus === 'Playing');
                    self.toggleClassName('bar-music-playstate', true);
                }),
            }),
            overlays: [TrackProgress()]
        })]
    });

   const trackTitle = Label({
       hexpand: true,
       className: 'txt-smallie bar-music-txt',
       truncate: 'end',
       maxWidthChars: 12,
       setup: (self) => {
           const update = () => {
               const mpris = Mpris.getPlayer('');
               if (mpris) {
                   const trackTitle = mpris.trackTitle;
                   const trackArtists = mpris.trackArtists || [];
                   
                   // Ensure we handle empty or undefined track titles and artists gracefully
                   const title = trimTrackTitle(trackTitle) || getString('');
                   const artists = trackArtists.length ? trackArtists.join(', ') : getString('Unknown artist');
   
                   self.label = `${title}`;
               } else {
                   self.label = getString('No media');
               }
           };
   
           // Hook into MPRIS signals to update the track title when necessary
           self.hook(Mpris, update, 'player-changed');
           self.hook(Mpris, update, 'changed');
       },
   });
    const musicStuff = Box({
        className: 'spacing-h-10',
        hexpand: true,
        css:`min-width:12rem`,
        children: [playingState, trackTitle]
    });

    const SystemResourcesOrCustomModule = () => {
        if (GLib.file_test(CUSTOM_MODULE_CONTENT_SCRIPT, GLib.FileTest.EXISTS)) {
            const interval = Number(Utils.readFile(CUSTOM_MODULE_CONTENT_INTERVAL_FILE)) || 5000;
            let cachedLabel = '';
            
            const updateLabel = async (label) => {
                const newContent = await Utils.execAsync([CUSTOM_MODULE_CONTENT_SCRIPT]);
                if (newContent !== cachedLabel) {
                    cachedLabel = newContent;
                    label.label = newContent;
                }
            };

            return BarGroup({
                child: Button({
                    child: Label({
                        className: 'txt-smallie txt-onSurfaceVariant',
                        useMarkup: true,
                        setup: (self) => {
                            updateLabel(self);
                            self.poll(interval, () => updateLabel(self));
                        }
                    }),
                    onPrimaryClickRelease: () => Utils.execAsync(CUSTOM_MODULE_LEFTCLICK_SCRIPT),
                    onSecondaryClickRelease: () => Utils.execAsync(CUSTOM_MODULE_RIGHTCLICK_SCRIPT),
                    onMiddleClickRelease: () => Utils.execAsync(CUSTOM_MODULE_MIDDLECLICK_SCRIPT),
                    // onScrollUp: () => Utils.execAsync(CUSTOM_MODULE_SCROLLUP_SCRIPT),
                    // onScrollDown: () => Utils.execAsync(CUSTOM_MODULE_SCROLLDOWN_SCRIPT),
                })
            });
        }

        return BarGroup({
            child: Box({
                spacing: 4,
                hpack: 'end',
                css:`padding:0 0.8rem`,
                // hexpand: true,
                children: [
                    BarResource(getString('RAM Usage'), 'memory', 
                        `LANG=C free | awk '/^Mem/ {printf("%.2f\\n", ($3/$2) * 100)}'`,
                        'bar-ram-circprog', 'bar-ram-txt', 'bar-ram-icon'),
                        BarResource('GPU Temperature', 'thermostat',
                            `(nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader 2>/dev/null || rocm-smi --showtemp 2>/dev/null | grep -i "GPU Temperature" | awk '{print $4}' || echo "N/A") | tr -d '\n'`,
                            'bar-cpu-circprog', 'bar-cpu-txt', 'bar-cpu-icon'),
                    BarResource(getString('CPU Usage'), 'settings_motion_mode',
                        `LANG=C top -bn1 | grep Cpu | sed 's/\\,/\\./g' | awk '{print $2}'`,
                        'bar-cpu-circprog', 'bar-cpu-txt', 'bar-cpu-icon'),
                ],
            })
        });
    };

    return EventBox({
        // onScrollUp: (self) => switchToRelativeWorkspace(self, -1),
        // onScrollDown: (self) => switchToRelativeWorkspace(self, +1),
        child: Box({
            spacing: 4,
            children: [
                ...(userOptions.asyncGet().bar.elements.showResources? [
                scrolledmodule({
                    children: [
                        Widget.Box({hexpand:true, hpack:'end',children:[SystemResourcesOrCustomModule(),]}),
                    ]
                })]:[]),
                ...(userOptions.asyncGet().bar.elements.showMusic? [BarGroup({ 
                    child: EventBox({
                    child: BarGroup({ child: musicStuff }),
                    onPrimaryClick: () => App.toggleWindow('music'),
                    onSecondaryClick: () => execAsync(['bash', '-c', 'playerctl next || playerctl position `bc <<< "100 * $(playerctl metadata mpris:length) / 1000000 / 100"` &']).catch(print),
                    onMiddleClick: () => execAsync('playerctl play-pause').catch(print),
                    setup: (self) => self.on('button-press-event', (_, event) => {
                        if (event.get_button()[1] === 8)
                            execAsync('playerctl previous').catch(print);
                    }),
                })
            })] : []),
            ]
        })
    });
}
