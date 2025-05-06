const { Gdk } = imports.gi;

/**
 * Cache for cursor objects to avoid recreating them
 */
const cursorCache = new Map();

/**
 * Get a cursor from cache or create a new one
 * @param {string} name - Cursor name
 * @returns {Gdk.Cursor} - Cursor object
 */
const getCursor = (name) => {
    if (!cursorCache.has(name)) {
        const display = Gdk.Display.get_default();
        cursorCache.set(name, Gdk.Cursor.new_from_name(display, name));
    }
    return cursorCache.get(name);
};

/**
 * Generic function to set up cursor hover effects
 * @param {Widget} button - The widget to set up hover for
 * @param {string} hoverCursor - Cursor name for hover state
 */
const setupCursorHoverGeneric = (button, hoverCursor) => {
    // Get default cursor once
    const defaultCursor = getCursor('default');
    // Get hover cursor once
    const cursor = getCursor(hoverCursor);

    // Set up enter event
    button.connect('enter-notify-event', () => {
        const window = button.get_window();
        if (window) {
            window.set_cursor(cursor);
        }
    });

    // Set up leave event
    button.connect('leave-notify-event', () => {
        const window = button.get_window();
        if (window) {
            window.set_cursor(defaultCursor);
        }
    });

    return button;
};

/**
 * Set up pointer cursor on hover (hand pointing)
 * @param {Widget} button - The widget to set up hover for
 * @returns {Widget} - The same widget for chaining
 */
export function setupCursorHover(button) {
    return setupCursorHoverGeneric(button, 'pointer');
}

/**
 * Set up crosshair cursor on hover
 * @param {Widget} button - The widget to set up hover for
 * @returns {Widget} - The same widget for chaining
 */
export function setupCursorHoverAim(button) {
    return setupCursorHoverGeneric(button, 'crosshair');
}

/**
 * Set up grab cursor on hover (hand ready to grab)
 * @param {Widget} button - The widget to set up hover for
 * @returns {Widget} - The same widget for chaining
 */
export function setupCursorHoverGrab(button) {
    return setupCursorHoverGeneric(button, 'grab');
}

/**
 * Set up help cursor on hover (question mark)
 * @param {Widget} button - The widget to set up hover for
 * @returns {Widget} - The same widget for chaining
 */
export function setupCursorHoverInfo(button) {
    return setupCursorHoverGeneric(button, 'help');
}

