import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Dock, { isPinned, onPinStateChanged } from './dock.js';

export default (monitor = 0) => {
    // Get the user's exclusivity preference
    const userExclusivitySetting = userOptions.asyncGet().dock.exclusivity;

    // Function to determine the correct exclusivity based on pin state and user setting
    const getExclusivity = (pinned) => {
        // If user has set exclusivity to "exclusive", respect pin state
        if (userExclusivitySetting === "exclusive") {
            return pinned ? "exclusive" : "ignore";
        }
        // If user has set exclusivity to anything else (like "ignore"), always use that setting
        else {
            return "ignore";
        }
    };

    // Create the dock window
    const dockWindow = Widget.Window({
        monitor,
        name: `dock${monitor}`,
        // Set initial exclusivity based on user preference and pin state
        exclusivity: getExclusivity(isPinned),
        layer: userOptions.asyncGet().dock.layer,
        anchor: [userOptions.asyncGet().bar.position === "top" ? 'bottom' : 'top'],
        visible: true,
        child: Dock(monitor),
    });

    // Register a callback to update exclusivity when pin state changes
    onPinStateChanged((pinned) => {
        // Update exclusivity based on pin state and user setting
        dockWindow.exclusivity = getExclusivity(pinned);
    });

    return dockWindow;
};
