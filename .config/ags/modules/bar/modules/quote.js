import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Quotes from '../../../services/quotes.js';

const { Box, Label, EventBox } = Widget;

// Update interval: 3 hours in milliseconds
const UPDATE_INTERVAL = 3 * 60 * 60 * 1000;

const QuoteWidget = () => {
    // Create widget with initial content
    const label = Label({
        className: 'txt-norm onSurfaceVariant', // Changed from txt-small to txt-norm for larger text
        label: 'Loading quote...',
        justification: 'left',
        wrap: true,
        wrapMode: 'word_char',  // Changed to word_char for better wrapping
        widthChars: 40,    // Force width to roughly 12rem - increased for longer quotes
        maxWidthChars: 50, // Maximum width in characters - increased for longer quotes
        css: 'font-size: 1.3em;', // Increased font size from 0.9em to 1.1em
        // Removed ellipsize to allow text to wrap to new lines instead of truncating
    });

    // Create the main widget
    const widget = EventBox({
        onPrimaryClick: () => {
            label.label = 'Loading...';
            Quotes.fetch();
        },
        css: 'padding: 5px;', // Add padding but avoid max-height in GTK3
        child: Box({
            className: 'spacing-h-5',
            hexpand: false,
            vexpand: false, // Don't expand vertically
            children: [label],
        }),
    });

    // Update label when service changes
    const updateLabel = () => {
        if (Quotes.loading) {
            label.label = 'Loading...';
            return;
        }

        if (!Quotes.content || !Quotes.author) {
            label.label = 'Click to retry';
            return;
        }

        // Don't truncate content, let it wrap to new lines
        label.label = `"${Quotes.content}" —${Quotes.author}`;
    };

    // Connect to service changes
    widget.hook(Quotes, updateLabel);

    // Set up polling
    widget.poll(UPDATE_INTERVAL, () => {
        Quotes.fetch();
    });

    return widget;
};

// Export a function that returns the widget
export default () => QuoteWidget();
