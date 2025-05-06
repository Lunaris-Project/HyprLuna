const { Gio } = imports.gi;
import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
const { Box, Button, Label } = Widget;
import { MaterialIcon } from "../../.commonwidgets/materialicon.js";
import { setupCursorHover } from "../../.widgetutils/cursorhover.js";
import { TimerWidget } from "./timers.js";
import { TodoWidget } from "./todolist.js";
import { getCalendarLayout } from "./calendar_layout.js";
import AudioFiles from "./media.js";
import { PrayerTimesWidget } from "../prayertimes.js";
let calendarJson = getCalendarLayout(undefined, true);
let monthshift = 0;
let userOpts = userOptions.asyncGet();

function getDateInXMonthsTime(x) {
  const currentDate = new Date();
  let targetMonth = currentDate.getMonth() + x;
  let targetYear = currentDate.getFullYear();
  targetYear += Math.floor(targetMonth / 12);
  targetMonth = ((targetMonth % 12) + 12) % 12;
  return new Date(targetYear, targetMonth, 1);
}

const weekDays = (() => {
  const currentDay = new Date().getDay(); // 0 = воскресенье, 1 = понедельник, и т.д.
  const adjustedCurrentDay = currentDay === 0 ? 6 : currentDay - 1; // Корректируем для нашего формата (пн=0, вс=6)

  return [
    { day: getString("Mo"), today: adjustedCurrentDay === 0 ? 1 : 0 },
    { day: getString("Tu"), today: adjustedCurrentDay === 1 ? 1 : 0 },
    { day: getString("We"), today: adjustedCurrentDay === 2 ? 1 : 0 },
    { day: getString("Th"), today: adjustedCurrentDay === 3 ? 1 : 0 },
    { day: getString("Fr"), today: adjustedCurrentDay === 4 ? 1 : 0 },
    { day: getString("Sa"), today: adjustedCurrentDay === 5 ? 1 : 0 },
    { day: getString("Su"), today: adjustedCurrentDay === 6 ? 1 : 0 },
  ];
})();

const CalendarDay = (day, today) =>
  Widget.Button({
    className: `sidebar-calendar-btn ${today == 1 ? "sidebar-calendar-btn-today" : today == -1 ? "sidebar-calendar-btn-othermonth" : ""}`,
    child: Widget.Overlay({
      child: Box({}),
      overlays: [
        Label({
          hpack: "center",
          className: "txt-smallie txt-semibold sidebar-calendar-btn-txt",
          label: String(day),
        }),
      ],
    }),
    setup: (self) => {
      self.connect('destroy', () => {
        // Cleanup any connected signals
        self.disconnect_by_func('clicked');
      });
    },
  });

const CalendarWidget = () => {
  // Кэшируем элементы
  const calendarMonthYear = Widget.Button({
    className: "txt txt-large sidebar-calendar-monthyear-btn",
    onClicked: () => shiftCalendarXMonths(0),
    setup: (button) => {
      button.label = `${new Date().toLocaleString("default", { month: "long" })} ${new Date().getFullYear()}`;
      setupCursorHover(button);
    },
  });

  // Оптимизированное обновление календаря
  const addCalendarChildren = (box, calendarJson) => {
    box.get_children().forEach((child) => child.destroy());
    box.children = calendarJson.map((row) =>
      Widget.Box({
        className: "spacing-h-5",
        children: row.map((day) => CalendarDay(day.day, day.today)),
      }),
    );
  };

  function shiftCalendarXMonths(x) {
    monthshift = x == 0 ? 0 : monthshift + x;
    const newDate =
      monthshift == 0 ? new Date() : getDateInXMonthsTime(monthshift);
    calendarJson = getCalendarLayout(newDate, monthshift == 0);
    calendarMonthYear.label = `${monthshift == 0 ? "" : "• "}${newDate.toLocaleString("default", { month: "long" })} ${newDate.getFullYear()}`;
    addCalendarChildren(calendarDays, calendarJson);
  }

  const calendarHeader = Widget.Box({
    className: "spacing-h-5 sidebar-calendar-header",
    setup: (box) => {
      box.pack_start(calendarMonthYear, false, false, 0);
      box.pack_end(
        Widget.Box({
          className: "spacing-h-5",
          children: [
            Button({
              className: "sidebar-calendar-monthshift-btn",
              onClicked: () => shiftCalendarXMonths(-1),
              child: MaterialIcon("chevron_left", "norm"),
              setup: setupCursorHover,
            }),
            Button({
              className: "sidebar-calendar-monthshift-btn",
              onClicked: () => shiftCalendarXMonths(1),
              child: MaterialIcon("chevron_right", "norm"),
              setup: setupCursorHover,
            }),
          ],
        }),
        false,
        false,
        0,
      );
    },
  });

  const calendarDays = Widget.Box({
    className: 'calendar-days',
    hexpand: true,
    vertical: true,
    className: "spacing-v-5",
    setup: (self) => {
      self.connect('destroy', () => {
        // Ensure child widgets are properly destroyed
        self.get_children().forEach(child => {
          if (child.destroy) child.destroy();
        });
      });
      addCalendarChildren(self, calendarJson);
    },
  });

  return Widget.EventBox({
    onScrollUp: () => shiftCalendarXMonths(-1),
    onScrollDown: () => shiftCalendarXMonths(1),
    child: Widget.Box({
      hpack: "center",
      children: [
        Widget.Box({
          hexpand: true,
          vertical: true,
          className: "spacing-v-5",
          children: [
            calendarHeader,
            Widget.Box({
              homogeneous: true,
              className: "spacing-h-5",
              children: weekDays.map((day) => CalendarDay(day.day, day.today)),
            }),
            calendarDays,
          ],
        }),
      ],
    }),
  });
};

