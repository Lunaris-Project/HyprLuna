const { Gio, GLib } = imports.gi;
import App from 'resource:///com/github/Aylur/ags/app.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const { execAsync, exec } = Utils;
import Todo from "../../services/todo.js";
import timers from "../../services/timers.js";
import { darkMode } from '../.miscutils/system.js';
import Hyprland from 'resource:///com/github/Aylur/ags/service/hyprland.js';
import userOptions from '../.configuration/user_options.js';
import { currentShellMode, updateMonitorShellMode } from '../../variables.js';

export const hasUnterminatedBackslash = str => /\\+$/.test(str);
// Check for both .json and .jsonc files
const configBasePath = GLib.get_home_dir() + '/.ags/config';
const jsonPath = (() => {
    const jsonFile = configBasePath + '.json';
    const jsoncFile = configBasePath + '.jsonc';

    // Use GLib.file_test to check if files exist
    const jsonExists = GLib.file_test(jsonFile, GLib.FileTest.EXISTS);
    const jsoncExists = GLib.file_test(jsoncFile, GLib.FileTest.EXISTS);

    return jsonExists ? jsonFile :
           jsoncExists ? jsoncFile :
           configBasePath + '.json';
})();
const logo = App.configDir + "/assets/icons/logo-symbolic.svg"
export function launchCustomCommand(command) {
    const [cmd, ...args] = command.toLowerCase().split(' ');
    const execScript = (script, params = '') =>
        execAsync([`bash`, `-c`, `${App.configDir}/scripts/${script}`, params]).catch(print);

    const commands = {
        '>raw': () => {
            Utils.execAsync('hyprctl -j getoption input:accel_profile')
                .then(output => {
                    const value = JSON.parse(output).str.trim();
                    execAsync(['bash', '-c',
                        `hyprctl keyword input:accel_profile '${value != "[[EMPTY]]" && value != "" ? "[[EMPTY]]" : "flat"}'`
                    ]).catch(print);
                });
        },
        '>bar': () => {
            if (!args[0]) return;
            const mode = parseInt(args[0]);
            if (isNaN(mode)) return;

            const monitor = Hyprland.active.monitor.id || 0;
            updateMonitorShellMode(currentShellMode, monitor, mode.toString());
        },
        '>light': () => darkMode.value = false,
        '>dark': () => darkMode.value = true,
        '>todo': () => Todo.add(args.join(' ')),
        '>td': () => Todo.add(args.join(' ')),
        '>shutdown': () => execAsync(['bash', '-c', 'systemctl poweroff || loginctl poweroff']).catch(print),
        '>reboot': () => execAsync(['bash', '-c', 'systemctl reboot || loginctl reboot']).catch(print),
        '>sleep': () => execAsync(['bash', '-c', 'systemctl suspend || loginctl suspend']).catch(print),
        '>logout': () => execAsync(['bash', '-c', 'pkill Hyprland || pkill sway']).catch(print),
        '>addgpt': () => {
            if (!args || args.length < 1) {
                print("Usage: >addgpt <model_name> [provider]");
                return;
            }

            const modelName = args[0];
            // If provider not provided, use model name as provider (lowercase)
            const provider = args[1] || modelName.toLowerCase().replace(/[^a-z0-9]/g, '-');

            // Always use OpenRouter settings
            const baseUrl = "https://openrouter.ai/api/v1/chat/completions";
            const keyGetUrl = "https://openrouter.ai/keys";

            // Prepare model config
            const modelConfig = {
                name: modelName,
                logo_name: "openrouter-symbolic",
                description: `${modelName} via OpenRouter`,
                base_url: baseUrl,
                key_get_url: keyGetUrl,
                key_file: "openrouter_key.txt",  // Always use OpenRouter key
                model: modelName
            };

            try {
                // Update user_options.default.json
                // Use the same configBasePath defined above
                const defaultConfigPath = jsonPath;
                let defaultConfig = JSON.parse(Utils.readFile(defaultConfigPath));

                // Ensure the path exists
                if (!defaultConfig.sidebar) defaultConfig.sidebar = {};
                if (!defaultConfig.sidebar.ai) defaultConfig.sidebar.ai = {};
                if (!defaultConfig.sidebar.ai.__custom) defaultConfig.sidebar.ai.__custom = ["extraGptModels"];
                if (!defaultConfig.sidebar.ai.extraGptModels) defaultConfig.sidebar.ai.extraGptModels = {};

                // Add the model
                defaultConfig.sidebar.ai.extraGptModels[provider] = modelConfig;
                Utils.writeFile(JSON.stringify(defaultConfig, null, 2), defaultConfigPath);

                print(`Added OpenRouter model: ${modelName} (provider: ${provider})`);
            } catch (error) {
                print(`Error adding GPT model: ${error.message}`);
            }
        },
        '>lofi': () => {
    const musicDir = GLib.get_home_dir() + (userOptions.asyncGet().music.musicDir || "/Music");
    const supportedFormats = /\.(mp3|wav|ogg|m4a|flac|opus)$/i;

    try {
        // Get all audio files in the music directory
        const dir = Gio.File.new_for_path(musicDir);
        const enumerator = dir.enumerate_children(
            "standard::*",
            Gio.FileQueryInfoFlags.NONE,
            null
        );

        const audioFiles = [];
        let fileInfo;
        while ((fileInfo = enumerator.next_file(null))) {
            const filename = fileInfo.get_name();
            if (filename.match(supportedFormats)) {
                audioFiles.push(filename);
            }
        }

        if (audioFiles.length > 0) {
            // Choose a random starting index
            const randomIndex = Math.floor(Math.random() * audioFiles.length);
            // Rearrange the playlist so that it starts with the randomly chosen file
            const playlist = audioFiles.slice(randomIndex).concat(audioFiles.slice(0, randomIndex));
            // Convert to full file paths
            const playlistPaths = playlist.map(file => `${musicDir}/${file}`);
            // Kill any running instance of VLC
            execAsync(['bash', '-c', 'pkill vlc']).catch(print);
            // Build the VLC command with the entire playlist in order

            const vlcCommand = [
                'bash',
                '-c',
                `vlc --loop --qt-start-minimized ${playlistPaths.map(path => `"${path}"`).join(' ')}`
            ];

            execAsync(vlcCommand).catch(error => {
                print(`Error playing playlist: ${error}`);
                execAsync(vlcCommand).catch(print);
            });
        } else {
            print("No audio files found in Music directory");
        }
    } catch (error) {
        print(`Error accessing Music directory: ${error}`);
    }
},
        '>yt': () => {
            if (!args[0]) return;
            const searchQuery = args.join(' ');
            execAsync(['pkill', 'mpv']).catch(print);
            execAsync(['bash', '-c', `python3 -c "
from ytmusicapi import YTMusic
ytm = YTMusic()
results = ytm.search('${searchQuery}', filter='songs', limit=1)
if results:
    video_id = results[0]['videoId']
    print(f'https://music.youtube.com/watch?v={video_id}')
"`]).then(url => {
                if (url.trim()) {
                    execAsync(['vlc', '--qt-start-minimized', url.trim()]).catch(print);
                }
            }).catch(print);
        },
      '>ytd': () => {
    if (!args[0]) return;
    const searchQuery = args.join(' ');
    execAsync(['bash', '-c', `python3 -c "
from ytmusicapi import YTMusic;
ytm = YTMusic()
results = ytm.search('${searchQuery}', filter='songs', limit=1)
if results:
    video_id = results[0]['videoId']
    title = results[0]['title']
    print(f'https://music.youtube.com/watch?v={video_id}\\n{title}')
"`]).then(output => {
        const [url, title] = output.trim().split('\n');
        if (url) {
            const musicDir = GLib.get_home_dir() + '/Music';
            execAsync(['pkill', 'mpv']).catch(print);
            execAsync(['notify-send', `Downloading "${title}"`,  '-i', `${logo}`, 'Starting download...']).catch(print);
            execAsync(['yt-dlp',
                '--extract-audio',
                '--audio-format', 'mp3',
                '--audio-quality', '0',
                '--add-metadata',
                '--embed-thumbnail',
                '--output', `${musicDir}/%(title)s.%(ext)s`,
                url.trim()
            ]).then(() => {
                execAsync(['mpv', '--no-video', url.trim()]).catch(print);
                execAsync(['notify-send', '-i',`${logo}`,`Downloaded "${title}"`, 'Saved to Music folder']).catch(print);
            }).catch(print);
        }
    }).catch(print);
},
">yta": () => {
    if (!args[0]) return;
    const searchQuery = args.join(' ');
    execAsync(['pkill', 'mpv']).catch(print);
    execAsync(['bash', '-c', `python3 -c "
from ytmusicapi import YTMusic
ytm = YTMusic()
results = ytm.search('${searchQuery}', filter='songs', limit=10)
if results:
    for result in results:
        video_id = result['videoId']
        print(f'https://music.youtube.com/watch?v={video_id}')
"`]).then(urls => {
        const playlist = urls.trim().split('\n');
        if (playlist.length > 0) {
            const socketPath = '/tmp/mpvsocket';
            execAsync(['mpv',
                '--no-video',
                '--loop-playlist',
                '--input-ipc-server=' + socketPath,
                '--script=' + App.configDir + '/scripts/mpv-notify.lua',
                ...playlist
            ]).catch(print);
        }
    }).catch(print);
},
">ytda": () => {
    if (!args[0]) return;
    const searchQuery = args.join(' ');
    // Kill any existing mpv instances
    execAsync(['pkill', 'mpv']).catch(print);
    // Use python to search for 10 songs and output URL and title separated by a delimiter
    execAsync([
        'bash',
        '-c',
        `python3 -c "
from ytmusicapi import YTMusic
ytm = YTMusic()
results = ytm.search('${searchQuery}', filter='songs', limit=10)
if results:
    for result in results:
        video_id = result['videoId']
        title = result['title']
        print(f'https://music.youtube.com/watch?v={video_id}||{title}')
"`
    ]).then(output => {
        const lines = output.trim().split('\n');
        const playlist = [];
        lines.forEach(line => {
            const parts = line.split('||');
            if (parts.length >= 2) {
                playlist.push({
                    url: parts[0].trim(),
                    title: parts[1].trim()
                });
            }
        });
        if (playlist.length > 0) {
            const socketPath = '/tmp/mpvsocket';
            // Play the playlist without looping so mpv will exit after finishing
            execAsync([
                'mpv',
                '--no-video',
                '--input-ipc-server=' + socketPath,
                ...playlist.map(item => item.url)
            ]).then(() => {
                // After playback finishes, download each track that was listened to
                const musicDir = GLib.get_home_dir() + '/Music';
                playlist.forEach(item => {
                    execAsync(['notify-send', `Downloading "${item.title}"`, '-i',`${logo}`,'Starting download...']).catch(print);
                    execAsync([
                        'yt-dlp',
                        '--extract-audio',
                        '--audio-format', 'mp3',
                        '--audio-quality', '0',
                        '--add-metadata',
                        '--embed-thumbnail',
                        '--output', `${musicDir}/%(title)s.%(ext)s`,
                        item.url
                    ]).then(() => {
                        execAsync(['notify-send', '-i',`${logo}`,`Downloaded "${item.title}"`, 'Saved to Music folder']).catch(print);
                    }).catch(print);
                });
            }).catch(print);
        }
    }).catch(print);
},

        '>skip': () => {
            execAsync(['playerctl', 'next']).catch(print);
            execAsync(['bash', '-c', 'sleep 0.1 && playerctl position 0']).catch(print);
        },
        '>stop': () => {
            execAsync(['bash', '-c', 'killall mpv']).catch(print);
            execAsync(['bash', '-c', 'killall vlc']).catch(print);
        },
        '>prev': () => {
            execAsync(['playerctl', 'previous']).catch(print);
        },
        '>pin': () => {
            if (!args[0]) return;
            const appName = args.join(' ').toLowerCase();
            try {
                const config = JSON.parse(Utils.readFile(jsonPath));
                if (!config.dock) config.dock = {};
                if (!config.dock.pinnedApps) config.dock.pinnedApps = [];

                if (!config.dock.pinnedApps.includes(appName)) {
                    config.dock.pinnedApps.push(appName);
                    Utils.writeFile(JSON.stringify(config, null, 2), jsonPath);
                }
            } catch (error) {
                print('Error pinning app:', error);
            }
        },
        '>conf': async ()  => {
            await execAsync(['bash','-c', `kitty nvim '.config/ags'`]).catch(print);
        },
        '>gn': async ()  => {
            await execAsync(['bash','-c', `hyprsunset -t ${userOptions.asyncGet().etc.nightLightTemp}`]).catch(print);
        },
        '>unpin': () => {
            if (!args[0]) return;
            const appName = args.join(' ').toLowerCase();
            const configPath = `${App.configDir}/modules/.configuration/user_options.default.json`;

            try {
                const config = JSON.parse(Utils.readFile(configPath));
                if (config.dock?.pinnedApps) {
                    const index = config.dock.pinnedApps.indexOf(appName);
                    if (index > -1) {
                        config.dock.pinnedApps.splice(index, 1);
                        Utils.writeFile(JSON.stringify(config, null, 2), configPath);
                        execAsync(['bash', '-c', 'ags -q; ags']).catch(print);
                    }
                }
            } catch (error) {
                print('Error unpinning app:', error);
            }
        },
        '>tm': () => {
            // Parse the time string
            const timeStr = args[0].toLowerCase();
            let seconds = 0;

            // Handle different time formats
            if (timeStr.includes('h')) {
                const hours = parseFloat(timeStr);
                seconds = Math.floor(hours * 3600);
            }
            else if (timeStr.includes('m')) {
                const minutes = parseFloat(timeStr);
                seconds = Math.floor(minutes * 60);
            }
            else if (timeStr.includes('s')) {
                seconds = Math.floor(parseFloat(timeStr));
            }
            else {
                // Assume minutes if no unit specified
                seconds = Math.floor(parseFloat(timeStr) * 60);
            }

            if (isNaN(seconds) || seconds <= 0) {
                print("Invalid time format");
                return;
            }

            // Get timer name (rest of arguments after time)
            const name = args.slice(1).join(' ') || `${Math.floor(seconds / 60)}min Timer`;

            // Create and start the timer
            const timerId = timers.addTimer(name, seconds);
            timers.startTimer(timerId);

            // Send notification
            const endTime = new Date(Date.now() + seconds * 1000).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
            execAsync([
                'notify-send',
                `Timer Started: ${name}`,
                `Will complete at ${endTime}`,
                '-i',
                `${logo}`,
                '-t',
                '3000'
            ]).catch(print);
        },
        '>pick': () => {
            execAsync(['hyprpicker','-t','-a','-q','--no-fancy']).catch(print);
        },
        '>rewall': () => {
            App.closeWindow('wallselect')
            .then(`rm -rf .cache/ags/user/wallpapers`).catch(print);
        },

        '>': () => {}
    };

    commands[cmd]?.();
}

