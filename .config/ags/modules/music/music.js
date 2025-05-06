const { GLib, Gtk, GdkPixbuf, Gdk } = imports.gi;
import PopupWindow from "../.widgethacks/popupwindow.js";
import App from "resource:///com/github/Aylur/ags/app.js";
import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import Mpris from "resource:///com/github/Aylur/ags/service/mpris.js";
import userOptions from "../.configuration/user_options.js";
import { RoundedCorner } from "../.commonwidgets/cairo_roundedcorner.js";
const { Box, Icon, Label, Button } = Widget;
import { AnimatedCircProg } from "../.commonwidgets/cairo_circularprogress.js";
import { hasPlasmaIntegration } from "../.miscutils/system.js";
import CavaService from "../../services/cava.js";
import clickCloseRegion from "../.commonwidgets/clickcloseregion.js";
import Audio from 'resource:///com/github/Aylur/ags/service/audio.js';
const elevate = userOptions.asyncGet().etc.widgetCorners
  ? "osd-music-round osd-music "
  : "osd-music elevation elevate-music ";
const mode = userOptions.asyncGet().etc.enableAmberol ? "amberoled " : "";

var lastCoverPath = "";
let lastSelectedPlayer = null;

export const getPlayer = () => {
    const players = Mpris.players.filter(p => p.busName !== "playerctld");
    if (players.length === 0) return null;
    if (lastSelectedPlayer) {
        const found = players.find(p => p.busName === lastSelectedPlayer.busName);
        if (found) return found;
        lastSelectedPlayer = null;
    }
    return players[0];
};

function lengthStr(length) {
  if (isNaN(length) || length < 0) {
    return "0:00";
  }

  const min = Math.floor(length / 60);
  const sec = Math.floor(length % 60);
  const sec0 = sec < 10 ? "0" : "";
  return `${min}:${sec0}${sec}`;
}

