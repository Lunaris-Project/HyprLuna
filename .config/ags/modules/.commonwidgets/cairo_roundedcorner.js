import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from "resource:///com/github/Aylur/ags/utils.js";
import userOptions from "../.configuration/user_options.js";
const { Gtk } = imports.gi;

// Cache user options to avoid repeated calls
let cachedOptions = null;
const getOptions = () => {
    if (!cachedOptions) {
        cachedOptions = userOptions.asyncGet();
    }
    return cachedOptions;
};

// Get corner radius from user options with fallback
let cornerRadius = getOptions().etc.cornerRadius || 12;

// Cache for arc and line coordinates to avoid recalculating
const arcCoords = {
    'topleft': [cornerRadius, cornerRadius, cornerRadius, Math.PI, 3 * Math.PI / 2],
    'topright': [0, cornerRadius, cornerRadius, 3 * Math.PI / 2, 2 * Math.PI],
    'bottomleft': [cornerRadius, 0, cornerRadius, Math.PI / 2, Math.PI],
    'bottomright': [0, 0, cornerRadius, 0, Math.PI / 2],
};

const lineCoords = {
    'topleft': [0, 0],
    'topright': [cornerRadius, 0],
    'bottomleft': [0, cornerRadius],
    'bottomright': [cornerRadius, cornerRadius],
};

/**
 * Creates a rounded corner widget with performance optimizations
 * @param {string} place - Corner position ('topleft', 'topright', 'bottomleft', 'bottomright')
 * @param {object} props - Additional properties for the widget
 * @returns {Widget.DrawingArea} - The rounded corner widget
 */
export const RoundedCorner = (place, props) => {
    const widget = Widget.DrawingArea({
        ...props,
        setup: widget => {
            // Store the corner style for optimization
            widget._cornerStyle = place;

            // Set size request only once
            widget.set_size_request(cornerRadius, cornerRadius);

            // Connect draw signal with optimized rendering
            widget.connect('draw', (widget, cr) => {
                // Get background color from style context
                const c = widget.get_style_context().get_property('background-color', Gtk.StateFlags.NORMAL);

                // Draw the corner using cached coordinates
                cr.arc(...arcCoords[place]);
                cr.lineTo(...lineCoords[place]);
                cr.closePath();
                cr.setSourceRGBA(c.red, c.green, c.blue, c.alpha);
                cr.fill();

                return false;
            });
        },
    });

    return widget;
};