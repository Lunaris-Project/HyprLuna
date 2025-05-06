import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Indicator from '../../services/indicator.js';
import IndicatorValues from './indicatorvalues.js';
import NotificationPopups from './notificationpopups.js';
import ColorschemeContent from './colorscheme.js';

export default (monitor = 0) => Widget.Window({
    name: `indicator${monitor}`,
    monitor,
    className: 'indicator',
    layer: 'overlay',
    anchor: ['top'],
    child: Widget.EventBox({
        onHover: () => { //make the widget hide when hovering
            Indicator.popup(-1);
        },
        child: Widget.Box({
            vertical: true,
            className: 'osd-window',
            children: [
                
                ColorschemeContent(),
                IndicatorValues(monitor),
                NotificationPopups(),
            ]
        })
    }),
});