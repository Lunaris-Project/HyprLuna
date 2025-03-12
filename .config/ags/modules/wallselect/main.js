import PopupWindow from '../.widgethacks/popupwindow.js';
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import WallSelect from './wallpaper_selector.js';
import clickCloseRegion from '../.commonwidgets/clickcloseregion.js';
import { RoundedCorner } from '../.commonwidgets/cairo_roundedcorner.js';
const { Box } = Widget;

export default () => PopupWindow({
  keymode: 'on-demand',
  anchor: ['left', 'top', 'right'],
  name: 'wallselect',
  child: Box({
    vertical: true,
    children: [
      WallSelect(),
      userOptions.asyncGet().etc.widgetCorners ? Box({
        children: [
          RoundedCorner('topleft', { className: 'corner' }),
          Box({ hexpand: true }),
          RoundedCorner('topright', { className: 'corner' }),
        ]
      }) : null,
      userOptions.asyncGet().etc.clickCloseRegion ? clickCloseRegion({ name: 'wallselect', multimonitor: false, fillMonitor: 'vertical' }) : null
    ]
  })
});
