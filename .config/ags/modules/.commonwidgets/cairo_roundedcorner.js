import Widget from 'resource:///com/github/Aylur/ags/widget.js';
const { Gtk } = imports.gi;
let cornerRadius = userOptions.asyncGet().etc.cornerRadius || 12;

export const RoundedCorner = (place, props) => Widget.DrawingArea({
    ...props,
    setup: widget => {
        widget.set_size_request(cornerRadius, cornerRadius);
        widget.connect('draw', (widget, cr) => {
            const c = widget.get_style_context().get_property('background-color', Gtk.StateFlags.NORMAL);
            cr.arc(...{
                'topleft': [cornerRadius, cornerRadius, cornerRadius, Math.PI, 3 * Math.PI / 2],
                'topright': [0, cornerRadius, cornerRadius, 3 * Math.PI / 2, 2 * Math.PI],
                'bottomleft': [cornerRadius, 0, cornerRadius, Math.PI / 2, Math.PI],
                'bottomright': [0, 0, cornerRadius, 0, Math.PI / 2],
            }[place]);
            cr.lineTo(...{
                'topleft': [0, 0],
                'topright': [cornerRadius, 0],
                'bottomleft': [0, cornerRadius],
                'bottomright': [cornerRadius, cornerRadius],
            }[place]);
            cr.closePath();
            cr.setSourceRGBA(c.red, c.green, c.blue, c.alpha);
            cr.fill();
            return false;
        });
    },
});