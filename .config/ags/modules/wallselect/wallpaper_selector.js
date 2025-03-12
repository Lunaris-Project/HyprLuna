import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import App from "resource:///com/github/Aylur/ags/app.js";
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gdk from 'gi://Gdk';
import userOptions from '../.configuration/user_options.js';
const { Box, Label, EventBox, Scrollable, Button } = Widget;
const { wallselect: opts, etc } = await userOptions.asyncGet();
const elevate = etc.widgetCorners ? "wall-rounding shadow-window" : "elevation shadow-window";
const WALLPAPER_DIR = GLib.get_home_dir() + (opts.wallpaperFolder || '/Pictures/Wallpapers');
const PREVIEW_WIDTH = opts.width || 200;
const PREVIEW_HEIGHT = opts.height || 120;
const PREVIEW_CORNER = opts.radius || 18;
const HIGH_QUALITY_PREVIEW = opts.highQualityPreview;
const wallpaperStore = GLib.get_user_state_dir() + '/ags/user/current_wallpaper.txt';

// Set up disk cache.
const DISK_CACHE_DIR = GLib.get_user_cache_dir() + '/ags/user/wallpapers';
GLib.mkdir_with_parents(DISK_CACHE_DIR, 0o755);

// Helper to extract the file extension and compute a cache file name.
const getCacheInfo = (path) => {
    const basename = GLib.path_get_basename(path);
    const dotIndex = basename.lastIndexOf('.');
    const ext = dotIndex !== -1 ? basename.substring(dotIndex + 1).toLowerCase() : "png";
    return { cachedFileName: basename, format: ext === "jpg" ? "jpeg" : ext };
};

// Asynchronously load and scale a preview image with disk caching.
const loadPreviewAsync = async (path) => {
    const { cachedFileName } = getCacheInfo(path);
    const diskCachePath = DISK_CACHE_DIR + '/' + cachedFileName;
    const diskCacheFile = Gio.File.new_for_path(diskCachePath);
    if (diskCacheFile.query_exists(null)) {
        // Compare modification times: use cache only if the original file is older.
        const originalFile = Gio.File.new_for_path(path);
        try {
            const diskInfo = diskCacheFile.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null);
            const originalInfo = originalFile.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null);
            if (originalInfo.get_attribute_uint64('time::modified') <= diskInfo.get_attribute_uint64('time::modified')) {
                try {
                    return GdkPixbuf.Pixbuf.new_from_file(diskCachePath);
                } catch (e) {
                    log(`Error loading disk cached image ${diskCachePath}: ${e}`);
                }
            }
        } catch (e) {
            log(`Error comparing modification times for caching: ${e}`);
        }
    }

    // Load and scale the image if not cached or if cache is outdated.
    let pixbuf;
    if (path.toLowerCase().endsWith('.gif')) {
        const animation = GdkPixbuf.PixbufAnimation.new_from_file(path);
        pixbuf = animation.get_static_image().scale_simple(PREVIEW_WIDTH, PREVIEW_HEIGHT, GdkPixbuf.InterpType.BILINEAR);
    } else if (HIGH_QUALITY_PREVIEW) {
        pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(path, PREVIEW_WIDTH, PREVIEW_HEIGHT, true);
    } else {
        const fullPixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
        pixbuf = fullPixbuf.scale_simple(PREVIEW_WIDTH, PREVIEW_HEIGHT, GdkPixbuf.InterpType.NEAREST);
    }

    // Save the newly generated image to disk.
    const { format } = getCacheInfo(path);
    try {
        pixbuf.savev(diskCachePath, format, [], []);
    } catch (e) {
        log(`Error saving disk cached image ${diskCachePath}: ${e}`);
    }
    return pixbuf;
};

// Cache for wallpaper paths (cached for 60 seconds).
let wallpaperPathsCache = null;
let wallpaperPathsCacheTime = 0;
const CACHE_DURATION = 60 * 1e6; // 60 seconds in microseconds

const getWallpaperPaths = async () => {
    const now = GLib.get_monotonic_time();
    if (wallpaperPathsCache && now - wallpaperPathsCacheTime < CACHE_DURATION) {
        return wallpaperPathsCache;
    }
    const files = await Utils.execAsync(
        `find ${GLib.shell_quote(WALLPAPER_DIR)} -type f \\( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.gif" -o -iname "*.webp" -o -iname "*.tga" -o -iname "*.tiff" -o -iname "*.bmp" -o -iname "*.ico" \\)`
    );
    wallpaperPathsCache = files.split("\n").filter(Boolean);
    wallpaperPathsCacheTime = now;
    return wallpaperPathsCache;
};

