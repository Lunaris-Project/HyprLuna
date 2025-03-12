import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const { GLib } = imports.gi;
const { execAsync, exec } = Utils;
const { Box, Label, Button, Revealer, EventBox } = Widget;
const TimeAndDate = () => Box({
    vertical: true,
    className: 'spacing-v--5',
    children: [
        Label({
            className: 'bg-time-clock',
            xalign: 0,
            label: GLib.DateTime.new_now_local().format(userOptions.asyncGet().time.format),
            setup: (self) => self.poll(userOptions.asyncGet().time.interval, label => {
                label.label = GLib.DateTime.new_now_local().format(userOptions.asyncGet().time.format);
            }),
        }),
        Label({
            className: 'bg-time-date',
            xalign: 0,
            label: GLib.DateTime.new_now_local().format(userOptions.asyncGet().time.dateFormatLong),
            setup: (self) => self.poll(userOptions.asyncGet().time.dateInterval, (label) => {
                label.label = GLib.DateTime.new_now_local().format(userOptions.asyncGet().time.dateFormatLong);
            }),
        }),
    ]
})

export default () => Box({
    hpack: 'start',
    vpack: 'end',
    vertical: true,
    css: `margin:0 4rem 2rem`,
    className: 'bg-time-box spacing-h--10',
    children: [
        TimeAndDate(),
    ],
})

