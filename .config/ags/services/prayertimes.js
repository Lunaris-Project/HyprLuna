const { Gio, GLib } = imports.gi;
import Service from 'resource:///com/github/Aylur/ags/service.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const { execAsync } = Utils;

class PrayerTimesService extends Service {
    static {
        Service.register(
            this,
            {
                'updated': [],
                'adhanPlaying': ['string'],
            },
            {
                'nextPrayerName': ['string', 'r'],
                'nextPrayerTime': ['string', 'r'],
                'hijriDate': ['string', 'r'],
                'isha': ['string', 'r'],
                'maghrib': ['string', 'r'],
                'asr': ['string', 'r'],
                'dhuhr': ['string', 'r'],
                'fajr': ['string', 'r'],
                'isAdhanPlaying': ['boolean', 'r'],
            },
        );
    }

    _data = {};
    _nextPrayerName = '';
    _nextPrayerTime = '';
    _hijriDate = '';
    _isha = '';
    _maghrib = '';
    _asr = '';
    _dhuhr = '';
    _fajr = '';
    _isAdhanPlaying = false;
    _adhanCheckTimerId = null;
    _lastCheckedMinute = -1;

    get nextPrayerName() { return this._nextPrayerName; }
    get nextPrayerTime() { return this._nextPrayerTime; }
    get hijriDate() { return this._hijriDate; }
    get isha() { return this._isha; }
    get maghrib() { return this._maghrib; }
    get asr() { return this._asr; }
    get dhuhr() { return this._dhuhr; }
    get fajr() { return this._fajr; }
    get isAdhanPlaying() { return this._isAdhanPlaying; }

    refresh() {
        this.#fetchPrayerTimes();
    }

    // Test function to manually play adhan
    testAdhan(prayerName = 'Default') {
        // If a specific prayer name is provided, use it
        if (['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].includes(prayerName)) {
            this.#playAdhan(prayerName);
        } else {
            // Otherwise use the default
            this.#playAdhan('Default');
        }
        return `Playing adhan for ${prayerName}`;
    }

    #updateTimes(data) {
        if (!data || !data.data) return;

        this._data = data;
        const timings = data.data.timings;
        const date = data.data.date;

        // Update prayer times
        this._fajr = timings.Fajr;
        this._dhuhr = timings.Dhuhr;
        this._asr = timings.Asr;
        this._maghrib = timings.Maghrib;
        this._isha = timings.Isha;

        // Update Hijri date
        const hijri = date.hijri;
        this._hijriDate = `${hijri.day} ${hijri.month.en} ${hijri.year}`;

        // Calculate next prayer
        this.#calculateNextPrayer();

        // Save to cache
        this.#saveToCache(data);

        // Start checking for adhan times if not already checking
        this.#setupAdhanCheck();

        this.emit('updated');
    }

    #calculateNextPrayer() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

        const prayers = [
            { name: 'Fajr', time: this._fajr },
            { name: 'Dhuhr', time: this._dhuhr },
            { name: 'Asr', time: this._asr },
            { name: 'Maghrib', time: this._maghrib },
            { name: 'Isha', time: this._isha },
        ];

        let nextPrayer = prayers.find(prayer => prayer.time > currentTime);
        if (!nextPrayer) {
            nextPrayer = prayers[0]; // If no next prayer today, next is Fajr
        }