const WallpaperPreview = (path) =>
    Button({
        child: EventBox({
            setup: (self) => {
                const drawingArea = new Gtk.DrawingArea();
                drawingArea.set_size_request(PREVIEW_WIDTH, PREVIEW_HEIGHT);
                self.add(drawingArea);
                let pixbuf = null;

                // Function to load the image.
                const loadImage = () => {
                    loadPreviewAsync(path)
                        .then((p) => {
                            pixbuf = p;
                            drawingArea.queue_draw();
                        })
                        .catch((e) => {
                            log(`Error loading image ${path}: ${e}`);
                            drawingArea.queue_draw();
                        });
                };

                // Load image on widget mapping.
                if (drawingArea.get_mapped()) {
                    loadImage();
                } else {
                    drawingArea.connect("map", loadImage);
                }
                drawingArea.connect("draw", (widget, cr) => {
                    if (pixbuf) {
                        const areaWidth = widget.get_allocated_width();
                        const areaHeight = widget.get_allocated_height();
                        cr.save();
                        // Create a rounded clipping path.
                        cr.newPath();
                        cr.arc(PREVIEW_CORNER, PREVIEW_CORNER, PREVIEW_CORNER, Math.PI, 1.5 * Math.PI);
                        cr.arc(areaWidth - PREVIEW_CORNER, PREVIEW_CORNER, PREVIEW_CORNER, 1.5 * Math.PI, 2 * Math.PI);
                        cr.arc(areaWidth - PREVIEW_CORNER, areaHeight - PREVIEW_CORNER, PREVIEW_CORNER, 0, 0.5 * Math.PI);
                        cr.arc(PREVIEW_CORNER, areaHeight - PREVIEW_CORNER, PREVIEW_CORNER, 0.5 * Math.PI, Math.PI);
                        cr.closePath();
                        cr.clip();

                        // Compute independent scale factors for width and height.
                        const scaleX = areaWidth / pixbuf.get_width();
                        const scaleY = areaHeight / pixbuf.get_height();
                        cr.scale(scaleX, scaleY);

                        // Draw the image so that it fills the entire area.
                        Gdk.cairo_set_source_pixbuf(cr, pixbuf, 0, 0);
                        cr.paint();
                        cr.restore();
                    }
                    return false;
                });
            }
        }),
        onClicked: async () => {
            try {
                await Utils.execAsync([`bash`, `-c`, `${App.configDir}/scripts/color_generation/colorgen.sh ${path}`]);
                App.closeWindow('wallselect');
            } catch (error) {
                console.error("Error during color generation:", error);
            }
        }
    });

// A placeholder widget when no wallpapers are found.
const createPlaceholder = () =>
    Box({
        className: 'wallpaper-placeholder',
        vertical: true,
        vexpand: true,
        hexpand: true,
        spacing: 10,
        children: [
            Box({
                vertical: true,
                vpack: 'center',
                hpack: 'center',
                vexpand: true,
                children: [
                    Label({ label: 'No wallpapers found.', className: 'txt-norm onSurfaceVariant' }),
                    Label({ label: 'Add wallpapers to get started.', opacity: 0.8, className: 'txt-small onSurfaceVariant' }),
                ],
            }),
        ],
    });

// Create the wallpaper content container.
const createContent = async () => {
    try {
        const wallpaperPaths = await getWallpaperPaths();
        if (!wallpaperPaths.length) return createPlaceholder();
        return EventBox({
            onPrimaryClick: () => App.closeWindow("wallselect"),
            onSecondaryClick: () => App.closeWindow("wallselect"),
            onMiddleClick: () => App.closeWindow("wallselect"),
            child: Scrollable({
                hexpand: true,
                vexpand: false,
                hscroll: "always",
                vscroll: "never",
                child: Box({
                    className: "wallpaper-list",
                    children: wallpaperPaths.map(WallpaperPreview),
                }),
            }),
        });
    } catch (error) {
        return Box({
            className: "wallpaper-error",
            vexpand: true,
            hexpand: true,
            children: [Label({ label: "Error loading wallpapers.", className: "txt-large txt-error" })],
        });
    }
};

export default () =>
    Box({
        vertical: true,
        className: `wallselect-bg ${elevate}`,
        children: [
            Box({
                className: "wallselect-header",
                children: [Box({ hexpand: true })],
            }),
            Box({
                vertical: true,
                vpack: "center",
                className: "wallselect-content",
                setup: (self) => {
                    self.hook(App, async (_, name, visible) => {
                        if (name === "wallselect" && visible) {
                            self.children = [await createContent()];
                        }
                    }, "window-toggled");
                },
            }),
        ],
    });
