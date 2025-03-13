import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
const { Box, Label, EventBox } = Widget;
const { GLib } = imports.gi;
import fetcher from "./fetcher.js";
const options = userOptions.asyncGet();
const timeFormat = options.time.format;
const dateFormat = options.time.dateFormatLong;
import { Revealer } from "resource:///com/github/Aylur/ags/widget.js";
import { RevealerState } from "./revealercontrol.js";

const time = Variable("", {
  poll: [
    options.time.interval,
    () => GLib.DateTime.new_now_local().format(timeFormat),
  ],
});

const date = Variable("", {
  poll: [
    options.time.dateInterval,
    () => GLib.DateTime.new_now_local().format(dateFormat),
  ],
});

const BarClock = () =>
  Widget.EventBox({
    onPrimaryClick: () => {
      musicRevealer.revealChild = !musicRevealer.revealChild;
    },
    child: Widget.Box({
      vpack: "center",
      className: "spacing-h-4 bar-clock-box txt-norm",
      children: [
        Widget.Label({
          className: "bar-time",
          label: time.bind(),
        }),
        Widget.Label({
          className: "txt-small txt-onLayer1",
          label: "•",
        }),
        Widget.Label({
          className: "txt-smallie bar-date",
          label: date.bind(),
        }),
      ],
    }),
  });

const musicRevealer = RevealerState.register(Revealer({
  transitionDuration: options.animations.durationLarge,
  transition: "slide_right",
  revealChild: false,
  child: fetcher(),
}));

export default (props = {}) =>
  Widget.EventBox({
    ...props,
    onPrimaryClick: () => musicRevealer.revealChild = !musicRevealer.revealChild,
    onSecondaryClick: () => App.toggleWindow("wallselect"),
    onMiddleClick: () => {
      Utils.execAsync(["hyprpicker", "-a"]).catch(print);
    },
    child: Widget.Box({
      children: [BarClock(),],
    }),
  });
