import Widget from "resource:///com/github/Aylur/ags/widget.js";
const { GLib } = imports.gi;
const hourFormat = "%I";
const minuteFormat = "%M";
const secondFormat = "%S";
const dayTimeFormat = "%p";
const dateFormat = userOptions.asyncGet().time.dateFormatLong;
const hours = Variable("", {
  poll: [
    userOptions.asyncGet().time.interval,
    () => GLib.DateTime.new_now_local().format(hourFormat),
  ],
});

const minutes = Variable("", {
  poll: [
    userOptions.asyncGet().time.interval,
    () => GLib.DateTime.new_now_local().format(minuteFormat),
  ],
});

const seconds = Variable("", {
  poll: [
    userOptions.asyncGet().time.interval,
    () => GLib.DateTime.new_now_local().format(secondFormat),
  ],
});

const dayTime = Variable("", {
  poll: [
    userOptions.asyncGet().time.interval,
    () => GLib.DateTime.new_now_local().format(dayTimeFormat),
  ],
});
const date = Variable("", {
  poll: [
    userOptions.asyncGet().time.dateInterval,
    () => GLib.DateTime.new_now_local().format(dateFormat),
  ],
});

const verticalCLock = () =>
  Widget.EventBox({
    onPrimaryClick: () => {
      App.toggleWindow("sideright");
    },
    child: Widget.Box({
      vpack: "end",
      vertical: true,
      hpack:"center",
      hexpand:true,
      className:"bar-group-pad-vertical bar-group txt-large",
      css:`padding:15px 5px`,
      tooltipText:date.bind(),
      children: [
        userOptions.asyncGet().time.verticalCLock.showHours ? Widget.Label({
          className: "bar-time",
          label: hours.bind(),
          xalign:0.5
        }) : null,
        userOptions.asyncGet().time.verticalCLock.showMinutes ? Widget.Label({
          className: "bar-time",
          label: minutes.bind(),
          xalign:0.5
        }) : null,
        userOptions.asyncGet().time.verticalCLock.showSeconds ? Widget.Label({
          className: "bar-time",
          label: seconds.bind(),
          xalign:0.5
        }): null,
        userOptions.asyncGet().time.verticalCLock.showDayTime ? Widget.Label({
          className: "bar-time",
          label: dayTime.bind(),
          xalign:0.5
        }) : null
      ],
    }),
  });
export default () => verticalCLock();
