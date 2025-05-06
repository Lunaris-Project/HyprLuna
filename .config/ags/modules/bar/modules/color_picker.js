const { Gio, GLib } = imports.gi;
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import { setupCursorHover } from '../../.widgetutils/cursorhover.js';
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';
import { darkMode } from '../../.miscutils/system.js';
const LIGHTDARK_FILE = `${GLib.get_user_state_dir()}/ags/user/colormode.txt`;

const schemeOptions = [
    { icon: 'palette', value: 'scheme-tonal-spot', tooltip: 'Tonal Spot' },
    { icon: 'restaurant', value: 'scheme-fruit-salad', tooltip: 'Fruit Salad' },
    { icon: 'music_note', value: 'scheme-fidelity', tooltip: 'Fidelity' },
    { icon: 'looks', value: 'scheme-rainbow', tooltip: 'Rainbow' },
    { icon: 'tonality', value: 'scheme-neutral', tooltip: 'Neutral' },
    { icon: 'contrast', value: 'scheme-monochrome', tooltip: 'Monochrome' },
    { icon: 'theater_comedy', value: 'scheme-expressive', tooltip: 'Expressive' },
    { icon: 'favorite', value: 'scheme-content', tooltip: 'Vibrant' },
];

const ColorButton = ({ icon, value, tooltip }) => Widget.Button({
    className: 'bar-colorscheme-btn onSurfaceVariant',
    tooltipText: tooltip,
    onClicked: () => {
        Utils.execAsync([`bash`, `-c`, 
            `mkdir -p ${GLib.get_user_state_dir()}/ags/user && ` +
            `sed -i "3s/.*/${value}/" ${LIGHTDARK_FILE} && ` +
            `matugen image ${currentShellMode} -t ${value}`
        ]).catch(print);
    },
    setup: setupCursorHover,
    child: MaterialIcon(icon, 'large'),
});

const DarkModeToggle = () => {
    const stack = Widget.Stack({
        transition: 'slide_left_right',
        transitionDuration: userOptions.asyncGet().animations.durationSmall,
        children: {
            'light': MaterialIcon('light_mode', 'large'),
            'dark': MaterialIcon('dark_mode', 'large'),
        },
    });
    
    return Widget.Button({
        className: 'bar-colorscheme-btn onSurfaceVariant',
        tooltipText: 'Toggle Dark Mode',
        onClicked: () => {
            darkMode.value = !darkMode.value;
        },
        setup: (self) => {
            self.hook(darkMode, () => {
                stack.shown = darkMode.value ? 'dark' : 'light';
            });
            setupCursorHover(self);
        },
        child: stack,
    });
};

const TransparencyToggle = () => {
    const currentTransparency = Utils.exec(`bash -c "sed -n '2p' ${LIGHTDARK_FILE}"`);
    const isTransparent = currentTransparency.trim() === "transparent";
    
    const stack = Widget.Stack({
        transition: 'slide_left_right',
        transitionDuration: userOptions.asyncGet().animations.durationSmall,
        children: {
            'opaque': MaterialIcon('blur_off', 'large'),
            'transparent': MaterialIcon('blur_on', 'large'),
        },
    });

    return Widget.Button({
        className: 'bar-colorscheme-btn onSurfaceVariant',
        tooltipText: 'Toggle Transparency',
        onClicked: (self) => {
            self._isTransparent = !self._isTransparent;
            stack.shown = self._isTransparent ? 'transparent' : 'opaque';
            const newValue = self._isTransparent ? "transparent" : "opaque";
            Utils.execAsync([`bash`, `-c`,
                `mkdir -p ${GLib.get_user_state_dir()}/ags/user && ` +
                `sed -i "2s/.*/${newValue}/" ${LIGHTDARK_FILE} && ` +
                `go run ${App.configDir}/scripts/color_generation/applycolor.go`
            ]).catch(print);
        },
        setup: (self) => {
            self._isTransparent = isTransparent;
            stack.shown = isTransparent ? 'transparent' : 'opaque';
            setupCursorHover(self);
        },
        child: stack,
    });
};

export default () => Widget.Box({
    className: 'spacing-h-5 bar-group-margin onSurfaceVariant bar-colorscheme',
    child: Widget.Box({
        spacing: 8,
        children: [
            DarkModeToggle(),
            TransparencyToggle(),
            Widget.Label({ css:`padding:0 8px`,className: 'txt-norm onSurfaceVariant',label:"|" }),
            ...schemeOptions.map(opt => ColorButton(opt)),
        ],
    }),
});