function detectMediaSource(link) {
  if (!link) {
    // If no link is provided, try to identify by player name
    const player = getPlayer();
    if (player) {
      const name = player.name?.toLowerCase() || '';
      if (name.includes('brave')) return "󰖟  Brave";
      if (name.includes('zen')) return "󰖟  Zen Browser";
      if (name.includes('chromium')) return "󰊯  Chromium";
      if (name.includes('chrome')) return "󰊭  Chrome";
      if (name.includes('firefox')) return "󰈹  Firefox";
      if (name.includes('spotify')) return "   Spotify";
      if (name.includes('mpv')) return "󰎁  MPV";
      if (name.includes('vlc')) return "󰕼  VLC";
      return name; // Return the player name if we can't identify it specifically
    }
    return "Unknown";
  }

  try {
    // Check player name first for browser identification
    const player = getPlayer();
    if (player) {
      const name = player.name?.toLowerCase() || '';

      // Browser-specific checks
      if (name.includes('brave')) return "󰖟  Brave";
      if (name.includes('zen')) return "󰖟  Zen Browser";
      if (name.includes('chromium')) return "󰊯  Chromium";
      if (name.includes('chrome')) return "󰊭  Chrome";
      if (name.includes('firefox')) return "󰈹  Firefox";
    }

    if (link.startsWith("file://")) {
      if (link.includes("firefox-mpris")) return "󰈹  Firefox";
      if (link.includes("brave")) return "󰖟  Brave";
      if (link.includes("zen-browser")) return "󰖟  Zen Browser";
      if (link.includes("chromium")) return "󰊯  Chromium";
      if (link.includes("chrome")) return "󰊭  Chrome";
      return "󰎆   Lofi";
    }

    let url = link.replace(/(^\w+:|^)\/\//, "");
    if (!url.includes(".") || !url.match(/(?:[a-z]+\.)?([a-z]+\.[a-z]+)/i)) {
      return "Local Source";
    }

    let domain = url.match(/(?:[a-z]+\.)?([a-z]+\.[a-z]+)/i)[1];
    if (domain == "ytimg.com" || domain == "youtube.com" || domain == "youtu.be") return "󰗃   Youtube";
    if (domain == "discordapp.net" || domain == "discord.com") return "󰙯   Discord";
    if (domain == "scdn.co" || domain == "spotify.com") return "   Spotify";
    if (domain == "sndcdn.com" || domain == "soundcloud.com") return "󰓀   SoundCloud";
    return domain;
  } catch (e) {
    return "Unknown";
  }
}

const DEFAULT_MUSIC_FONT = "Geist, sans-serif";
function getTrackfont(player) {
  const title = player.trackTitle;
  const artists = player.trackArtists.join(" ");
  if (
    artists.includes("TANO*C") ||
    artists.includes("USAO") ||
    artists.includes("Kobaryo")
  )
    return "Geist";
  if (title.includes("東方")) return "Crimson Text, serif";
  return DEFAULT_MUSIC_FONT;
}

function trimTrackTitle(title) {
  if (!title) return "";
  const cleanPatterns = [
    /【[^】]*】/,
    " [FREE DOWNLOAD]",
  ];
  cleanPatterns.forEach((expr) => (title = title.replace(expr, "")));
  return title;
}

const TrackProgress = ({ player, ...rest }) => {
  const _updateProgress = (circprog) => {
    if (!player) {
      circprog.css = `font-size: 0px;`;
      return;
    }

    try {
      const position = typeof player.position === 'number' ? Math.max(0, player.position) : 0;
      const length = typeof player.length === 'number' ? Math.max(1, player.length) : 1;
      const progressPercent = Math.min(Math.max((position / length) * 100, 0), 100);
      circprog.css = `font-size: ${progressPercent}px;`;
    } catch (e) {
      circprog.css = `font-size: 0px;`;
    }
  };

  return AnimatedCircProg({
    ...rest,
    className: "osd-music-circprog",
    vpack: "center",
    extraSetup: (self) => {
      let mprisSignalId = null;
      let pollId = null;
      mprisSignalId = self.hook(Mpris, _updateProgress);
      pollId = self.poll(3000, _updateProgress);
      self.connect("destroy", () => {
        if (mprisSignalId) {
          try {
            Mpris.disconnect(mprisSignalId);
          } catch (e) {
          }
          mprisSignalId = null;
        }
        if (pollId) {
          try {
            self.removePoll(pollId);
          } catch (e) {
            try {
              GLib.Source.remove(pollId);
            } catch (e2) {
            }
          }
          pollId = null;
        }
      });
    },
  });
};

const TrackTitle = ({ player, ...rest }) =>
  Label({
    ...rest,
    label: "Play Some Music",
    xalign: 0,
    truncate: "end",
    className: "osd-music-title txt-shadow",
    css: "font-size: 1.4em;",
    setup: (self) => {
      if (player) {
        self.hook(
          player,
          (self) => {
            if (!player || typeof player.trackTitle === 'undefined') {
              self.label = "No media";
              return;
            }

            self.label =
              player.trackTitle && player.trackTitle.length > 0
                ? trimTrackTitle(player.trackTitle)
                : "No media";

            try {
              const fontForThisTrack = getTrackfont(player);
              self.css = `font-family: ${fontForThisTrack}, ${DEFAULT_MUSIC_FONT}; font-size: 1.4em;`;
            } catch (e) {
              self.css = `font-family: ${DEFAULT_MUSIC_FONT}; font-size: 1.4em;`;
            }
          },
          "notify::track-title"
        );
      } else {
        self.label = "No music playing";
      }
    },
  });

const TrackArtists = ({ player, ...rest }) =>
  Label({
    ...rest,
    xalign: 0,
    label: "HyprLuna",
    className: "osd-music-artists txt-shadow",
    css: "font-size: 0.9em;",
    truncate: "end",
    setup: (self) => {
      if (player) {
        self.hook(
          player,
          (self) => {
            if (!player || !player.trackArtists) {
              self.label = "";
              return;
            }

            self.label =
              player.trackArtists.length > 0
                ? player.trackArtists.join(", ")
                : "";
          },
          "notify::track-artists"
        );
      } else {
        self.label = "";
      }
    },
  });

const CoverArt = ({ player, ...rest }) => {
  const DEFAULT_COVER_SIZE = 150;
  let currentCoverPath = null;
  const drawingArea = Widget.DrawingArea({
    className: "osd-music-cover-art shadow-window",
    vpack: "start",
    setup: (self) => {
      self.set_size_request(DEFAULT_COVER_SIZE, DEFAULT_COVER_SIZE);
      self.connect("draw", (widget, cr) => {
        if (!currentCoverPath) return;
        try {
          let pixbuf = GdkPixbuf.Pixbuf.new_from_file(currentCoverPath);
          const imgWidth = pixbuf.get_width();
          const imgHeight = pixbuf.get_height();
          const scale = Math.min(
            DEFAULT_COVER_SIZE / imgWidth,
            DEFAULT_COVER_SIZE / imgHeight
          );
          const newWidth = Math.round(imgWidth * scale);
          const newHeight = Math.round(imgHeight * scale);
          const offsetX = (DEFAULT_COVER_SIZE - newWidth) / 2;
          const offsetY = (DEFAULT_COVER_SIZE - newHeight) / 2;
          pixbuf = pixbuf.scale_simple(
            newWidth,
            newHeight,
            GdkPixbuf.InterpType.BILINEAR
          );
          const radius = 16;
          cr.arc(radius, radius, radius, Math.PI, 1.5 * Math.PI);
          cr.arc(
            DEFAULT_COVER_SIZE - radius,
            radius,
            radius,
            1.5 * Math.PI,
            2 * Math.PI
          );
          cr.arc(
            DEFAULT_COVER_SIZE - radius,
            DEFAULT_COVER_SIZE - radius,
            radius,
            0,
            0.5 * Math.PI
          );
          cr.arc(
            radius,
            DEFAULT_COVER_SIZE - radius,
            radius,
            0.5 * Math.PI,
            Math.PI
          );
          cr.closePath();
          cr.clip();
          Gdk.cairo_set_source_pixbuf(cr, pixbuf, offsetX, offsetY);
          cr.paint();
        } catch (e) {
          console.error("Error drawing cover art:", e);
        }
      });
    },
  });

  let fallbackIcon = Icon({
    className: "onSurfaceVariant",
    icon: "logo-symbolic",
    css: `min-width:150px;min-height:150px`,
    size: "100",
    visible: false,
  });

  return Widget.Box({
    ...rest,
    css: `margin-right:0.8rem;margin-left:0.4rem;`,
    child: Widget.Overlay({
      child: fallbackIcon,
      overlays: [drawingArea],
    }),
    setup: (self) => {
      const updateCover = () => {
        if (!player || !player.trackTitle) {
          currentCoverPath = null;
          drawingArea.queue_draw();
          return;
        }

        if (!player.coverPath) {
          currentCoverPath = null;
          drawingArea.queue_draw();
          return;
        }

        const newPath = player.coverPath;
        if (newPath === currentCoverPath) return;

        currentCoverPath = newPath;

        if (newPath.startsWith("http")) {
          Utils.fetch(newPath)
            .then((filePath) => {
              currentCoverPath = filePath;
              drawingArea.queue_draw();
            })
            .catch(() => {
              currentCoverPath = null;
            });
        } else {
          drawingArea.queue_draw();
        }
      };

      if (player) {
        self.hook(player, updateCover, "notify::cover-path");
        self.hook(player, updateCover, "notify::track-title");
        updateCover();
      }
    },
  });
};

const TrackControls = ({ player, ...rest }) => {
  // Track the current player index
  let currentPlayerIndex = 0;
  let menu = null;
  let signalIds = [];



  // Function to clean up menu
  const cleanupMenu = () => {
    if (menu) {
      signalIds.forEach(id => {
        try {
          if (menu && id > 0) menu.disconnect(id);
        } catch (e) {}
      });
      signalIds = [];

      try {
        menu.destroy();
      } catch (e) {}
      menu = null;
    }
  };

  // Function to switch to the next player with animation
  const switchToNextPlayer = () => {
    const players = Mpris.players.filter(p => p.busName !== "playerctld");
    if (players.length <= 1) return;

    // Update player index
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    lastSelectedPlayer = players[currentPlayerIndex];

    // Create a simple animation using opacity
    if (playerIndicator && playerLabel && playerIcon) {
      // Fade out
      const duration = userOptions.asyncGet().animations.durationSmall;
      playerIndicator.css = `transition: opacity ${duration}ms ease; opacity: 0;`;

      // After fade out, update content and fade back in
      Utils.timeout(duration, () => {
        // Check if widgets still exist before updating
        if (playerLabel && !playerLabel.is_destroyed &&
            playerIcon && !playerIcon.is_destroyed &&
            playerIndicator && !playerIndicator.is_destroyed) {
          // Update content
          playerLabel.label = lastSelectedPlayer.name;
          playerIcon.label = getPlayerIcon(lastSelectedPlayer.name);

          // Fade back in
          playerIndicator.css = `transition: opacity ${duration}ms ease; opacity: 1;`;
        }
      });
    } else {
      // Fallback if animation not possible
      if (playerLabel && playerIcon) {
        playerLabel.label = lastSelectedPlayer.name;
        playerIcon.label = getPlayerIcon(lastSelectedPlayer.name);
      }
    }

    // Notify the system about the player change
    Utils.timeout(10, () => {
      Mpris.emit('changed');
    });
  };

  // Function to switch to the previous player with animation
  const switchToPrevPlayer = () => {
    const players = Mpris.players.filter(p => p.busName !== "playerctld");
    if (players.length <= 1) return;

    // Update player index
    currentPlayerIndex = (currentPlayerIndex - 1 + players.length) % players.length;
    lastSelectedPlayer = players[currentPlayerIndex];

    // Create a simple animation using opacity
    if (playerIndicator && playerLabel && playerIcon) {
      // Fade out
      const duration = userOptions.asyncGet().animations.durationSmall;
      playerIndicator.css = `transition: opacity ${duration}ms ease; opacity: 0;`;

      // After fade out, update content and fade back in
      Utils.timeout(duration, () => {
        // Check if widgets still exist before updating
        if (playerLabel && !playerLabel.is_destroyed &&
            playerIcon && !playerIcon.is_destroyed &&
            playerIndicator && !playerIndicator.is_destroyed) {
          // Update content
          playerLabel.label = lastSelectedPlayer.name;
          playerIcon.label = getPlayerIcon(lastSelectedPlayer.name);

          // Fade back in
          playerIndicator.css = `transition: opacity ${duration}ms ease; opacity: 1;`;
        }
      });
    } else {
      // Fallback if animation not possible
      if (playerLabel && playerIcon) {
        playerLabel.label = lastSelectedPlayer.name;
        playerIcon.label = getPlayerIcon(lastSelectedPlayer.name);
      }
    }

    // Notify the system about the player change
    Utils.timeout(10, () => {
      Mpris.emit('changed');
    });
  };

  // Function to show player selection menu
  const showPlayerMenu = (button) => {
    const players = Mpris.players.filter(p => p.busName !== "playerctld");
    if (players.length <= 1) return;

    cleanupMenu();

    menu = Widget.Menu({
      className: "osd-music-player-menu",
      children: players.map(p => Widget.MenuItem({
        child: Widget.Box({
          spacing: 8,
          children: [
            Widget.Label({
              className: "icon-material",
              label: getPlayerIcon(p.name),
              css: "min-width: 24px; margin-right: 4px;"
            }),
            Widget.Label({
              label: p.name,
              xalign: 0,
              hexpand: true,
            }),
            p.playBackStatus === "Playing" ?
              Widget.Label({
                className: "icon-material",
                label: "play_arrow",
              }) : null,
          ],
        }),
        onActivate: () => {
          lastSelectedPlayer = p;
          Utils.timeout(10, () => {
            Mpris.emit('changed');
            return false;
          });
        },
      })),
    });

    signalIds.push(
      menu.connect('destroy', () => {
        menu = null;
        signalIds = [];
      })
    );

    menu.popup_at_widget(button, Gdk.Gravity.SOUTH, Gdk.Gravity.NORTH, null);
  };

  // Function to get the appropriate icon for a player
  const getPlayerIcon = (name) => {
    const lowerName = name?.toLowerCase() || '';
    if (lowerName.includes('brave')) return "󰖟";
    if (lowerName.includes('zen')) return "󰖟";
    if (lowerName.includes('chromium')) return "󰊯";
    if (lowerName.includes('chrome')) return "󰊭";
    if (lowerName.includes('firefox')) return "󰈹";
    if (lowerName.includes('spotify')) return "";
    if (lowerName.includes('mpv')) return "󰎁";
    if (lowerName.includes('vlc')) return "󰕼";
    return "music_note"; // Default icon
  };

  // Initialize player label and icon references
  let playerLabel = null;
  let playerIcon = null;
  let playerIndicator = null;



  // Set the current player index
  if (player) {
    const players = Mpris.players.filter(p => p.busName !== "playerctld");
    currentPlayerIndex = players.findIndex(p => p.busName === player.busName);
    if (currentPlayerIndex === -1) currentPlayerIndex = 0;
  }

  return Widget.Revealer({
    revealChild: true,
    transition: "slide_right",
    transitionDuration: userOptions.asyncGet().animations.durationLarge,
    child: Widget.Box({
      ...rest,
      vpack: "center",
      className: "osd-music-controls spacing-h-3",
      setup: (self) => {
        self.connect('destroy', () => {
          cleanupMenu();
        });
      },
      children: [
        // Previous track button
        Button({
          className: "osd-music-controlbtn",
          tooltipText: "Previous Track",
          onClicked: () => {
            if (!player || !player.previous) return;
            player.previous();
          },
          child: Label({
            className: "icon-material osd-music-controlbtn-txt",
            label: "skip_previous",
          }),
        }),

        // Previous player button
        Button({
          className: "osd-music-controlbtn",
          onClicked: switchToPrevPlayer,
          child: Label({
            className: "icon-material osd-music-controlbtn-txt",
            label: "navigate_before",
          }),
          tooltipText: "Previous Player",
        }),

        // Current player indicator (clickable to show menu)
        Button({
          className: "osd-music-controlbtn osd-music-player-btn",
          hexpand: false,
          onClicked: (button) => showPlayerMenu(button),
          tooltipText: "Select Player",
          child: Widget.Box({
            className: "osd-music-player-indicator",
            homogeneous: false,
            spacing: 4,
            css: "padding: 0 4px;",
            setup: (self) => {
              playerIndicator = self;
            },
            children: [
              Label({
                className: "icon-material",
                css: "margin-right: 4px;",
                label: getPlayerIcon(player?.name || ""),
                setup: (self) => {
                  playerIcon = self;
                  self.hook(Mpris, () => {
                    if (!player) return;
                    self.label = getPlayerIcon(player.name);
                  });
                },
              }),
              Label({
                className: "txt osd-music-player-name",
                css: "font-weight: bold;",
                label: player?.name || "No Player",
                truncate: "end",
                maxWidthChars: 8,
                setup: (self) => {
                  playerLabel = self;
                  self.hook(Mpris, () => {
                    if (!player) return;
                    self.label = player.name;
                  });
                },
              }),
            ],
          }),
        }),

        // Next player button
        Button({
          className: "osd-music-controlbtn",
          onClicked: switchToNextPlayer,
          child: Label({
            className: "icon-material osd-music-controlbtn-txt",
            label: "navigate_next",
          }),
          tooltipText: "Next Player",
        }),

        // Play/Pause button
        Button({
          className: "osd-music-controlbtn",
          tooltipText: "Play/Pause",
          onClicked: () => {
            if (!player || !player.playPause) return;
            player.playPause();
          },
          child: Label({
            className: "icon-material osd-music-controlbtn-txt",
            css: "font-size: 1.6rem;", // Slightly larger icon for play/pause
            label: player?.playBackStatus === "Playing" ? "pause" : "play_arrow",
            setup: (self) => {
              self.hook(Mpris, () => {
                if (!player) return;
                self.label = player.playBackStatus === "Playing" ? "pause" : "play_arrow";
              });
            },
          }),
        }),

        // Shuffle button
        Button({
          className: "osd-music-controlbtn",
          tooltipText: "Shuffle",
          child: Widget.Label({
            className: "icon-material osd-music-controlbtn-txt",
            label: "shuffle",
          }),
          setup: function (self) {
            self.hook(Mpris, () => {
              if (!player) return;
              self.toggleClassName("active", player.shuffleStatus);
              // Update icon color based on state
              if (player.shuffleStatus) {
                self.child.css = "color: $onPrimary;";
              } else {
                self.child.css = "";
              }
            });
          },
          onClicked: function () {
            if (!player) return;
            const newState = !player.shuffleStatus;
            Utils.execAsync([
              "playerctl",
              "--player", player.name,
              "shuffle",
              newState ? "On" : "Off",
            ]).catch((err) => console.error("Failed to set shuffle:", err));
            this.toggleClassName("active", newState);
            // Update icon color based on new state
            if (newState) {
              this.child.css = "color: $onPrimary;";
            } else {
              this.child.css = "";
            }
          },
        }),

        // Repeat button
        Button({
          className: "osd-music-controlbtn",
          tooltipText: "Repeat Mode",
          child: Widget.Label({
            className: "icon-material osd-music-controlbtn-txt",
            label: "repeat",
          }),
          setup: function (self) {
            self.hook(Mpris, () => {
              if (!player) return;
              const status = player.loopStatus || "None";
              self.child.label =
                status === "None"
                  ? "repeat"
                  : status === "Track"
                  ? "repeat_one"
                  : "repeat";
              self.toggleClassName("active", status !== "None");
              // Update icon color based on state
              if (status !== "None") {
                self.child.className = "icon-material osd-music-controlbtn-txt active";
              } else {
                self.child.className = "icon-material osd-music-controlbtn-txt";
              }
            });
          },
          onClicked: function () {
            if (!player) return;
            const currentStatus = player.loopStatus || "None";
            let newStatus;
            switch (currentStatus) {
              case "None":
                newStatus = "Track";
                break;
              case "Track":
                newStatus = "Playlist";
                break;
              default:
                newStatus = "None";
            }

            Utils.execAsync([
              "playerctl",
              "--player", player.name,
              "loop",
              newStatus
            ]).catch((err) =>
              console.error("Failed to set loop status:", err)
            );

            this.child.label =
              newStatus === "None"
                ? "repeat"
                : newStatus === "Track"
                ? "repeat_one"
                : "repeat";
            this.toggleClassName("active", newStatus !== "None");
            // Update icon color based on new state
            if (newStatus !== "None") {
              this.child.className = "icon-material osd-music-controlbtn-txt active";
            } else {
              this.child.className = "icon-material osd-music-controlbtn-txt";
            }
          },
        }),

        // Next track button
        Button({
          className: "osd-music-controlbtn",
          tooltipText: "Next Track",
          onClicked: () => (player && player.next ? player.next() : null),
          child: Label({
            className: "icon-material osd-music-controlbtn-txt",
            label: "skip_next",
          }),
        }),
      ],
    }),
  });
};

const TrackSource = ({ player, ...rest }) =>
  Widget.Revealer({
    revealChild: true,
    transition: "slide_left",
    transitionDuration: userOptions.asyncGet().animations.durationLarge,
    child: Widget.Box({
      ...rest,
      homogeneous: true,
      children: [
        Label({
          hpack: "start",
          opacity: 0.6,
          css: `margin-top:0.75rem`,
          className: "txt-large onSurfaceVariant",
          setup: (self) => {
            let isDestroyed = false;

            const updateLabel = () => {
              if (!isDestroyed) {
                try {
                  self.label = player ? detectMediaSource(player.trackCoverUrl || "") : "";
                } catch (e) {
                  self.label = "";
                  console.log("خطأ في تحديث مصدر المسار:", e);
                }
              }
            };

            if (player) {
              self.hook(player, updateLabel, "notify::cover-path");
              updateLabel();
            } else {
              self.label = "";
            }
            self.connect("destroy", () => {
              isDestroyed = true;
            });
          },
        }),
      ],
    }),
  });

const TrackTime = ({ player, ...rest }) => {
  return Widget.Revealer({
    revealChild: true,
    transition: "slide_left",
    transitionDuration: userOptions.asyncGet().animations.durationLarge,
    child: Widget.Box({
      ...rest,
      vpack: "center",
      className: "osd-music-pill spacing-h-5",
      css: "font-weight: bold; margin: 0 10px; background-color: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 8px;",
      children: [
        Label({
          setup: (self) => {
            let pollId = null;
            let isDestroyed = false;

            const updatePosition = () => {
              if (!isDestroyed && player) {
                try {
                  const position = typeof player.position === 'number' ?
                    Math.max(0, player.position) : 0;

                  self.label = lengthStr(position);
                } catch (e) {
                  self.label = "0:00";
                }
              }
              return !isDestroyed;
            };

            if (player) {
              pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                if (isDestroyed) {
                  if (pollId) {
                    GLib.Source.remove(pollId);
                    pollId = null;
                  }
                  return GLib.SOURCE_REMOVE;
                }
                return updatePosition();
              });
            } else {
              self.label = "0:00";
            }
            self.connect("destroy", () => {
              isDestroyed = true;
              if (pollId) {
                GLib.Source.remove(pollId);
                pollId = null;
              }
            });
          },
        }),
        Label({ label: "/" }),
        Label({
          setup: (self) => {
            let isDestroyed = false;

            const updateLength = () => {
              if (!isDestroyed && player) {
                try {
                  const length = typeof player.length === 'number' ?
                    Math.max(0, player.length) : 0;

                  self.label = lengthStr(length);
                } catch (e) {
                  self.label = "0:00";
                }
              }
            };

            if (player) {
              self.hook(player, updateLength, "notify::length");
              updateLength();
            } else {
              self.label = "0:00";
            }
            self.connect("destroy", () => {
              isDestroyed = true;
            });
          },
        }),
      ],
    }),
  });
};

