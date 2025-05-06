import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import App from "resource:///com/github/Aylur/ags/app.js";
const { Box, Button } = Widget;
const { GLib } = imports.gi;
import { setupCursorHover } from "../../.widgetutils/cursorhover.js";

const createUtilButton = ({ name, icon, onClicked, onSecondaryClick, setup }) => {
  const buttonProps = {
    vpack: "center",
    tooltipText: name,
    onClicked,
    className: "icon-material onSurfaceVariant txt-larger",
    label: icon, // No need for template literal here
    setup:setupCursorHover
  };
  
  if (onSecondaryClick) {
    buttonProps.onSecondaryClick = onSecondaryClick;
  }
  
  return Button(buttonProps);
};

const createNerdButton = ({ name, icon, onClicked, onSecondaryClick }) => {
  const buttonProps = {
    vpack: "center",
    tooltipText: name,
    onClicked,
    className: "icon-nerd onSurfaceVariant txt-norm",
    label: icon, // No need for template literal here
  };
  
  if (onSecondaryClick) {
    buttonProps.onSecondaryClick = onSecondaryClick;
  }
  
  return Button(buttonProps);
};

let wallpaperFolder = "";

const changeWallpaperButton = () => createUtilButton({
  name: "Change wallpaper",
  icon: "image",
  onClicked: () => Utils.execAsync([
    `${App.configDir}/scripts/color_generation/randomwall.sh`
  ]),
  onSecondaryClick: () => App.toggleWindow("wallselect"),
  setup: setupCursorHover,
});

const geminiScreenshotButton = () => createUtilButton({
  name: "Analyze screenshot with AI",
  icon: "screenshot_region",
  onClicked: () => {
    const { sendScreenshotToGemini } = globalThis;
    if (sendScreenshotToGemini) {
      sendScreenshotToGemini();
    } else {
      Utils.execAsync(['notify-send', 'Error', 'Screenshot to Gemini not available']);
    }
  },
});

const Shortcuts = () => {
  let unsubscriber = () => {};
  let showWallpaperButton = false;

  const unixporn = createUtilButton({
    name: "Unix Porn",
    icon: "\udb81\udfea ",
    onClicked: () => Utils.execAsync(`windsurf ${App.configDir}`),
    onSecondaryClicked: () => Utils.execAsync(`xdg-open "https://www.reddit.com/r/unixporn/"`),
  });

  const collage = createUtilButton({
    name: "LMS site",
    icon: "ecg_heart",
    onClicked: () => Utils.execAsync(`firefox --new-window http://lms.nv.edu.eg`),
  });

  const gitHubButton = createNerdButton({
    name: "GitHub",
    icon: "\uea84 ",
    onClicked: () => Utils.execAsync(`firefox --new-window github.com/Lunaris-Project`),
  });

  const yt = createNerdButton({
    name: "YT",
    icon: "\uf166 ",
    onClicked: () => Utils.execAsync(`firefox --new-window youtube.com`),
  });

  const agsTweaksButton = createUtilButton({
    name: "Settings",
    icon: "water_drop",
    onClicked: () => Utils.execAsync([
      "bash",
      "-c",
      `${GLib.get_home_dir()}/.local/bin/ags-tweaks`,
    ]),
  });

  const screenSnipButton = createUtilButton({
    name: "Screen snip",
    icon: "screenshot_region",
    onClicked: () => Utils.execAsync(`${App.configDir}/scripts/grimblast.sh copy area`).catch(print),
  });

  const colorPickerButton = createUtilButton({
    name: "Color picker",
    icon: "colorize",
    onClicked: () => Utils.execAsync(["hyprpicker", "-a"]).catch(print),
  });

  const box = Box({
    className: "spacing-h-5",
    children: [
      geminiScreenshotButton(),
      yt,
      gitHubButton,
      unixporn,
      // Widget.Label({label: "  "}),
      collage,
      agsTweaksButton,
      screenSnipButton,
      colorPickerButton,
      // changeWallpaperButton(),
    ],
  });

  unsubscriber = userOptions.subscribe((options) => {
    wallpaperFolder = options.bar.wallpaper_folder;
    const shouldShow = typeof wallpaperFolder === "string";

    if (shouldShow !== showWallpaperButton) {
      showWallpaperButton = shouldShow;
      if (shouldShow) {
        box.add(changeWallpaperButton());
      } else {
        box.remove(changeWallpaperButton());
      }
    }
  });

  box.on("destroy", unsubscriber);

  return box;
};

export default Shortcuts;
export { changeWallpaperButton, wallpaperFolder };