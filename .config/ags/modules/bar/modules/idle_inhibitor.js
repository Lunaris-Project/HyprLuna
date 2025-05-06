import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Utils from 'resource:///com/github/Aylur/ags/utils.js';
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';
const { exec, execAsync } = Utils;

const SCRIPT_PATH = '~/.config/ags/scripts/wayland-idle-inhibitor.py';

const configDir = Utils.CACHE_DIR.replace('cache/ags', 'config/ags');

const checkIdleStatus = () => {
    try {
        // Check if the idle inhibitor script is running
        const isScriptRunning = !!exec('pidof wayland-idle-inhibitor.py');
        // Check if DPMS is enabled
        const dpmsStatus = exec('hyprctl getoption dpms').includes('int: 1');
        return isScriptRunning || !dpmsStatus;
    } catch (error) {
        console.error('Error checking idle status:', error);
        return false;
    }
};

const IdleInhibitor = ({ className = '', ...props } = {}) => {
    const stack = Widget.Stack({
        transition: 'slide_up_down',
        transitionDuration: userOptions.asyncGet().animations.durationSmall,
        children: {
            true: MaterialIcon('coffee_maker', 'norm'),
            false: MaterialIcon('coffee', 'norm'),
        },
    });

    return Widget.Button({
        attribute: { enabled: false },
        className: `bar-button ${className}`,
        tooltipText: 'Keep system awake',
        onClicked: async (self) => {
            try {
                const currentState = checkIdleStatus();
                const newState = !currentState;
                
                if (newState) {
                    console.log('Starting idle inhibitor...');
                    const result = await execAsync([SCRIPT_PATH]).catch(error => {
                        console.error('Failed to start idle inhibitor:', error);
                        throw error;
                    });
                    console.log('Idle inhibitor started:', result);
                } else {
                    console.log('Stopping idle inhibitor...');
                    await execAsync(['pkill', '-f', 'wayland-idle-inhibitor.py']).catch(error => {
                        console.error('Failed to stop idle inhibitor:', error);
                        throw error;
                    });
                    console.log('Idle inhibitor stopped');
                }

                // Update state after executing command
                self.attribute.enabled = newState;
                stack.shown = String(newState);
                self.toggleClassName('active', newState);
            } catch (error) {
                console.error('Error in onClicked:', error);
            }
        },
        child: Widget.Box({
            className: 'spacing-h-10 sec-txt',
            children: [stack],
        }),
        setup: (self) => {
            // Initial state from system
            self.attribute.enabled = checkIdleStatus();
            stack.shown = String(self.attribute.enabled);
            self.toggleClassName('active', self.attribute.enabled);

            // Poll for changes every 2 seconds
            Utils.interval(2000, () => {
                const newState = checkIdleStatus();
                if (newState !== self.attribute.enabled) {
                    self.attribute.enabled = newState;
                    stack.shown = String(newState);
                    self.toggleClassName('active', newState);
                }
                return true; // Keep interval running
            });
        },
        ...props,
    });
};

export default IdleInhibitor;
