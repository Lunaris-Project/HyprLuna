import GLib from 'gi://GLib';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js'
import { writable, clone } from '../.miscutils/store.js';
import { fileExists } from '../.miscutils/files.js';

const defaultConfigPath = `${GLib.get_current_dir()}/.config/ags/modules/.configuration/user_options.default.json`;
let configOptions = {};

try {
    const defaultConfig = Utils.readFile(defaultConfigPath);
    configOptions = JSON.parse(defaultConfig);
} catch (e) {
    console.error('Error loading user_options.default.jsonc:', e);
}

let optionsOkay = true;
function overrideConfigRecursive(userOverrides, configOptions = {}, check = true) {
    for (const [key, value] of Object.entries(userOverrides)) {
        if (key === '__custom' || (configOptions['__custom'] instanceof Array &&
            configOptions['__custom'].indexOf(key) >= 0)) {
            configOptions[key] = value;
            continue;
        }

        if (configOptions[key] === undefined && check) {
            console.error(`Missing config option: ${key}`);
            optionsOkay = false;
            continue;
        }

        if (typeof value === 'object' && value !== null && !(value instanceof Array)) {
            if (!configOptions[key]) configOptions[key] = {};
            overrideConfigRecursive(value, configOptions[key], check);
        } else {
            configOptions[key] = value;
        }
    }
}

const USER_CONFIG_FOLDER = GLib.get_home_dir() + '/.ags/';
const _userOptions = writable(configOptions);

async function config_error_parse(e) {
    Utils.notify({
        summary: 'Failed to load config',
        body: e.message || 'Unknown'
    });
}

// Function to check for both .json and .jsonc files
const findConfigFile = (basePath) => {
    const jsonPath = `${basePath}.json`;
    const jsoncPath = `${basePath}.jsonc`;

    if (fileExists(jsonPath)) {
        return jsonPath;
    } else if (fileExists(jsoncPath)) {
        return jsoncPath;
    }

    return null;
};

const update = (file) => {
    // If file is a path without extension, try to find the correct file
    let configFile = file;
    if (typeof file === 'string' && !file.endsWith('.json') && !file.endsWith('.jsonc')) {
        configFile = findConfigFile(file);
        if (!configFile) {
            Utils.notify({
                summary: 'Config file not found',
                body: `Could not find ${file}.json or ${file}.jsonc`
            });
            return false;
        }
    }

    if (fileExists(configFile)) {
        try {
            optionsOkay = true; // Reset the flag at the start of each update
            const userOverrides = Utils.readFile(configFile);
            const copy_configOptions = clone(configOptions);
            overrideConfigRecursive(JSON.parse(userOverrides), copy_configOptions);
            if (!optionsOkay) {
                Utils.timeout(2000, () => Utils.execAsync([
                    'notify-send',
                    'Update your user options',
                    'One or more config options don\'t exist',
                    '-a', 'ags',
                ]).catch(print));
                return false;
            }
            _userOptions.set(copy_configOptions);
            return true; // Indicate success
        } catch (e) {
            config_error_parse(e);
            return false;
        }
    }
    return false;
};

// Try to find the config file (either .json or .jsonc)
const configBasePath = USER_CONFIG_FOLDER + 'config';
const configFile = findConfigFile(configBasePath) || USER_CONFIG_FOLDER + 'config.json';

// Load the config file
update(configFile);

// Monitor both possible config files for changes
const monitorJson = Utils.monitorFile(USER_CONFIG_FOLDER + 'config.json', (file, event) => {
    if (event === 1) { // GFileMonitorEvent.CHANGED
        const success = update(file.get_path());
        if (success) {
            // Restart AGS on successful config update
            Utils.execAsync(['bash','-c',`${App.configDir}/scripts/restart_ags.sh`]).catch(print);
        }
    }
});

const monitorJsonc = Utils.monitorFile(USER_CONFIG_FOLDER + 'config.jsonc', (file, event) => {
    if (event === 1) { // GFileMonitorEvent.CHANGED
        const success = update(file.get_path());
        if (success) {
            // Restart AGS on successful config update
            Utils.execAsync(['bash','-c',`${App.configDir}/scripts/restart_ags.sh`]).catch(print);
        }
    }
});

globalThis['userOptions'] = _userOptions;
export default _userOptions;