const PlayState = ({ player }) => {
  const trackCircProg = TrackProgress({ player: player });
  return Widget.Button({
    className: "osd-music-playstate",
    onClicked: () => {
      if (player && player.playPause) {
        player.playPause();
      }
    },
    child: Widget.Overlay({
      child: trackCircProg,
      overlays: [
        Widget.Button({
          className: "osd-music-playstate-btn",
          onClicked: () => {
            if (player && player.playPause) {
              player.playPause();
            }
          },
          child: Widget.Label({
            justification: "center",
            hpack: "fill",
            vpack: "center",
            setup: (self) => {
              let isDestroyed = false;

              const updatePlayState = () => {
                if (!isDestroyed) {
                  if (player) {
                    self.label = `${
                      player.playBackStatus == "Playing"
                        ? "pause"
                        : "play_arrow"
                    }`;
                  } else {
                    self.label = "play_arrow";
                  }
                }
              };

              if (player) {
                self.hook(player, updatePlayState, "notify::play-back-status");
                updatePlayState();
              } else {
                self.label = "play_arrow";
              }
              self.connect("destroy", () => {
                isDestroyed = true;
              });
            },
          }),
        }),
      ],
      passThrough: true,
    }),
  });
};

const CavaVisualizer = () => {
  const bars = Array(50)
    .fill(0)
    .map(() =>
      Widget.Box({
        vertical: true,
        className: "cava-bar-wrapper",
        hpack: "center",
        vpack: "center",
        hexpand: true,
        children: [
          Widget.Box({
            className: "cava-bar cava-bar-low cava-bar-up",
            hpack: "center",
            vpack: "end",
          }),
          Widget.Box({
            className: "cava-bar cava-bar-low cava-bar-down",
            hpack: "center",
            vpack: "start",
          }),
        ],
      })
    );

  let isActive = false;
  let updateTimeout = null;
  let isDestroyed = false;
  const barElements = [];
  const safeUpdate = (widget, property, value) => {
    if (!widget || isDestroyed) return false;

    try {
      const test = widget.css;
      widget[property] = value;
      return true;
    } catch (e) {
      return false;
    }
  };
  const initBars = () => {
    barElements.length = 0;

    bars.forEach((barWrapper) => {
      if (barWrapper && barWrapper.children && barWrapper.children.length >= 2) {
        barElements.push({
          wrapper: barWrapper,
          upBar: barWrapper.children[0],
          downBar: barWrapper.children[1],
          valid: true
        });
      }
    });
  };
  initBars();

  const updateBars = () => {
    if (!isActive || isDestroyed) return;
    if (updateTimeout) {
      try {
        GLib.Source.remove(updateTimeout);
        updateTimeout = null;
      } catch (e) {
      }
    }

    try {
      const output = CavaService.output;
      if (!output || typeof output !== "string") {
        if (!isDestroyed && isActive) {
          updateTimeout = Utils.timeout(8, updateBars);
        }
        return;
      }

      const values = output.split("").map((c) => {
        const code = c.charCodeAt(0);
        return code >= 0x30 && code <= 0x39 ? code - 0x30 : 0;
      });

      const step = Math.floor(values.length / barElements.length);
      for (let i = 0; i < barElements.length; i++) {
        if (isDestroyed) break;

        const barData = barElements[i];
        if (!barData || !barData.valid) continue;

        try {
          const start = i * step;
          const end = start + step;
          const avg = values.slice(start, end).reduce((a, b) => a + b, 0) / step || 0;
          const height = Math.max(1, Math.pow(avg, 1.9) * 4);
          const intensity = avg > 6 ? "high" : avg > 3 ? "med" : "low";

          const { upBar, downBar } = barData;

          const barCss = `
            min-height: ${height}px;
            min-width: 8px;
            margin: 0 2px;
            transition: all 100ms cubic-bezier(0.4, 0, 0.2, 1);
          `;
          let upValid = false;
          let downValid = false;

          try {
            upValid = safeUpdate(upBar, "css", barCss);
            if (upValid) {
              upValid = safeUpdate(upBar, "className", `cava-bar cava-bar-${intensity} cava-bar-up`);
            }
          } catch (e) {
            upValid = false;
          }

          try {
            downValid = safeUpdate(downBar, "css", barCss);
            if (downValid) {
              downValid = safeUpdate(downBar, "className", `cava-bar cava-bar-${intensity} cava-bar-down`);
            }
          } catch (e) {
            downValid = false;
          }
          if (!upValid || !downValid) {
            barData.valid = false;
          }
        } catch (err) {
          barData.valid = false;
        }
      }
      if (!isDestroyed && isActive) {
        updateTimeout = Utils.timeout(8, updateBars);
      }
    } catch (e) {
    }
  };

  const startUpdates = () => {
    if (isActive || isDestroyed) return;
    isActive = true;
    CavaService.start();
    updateBars();
  };

  const stopUpdates = () => {
    if (!isActive || isDestroyed) return;
    isActive = false;

    try {
      try {
        CavaService.stop();
      } catch (e) {
      }
      if (updateTimeout) {
        try {
          GLib.Source.remove(updateTimeout);
        } catch (e) {
        }
        updateTimeout = null;
      }
      for (let i = 0; i < barElements.length; i++) {
        if (isDestroyed) break;

        const barData = barElements[i];
        if (!barData || !barData.valid) continue;

        try {
          const { upBar, downBar } = barData;

          const barCss = `
            min-height: 1px;
            min-width: 8px;
            margin: 0 2px;
          `;
          const upValid = safeUpdate(upBar, "css", barCss) &&
                        safeUpdate(upBar, "className", "cava-bar cava-bar-low cava-bar-up");

          const downValid = safeUpdate(downBar, "css", barCss) &&
                          safeUpdate(downBar, "className", "cava-bar cava-bar-low cava-bar-down");
          if (!upValid || !downValid) {
            barData.valid = false;
          }
        } catch (err) {
          barData.valid = false;
        }
      }
    } catch (e) {
    }
  };

  return Widget.Box({
    className: "cava-visualizer",
    spacing: 0,
    homogeneous: true,
    vexpand: false,
    children: bars,
    setup: (self) => {
      const mprisSignalId = self.hook(Mpris, () => {
        const player = getPlayer();
        if (!player || player.playBackStatus !== "Playing") {
          stopUpdates();
          return;
        }
        startUpdates();
      });
      let windowSignalId = null;
      const checkWindowVisibility = () => {
        if (isDestroyed) return false;

        try {
          const window = App.getWindow("music");
          if (!window) {
            Utils.timeout(1000, checkWindowVisibility);
            return false;
          }

          windowSignalId = window.connect("notify::visible", () => {
            if (isDestroyed) return;
            const player = getPlayer();
            if (window.visible && player?.playBackStatus === "Playing") {
              startUpdates();
            } else {
              stopUpdates();
            }
          });
          if (window.visible) {
            const player = getPlayer();
            if (player?.playBackStatus === "Playing") {
              startUpdates();
            }
          }
        } catch (e) {
          Utils.timeout(2000, checkWindowVisibility);
        }

        return false;
      };
      Utils.timeout(1000, checkWindowVisibility);
      self.connect("destroy", () => {
        isDestroyed = true;
        stopUpdates();
        if (windowSignalId) {
          const window = App.getWindow("music");
          if (window) {
            try {
              window.disconnect(windowSignalId);
            } catch (e) {
            }
          }
          windowSignalId = null;
        }
        for (let i = 0; i < barElements.length; i++) {
          if (barElements[i]) {
            barElements[i].upBar = null;
            barElements[i].downBar = null;
            barElements[i].wrapper = null;
            barElements[i].valid = false;
          }
        }
        if (updateTimeout) {
          try {
            GLib.Source.remove(updateTimeout);
          } catch (e) {
          }
          updateTimeout = null;
        }
        try {
          CavaService.stop();
        } catch (e) {
        }
        barElements.length = 0;
      });
    },
  });
};

