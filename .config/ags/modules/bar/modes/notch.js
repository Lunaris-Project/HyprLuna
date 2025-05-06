import Widget from "resource:///com/github/Aylur/ags/widget.js";
import { StatusIcons } from "./../../.commonwidgets/statusicons.js";
import Clock from "../modules/maclock.js";
import Complex from "../modules/weather.js";
import Battery from "../modules/battery.js";
import WindowTitle from "../modules/window_title.js";
import { RoundedCorner} from '../../.commonwidgets/cairo_roundedcorner.js';
import { changeWallpaperButton } from "../modules/utils.js";
import { setupCursorHover } from "../../.widgetutils/cursorhover.js";
import scrolledmodule from "../../.commonwidgets/scrolledmodule.js";
import FocusOptionalWorkspaces  from "../focus/workspaces_hyprland.js";
const PowerBtn = () => Widget.Button({
  vpack:'center',
  child: Widget.Label({
    label: "power_settings_new",
    css:`padding:6px ;margin: 5px;`,
    className: "txt-large bar-util-btn2 icon-material onSurfaceVariant",
  }),
  onClicked: () => {
    Utils.timeout(1, () => openWindowOnAllMonitors('session'));
  }
});
const ChatGPT = () => Widget.Button({
  vpack:'center',
  hpack:'center',
  css:`padding:7px ;margin: 5px;`,
  className: "txt-large bar-util-btn2 icon-material onSurfaceVariant",
  child: Widget.Icon({icon: "deepseek-symbolic",size: 22}),
  onClicked: () => {Utils.execAsync([`xdg-open`,`https://chat.deepseek.com/`]).catch(print)},
  setup:setupCursorHover
});

const Edit = () => Widget.Button({
  vpack:'center',
  hpack:'center',
  className: "txt-large bar-util-btn2 icon-material onSurfaceVariant",
  child: Widget.Label({
    label: "edit",
  }),
  onClicked: () => {
    Utils.execAsync([`nvim ~/.ags/config.jsonc`]).catch(print);
  },
  setup:setupCursorHover
});
const GH = () => Widget.Button({
  vpack:'center',
  hpack:'center',
  css:`padding:6px ;margin: 5px;`,
  className: "txt-large bar-util-btn2 icon-material onSurfaceVariant",
  child: Widget.Icon({
    icon: "github-symbolic",
    size: 26,
  }),
  onClicked: () => {
    Utils.execAsync([`xdg-open`,`https://www.github.com/`]).catch(print);
  },
  setup:setupCursorHover
});

export const NotchBar = Widget.CenterBox({
  startWidget:
  Widget.Box({
    vpack:'center',
    css: "margin-left:2rem;",
    spacing: 10,
    children: [
      Battery(),
      Widget.Box({child:await FocusOptionalWorkspaces(),css:`padding:6px 20px;`,hpack:"center",className: "bar-util-btn2 ",vpack:'center',}),
    ],
  }),
  centerWidget:
  Widget.Box({
    children: [
      scrolledmodule({children:[
        ChatGPT(),
        GH(),
      ]}),
      Widget.Box({
        children:[
          RoundedCorner('topright', {className: 'corner'}),
          Widget.Box({
            className: "bar-notch shadow-window-light",
            css:`min-height: 3.364rem;`,
            hpack:"center",
            children: [
              Complex(),
            ],
          }),
          RoundedCorner('topleft', {className: 'corner'}),
        ]
      }),
      scrolledmodule({children:[
        Widget.Box({child:changeWallpaperButton(),css:`padding:6px 8px`,className: "bar-util-btn2 ",hpack:'center',vpack:'center',}),
        Widget.Box({child:Edit(),css:`padding:6px 8px`,className: "bar-util-btn2 ",hpack:'center',vpack:'center',}),

      ]}),
    ]
  }),
  endWidget:
  Widget.Box({
    hpack:"end",
    spacing: 10,
    css:`margin-right:1.4rem`,
    children:[
      Widget.Box({child:Clock(),css:`padding:6px 15px`,className: "bar-util-btn2 ",vpack:'center',}),
      Widget.Box({child:StatusIcons(),css:`padding:6px 15px`,className: "bar-util-btn2 ",vpack:'center',}),
      PowerBtn(),
    ]
  })
});
