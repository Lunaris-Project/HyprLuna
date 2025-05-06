"use strict";
import Gdk from "gi://Gdk";
import GLib from "gi://GLib";
import App from "resource:///com/github/Aylur/ags/app.js";
import Wallselect from "./modules/wallselect/main.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import userOptions from "./modules/.configuration/user_options.js";
import {
  firstRunWelcome,
  startBatteryWarningService,
} from "./services/messages.js";
import { startAutoDarkModeService } from "./services/darkmode.js";
import { Bar } from "./modules/bar/main.js";
import Cheatsheet from "./modules/cheatsheet/main.js";
import DesktopBackground from "./modules/desktopbackground/main.js";
import Dock from "./modules/dock/main.js";
import Corner from "./modules/screencorners/main.js";
import Indicator from "./modules/indicators/main.js";
import Overview from "./modules/overview/main.js";
import Session from "./modules/session/main.js";
import SideLeft from "./modules/sideleft/main.js";
import SideRight from "./modules/sideright/main.js";
import Recorder from "./modules/indicators/recorder.js";
import MusicWindow from "./modules/music/music.js";
import Glance from "./modules/overview/glance.js";
const COMPILED_STYLE_DIR = `${GLib.get_user_cache_dir()}/ags/user/generated`;
const opts = await userOptions.asyncGet();

// Import variables for bar monitor mode
import { barMonitorMode, findMonitorByName } from "./variables.js";
import Hyprland from "resource:///com/github/Aylur/ags/service/hyprland.js";

const range = (length, start = 1) =>
  Array.from({ length }, (_, i) => i + start);

function forMonitors(widget) {
  // Get the target monitor based on barMonitorMode
  const targetMonitorName = barMonitorMode.value;

  // If monitorMode is set to a specific monitor name (not "primary"),
  // and there are multiple monitors, only create widgets for the target monitor
  if (targetMonitorName !== "primary" && Hyprland.monitors.length > 1) {
    const targetMonitor = findMonitorByName(targetMonitorName);
    return [widget(targetMonitor)].flat(1);
  }

  // Otherwise, create widgets for all monitors (original behavior)
  const n = Gdk.Display.get_default()?.get_n_monitors() || 1;
  return range(n, 0).map(widget).flat(1);
}

globalThis["handleStyles"] = () => {
  // Reset Styles
  Utils.exec(`mkdir -p "${GLib.get_user_state_dir()}/ags/scss"`);
  let lightdark = darkMode.value ? "dark" : "light";
  Utils.writeFileSync(
    `@mixin symbolic-icon { -gtk-icon-theme: '${
      userOptions.asyncGet().icons.symbolicIconTheme[lightdark]
    }'}`,
    `${GLib.get_user_state_dir()}/ags/scss/_lib_mixins_overrides.scss`
  );
  // Compile and apply
  async function applyStyle() {
    Utils.exec(`mkdir -p ${COMPILED_STYLE_DIR}`);
    Utils.exec(
      `sass -I "${GLib.get_user_state_dir()}/ags/scss" -I "${
        App.configDir
      }/scss/fallback" "${
        App.configDir
      }/scss/main.scss" "${COMPILED_STYLE_DIR}/style.css"`
    );
    App.resetCss();
    App.applyCss(`${COMPILED_STYLE_DIR}/style.css`);
  }
  applyStyle().catch(print);
};

// Start stuff
handleStyles();
startBatteryWarningService().catch(print);
startAutoDarkModeService().catch(print);
firstRunWelcome().catch(print);

// Import variables for bar monitor mode and Hyprland service

// Get all available monitors
const allMonitors = Hyprland.monitors;

// Get the target monitor based on barMonitorMode
const targetMonitorName = barMonitorMode.value;
const targetMonitor = findMonitorByName(targetMonitorName);

// Only log if there are multiple monitors
if (allMonitors.length > 1) {
  console.log(`Creating bar for monitor: ${targetMonitorName} (ID: ${targetMonitor})`);
}

// Create bar for the specified monitor
Bar(targetMonitor)
  .then(([mainBar, leftCorner, rightCorner]) => {
    App.addWindow(mainBar);
    App.addWindow(leftCorner);
    App.addWindow(rightCorner);
  })
  .catch(print);
let Modules = () => [
  ...(userOptions.asyncGet().indicators.enabled !== false
    ? [forMonitors(Indicator)]
    : []),
  ...(userOptions.asyncGet().session.enabled !== false
    ? [forMonitors(Session)]
    : []),
  ...(userOptions.asyncGet().overview.enabled !== false ? [Overview()] : []),
  ...(userOptions.asyncGet().cheatsheet.enabled !== false
    ? [forMonitors(Cheatsheet)]
    : []),
  ...(userOptions.asyncGet().desktopBackground.enabled !== false
    ? [forMonitors(DesktopBackground)]
    : []),
  ...(userOptions.asyncGet().wallselect.enabled !== false
    ? [Wallselect()]
    : []),
  ...(userOptions.asyncGet().dock.enabled ? [forMonitors(Dock)] : []),
  ...(userOptions.asyncGet().appearance.fakeScreenRounding !== 0
    ? [
        forMonitors((id) =>
          Corner(id, "top left", true, opts.etc.screencorners.topleft)
        ),
        forMonitors((id) =>
          Corner(id, "top right", true, opts.etc.screencorners.topright)
        ),
        forMonitors((id) =>
          Corner(id, "bottom left", true, opts.etc.screencorners.bottomleft)
        ),
        forMonitors((id) =>
          Corner(id, "bottom right", true, opts.etc.screencorners.bottomright)
        ),
      ]
    : []),
  SideLeft(),
  Recorder(),
  MusicWindow(),
  SideRight(),
  Glance(),
];

App.config({
  css: `${COMPILED_STYLE_DIR}/style.css`,
  stackTraceOnError: true,
  windows: Modules().flat(1),
});