const VolumeControl = () => {
  return Widget.Box({
    className: "osd-music-volume spacing-h-5",
    children: [
      Widget.Label({
        className: "icon-material",
        label: "volume_up",
      }),
      Widget.Slider({
        className: "osd-music-volume-slider",
        hexpand: true,
        drawValue: false,
        onChange: ({ value }) => {
          if (!Audio.speaker) return;
          Audio.speaker.volume = value;
        },
        setup: (self) => {
          if (!Audio.speaker) return;
          self.value = Audio.speaker.volume;
          self.hook(Audio, (self) => {
            if (!Audio.speaker) return;
            self.value = Audio.speaker.volume;
          }, 'speaker-changed');
        },
      }),
    ],
  });
};

const PlayerSwitcher = () => {
  return Widget.Box({
    className: "osd-music-player-switcher",
    children: [
      Widget.Button({
        className: "osd-music-player-menu-btn osd-music-controlbtn",
        child: Widget.Label({
          className: "icon-material osd-music-controlbtn-txt",
          label: "queue_music",
        }),
        onClicked: (button) => {
          const players = Mpris.players.filter(p => p.busName !== "playerctld");
          if (players.length <= 1) return;

          const menu = Widget.Menu({
            className: "osd-music-player-menu",
            children: players.map(player => Widget.MenuItem({
              child: Widget.Box({
                spacing: 8,
                children: [
                  Widget.Label({
                    label: player.name,
                    xalign: 0,
                    hexpand: true,
                  }),
                  player.playBackStatus === "Playing" ?
                    Widget.Label({
                      className: "icon-material",
                      label: "play_arrow",
                    }) : null,
                ],
              }),
              onActivate: () => {
                lastSelectedPlayer = player;
                Utils.timeout(10, () => {
                  Mpris.emit('changed');
                  return false;
                });
              },
            })),
          });
          menu.popup_at_widget(button, Gdk.Gravity.SOUTH, Gdk.Gravity.NORTH, null);
        },
      }),
    ],
  });
};

