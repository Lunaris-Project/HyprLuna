import PopupWindow from '../.widgethacks/popupwindow.js';
import SidebarLeft from "./sideleft.js";
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
const { Box } = Widget;
import clickCloseRegion from '../.commonwidgets/clickcloseregion.js';
export default () => {
    // Create the popup window
    const popupWindow = PopupWindow({
        keymode: 'on-demand',
        anchor: ['left', 'top', 'bottom'],
        name: 'sideleft',
        layer: 'top',
        child: Box({
            children: [
                // The main sidebar content
                SidebarLeft(),
                // Add a close region that will be shown when the sidebar is not pinned
                userOptions.asyncGet().etc.clickCloseRegion ?
                    clickCloseRegion({
                        name: 'sideleft',
                        multimonitor: false,
                        fillMonitor: 'horizontal'
                    }) :
                    null,
            ].filter(Boolean) // Filter out null values
        })
    });

    // Set initial exclusivity based on the sideLeftPin setting
    if (userOptions.asyncGet().etc.sideLeftPin) {
        popupWindow.exclusivity = 'exclusive';
    } else {
        popupWindow.exclusivity = 'normal';
    }

    return popupWindow;
};
