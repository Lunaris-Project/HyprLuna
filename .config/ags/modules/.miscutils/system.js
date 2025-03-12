const { GLib, Gio } = imports.gi;
const { execAsync, exec } = Utils;
import Variable from 'resource:///com/github/Aylur/ags/variable.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';

export const distroID = exec(`bash -c 'cat /etc/os-release | grep "^ID=" | cut -d "=" -f 2 | sed "s/\\"//g"'`).trim();
export const isDebianDistro = (distroID == 'linuxmint' || distroID == 'ubuntu' || distroID == 'debian' || distroID == 'zorin' || distroID == 'popos' || distroID == 'raspbian' || distroID == 'kali');
export const isArchDistro = (distroID == 'arch' || distroID == 'endeavouros' || distroID == 'cachyos' || distroID == 'arcolinux');
export const hasFlatpak = !!exec(`bash -c 'command -v flatpak'`);
export const darkMode = Variable(!(Utils.readFile(GLib.get_user_state_dir() + '/ags/user/colormode.txt').split('\n')[0].trim() == 'light'));
darkMode.connect('changed', async ({ value }) => {
    try {
        const lightdark = value ? "dark" : "light";
        const userDir = GLib.get_user_state_dir();
        await execAsync([
            'bash',
            '-c',
            `mkdir -p "${userDir}/ags/user" && sed -i "1s/.*/${lightdark}/" "${userDir}/ags/user/colormode.txt"`
        ])
        runMatugen()
    } catch (error) {
        console.error('Error changing dark mode:', error);
    }
});
globalThis['darkMode'] = darkMode;
export const hasPlasmaIntegration = !!Utils.exec('bash -c "command -v plasma-browser-integration-host"');

export const devMode = Variable(false);
globalThis['devMode'] = devMode;

export const getDistroIcon = () => {
    if (distroID == 'arch') return 'arch-symbolic';
    if (distroID == 'endeavouros') return 'endeavouros-symbolic';
    if (distroID == 'cachyos') return 'cachyos-symbolic';
    if (distroID == 'arcolinux') return 'arcolinux-symbolic';
    if (distroID == 'nixos') return 'nixos-symbolic';
    if (distroID == 'fedora') return 'fedora-symbolic';
    if (distroID == 'linuxmint') return 'ubuntu-symbolic';
    if (distroID == 'ubuntu') return 'ubuntu-symbolic';
    if (distroID == 'debian') return 'debian-symbolic';
    if (distroID == 'zorin') return 'ubuntu-symbolic';
    if (distroID == 'popos') return 'ubuntu-symbolic';
    if (distroID == 'raspbian') return 'debian-symbolic';
    if (distroID == 'kali') return 'debian-symbolic';
    return 'linux-symbolic';
}

export const getDistroName = () => {
    if (distroID == 'arch') return 'Arch Linux';
    if (distroID == 'endeavouros') return 'EndeavourOS';
    if (distroID == 'cachyos') return 'CachyOS';
    if (distroID == 'arcolinux') return 'ArcoLinux';
    if (distroID == 'nixos') return 'NixOS';
    if (distroID == 'fedora') return 'Fedora';
    if (distroID == 'linuxmint') return 'Linux Mint';
    if (distroID == 'ubuntu') return 'Ubuntu';
    if (distroID == 'debian') return 'Debian';
    if (distroID == 'zorin') return 'Zorin';
    if (distroID == 'popos') return 'Pop!_OS';
    if (distroID == 'raspbian') return 'Raspbian';
    if (distroID == 'kali') return 'Kali Linux';
    return 'Linux';
}
