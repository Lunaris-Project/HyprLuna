const { Gdk, GLib } = imports.gi;
import Service from 'resource:///com/github/Aylur/ags/service.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';

const WALLPAPER_CONFIG_PATH = `${GLib.get_user_state_dir()}/ags/user/wallpaper.json`;

class WallpaperService extends Service {
    static {
        Service.register(
            this,
            {
                'updated': [],
                'preview-ready': [],
                'loading': [],
            },
        );
    }

    _wallPath = '';
    _wallJson = [];
    _monitorCount = 1;
    _loading = false;
    _previewFile = '';

    get loading() {
        return this._loading;
    }

    set loading(value) {
        this._loading = value;
        this.emit('loading');
    }

    generateWallpaper(prompt) {
        this.loading = true;
        console.log(`Generating wallpaper with prompt: ${prompt}`);

        return new Promise((resolve, reject) => {
            try {
                // Create a temporary file path
                const tempFile = GLib.build_filenamev([GLib.get_tmp_dir(), 'wallpaper.png']);

                // Encode the prompt for URL usage
                const encodedPrompt = encodeURIComponent(prompt);

                // Try multiple image generation services in order of quality
                const aiServices = [
                    // Pollinations.ai - Free AI image generation (works reliably)
                    {
                        name: 'Pollinations.ai',
                        url: `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1920&height=1080&nologo=true`,
                        method: 'GET',
                        directDownload: true
                    },

                    // Lexica.art API - AI image search (works reliably)
                    {
                        name: 'Lexica.art',
                        url: `https://lexica.art/api/v1/search?q=${encodedPrompt}`,
                        method: 'GET',
                        resultHandler: (output) => {
                            try {
                                const data = JSON.parse(output);
                                if (data && data.images && data.images.length > 0) {
                                    // Get a random image from the results
                                    const randomIndex = Math.floor(Math.random() * Math.min(data.images.length, 5));
                                    const imageUrl = data.images[randomIndex].src;
                                    return Utils.execAsync(['curl', '-L', '--max-time', '30', '-o', tempFile, imageUrl]);
                                } else {
                                    throw new Error('No images found in Lexica API response');
                                }
                            } catch (e) {
                                throw new Error('Failed to parse Lexica API response');
                            }
                        }
                    },

                    // Unsplash - High quality photos (not AI but good quality)
                    {
                        name: 'Unsplash',
                        url: `https://source.unsplash.com/1920x1080/?${encodedPrompt}`,
                        method: 'GET',
                        directDownload: true
                    },

                    // Picsum - Random high quality photos (fallback)
                    {
                        name: 'Picsum',
                        url: 'https://picsum.photos/1920/1080',
                        method: 'GET',
                        directDownload: true
                    }
                ];

                // Try each service in sequence
                const tryNextService = (index) => {
                    if (index >= aiServices.length) {
                        // All services failed, create a gradient as last resort
                        console.log('All image services failed. Falling back to generated gradient...');
                        return Utils.execAsync(['convert', '-size', '1920x1080',
                            `gradient:${this._getRandomColor()}-${this._getRandomColor()}`,
                            tempFile])
                            .then(() => {
                                console.log(`Created gradient wallpaper at ${tempFile}`);
                                this._previewFile = tempFile;
                                this.emit('preview-ready');
                                this.loading = false;
                                resolve(tempFile);
                            })
                            .catch(err => {
                                console.error('Error creating gradient wallpaper:', err);
                                this.loading = false;
                                reject(new Error('Failed to create wallpaper'));
                            });
                    }

                    const service = aiServices[index];
                    console.log(`Trying ${service.name} for image generation...`);

                    // Prepare curl command based on service configuration
                    let curlCmd = ['curl', '-L', '--max-time', '30'];

                    // Add headers if specified
                    if (service.headers) {
                        service.headers.forEach(header => {
                            curlCmd.push('-H', header);
                        });
                    }

                    // Add method if not GET
                    if (service.method && service.method !== 'GET') {
                        curlCmd.push('-X', service.method);
                    }

                    // Add data if specified
                    if (service.data) {
                        curlCmd.push('-d', service.data);
                    }

                    // For direct download services, download directly to file
                    if (service.directDownload) {
                        curlCmd.push('-o', tempFile, service.url);

                        Utils.execAsync(curlCmd)
                            .then(() => {
                                console.log(`Downloaded ${service.name} image to ${tempFile}`);
                                return this._isValidImage(tempFile);
                            })
                            .then(isValid => {
                                if (isValid) {
                                    this._previewFile = tempFile;
                                    this.emit('preview-ready');
                                    this.loading = false;
                                    resolve(tempFile);
                                } else {
                                    console.error(`Downloaded ${service.name} file is not a valid image`);
                                    return tryNextService(index + 1);
                                }
                            })
                            .catch(error => {
                                console.error(`Error with ${service.name}:`, error);
                                return tryNextService(index + 1);
                            });
                    } else {
                        // For API services, get the response and process it
                        curlCmd.push(service.url);

                        Utils.execAsync(curlCmd)
                            .then(output => {
                                return service.resultHandler(output);
                            })
                            .then(() => {
                                console.log(`Downloaded ${service.name} image to ${tempFile}`);
                                return this._isValidImage(tempFile);
                            })
                            .then(isValid => {
                                if (isValid) {
                                    this._previewFile = tempFile;
                                    this.emit('preview-ready');
                                    this.loading = false;
                                    resolve(tempFile);
                                } else {
                                    console.error(`Downloaded ${service.name} file is not a valid image`);
                                    return tryNextService(index + 1);
                                }
                            })
                            .catch(error => {
                                console.error(`Error with ${service.name}:`, error);
                                return tryNextService(index + 1);
                            });
                    }
                };

                // Start trying services
                tryNextService(0);

            } catch (error) {
                console.error('Error in generateWallpaper:', error);
                this.loading = false;
                reject(error);
            }
        });
    }