export const execAndClose = (command, terminal) => {
    App.closeWindow('overview');
    if (terminal) {
        execAsync(['bash', '-c', `${userOptions.value.apps.terminal} fish -C "${command}"`, '&']).catch(print);
    } else {
        execAsync(command).catch(print);
    }
};

export const couldBeMath = str => /^[0-9.+*/-]/.test(str);

export const expandTilde = path => path.startsWith('~') ? GLib.get_home_dir() + path.slice(1) : path;

const getFileIcon = fileInfo => fileInfo.get_icon()?.get_names()[0] || 'text-x-generic';

export function ls({ path = '~', silent = false }) {
    try {
        const expandedPath = expandTilde(path).replace(/\/$/, '');
        const folder = Gio.File.new_for_path(expandedPath);
        const enumerator = folder.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);

        const contents = [];
        let fileInfo;
        while ((fileInfo = enumerator.next_file(null))) {
            const fileName = fileInfo.get_display_name();
            const isDirectory = fileInfo.get_file_type() === Gio.FileType.DIRECTORY;

            contents.push({
                parentPath: expandedPath,
                name: fileName,
                type: isDirectory ? 'folder' : fileName.split('.').pop(),
                icon: getFileIcon(fileInfo)
            });
        }

        return contents.sort((a, b) => {
            const aIsFolder = a.type === 'folder';
            const bIsFolder = b.type === 'folder';
            return aIsFolder === bIsFolder ? a.name.localeCompare(b.name) : bIsFolder ? 1 : -1;
        });
    } catch (e) {
        if (!silent) console.log(e);
        return [];
    }
}
