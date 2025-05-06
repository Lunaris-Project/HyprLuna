import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import battery from "../modules/battery.js";
import BarResources from "../modules/resourcesbar.js";
import Media from "../modules/music.js";
import simpleClock from "../modules/simple_clock.js";
import { StatusIcons } from "../../.commonwidgets/statusicons.js";
import NormalOptionalWorkspaces from "./../normal/workspaces_hyprland.js";
import kb_layout from "../modules/kb_layout.js";
import Fetcher from "../modules/fetcher.js";
import scrolledmodule from "../../.commonwidgets/scrolledmodule.js";

const RevealOnSideLeft = () => {
    const revealer = Widget.Revealer({
        transition: 'slide_left',
        transitionDuration: userOptions.asyncGet().animations.durationLarge,
        child: Widget.Box({
            className: 'bar-group-margin bar-knocks bar-sides txt-large onSurfaceVariant',
            css:`padding:0 1.5rem`,
            spacing: 5,
            children: [
              Widget.Icon({
                icon: 'go-previous-symbolic',
                size: 24,
              }),
              Widget.Label('You Look Handsome !'),
            ],
        }),
    });

    // Update revealer state when sideleft window toggles
    App.connect('window-toggled', (_, name, visible) => {
        if (name === 'sideleft') {
            if (visible) {
                Utils.timeout(0, () => revealer.revealChild = true);
        } else {
            revealer.revealChild = false;
            }
        }
    });

    return revealer;
};

const RevealOnSideRight = () => {
    const revealer = Widget.Revealer({
        transition: 'slide_right',
        transitionDuration: userOptions.asyncGet().animations.durationLarge,
        child: Widget.Box({
            className: 'bar-group-margin bar-sides txt-large bar-knocks onSurfaceVariant',
            css:`padding:0 1.5rem`,
            spacing: 5,
            children: [
              Widget.Label('Ooof !!'),
              Widget.Icon({
                  icon: 'go-next-symbolic',
                  size: 22,
              }),
            ],
        }),
    });

    // Update revealer state when sideright window toggles
    App.connect('window-toggled', (_, name, visible) => {
        if (name === 'sideright') {
            if (visible) {
                Utils.timeout( 0, () => revealer.revealChild = true);
        } else {
            revealer.revealChild = false;
            }
        }
    });

    return revealer;
};

export const AnoonBar = Widget.CenterBox({
    css:`margin: 0rem 1.5rem;`,
    centerWidget: Widget.Box({
      spacing: 8,
      children: [
        RevealOnSideLeft(),
        Widget.Box({
          css:`min-width:30rem`,
          child:scrolledmodule({
            children: [
              Widget.Box({className:"bar-knocks",child:Media()}),
            ]
          })
        }),
        Widget.Box({
          className: "bar-knocks",
          children: [NormalOptionalWorkspaces()],
        }),
        scrolledmodule({
          children: [
            Widget.Box({
              children: [
                Widget.Box({
                  css:`min-width:30rem`,
                  className: "bar-knocks",
                  spacing: 5,
                  children: [
                    simpleClock(),
                    StatusIcons({className:"onSurfaceVariant"}),
                    kb_layout(),
                    BarResources(),

                    battery()
                  ],
                }),
              ],
            }),
            Widget.Box({ className: "bar-knocks",hexpand: true, children: [Fetcher()] }),
          ],
        }),
        RevealOnSideRight(),
      ],
    }),
  });
