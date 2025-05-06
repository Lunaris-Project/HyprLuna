#!/usr/bin/env bash
# Set directories for config and state
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
XDG_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"
CONFIG_DIR="$XDG_CONFIG_HOME/ags"
STATE_DIR="$XDG_STATE_HOME/ags"

# File paths
colormodefile="$STATE_DIR/user/colormode.txt"
currentwallpaperfile="$STATE_DIR/user/current_wallpaper.txt"

# Read configuration values from files
currentwallpaper=$(sed -n '1p' "${currentwallpaperfile}")
lightdark=$(sed -n '1p' "${colormodefile}")
colormode=$(sed -n '3p' "${colormodefile}")
gowall_theme=$(sed -n '4p' "${colormodefile}")

# Theme name comes directly from colorscheme.js

# Dynamically extract the extension from the current wallpaper
extension="${currentwallpaper##*.}"
gowall_img="gowall.${extension}"
gowall_img_path="$STATE_DIR/user/gowall/$gowall_img"
# Function to run gowall conversion (renamed to avoid shadowing the external command)
run_gowall() {
    # Make sure the output directory exists
    mkdir -p "$STATE_DIR/user/gowall"

    # Create a temporary directory for the operation
    TEMP_DIR=$(mktemp -d)
    trap 'rm -rf "$TEMP_DIR"' EXIT

    # Create necessary directories in the temp directory
    mkdir -p "$TEMP_DIR/.local/state/ags/user/gowall/cluts"

    # Create a temporary file to store the original xdg-open
    if [ -f "/usr/bin/xdg-open" ]; then
        cp /usr/bin/xdg-open "$TEMP_DIR/xdg-open.backup"
        # Create a dummy xdg-open that does nothing
        echo '#!/bin/sh' > "$TEMP_DIR/xdg-open"
        echo 'exit 0' >> "$TEMP_DIR/xdg-open"
        chmod +x "$TEMP_DIR/xdg-open"
        # Temporarily replace xdg-open
        export PATH="$TEMP_DIR:$PATH"
    fi

    # Set HOME to the temp directory to avoid path issues
    export HOME_BACKUP="$HOME"
    export HOME="$TEMP_DIR"

    # Set environment variables to prevent browser/viewer opening
    export BROWSER=/dev/null
    export DISPLAY=

    # Use the dynamic output file name based on the input extension
    if [ -z "$gowall_theme" ]; then
        # If no theme is selected, just copy the original wallpaper
        cp "$currentwallpaper" "$gowall_img_path"
    elif [ "$gowall_theme" = "monochrome" ]; then
        # Special handling for monochrome theme using ImageMagick
        if command -v convert &> /dev/null; then
            echo "Using ImageMagick for monochrome conversion"
            # Convert to true black and white (grayscale)
            magick convert "$currentwallpaper" -colorspace Gray "$gowall_img_path"
        else
            echo "ImageMagick not found, using gowall for monochrome"
            gowall convert "$currentwallpaper" --theme "$gowall_theme" --output "$gowall_img_path" > /dev/null 2>&1
        fi
    else
        # Apply the selected theme
        gowall convert "$currentwallpaper" --theme "$gowall_theme" --output "$gowall_img_path" > /dev/null 2>&1
    fi

    # Restore the original HOME and PATH
    export HOME="$HOME_BACKUP"
    unset HOME_BACKUP
    unset BROWSER
    unset DISPLAY

    echo  "$gowall_img_path" > "$currentwallpaperfile"
}

# Function to set the wallpaper
set_wallpaper() {
    swww img "$gowall_img_path"
    matugen image "$gowall_img_path" --type "$colormode" --mode "$lightdark"
}

# Execute both functions concurrently
run_gowall &&
set_wallpaper &

# Wait for background jobs to complete
wait
exit 0
