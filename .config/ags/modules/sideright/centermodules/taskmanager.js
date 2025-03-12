import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
import GLib from 'gi://GLib';
const { Box, Button, Icon, Label, Scrollable, Stack } = Widget;
const { execAsync, exec } = Utils;
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';
import { setupCursorHover } from '../../.widgetutils/cursorhover.js';

// Helper function to safely update a label
function safeUpdateLabel(label, value, defaultValue = '') {
    if (!label) return;
    
    try {
        // Try different methods to update the label
        if (typeof label.set_label === 'function') {
            label.set_label(value || defaultValue);
        } else if (typeof label.setLabel === 'function') {
            label.setLabel(value || defaultValue);
        } else if (label.label !== undefined) {
            label.label = value || defaultValue;
        }
    } catch (e) {
        console.error('Error updating label:', e);
    }
}

let prevProcessTimes = new Map();
let prevSystemTime = 0;
const HERTZ = parseInt(exec('getconf CLK_TCK')) || 100;

// Cache for process item widgets to prevent recreation and GC issues
const processItemCache = new Map();
let processListBox = null;

const getSystemCPUTime = () => {
    try {
        const statContent = Utils.readFile('/proc/stat');
        const cpuTimes = statContent.split('\n')[0].split(/\s+/).slice(1, 5);
        return cpuTimes.reduce((acc, time) => acc + parseInt(time), 0);
    } catch (error) {
        return 0;
    }
};

const getProcessCPUTime = (pid) => {
    try {
        const statContent = Utils.readFile(`/proc/${pid}/stat`);
        if (!statContent) return null;
        
        const parts = statContent.split(' ');
        const utime = parseInt(parts[13]);
        const stime = parseInt(parts[14]);
        const cutime = parseInt(parts[15]);
        const cstime = parseInt(parts[16]);
        
        return {
            pid,
            total: utime + stime + cutime + cstime
        };
    } catch (error) {
        return null;
    }
};

const calculateCPUPercentage = (pid, currentProcTime, currentSystemTime) => {
    const prevProcTime = prevProcessTimes.get(pid);
    if (!prevProcTime) return 0;

    const procTimeDiff = currentProcTime - prevProcTime;
    const systemTimeDiff = currentSystemTime - prevSystemTime;

    if (systemTimeDiff === 0) return 0;
    return (procTimeDiff / systemTimeDiff) * 100;
};

const ProcessItem = ({ name, pid, cpu, memory }) => {
    // Check if we already have a widget for this PID
    if (processItemCache.has(pid)) {
        const existingItem = processItemCache.get(pid);
        
        // Update the existing widget's labels
        try {
            const nameLabel = existingItem._nameLabel;
            const statsLabel = existingItem._statsLabel;
            
            if (nameLabel) safeUpdateLabel(nameLabel, `${name}`);
            if (statsLabel) safeUpdateLabel(statsLabel, `PID: ${pid} | CPU: ${cpu}% | MEM: ${memory}MB`);
            
            return existingItem;
        } catch (e) {
            console.error(`Error updating cached process item for PID ${pid}:`, e);
            // If updating fails, remove from cache and create a new one
            processItemCache.delete(pid);
        }
    }
    
    // Create a new process item widget
    const nameLabel = Label({
        xalign: 0,
        className: 'txt-small txt',
        label: `${name}`,
    });
    
    const statsLabel = Label({
        xalign: 0,
        className: 'txt-smaller txt-subtext',
        label: `PID: ${pid} | CPU: ${cpu}% | MEM: ${memory}MB`,
    });
    
    const processItem = Box({
        className: 'task-manager-item spacing-h-10',
        children: [
            MaterialIcon('memory', 'norm'),
            Box({
                vertical: true,
                children: [nameLabel, statsLabel],
            }),
            Box({ hexpand: true }),
            Button({
                className: 'task-manager-button',
                child: MaterialIcon('close', 'small'),
                onClicked: () => {
                    execAsync(['kill', pid.toString()]).catch(print);
                    updateProcessList();
                },
                setup: setupCursorHover,
            }),
        ],
    });
    
    // Store references to the labels for future updates
    processItem._nameLabel = nameLabel;
    processItem._statsLabel = statsLabel;
    
    // Setup destruction handler
    processItem.connect('destroy', () => {
        console.log(`Process item for PID ${pid} destroyed, removing from cache`);
        processItemCache.delete(pid);
        processItem._nameLabel = null;
        processItem._statsLabel = null;
    });
    
    // Store in cache
    processItemCache.set(pid, processItem);
    
    return processItem;
};

const getProcessList = async () => {
    try {
        // Get system-wide CPU time
        const currentSystemTime = getSystemCPUTime();
        const newProcessTimes = new Map();

        // Get list of processes sorted by current CPU usage (using top)
        const topOutput = await execAsync(['top', '-b', '-n', '1']);
        const processes = topOutput.split('\n')
            .slice(7) // Skip header lines
            .filter(line => line.trim())
            .map(line => {
                const parts = line.trim().split(/\s+/);
                return {
                    pid: parseInt(parts[0]),
                    cpu: parseFloat(parts[8]),
                    memory: parseFloat(parts[9]),
                    name: parts.slice(11).join(' ')
                };
            })
            .sort((a, b) => {
                // Combined score: 70% CPU weight, 30% memory weight
                const scoreA = (a.cpu * 0.7) + (a.memory * 0.3);
                const scoreB = (b.cpu * 0.7) + (b.memory * 0.3);
                return scoreB - scoreA;
            })
            .slice(0, 15) // Show top 15 processes
            .map(proc => ({
                ...proc,
                memory: proc.memory.toFixed(1)
            }));

        // Calculate CPU percentage for each process
        processes.forEach(proc => {
            const procTime = getProcessCPUTime(proc.pid);
            if (procTime) {
                newProcessTimes.set(proc.pid, procTime.total);
                if (prevProcessTimes.has(proc.pid)) {
                    proc.cpu = calculateCPUPercentage(proc.pid, procTime.total, currentSystemTime);
                }
            }
        });

        // Update previous times for next calculation
        prevProcessTimes = newProcessTimes;
        prevSystemTime = currentSystemTime;

        return processes;
    } catch (error) {
        print('Error getting process list:', error);
        return [];
    }
};