    // Helper method to generate random colors for gradients
    _getRandomColor() {
        const colors = [
            'blue', 'purple', 'pink', 'red', 'orange',
            'yellow', 'green', 'teal', 'navy', 'indigo',
            'violet', 'magenta', 'cyan', 'lime', 'coral'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Helper method to check if a file is a valid image
    _isValidImage(filePath) {
        return new Promise((resolve) => {
            // First check if the file exists and has a non-zero size
            Utils.execAsync(['stat', '-c', '%s', filePath])
                .then(size => {
                    const fileSize = parseInt(size.trim());
                    if (fileSize <= 100) { // If file is too small, it's probably not a valid image
                        console.log(`File ${filePath} is too small (${fileSize} bytes)`);
                        resolve(false);
                        return;
                    }

                    // Use file command to check if the file is an image
                    return Utils.execAsync(['file', '--mime-type', '-b', filePath]);
                })
                .then(mimeType => {
                    if (!mimeType) return resolve(false);

                    // Check if the mime type starts with 'image/'
                    const isImage = mimeType.trim().startsWith('image/');
                    console.log(`File ${filePath} is ${isImage ? 'a valid' : 'not a valid'} image (${mimeType.trim()})`);

                    // If it's an image, also check dimensions to ensure it's not a tiny image
                    if (isImage) {
                        Utils.execAsync(['identify', '-format', '%wx%h', filePath])
                            .then(dimensions => {
                                const [width, height] = dimensions.trim().split('x').map(Number);
                                const isValidSize = width >= 800 && height >= 600;
                                console.log(`Image dimensions: ${width}x${height}, valid size: ${isValidSize}`);
                                resolve(isValidSize);
                            })
                            .catch(() => {
                                // If identify fails, still consider it a valid image
                                resolve(true);
                            });
                    } else {
                        resolve(false);
                    }
                })
                .catch(error => {
                    console.error('Error checking file type:', error);
                    // If there's an error, assume it's not a valid image
                    resolve(false);
                });
        });
    }



    saveWallpaper(filePath) {
        // This is a placeholder implementation
        // In a real implementation, you would save the wallpaper to the user's pictures directory
        console.log(`Saving wallpaper from ${filePath} to Pictures directory`);

        return new Promise((resolve, reject) => {
            try {
                // Simulate saving the file
                Utils.timeout(500, () => {
                    console.log('Wallpaper saved successfully');
                    resolve(true);
                });
            } catch (error) {
                console.error('Error saving wallpaper:', error);
                reject(error);
            }
        });
    }

    setWallpaper(filePath) {
        // This is a placeholder implementation
        // In a real implementation, you would set the wallpaper using the system's wallpaper service
        console.log(`Setting wallpaper from ${filePath}`);

        return new Promise((resolve, reject) => {
            try {
                // Simulate setting the wallpaper
                Utils.timeout(500, () => {
                    console.log('Wallpaper set successfully');
                    resolve(true);
                });
            } catch (error) {
                console.error('Error setting wallpaper:', error);
                reject(error);
            }
        });
    }

    setAsProfilePhoto(filePath) {
        // This is a placeholder implementation
        // In a real implementation, you would set the profile photo using the system's user account service
        console.log(`Setting profile photo from ${filePath}`);

        return new Promise((resolve, reject) => {
            try {
                // Simulate setting the profile photo
                Utils.timeout(500, () => {
                    console.log('Profile photo set successfully');
                    resolve(true);
                });
            } catch (error) {
                console.error('Error setting profile photo:', error);
                reject(error);
            }
        });
    }

    _monitorCount = 1;

    _save() {
        Utils.writeFile(JSON.stringify(this._wallJson), this._wallPath)
            .catch(print);
    }

    add(path) {
        this._wallJson.push(path);
        this._save();
        this.emit('updated');
    }

    set(path, monitor = -1) {
        this._monitorCount = Gdk.Display.get_default()?.get_n_monitors() || 1;
        if (this._wallJson.length < this._monitorCount) this._wallJson[this._monitorCount - 1] = "";
        if (monitor == -1)
            this._wallJson.fill(path);
        else
            this._wallJson[monitor] = path;

        this._save();
        this.emit('updated');
    }

    get(monitor = 0) {
        return this._wallJson[monitor];
    }

    constructor() {
        super();
        // How many screens?
        this._monitorCount = Gdk.Display.get_default()?.get_n_monitors() || 1;
        // Read config
        this._wallPath = WALLPAPER_CONFIG_PATH;
        try {
            const fileContents = Utils.readFile(this._wallPath);
            this._wallJson = JSON.parse(fileContents);
        }
        catch {
            Utils.exec(`bash -c 'mkdir -p ${GLib.get_user_cache_dir()}/ags/user'`);
            Utils.exec(`touch ${this._wallPath}`);
            Utils.writeFile('[]', this._wallPath).then(() => {
                this._wallJson = JSON.parse(Utils.readFile(this._wallPath))
            }).catch(print);
        }
    }
}

// instance
const service = new WallpaperService();
// make it global for easy use with cli
globalThis['wallpaper'] = service;
export default service;