        this._nextPrayerName = nextPrayer.name;
        this._nextPrayerTime = nextPrayer.time;
    }

    #fetchPrayerTimes() {
        const currentDate = new Date();
        const day = currentDate.getDate().toString().padStart(2, '0');
        const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
        const year = currentDate.getFullYear();
        const formattedDate = `${day}-${month}-${year}`;

        // Explicitly get both city and country
        const city = userOptions.asyncGet().muslim.prayerTimes.city;
        const country = userOptions.asyncGet().muslim.prayerTimes.country;

        if (!city || !country) {
            console.error('City and country must be specified');
            return;
        }

        execAsync([
            'curl',
            '-s',
            `https://api.aladhan.com/v1/timingsByCity/${formattedDate}?city=${city}&country=${country}`,
        ]).then(output => {
            try {
                const data = JSON.parse(output);
                this.#updateTimes(data);
            } catch (error) {
                console.error('Error parsing prayer times:', error);
                this.#loadFromCache();
            }
        }).catch(error => {
            console.error('Error fetching prayer times:', error);
            this.#loadFromCache();
        });
    }

    #getCacheFilePath() {
        const cacheDir = GLib.get_user_cache_dir();
        return `${cacheDir}/prayer_times_cache.json`;
    }

    #saveToCache(data) {
        const cacheFilePath = this.#getCacheFilePath();
        const file = Gio.File.new_for_path(cacheFilePath);
        const outputStream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);

        const jsonData = JSON.stringify(data);
        outputStream.write(jsonData, null);
        outputStream.close(null);
    }

    #loadFromCache() {
        const cacheFilePath = this.#getCacheFilePath();
        const file = Gio.File.new_for_path(cacheFilePath);

        if (!file.query_exists(null)) {
            console.error('Cache file does not exist');
            return;
        }

        const inputStream = file.read(null);
        const data = inputStream.read_bytes(file.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null).get_size(), null).toString();
        inputStream.close(null);

        try {
            const parsedData = JSON.parse(data);
            this.#updateTimes(parsedData);
        } catch (error) {
            console.error('Error parsing cached prayer times:', error);
        }
    }

    #setupAdhanCheck() {
        // Only set up the timer if it's not already running
        if (this._adhanCheckTimerId !== null) {
            return;
        }

        // Check every 10 seconds
        this._adhanCheckTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
            try {
                this.#checkAndPlayAdhan();
            } catch (error) {
                console.error('Error checking adhan times:', error);
            }
            return GLib.SOURCE_CONTINUE; // Continue the timeout
        });
    }

    #checkAndPlayAdhan() {
        // Check if muslim.enabled is true
        if (!userOptions.asyncGet().muslim.enabled) {
            return;
        }

        // Don't check if adhan is already playing
        if (this._isAdhanPlaying) {
            return;
        }

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // To avoid multiple checks in the same minute
        const currentMinuteIdentifier = currentHour * 60 + currentMinute;
        if (currentMinuteIdentifier === this._lastCheckedMinute) {
            return;
        }
        this._lastCheckedMinute = currentMinuteIdentifier;

        const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
        
        // Check each prayer time
        const prayers = [
            { name: 'Fajr', time: this._fajr },
            { name: 'Dhuhr', time: this._dhuhr },
            { name: 'Asr', time: this._asr },
            { name: 'Maghrib', time: this._maghrib },
            { name: 'Isha', time: this._isha },
        ];

        for (const prayer of prayers) {
            // Extract only hours and minutes for comparison
            const prayerTimeParts = prayer.time.split(':');
            const prayerTimeStr = `${prayerTimeParts[0].padStart(2, '0')}:${prayerTimeParts[1].padStart(2, '0')}`;
            
            if (prayerTimeStr === currentTimeStr) {
                this.#playAdhan(prayer.name);
                break;
            }
        }
    }

    #playAdhan(prayerName) {
        // Determine which adhan file to play based on prayer name
        let adhanFileName = 'adhan_default.mp3'; // Default fallback
        
        try {
            // Get the adhan files from user options
            const adhanFiles = userOptions.asyncGet().muslim.adhanFiles;
            
            // Convert prayer name to lowercase for matching with config keys
            const prayerKey = prayerName.toLowerCase();
            
            // Use the prayer-specific file if defined, otherwise use default
            if (adhanFiles && adhanFiles[prayerKey]) {
                adhanFileName = adhanFiles[prayerKey];
                console.log(`Using prayer-specific adhan file: ${adhanFileName} for ${prayerName}`);
            } else {
                // If not found, fall back to Fajr-specific or default
                adhanFileName = prayerName === 'Fajr' ? 'adhan_fajr.mp3' : 'adhan_default.mp3';
                console.log(`No specific adhan file found for ${prayerName}, using ${adhanFileName}`);
            }
        } catch (error) {
            console.error(`Error getting adhan file name: ${error}`);
            // Fallback to simple logic if there's an error
            adhanFileName = prayerName === 'Fajr' ? 'adhan_fajr.mp3' : 'adhan_default.mp3';
        }
        
        // Full path to the adhan file
        const adhanPath = `${App.configDir}/assets/sounds/${adhanFileName}`;
        
        console.log(`Playing adhan for ${prayerName} prayer from ${adhanPath}`);

        // Set flag to indicate adhan is playing
        this._isAdhanPlaying = true;
        
        // Emit event with prayer name
        this.emit('adhanPlaying', prayerName);
        
        // Play using mpv
        execAsync(['mpv', adhanPath])
            .then(() => {
                console.log(`Finished playing adhan for ${prayerName}`);
                // Reset flag when adhan finishes
                this._isAdhanPlaying = false;
            })
            .catch(error => {
                console.error(`Error playing adhan: ${error}`);
                this._isAdhanPlaying = false;
            });
    }

    constructor() {
        super();
        this.#fetchPrayerTimes();
    }
}

// the singleton instance
const service = new PrayerTimesService();

// make it global for easy use
globalThis.prayerTimes = service;

// export to use in other modules
export default service;