// Define valid options for the default shown module
const validOptions = ["calendar", "todo", "media", "timers"];
if (userOpts.muslim?.enabled) {
  validOptions.push("PrayerTimes");
}

// Get the default shown module from config or fallback to "calendar"
let configDefault = userOpts.sidebar?.ModuleCalendar?.default || "calendar";
// Validate that the default is one of the valid options
const defaultShown = validOptions.includes(configDefault) ? configDefault : "calendar";

const contentStack = Widget.Stack({
  hexpand: true,
  vexpand: false,
  homogeneous: true,
  children: {
    ...(userOpts.muslim?.enabled ? { PrayerTimes: PrayerTimesWidget() } : {}),
    calendar: CalendarWidget(),
    todo: TodoWidget(),
    media: AudioFiles(),
    timers: TimerWidget(),
  },
  setup: (self) => {
    // Set the default shown to the validated default value
    self.shown = defaultShown;
  },
  transition: "slide_up_down",
  transitionDuration: userOpts.animations.durationLarge,
  // setup: (stack) => {
  //   Utils.timeout(1, () => (stack.shown = defaultShown));
  //   userOptions.subscribe(newOpts => {
  //     userOpts = newOpts;
  //     if (!newOpts.muslim?.enabled && stack.shown === "PrayerTimes") {
  //       stack.shown = "calendar";
  //     }
  //   });
  // },
});

const StackButton = (stackItemName, icon, name) =>
  Widget.Button({
    className: "button-minsize sidebar-navrail-btn txt-small spacing-h-5",
    onClicked: (button) => {
      contentStack.shown = stackItemName;
      button
        .get_parent()
        .get_children()
        .forEach((kid) => {
          kid.toggleClassName("sidebar-navrail-btn-active", kid === button);
        });
    },
    child: Box({
      className: "spacing-v-5",
      vertical: true,
      children: [
        Label({
          className: "txt icon-material txt-hugeass",
          label: icon,
        }),
        Label({
          label: name,
          className: "txt txt-smallie",
        }),
      ],
    }),
    setup: (button) =>
      Utils.timeout(1, () => {
        setupCursorHover(button);
        button.toggleClassName(
          "sidebar-navrail-btn-active",
          defaultShown === stackItemName,
        );
      }),
  });

export const ModuleCalendar = () =>
  Box({
    hexpand: true,
    className: "sidebar-group spacing-h-10",
    setup: (box) => {
      box.pack_start(
        Box({
          vpack: "center",
          // hexpand: true,
          vertical: true,
          className: "sidebar-navrail spacing-v-10",
          children: [
            ...(userOpts.muslim?.enabled ? [StackButton("PrayerTimes", "mosque", getString("Prayers"))] : []),
            StackButton("calendar", "calendar_month", getString("Calendar")),
            StackButton("todo", "done_outline", getString("To Do")),
            StackButton("media", "music_note", getString("Media")),
            StackButton("timers", "access_time", getString("Timers")),
          ],
        }),
        false,
        false,
        0,
      );
      box.pack_end(contentStack, false, false, 0);
    },
  });
