import Widget from 'resource:///com/github/Aylur/ags/widget.js';

/**
 * Create a Material Icon widget
 * @param {string} icon - The icon name from Material Icons
 * @param {string} size - Size class (e.g., 'norm', 'small', 'large')
 * @param {Object} props - Additional widget properties
 * @returns {import('resource:///com/github/Aylur/ags/widget.js').Widget} The icon widget
 */
export const MaterialIcon = (icon, size, props = {}) => {
    // Create CSS with explicit font-family to ensure Material Icons is used
    const css = `font-family: "Material Icons", "Material Symbols Rounded"; ${props.css || ''}`;

    // Create the icon widget
    return Widget.Label({
        className: `icon-material txt-${size}`,
        label: icon,
        ...props,
        css: css, // Override any CSS from props
    });
};
