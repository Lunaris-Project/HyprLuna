import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Hyprland from 'resource:///com/github/Aylur/ags/service/hyprland.js';
export default () => Widget.Label({ css: `font-size:16.5px;font-weight:900;`, xalign: 0.4, yalign: 0.55, className: "onSurfaceVariant txt-semibold txt-monospace", label: Hyprland.active.workspace.bind('id').transform(id => ` ${id} `), });