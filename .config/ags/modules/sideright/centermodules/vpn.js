import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const { Box, Button, Label, Revealer, Scrollable, Stack, Overlay } = Widget;
const { execAsync, exec } = Utils;
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';

const VPN_STATUS = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
};

let currentStatus = VPN_STATUS.DISCONNECTED;
let currentServer = null;
let vpnServers = [];

const updateVpnServers = async () => {
    try {
        const result = await execAsync('wget -qO- https://www.vpngate.net/api/iphone/');
        const lines = result.split('\n').filter(line => line.trim() !== '*' && line.trim() !== '');
        vpnServers = lines.slice(1).map(line => {
            const [
                HostName,
                IP,
                Score,
                Ping,
                Speed,
                CountryLong,
                CountryShort,
                NumVpnSessions,
                Uptime,
                TotalUsers,
                TotalTraffic,
                LogType,
                Operator,
                Message,
                OpenVPN_ConfigData_Base64
            ] = line.split(',');

            return {
                hostName: HostName,
                country: CountryLong,
                speed: Speed,
                ping: Ping,
                configData: OpenVPN_ConfigData_Base64
            };
        });
    } catch (error) {
        console.error('Failed to fetch VPN servers:', error);
    }
};

const VpnServer = (server) => {
    const isConnected = currentServer?.hostName === server.hostName && currentStatus === VPN_STATUS.CONNECTED;

    return Button({
        onClicked: () => {
            if (isConnected) {
                execAsync('sudo killall openvpn');
                currentStatus = VPN_STATUS.DISCONNECTED;
                currentServer = null;
            } else {
                const configPath = '/tmp/vpnconfig.ovpn';
                execAsync(`echo "${server.configData}" | base64 -d > ${configPath}`).then(() => {
                    execAsync(`sudo openvpn --config ${configPath}`);
                    currentStatus = VPN_STATUS.CONNECTED;
                    currentServer = server;
                });
            }
        },
        child: Box({
            className: 'sidebar-wifinetworks-network spacing-h-10',
            children: [
                MaterialIcon(isConnected ? 'vpn_lock' : 'vpn', 'hugerass'),
                Box({
                    vertical: true,
                    children: [
                        Label({
                            hpack: 'start',
                            label: server.country
                        }),
                        Label({
                            hpack: 'start',
                            className: 'txt-smaller txt-subtext',
                            label: `Speed: ${Math.round(server.speed / 1000000)} Mbps, Ping: ${server.ping}ms`
                        })
                    ],
                }),
                Box({ hexpand: true }),
                isConnected ? MaterialIcon('check', 'large') : null
            ],
        }),
    });
};

export default (props) => {
    const serverList = Box({
        vertical: true,
        className: 'spacing-v-10',
        children: [
            Overlay({
                passThrough: true,
                child: Scrollable({
                    vexpand: true,
                    child: Box({
                        vertical: true,
                        attribute: {
                            'updateServers': (self) => {
                                updateVpnServers().then(() => {
                                    self.children = vpnServers.map(server => VpnServer(server));
                                });
                            },
                        },
                        className: 'spacing-v-5 margin-bottom-15',
                        setup: (self) => {
                            self.attribute.updateServers(self);
                            // Set up periodic updates
                            const updateInterval = () => {
                                self.attribute.updateServers(self);
                                Utils.timeout(300000, updateInterval);
                            };
                            Utils.timeout(300000, updateInterval);
                        },
                    }),
                }),
                overlays: [
                    Box({
                        className: 'sidebar-centermodules-scrollgradient-bottom'
                    }),
                ],
            }),
        ],
    });

    return Box({
        ...props,
        className: 'spacing-v-10',
        vertical: true,
        children: [
            serverList
        ],
    });
};