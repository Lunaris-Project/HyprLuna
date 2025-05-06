import Widget from "resource:///com/github/Aylur/ags/widget.js";
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import App from "resource:///com/github/Aylur/ags/app.js";
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gdk from 'gi://Gdk';
import userOptions from '../.configuration/user_options.js';
import { MaterialIcon } from "../.commonwidgets/materialicon.js";
const { Box, Label, EventBox, Scrollable, Button } = Widget;
const { wallselect: opts, etc } = await userOptions.asyncGet();
const elevate = etc.widgetCorners ? "wall-rounding shadow-window" : "elevation shadow-window";
const WALLPAPER_DIR = GLib.get_home_dir() + (opts.wallpaperFolder || '/Pictures/Wallpapers');
// إنشاء المجلد إذا لم يكن موجودا
GLib.mkdir_with_parents(WALLPAPER_DIR, 0o755);
const PREVIEW_WIDTH = opts.width || 200;
const PREVIEW_HEIGHT = opts.height || 120;
const PREVIEW_CORNER = opts.radius || 18;
const HIGH_QUALITY_PREVIEW = opts.highQualityPreview;
const wallpaperStore = GLib.get_user_state_dir() + '/ags/user/current_wallpaper.txt';
const DISK_CACHE_DIR = GLib.get_user_cache_dir() + '/ags/user/wallpapers';
GLib.mkdir_with_parents(DISK_CACHE_DIR, 0o755);

// تحديد عدد الصور في كل صفحة
const IMAGES_PER_PAGE = 30;
// مؤشر الصفحة الحالية
let currentPage = 0;

// إضافة متغير عام للتحديث
let contentUpdateCallback = null;

