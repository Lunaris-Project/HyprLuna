import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
const { Box, Label, Button, Overlay, Revealer, Scrollable, Stack, EventBox } =
  Widget;
const { exec, execAsync } = Utils;
const { GLib } = imports.gi;
import Battery from "resource:///com/github/Aylur/ags/service/battery.js";
import { MaterialIcon } from "../../.commonwidgets/materialicon.js";
import { AnimatedCircProg } from "../../.commonwidgets/cairo_circularprogress.js";
import {
  WWO_CODE,
  WEATHER_SYMBOL,
  NIGHT_WEATHER_SYMBOL,
} from "../../.commondata/weather.js";

// const userOptions = userOptions.asyncGet();
const options = userOptions.asyncGet();
const WEATHER_CACHE_FOLDER = `${GLib.get_user_cache_dir()}/ags/weather`;
const WEATHER_CACHE_PATH = WEATHER_CACHE_FOLDER + "/wttr.in.txt";
Utils.exec(`mkdir -p ${WEATHER_CACHE_FOLDER}`);

const batteryProgressCache = new Map();
const BarBatteryProgress = () => {
  const _updateProgress = (circprog) => {
    const percent = Battery.percent;
    const key = `${percent}-${Battery.charged}`;

    if (!batteryProgressCache.has(key)) {
      const css = `font-size: ${Math.abs(percent)}px;`;
      batteryProgressCache.set(key, css);
    }

    circprog.css = batteryProgressCache.get(key);
    circprog.toggleClassName(
      "bar-batt-circprog-low",
      percent <= options.battery.low,
    );
    circprog.toggleClassName("bar-batt-circprog-full", Battery.charged);
  };

  return AnimatedCircProg({
    className: "bar-batt-circprog",
    vpack: "center",
    hpack: "center",
    extraSetup: (self) => self.hook(Battery, _updateProgress),
  });
};

const timeFormat = options.time.format;
const dateFormat = options.time.dateFormatLong;

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
  Widget.Box({
    vpack: "center",
    className: "spacing-h-4 bar-clock-box",
    children: [
      Widget.Label({
        className: "bar-time",
        label: time.bind(),
      }),
      Widget.Label({
        className: "txt-norm txt-onLayer1",
        label: "•",
      }),
      Widget.Label({
        className: "txt-smallie bar-date",
        label: date.bind(),
      }),
    ],
  });

const utilButtonCache = new Map();
const UtilButton = ({ name, icon, onClicked }) => {
  const key = `${name}-${icon}`;
  if (!utilButtonCache.has(key)) {
    utilButtonCache.set(
      key,
      Button({
        vpack: "center",
        tooltipText: name,
        onClicked: onClicked,
        className: "bar-util-btn icon-material txt-norm",
        label: `${icon}`,
      }),
    );
  }
  return utilButtonCache.get(key);
};

const Utilities = () => {
  let unsubscriber = () => {};
  let wallpaperFolder = "";
  let showWallpaperButton = false;  // More descriptive variable name

  const changeWallpaperButton = Widget.Button({
    vpack: "center",
    tooltipText: getString("Change wallpaper"),
    onClicked: () => App.toggleWindow("wallselect"),
    className: "bar-util-btn icon-material txt-norm",
    label: "image",
  });

 const screenSnipButton = Widget.Button({
    vpack: "center",
    tooltipText: getString("Screen snip"),
    onClicked: () => {
      Utils.execAsync(
        `${App.configDir}/scripts/grimblast.sh copy area`,
      ).catch(print);
    },
    className: "bar-util-btn icon-material txt-norm",
    label: "screenshot_region",
  });

  const colorPickerButton = Widget.Button({
    vpack: "center",
    tooltipText: getString("Color picker"),
    onClicked: () => {
      Utils.execAsync(["hyprpicker", "-a"]).catch(print);
    },
    className: "bar-util-btn icon-material txt-norm",
    label: "colorize",
  });


  const keyboardButton = Widget.Button({
    vpack: "center",
    tooltipText: getString("Toggle on-screen keyboard"),
    onClicked: () => {
      App.toggleWindow("osk"); // Use App.toggleWindow for consistency.  If you have a custom function, replace this.
    },
    className: "bar-util-btn icon-material txt-norm",
    label: "keyboard",
  });


  const box = Box({
    hpack: "center",
    className: "spacing-h-4",
    children: [
      screenSnipButton,
      colorPickerButton,
      keyboardButton,
    ],
  });

  unsubscriber = userOptions.subscribe((options) => {
    wallpaperFolder = options.bar.wallpaper_folder;
    const shouldShow = typeof wallpaperFolder === "string";

    if (shouldShow !== showWallpaperButton) {
      showWallpaperButton = shouldShow;
      if (shouldShow) {
        box.add(changeWallpaperButton);
      } else {
        box.remove(changeWallpaperButton);
      }
    }
  });

  box.on("destroy", unsubscriber);
  return box;
};

