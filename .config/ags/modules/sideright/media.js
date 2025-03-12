import Widget from "resource:///com/github/Aylur/ags/widget.js";
import GLib from "gi://GLib";
import Gio from "gi://Gio";

const SUPPORTED_FORMATS = /\.(mp3|wav|ogg|m4a|flac|opus|mp4|mkv)$/i;

const AudioFileButton = (filename, filepath) => Widget.Button({
    className: "audio-files-button",
    onClicked: () => {
        const proc = Gio.Subprocess.new(
            ["xdg-open", filepath],
            Gio.SubprocessFlags.NONE,
        );
        proc.wait_async(null, () => {});
    },
    child: Widget.Box({
        homogeneous: false,
        spacing: 8,
        children: [
            Widget.Icon({
                icon: "audio-x-generic-symbolic",
                size: 24,
                className: "audio-files-icon",
            }),
            Widget.Label({
                label: filename,
                xalign: 0,
                maxWidthChars: 30,
                truncate: "end",
                justification: "left",
                className: "audio-files-label",
            }),
        ],
    }),
});

const AudioFiles = ({ directory = GLib.get_home_dir() + "/Music" } = {}) => {
    const fileList = Widget.Box({
        vertical: true,
        className: "audio-files-list",
    });

    const updateFileList = () => {
        const dir = Gio.File.new_for_path(directory);
        fileList.children = [];

        try {
            const enumerator = dir.enumerate_children(
                "standard::*",
                Gio.FileQueryInfoFlags.NONE,
                null,
            );
            
            let fileInfo;
            while ((fileInfo = enumerator.next_file(null)) !== null) {
                const filename = fileInfo.get_name();
                if (!SUPPORTED_FORMATS.test(filename)) continue;

                const filepath = GLib.build_filenamev([directory, filename]);
                fileList.add(AudioFileButton(filename, filepath));
            }
        } catch (error) {
            console.error("Error reading directory:", error);
        }
    };

    const setupFileMonitor = (widget) => {
        const file = Gio.File.new_for_path(directory);
        const monitor = file.monitor_directory(
            Gio.FileMonitorFlags.NONE,
            null
        );

        const monitorHandler = monitor.connect('changed', updateFileList);

        widget.connect('destroy', () => {
            monitor.disconnect(monitorHandler);
            monitor.cancel();
        });

        return monitor;
    };

    return Widget.Box({
        vertical: true,
        className: "audio-files-widget",
        setup: self => {
            // Initial file list population
            updateFileList();
            
            // Setup file monitoring
            setupFileMonitor(self);

            // Cleanup handler
            self.connect('destroy', () => {
                self.get_children().forEach(child => {
                    if (child.destroy) child.destroy();
                });
            });
        },
        children: [
            Widget.Scrollable({
                child: fileList,
                vexpand: true,
                hscroll: "never",
                className: "audio-files-scrollable",
            }),
        ],
    });
};

export default AudioFiles;