const getCacheInfo = (path) => {
    const basename = GLib.path_get_basename(path);
    const dotIndex = basename.lastIndexOf('.');
    const ext = dotIndex !== -1 ? basename.substring(dotIndex + 1).toLowerCase() : "png";
    return { cachedFileName: basename, format: ext === "jpg" ? "jpeg" : ext };
};
const loadPreviewAsync = async (path) => {
    const { cachedFileName } = getCacheInfo(path);
    const diskCachePath = DISK_CACHE_DIR + '/' + cachedFileName;
    const diskCacheFile = Gio.File.new_for_path(diskCachePath);
    if (diskCacheFile.query_exists(null)) {
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
    const { format } = getCacheInfo(path);
    try {
        pixbuf.savev(diskCachePath, format, [], []);
    } catch (e) {
        log(`Error saving disk cached image ${diskCachePath}: ${e}`);
    }
    return pixbuf;
};

let wallpaperPathsCache = null;
let wallpaperPathsCacheTime = 0;
const CACHE_DURATION = 60 * 1e6;

const getWallpaperPaths = async () => {
    try {
        const now = GLib.get_monotonic_time();
        if (wallpaperPathsCache && now - wallpaperPathsCacheTime < CACHE_DURATION) {
            return wallpaperPathsCache;
        }

        // فحص وجود المجلد
        const dir = Gio.File.new_for_path(WALLPAPER_DIR);
        if (!dir.query_exists(null)) {
            GLib.mkdir_with_parents(WALLPAPER_DIR, 0o755);
            return [];
        }

        try {
            // استخدام Gio لقراءة محتويات المجلد مباشرة بدلاً من الاعتماد على أمر find
            const wallpaperFiles = [];
            const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tga', '.tiff', '.bmp', '.ico'];

            const enumerator = dir.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
            let fileInfo;

            while ((fileInfo = enumerator.next_file(null)) !== null) {
                // تجاهل المجلدات
                if (fileInfo.get_file_type() === Gio.FileType.DIRECTORY) {
                    continue;
                }

                const fileName = fileInfo.get_name();
                const fileExtension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

                if (validExtensions.includes(fileExtension)) {
                    const filePath = WALLPAPER_DIR + '/' + fileName;
                    wallpaperFiles.push(filePath);
                }
            }

            wallpaperPathsCache = wallpaperFiles;
            wallpaperPathsCacheTime = now;

            return wallpaperFiles;
        } catch (error) {
            console.error('خطأ أثناء قراءة المجلد:', error);

            // محاولة الاستخدام بأمر ls كحل بديل إذا فشلت الطريقة السابقة
            const lsCommand = `ls -1 "${WALLPAPER_DIR}" | grep -E "\\.(jpg|jpeg|png|gif|webp|tga|tiff|bmp|ico)$" | awk '{print "${WALLPAPER_DIR}/"$0}'`;

            const files = await Utils.execAsync(['bash', '-c', lsCommand]);

            if (!files || !files.trim()) {
                console.log('لم يتم العثور على صور خلفيات.');
                return [];
            }

            wallpaperPathsCache = files.split("\n").filter(Boolean);
            wallpaperPathsCacheTime = now;

            return wallpaperPathsCache;
        }
    } catch (error) {
        console.error('خطأ أثناء البحث عن الصور:', error);
        return [];
    }
};

const WallpaperPreview = (path) =>
    Button({
        child: EventBox({
            setup: (self) => {
                const drawingArea = new Gtk.DrawingArea();
                drawingArea.set_size_request(PREVIEW_WIDTH, PREVIEW_HEIGHT);
                self.add(drawingArea);
                let pixbuf = null;
                let imageLoaded = false;
                let loadPromise = null;

                // تأخير تحميل الصورة حتى تكون مرئية
                const loadImage = () => {
                    if (imageLoaded || loadPromise) return;

                    // تحميل الصورة بعد تأخير صغير لتحسين الأداء
                    loadPromise = Utils.timeout(50, () => {
                        loadPreviewAsync(path)
                            .then((p) => {
                                pixbuf = p;
                                imageLoaded = true;
                                drawingArea.queue_draw();
                            })
                            .catch((e) => {
                                console.error(`Error loading image ${path}: ${e}`);
                                drawingArea.queue_draw();
                            });
                        return false; // لا يتكرر
                    });
                };

                // تحميل الصورة عند ظهورها فقط
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
                        cr.newPath();
                        cr.arc(PREVIEW_CORNER, PREVIEW_CORNER, PREVIEW_CORNER, Math.PI, 1.5 * Math.PI);
                        cr.arc(areaWidth - PREVIEW_CORNER, PREVIEW_CORNER, PREVIEW_CORNER, 1.5 * Math.PI, 2 * Math.PI);
                        cr.arc(areaWidth - PREVIEW_CORNER, areaHeight - PREVIEW_CORNER, PREVIEW_CORNER, 0, 0.5 * Math.PI);
                        cr.arc(PREVIEW_CORNER, areaHeight - PREVIEW_CORNER, PREVIEW_CORNER, 0.5 * Math.PI, Math.PI);
                        cr.closePath();
                        cr.clip();
                        const scaleX = areaWidth / pixbuf.get_width();
                        const scaleY = areaHeight / pixbuf.get_height();
                        cr.scale(scaleX, scaleY);
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

// Create pagination controls following Material You design
const createPaginationControls = (totalPages) => {
    // Create a label for page counter
    const pageInfoLabel = Label({
        className: 'wallpaper-pagination-counter',
        xalign: 0.5, // Center align text
        label: `${currentPage + 1}/${totalPages}`,
        css: 'font-size: 1rem;', // Set font size directly
    });

    // Update the page display
    const updatePageDisplay = () => {
        pageInfoLabel.label = `${currentPage + 1}/${totalPages}`;
    };

    return Box({
        className: 'material-pagination-container',
        hpack: 'center',
        spacing: 4,
        children: [
            // First page button
            Button({
                className: 'wallpaper-pagination-btn',
                child: MaterialIcon('first_page', 'norm'),
                setup: (self) => {
                    if (self.child) {
                        self.child.css = 'font-size: 18px;';
                    }
                },
                tooltipText: 'First page',
                onClicked: () => {
                    if (currentPage !== 0) {
                        currentPage = 0;
                        updatePageDisplay();
                        if (contentUpdateCallback) contentUpdateCallback();
                    }
                },
            }),
            // Previous page button
            Button({
                className: 'wallpaper-pagination-btn',
                child: MaterialIcon('navigate_before', 'norm'),
                setup: (self) => {
                    if (self.child) {
                        self.child.css = 'font-size: 18px;';
                    }
                },
                tooltipText: 'Previous page',
                onClicked: () => {
                    if (currentPage > 0) {
                        currentPage--;
                        updatePageDisplay();
                        if (contentUpdateCallback) contentUpdateCallback();
                    }
                },
            }),
            // Page counter
            pageInfoLabel,
            // Next page button
            Button({
                className: 'wallpaper-pagination-btn',
                child: MaterialIcon('navigate_next', 'norm'),
                setup: (self) => {
                    if (self.child) {
                        self.child.css = 'font-size: 18px;';
                    }
                },
                tooltipText: 'Next page',
                onClicked: () => {
                    if (currentPage < totalPages - 1) {
                        currentPage++;
                        updatePageDisplay();
                        if (contentUpdateCallback) contentUpdateCallback();
                    }
                },
            }),
            // Last page button
            Button({
                className: 'wallpaper-pagination-btn',
                child: MaterialIcon('last_page', 'norm'),
                setup: (self) => {
                    if (self.child) {
                        self.child.css = 'font-size: 18px;';
                    }
                },
                tooltipText: 'Last page',
                onClicked: () => {
                    if (currentPage !== totalPages - 1) {
                        currentPage = totalPages - 1;
                        updatePageDisplay();
                        if (contentUpdateCallback) contentUpdateCallback();
                    }
                },
            }),
        ],
    });
};

const createContent = async () => {
    try {
        // console.log("Loading wallpapers from:", WALLPAPER_DIR);
        const wallpaperPaths = await getWallpaperPaths();

        // console.log(`Found ${wallpaperPaths.length} wallpapers.`);

        if (!wallpaperPaths.length) {
            console.log("No wallpapers found.");
            return createPlaceholder();
        }

        // حساب عدد الصفحات الإجمالي
        const totalPages = Math.ceil(wallpaperPaths.length / IMAGES_PER_PAGE);

        // التأكد من أن مؤشر الصفحة الحالية ضمن النطاق المسموح
        if (currentPage >= totalPages) {
            currentPage = totalPages - 1;
        }
        if (currentPage < 0) {
            currentPage = 0;
        }

        // تحديد مجموعة الصور التي سيتم عرضها في الصفحة الحالية
        const startIndex = currentPage * IMAGES_PER_PAGE;
        const endIndex = Math.min(startIndex + IMAGES_PER_PAGE, wallpaperPaths.length);
        const currentPageWallpapers = wallpaperPaths.slice(startIndex, endIndex);

        // console.log(`Displaying page ${currentPage + 1}/${totalPages} (images ${startIndex + 1}-${endIndex} of ${wallpaperPaths.length})`);

        const contentBox = Box({
            vertical: true,
            spacing: 10,
            children: [
                Box({
                    setup: (self) => {
                        // Create a scrollable container
                        const scrollable = Scrollable({
                            hexpand: true,
                            vexpand: false,
                            hscroll: "always",
                            vscroll: "never",
                            child: Box({
                                className: "wallpaper-list",
                                children: currentPageWallpapers.map(WallpaperPreview),
                            }),
                        });

                        // Create an event box to handle clicks and scrolling
                        const eventBox = EventBox({
                            onPrimaryClick: () => App.closeWindow("wallselect"),
                            onSecondaryClick: () => App.closeWindow("wallselect"),
                            onMiddleClick: () => App.closeWindow("wallselect"),
                            onScrollUp: () => {
                                // Scroll left when mouse wheel scrolls up
                                const adj = scrollable.get_hadjustment();
                                const scrollAmount = 80; // Reduced scroll amount for smoother scrolling
                                adj.set_value(Math.max(adj.get_value() - scrollAmount, adj.get_lower()));
                            },
                            onScrollDown: () => {
                                // Scroll right when mouse wheel scrolls down
                                const adj = scrollable.get_hadjustment();
                                const scrollAmount = 80; // Reduced scroll amount for smoother scrolling
                                adj.set_value(Math.min(adj.get_value() + scrollAmount, adj.get_upper() - adj.get_page_size()));
                            },
                            child: scrollable,
                        });

                        // Add the event box to the container
                        self.add(eventBox);
                    },
                }),
                // إضافة أزرار التنقل بين الصفحات
                createPaginationControls(totalPages)
            ]
        });

        return contentBox;
    } catch (error) {
        console.error("Error loading wallpapers:", error);
        return Box({
            className: "wallpaper-error",
            vexpand: true,
            hexpand: true,
            children: [Label({ label: "Error loading wallpapers.", className: "txt-large txt-error" })],
        });
    }
};

// Note: This function is kept for reference but not currently used
// It can be used to update the content without recreating the entire widget
/*
const updateContent = async (contentBox) => {
    try {
        const content = await createContent();
        if (contentBox && content) {
            contentBox.children = [content];
        }
    } catch (error) {
        console.error('Error updating content:', error);
    }
};
*/

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
                    // تحديث وظيفة التحديث للاستخدام مع أزرار التنقل
                    contentUpdateCallback = async () => {
                        try {
                            self.children = [await createContent()];
                        } catch (error) {
                            console.error('Error in contentUpdateCallback:', error);
                        }
                    };

                    self.hook(App, async (_, name, visible) => {
                        if (name === "wallselect" && visible) {
                            // إعادة تعيين الصفحة الحالية في كل مرة يتم فيها فتح النافذة
                            currentPage = 0;
                            self.children = [await createContent()];
                        }
                    }, "window-toggled");
                },
            }),
        ],
    });
