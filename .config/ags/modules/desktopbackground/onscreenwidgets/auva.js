// Inspired by original Auva widget "Conky" By "Closebox73" Made for HyprLuna
import Widget from "resource:///com/github/Aylur/ags/widget.js";
import WeatherService from "../../../services/weather.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import { AnimatedCircProg } from "../../.commonwidgets/cairo_circularprogress.js";
import { MaterialIcon } from "../../.commonwidgets/materialicon.js";
const { GLib } = imports.gi;
const { execAsync, exec } = Utils;
const { Box, Label, Button, Revealer, Overlay, EventBox } = Widget;
const Time = () => {
  const now = GLib.DateTime.new_now_local();
  const currentHour = now.get_hour();
  let dayTime;

  if (currentHour >= 5 && currentHour < 8) {
    dayTime = "dawn";
  } else if (currentHour >= 8 && currentHour < 12) {
    dayTime = "morning";
  } else if (currentHour >= 12 && currentHour < 14) {
    dayTime = "noon";
  } else if (currentHour >= 14 && currentHour < 18) {
    dayTime = "afternoon";
  } else if (currentHour >= 18 && currentHour < 21) {
    dayTime = "evening";
  } else {
    dayTime = "night";
  }

  return Box({
    spacing: 15,
    vertical: true,
    children: [
      Box({
        hpack: "start",
        children: [
          Label({
            className: "auva-day",
            label: `it's `,
          }),
          Label({
            className: "auva-day-color",
            label: now.format("%A"),
          }),
        ],
      }),
      Label({
        className: "auva-greeting",
        label: `HOPE YOUR ${dayTime} IS GOING WELL.`,
        xalign: 0,
      }),
      Label({
        className: "auva-greeting",
        label: GLib.get_real_name(),
        xalign: 0,
      }),
      Box({
        className: "auva-clock-box",
        hexpand: false,
        hpack: "start",
        children: [
          Label({
            className: "auva-clock",
            label: now.format(userOptions.asyncGet().time.format + " %p"),
            setup: (self) =>
              self.poll(userOptions.asyncGet().time.interval, (label) => {
                label.label = GLib.DateTime.new_now_local().format(
                  userOptions.asyncGet().time.format + " %p"
                );
              }),
          }),
        ],
      }),
      Label({
        className: "auva-weather",
        xalign: 0,
        setup: (self) =>
          self.hook(WeatherService, () => {
            self.label = "Current temperature is " + WeatherService.temperature;
          }),
      }),
      Label({
        className: "auva-weather",
        xalign: 0,
        setup: (self) =>
          self.hook(WeatherService, () => {
            self.label = `Feels ${WeatherService.feelsLike} in ${
              userOptions.asyncGet().weather.city
            }`;
          }),
      }),
    ],
  });
};

const ResourceValue = (
  name,
  icon,
  interval,
  valueUpdateCmd,
  displayFunc,
  props = {}
) =>
  Box({
    ...props,
    className: "bg-system-bg txt auva-resource-container",
    vpack: "center", // Ensure vertical centering
    hpack: "center", // Ensure horizontal centering
    children: [
      Overlay({
        child: AnimatedCircProg({
          className: "auva-circprog-main",
          extraSetup: (self) =>
            self.poll(interval, (self) => {
              execAsync(["bash", "-c", `${valueUpdateCmd}`])
                .then((newValue) => {
                  self.css = `font-size: ${Math.round(newValue)}px;`;
                })
                .catch(print);
            }),
        }),
        overlays: [
          // Use the same approach as in system.js with exact same parameters
          MaterialIcon(`${icon}`, "hugeass")
        ],
        // Ensure the overlay is centered
        hpack: "center",
        vpack: "center",
        setup: (self) =>
          self.set_overlay_pass_through(self.get_children()[1], true),
      }),
    ],
  });
const resources = Box({
  spacing: 15,
  className: "spacing-h-15", // Changed from spacing-v-15 to spacing-h-15 for horizontal layout
  // vertical: false, // Ensure horizontal layout
  // hpack: "center", // Center the resources horizontally
  children: [
    ResourceValue(
      "Memory",
      "memory",
      10000,
      `free | awk '/^Mem/ {printf("%.2f\\n", ($3/$2) * 100)}'`,
      (label) => {
        execAsync([
          "bash",
          "-c",
          `free -h | awk '/^Mem/ {print $3 " / " $2}' | sed 's/Gi/Gib/g'`,
        ])
          .then((output) => {
            label.label = `${output}`;
          })
          .catch(print);
      },
      { hpack: "center", vpack: "center" }
    ),
    ResourceValue(
      "Swap",
      "swap_horiz",
      10000,
      `free | awk '/^Swap/ {if ($2 > 0) printf("%.2f\\n", ($3/$2) * 100); else print "0";}'`,
      (label) => {
        execAsync([
          "bash",
          "-c",
          `free -h | awk '/^Swap/ {if ($2 != "0") print $3 " / " $2; else print "No swap"}' | sed 's/Gi/Gib/g'`,
        ])
          .then((output) => {
            label.label = `${output}`;
          })
          .catch(print);
      },
      { hpack: "center", vpack: "center" }
    ),
    ResourceValue(
      "Disk space",
      "hard_drive_2",
      3600000,
      `echo $(df --output=pcent / | tr -dc '0-9')`,
      (label) => {
        execAsync([
          "bash",
          "-c",
          `df -h --output=avail / | awk 'NR==2{print $1}'`,
        ])
          .then((output) => {
            label.label = `${output} available`;
          })
          .catch(print);
      },
      { hpack: "center", vpack: "center" }
    ),
  ],
});

export default () =>
  Box({
    hpack: "start",
    vpack: "end",
    vertical: true,
    css: `margin:0 0 2.5rem 3rem`,
    spacing: 35,
    children: [Time(), resources],
  });