const WeatherWidget = () => {
  const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
  let lastUpdate = 0;
  let cachedData = null;

  const getLocation = async () => {
    try {
      const response = await execAsync(['curl', '-s', '-k', 'https://ipapi.co/json/']);
      const data = JSON.parse(response);
      return data.city || userOptions.weather?.city || 'Cairo';
    } catch (err) {
      return userOptions.weather?.city || 'Cairo';
    }
  };

  const updateWeatherForCity = async (city) => {
    // Check cache first
    const now = Date.now();
    if (cachedData && (now - lastUpdate) < CACHE_DURATION) {
      return cachedData;
    }

    try {
      const encodedCity = encodeURIComponent(city.trim());
      const cmd = ['curl', '-s', '-k', '--connect-timeout', '5', `https://wttr.in/${encodedCity}?format=j1`];
      const response = await execAsync(cmd);

      if (!response) {
        throw new Error('Empty response from weather API');
      }

      const data = JSON.parse(response);
      if (!data || !data.current_condition || !data.current_condition[0]) {
        throw new Error('Invalid weather data format');
      }

      const weatherData = {
        temp: data.current_condition[0].temp_C,
        feelsLike: data.current_condition[0].FeelsLikeC,
        weatherDesc: data.current_condition[0].weatherDesc[0].value,
        weatherCode: data.current_condition[0].weatherCode,
      };

      // Update cache
      cachedData = weatherData;
      lastUpdate = now;

      return weatherData;
    } catch (err) {
      return null;
    }
  };

  const updateWidget = async () => {
    try {
      const city = await getLocation();
      const weatherData = await updateWeatherForCity(city);

      if (!weatherData) {
        tempLabel.label = "N/A";
        feelsLikeLabel.label = "";
        feelsLikeTextLabel.visible = false;
        tempLabel.tooltipText = "Weather data unavailable";
        return;
      }

      const { temp, feelsLike, weatherDesc } = weatherData;
      tempLabel.label = `${temp}°C  `;
      feelsLikeLabel.label = ` ${feelsLike}°C   `;
      feelsLikeTextLabel.visible = true;
      tempLabel.tooltipText = `${weatherDesc}\nFeels like: ${feelsLike}°C`;
    } catch (err) {
      tempLabel.label = "N/A";
      feelsLikeLabel.label = "";
      feelsLikeTextLabel.visible = false;
      tempLabel.tooltipText = "Weather data unavailable";
    }
  };

  const tempLabel = Widget.Label({
    className: "txt-small txt",
    label: "Loading...",
  });

  const feelsLikeTextLabel = Widget.Label({
    className: "txt-smalltxt-onLayer1",
    label: "Feels like",
  });

  const feelsLikeLabel = Widget.Label({
    className: "txt-small txt-onLayer1",
    label: "",
  });

  const weatherBox = Box({
    hexpand: true,
    hpack: 'center',
    className: 'spacing-h-4 bar-group-pad txt-onSurfaceVariant',
    css: "min-width:5rem",
    children: [
      MaterialIcon('device_thermostat', 'small'),
      Box({
        className: 'spacing-h-2',
        children: [
          tempLabel,
          feelsLikeTextLabel,
          feelsLikeLabel
        ]
      })
    ],
    setup: self => {
      // Initial update
      updateWidget();

      // Update every 15 minutes
      self.poll(900000, () => {
        updateWidget();
        return true;
      });
    }
  });

  return weatherBox;
};

const BarBattery = () => {
  const chargingIcon = MaterialIcon("bolt", "norm", { tooltipText: "Charging" });
  const chargingRevealer = Revealer({
    transitionDuration: userOptions.asyncGet().animations.durationSmall,
    revealChild: false,
    transition: "slide_right",
    child: chargingIcon,
    setup: (self) =>
      self.hook(Battery, () => {
        self.revealChild = Battery.charging;
      }),
  });

  const percentLabel = Label({
    className: "txt-smallie",
    setup: (self) =>
      self.hook(Battery, () => {
        self.label = `${Number.parseFloat(Battery.percent.toFixed(1))}%`;
      }),
  });

  const batteryIcon = Widget.Box({
    vpack: "center",
    className: "bar-batt",
    homogeneous: true,
    children: [MaterialIcon("battery_full", "small")],
    setup: (self) =>
      self.hook(Battery, () => {
        self.toggleClassName(
          "bar-batt-low",
          Battery.percent <= userOptions.asyncGet().battery.low,
        );
        self.toggleClassName("bar-batt-full", Battery.charged);
      }),
  });

  return Box({
    className: "spacing-h-4 bar-batt-txt",
    children: [
      chargingRevealer,
      percentLabel,
      Overlay({
        child: batteryIcon,
        overlays: [BarBatteryProgress()],
      }),
    ],
  });
};

const BarGroup = ({ child }) =>
  Widget.Box({
    className: "bar-group-margin bar-sides",
    children: [
      Widget.Box({
        className: "bar-group bar-group-standalone bar-group-pad-system",
        children: [child],
      }),
    ],
  });

const BatteryModule = () => {
  // Check if battery is available
  if (!Battery?.available) {
    // Return only utilities without battery for non-battery devices
    return Box({
      className: "spacing-h-5",
      children: [BarGroup({ child: Utilities() })],
    });
  }

  // For devices with battery, return both utilities and battery
  return Box({
    className: "spacing-h-5",
    children: [
      BarGroup({ child: Utilities() }),
      BarGroup({ child: BarBattery() }),
    ],
  });
};

export default () =>
  Widget.EventBox({
    // onScrollUp: (self) => switchToRelativeWorkspace(self, -1),
    // onScrollDown: (self) => switchToRelativeWorkspace(self, +1),
    onPrimaryClick: () => App.toggleWindow("sideright"),
    child: Widget.Box({
      className: "spacing-h-5",
      children: [

          Widget.Box({
            className: "spacing-h-5",
            children: [
              BarGroup({ child: BarClock() }),
              BarGroup({ child: WeatherWidget() }),
              BarGroup({ child: BatteryModule() }),
            ],
          }),

      ],
    }),
  });