const updateProcessList = async () => {
    // First check if the process list box is still valid
    if (!processListBox || !processListBox.get_parent()) {
        console.log('Process list box no longer in DOM, skipping update');
        return;
    }
    
    const processes = await getProcessList();
    const currentPids = new Set(processes.map(proc => proc.pid));
    
    // Find and remove cached items that are no longer in the process list
    for (const [pid, widget] of processItemCache.entries()) {
        if (!currentPids.has(pid)) {
            console.log(`Process ${pid} no longer exists, removing from cache`);
            try {
                if (widget && widget.destroy && typeof widget.destroy === 'function') {
                    widget.destroy();
                }
            } catch (e) {
                console.error(`Error destroying widget for PID ${pid}:`, e);
            }
            processItemCache.delete(pid);
        }
    }
    
    // Create or update process items and add them to the box
    const processItems = processes.map(proc => ProcessItem({
        ...proc,
        cpu: proc.cpu.toFixed(1)
    }));
    
    // Safely update the children of the process list box
    try {
        // Check again if the widget is still valid before updating
        if (!processListBox || !processListBox.get_parent()) {
            console.log('Process list box no longer in DOM during update');
            return;
        }
        
        // First remove all existing children to prevent GC issues
        try {
            const existingChildren = [...(processListBox.children || [])];
            for (const child of existingChildren) {
                if (child && child.destroy && typeof child.destroy === 'function') {
                    child.destroy();
                }
            }
            processListBox.children = [];
        } catch (e) {
            console.error('Error cleaning up existing children:', e);
        }
        
        // Add a small delay before adding new children to ensure proper cleanup
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            if (!processListBox || !processListBox.get_parent()) {
                console.log('Process list box no longer in DOM during delayed update');
                return false;
            }
            
            try {
                // Double check each process item is still valid
                const validItems = processItems.filter(item => item && item.get_parent() === null);
                processListBox.children = validItems;
            } catch (e) {
                console.error('Error updating process list children:', e);
            }
            return false; // Don't repeat
        });
    } catch (e) {
        console.error('Error clearing process list children:', e);
    }
};

export default () => {
    // Create the process list box
    processListBox = Box({
        vertical: true,
        className: 'task-manager-box spacing-v-5',
    });
    
    // Setup destruction handler for the process list box
    processListBox.connect('destroy', () => {
        console.log('Process list box destroyed, clearing cache');
        // Clear the cache when the box is destroyed
        processItemCache.clear();
    });

    const widget = Box({
        vertical: true,
        className: 'task-manager-widget',
        children: [
            Box({
                className: 'task-manager-header spacing-h-5',
                children: [
                    MaterialIcon('monitor_heart', 'norm'),
                    Label({
                        xalign: 0,
                        className: 'txt txt-bold',
                        label: 'Task Manager',
                    }),
                    Box({ hexpand: true }),
                    Button({
                        className: 'task-manager-refresh-button',
                        child: MaterialIcon('refresh', 'small'),
                        onClicked: updateProcessList,
                        setup: setupCursorHover,
                    }),
                ],
            }),
            Scrollable({
                vexpand: true,
                className: 'task-manager-scrollable',
                child: processListBox,
            }),
        ],
    });
    
    // Setup destruction handler for the main widget
    widget.connect('destroy', () => {
        console.log('Task manager widget destroyed');
    });

    // Create a variable to store the interval ID
    let updateInterval = null;
    
    // Setup the update interval
    const setupInterval = () => {
        // Clear any existing interval
        if (updateInterval !== null) {
            GLib.source_remove(updateInterval);
        }
        
        // Set up a new interval
        updateInterval = Utils.interval(userOptions.asyncGet().sidebar.centerModules.taskManager.pollingRate, () => {
            // Only update if the widget is still valid
            if (widget.get_parent()) {
                updateProcessList();
                return true; // Continue the interval
            } else {
                console.log('Task manager widget no longer in DOM, stopping updates');
                processItemCache.clear();
                return false; // Stop the interval
            }
        });
    };
    
    // Setup the interval

    
    // Connect a destroy signal to clean up the interval and cache
    widget.connect('destroy', () => {
        console.log('Task manager widget destroyed, cleaning up');
        
        // Clean up the update interval
        if (updateInterval !== null) {
            GLib.source_remove(updateInterval);
            updateInterval = null;
        }
        
        // Clean up process list box if it still exists
        try {
            if (processListBox && processListBox.destroy && typeof processListBox.destroy === 'function') {
                processListBox.destroy();
            }
        } catch (e) {
            console.error('Error destroying process list box:', e);
        }
        
        // Clean up cached items
        try {
            for (const [pid, widget] of processItemCache.entries()) {
                try {
                    if (widget && widget.destroy && typeof widget.destroy === 'function') {
                        widget.destroy();
                    }
                } catch (e) {
                    console.error(`Error destroying widget for PID ${pid}:`, e);
                }
            }
            processItemCache.clear();
        } catch (e) {
            console.error('Error cleaning up process item cache:', e);
        }
    });

    // Initial update
    updateProcessList();

    return widget;
};