const createContent = (player) =>
  Widget.Box({
    vertical: true,
    children: [
      Box({
        spacing: 10,
        children: [
          Box({
            spacing: 15,
            children: [
              CoverArt({
                player: player,
                css: 'min-width: 80px; min-height: 80px;'
              }),
              Box({
                vertical: true,
                vpack: "center",
                children: [
                  TrackTitle({ player: player }),
                  TrackArtists({ player: player }),
                  TrackSource({ player: player }),
                ],
              }),
            ],
          }),
        ],
      }),
      Box({
        className: "cava-container",
        vexpand: true,
        child: userOptions.asyncGet().etc.cava.enabled ? CavaVisualizer() : null,
      }),
      Box({
        className: "spacing-v-5",
        vertical: true,
        children: [
          VolumeControl(),
          Box({
            className: "spacing-h-10",
            children: [
              TrackControls({ player: player }),
              Widget.Box({ hexpand: true }),
              TrackTime({ player: player }),
              PlayState({ player: player }),
            ],
          }),
        ],
      }),
    ],
  });

const musicWidget = () => {
  let currentContent = null;
  let currentPlayer = null;
  let signalIds = [];
  let widget;
  const updateChildren = (newPlayer) => {
    try {
      const player = newPlayer || getPlayer();

      // Check if there are any audio apps running
      if (!player || !widget) {
        // No audio apps running, show "No apps playing right now" message
        if (widget && widget.children) {
          const noAppsContent = Widget.Box({
            vertical: true,
            vpack: "center",
            hpack: "center",
            hexpand: true,
            vexpand: true,
            css: "min-height: 180px;",
            children: [
              Widget.Box({
                vertical: true,
                hpack: "center",
                vpack: "center",
                className: "spacing-v-15",
                children: [
                  Widget.Label({
                    label: "music_note",
                    className: "icon-material onSurfaceVariant",
                    css: "font-size: 48px; margin-bottom: 10px;"
                  }),
                  Widget.Label({
                    label: "No apps playing right now",
                    className: "txt-large onSurfaceVariant",
                    css: "font-weight: 500;"
                  })
                ]
              })
            ]
          });
          widget.children = [noAppsContent];
          if (widget.show_all) {
            widget.show_all();
          }
        }
        return;
      }

      if (!player.busName) {
        return;
      }

      const shouldRecreate =
        (currentPlayer?.busName !== player.busName) ||
        (currentPlayer?.playBackStatus !== player.playBackStatus) ||
        !currentContent;

      if (shouldRecreate) {
        try {
          const oldPlayer = currentPlayer;
          const oldContent = currentContent;
          const newContent = createContent(player);
          currentPlayer = player;
          currentContent = newContent;
          if (widget && widget.children) {
            widget.children = [newContent];
            if (widget.show_all) {
              widget.show_all();
            }
          }
        } catch (e) {
          console.error("خطأ في إنشاء محتوى الواجهة:", e);
        }
      }
    } catch (e) {
      console.error("خطأ في تحديث واجهة الموسيقى:", e);
    }
  };
  widget = Box({
    className: `normal-music ${mode} ${elevate}`,
    vpack: "end",
    setup: (self) => {
      const setupMprisHooks = () => {
        try {
          self.hook(Mpris, updateChildren, "notify::players");
          self.hook(Mpris, () => {
            const player = getPlayer();
            if (player) {
              updateChildren(player);
            }
          }, "player-changed");
          self.hook(Mpris, () => {
            try {
              const player = getPlayer();
              if (player) {
                updateChildren(player);
              }
            } catch (e) {
              console.error("خطأ في استجابة إشارة player-changed:", e);
            }
          }, "changed");
        } catch (e) {
          console.error("فشل إعداد مراقبة الإشارات:", e);
        }
      };
      Utils.timeout(100, () => {
        updateChildren();
        setupMprisHooks();
        return false;
      });
      self.connect('destroy', () => {
        currentContent = null;
        currentPlayer = null;
      });
    },
  });
  widget.updateChildren = updateChildren;

  return widget;
};

export default () =>
  PopupWindow({
    keymode: "on-demand",
    anchor: ["bottom"],
    layer: "top",
    name: "music",
    child: Box({
      vertical: true,
      children: [
        clickCloseRegion({
          name: "music",
          multimonitor: false,
          fillMonitor: "vertical",
        }),
        Box({
          vpack: "end",
          children: [
            userOptions.asyncGet().etc.widgetCorners ? RoundedCorner("bottomright", {
              className: "corner corner-amberoled",
              vpack: "end",
            }) : null,
            musicWidget(),
            userOptions.asyncGet().etc.widgetCorners ? RoundedCorner("bottomleft", {
              className: "corner corner-amberoled",
              vpack: "end",
            }) : null,
          ],
        }),
      ],
    }),
  });
