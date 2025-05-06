#!/bin/bash

# Default wallpaper directory
WALLPAPER_DIR="$HOME/Pictures/Wallpapers"
CURRENT_WALLPAPER_FILE="$HOME/.local/state/ags/user/current_wallpaper.txt"
CACHE_DIR="$XDG_CACHE_HOME/ags"
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
XDG_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"
CONFIG_DIR="$XDG_CONFIG_HOME/ags"
STATE_DIR="$XDG_STATE_HOME/ags"
colormodefile="$STATE_DIR/user/colormode.txt"
SWWW_OPTIONS="
--transition-type center \
--transition-duration 1 \
--transition-step 90 \
--transition-fps 90 \
-f Nearest
"
# Default settings
MODE=$(sed -n '1p' "$colormodefile")
SCHEME=$(sed -n '3p' "$colormodefile")
CONTRAST="0"

# Material Symbols Codes
ICON_WALLPAPER=$'\ue0d6 '
ICON_RANDOM=$'\ue043 '
ICON_MODE_DARK=$'\ue51c '
ICON_MODE_LIGHT=$'\ue518 '
ICON_SCHEME=$'\ue40a '
ICON_CONTRAST=$'\ue3a1 '
ICON_PICKER=$'\ue3b8 '

# Debug function
debug() {
    echo "[DEBUG] $*" >&2
}

# Function to run rofi menu
run_rofi() {
    local cmd="$1"
    eval "$cmd"
}

# Function to set wallpaper
set_wallpaper() {
    local wallpaper="$1"
    if [ -n "$wallpaper" ] && [ -f "$wallpaper" ]; then
        echo "$wallpaper" > "$CURRENT_WALLPAPER_FILE"
        swww img $SWWW_OPTIONS $wallpaper &
        matugen image "$wallpaper" \
            --mode "$MODE" \
            --type "$SCHEME"
    fi
}

# Function to reapply current wallpaper
reapply_current_wallpaper() {
    if [ -f "$CURRENT_WALLPAPER_FILE" ]; then
        local current_wallpaper
        current_wallpaper=$(cat "$CURRENT_WALLPAPER_FILE")
        debug "Reapplying wallpaper: $current_wallpaper"
        if [ -f "$current_wallpaper" ]; then
            set_wallpaper "$current_wallpaper"
            return 0
        fi
    fi
    debug "No current wallpaper found"
    return 1
}

# Show mode selection menu
select_mode() {
    local mode_menu="$ICON_MODE_DARK  dark\n$ICON_MODE_LIGHT  light"
    debug "Mode menu options: $mode_menu"
    local cmd="echo -e \"$mode_menu\" | rofi -dmenu -i -p 'Select Mode'"
    local selection
    selection=$(~/.config/hypr/scripts/rofi_toggle.sh "$cmd")
    
    debug "Selected mode: $selection"
    if [ -n "$selection" ]; then
        MODE=$(echo "$selection" | sed 's/^.*  //')
        debug "Setting MODE=$MODE"
        reapply_current_wallpaper
        show_menu
    fi
}

# Show scheme selection menu
select_scheme() {
    local schemes=(
        "$ICON_SCHEME  scheme-tonal-spot    Material You"
        "$ICON_SCHEME  scheme-expressive    Vibrant"
        "$ICON_SCHEME  scheme-monochrome    Single Color"
        "$ICON_SCHEME  scheme-rainbow       Full Spectrum"
        "$ICON_SCHEME  scheme-neutral       Balanced"
        "$ICON_SCHEME  scheme-fidelity      Source Match"
        "$ICON_SCHEME  scheme-content       Content Based"
        "$ICON_SCHEME  scheme-fruit-salad   Colorful Mix"
    )
    
    local cmd="printf '%s\n' '${schemes[*]}' | rofi -dmenu -i -p 'Select Scheme'"
    local selection
    selection=$(~/.config/hypr/scripts/rofi_toggle.sh "$cmd")
    
    debug "Selected scheme: $selection"
    if [ -n "$selection" ]; then
        SCHEME=$(echo "$selection" | awk '{print $2}')
        debug "Setting SCHEME=$SCHEME"
        reapply_current_wallpaper
        show_menu
    fi
}

# Show contrast selection menu
select_contrast() {
    local contrast_options=(
        "$ICON_CONTRAST  0    Standard"
        "$ICON_CONTRAST  0.5  Higher"
        "$ICON_CONTRAST  1.0  Maximum"
        "$ICON_CONTRAST  -0.5 Lower"
        "$ICON_CONTRAST  -1.0 Minimum"
    )
    
    local cmd="printf '%s\n' '${contrast_options[*]}' | rofi -dmenu -i -p 'Select Contrast'"
    local selection
    selection=$(~/.config/hypr/scripts/rofi_toggle.sh "$cmd")
    
    debug "Selected contrast: $selection"
    if [ -n "$selection" ]; then
        CONTRAST=$(echo "$selection" | awk '{print $2}')
        debug "Setting CONTRAST=$CONTRAST"
        reapply_current_wallpaper
        show_menu
    fi
}

# Function to pick colors using hyprpicker
pick_color() {
    local color
    color=$(hyprpicker -n -z -d -a -r)
    if [ -n "$color" ]; then
        matugen color hex "$color" \
            --mode "$MODE" \
            --type "$SCHEME" \
            --contrast "$CONTRAST"
        cp "$CACHE_DIR/user/generated/material_colors.scss" "$STATE_DIR/scss/_material.scss"
        go run "$CONFIG_DIR/scripts/color_generation/applycolor.go"
    fi
}

# Show main menu
show_menu() {
    local current_mode_icon="$ICON_MODE_DARK"
    [ "$MODE" = "light" ] && current_mode_icon="$ICON_MODE_LIGHT"
    
    local options=(
        "$ICON_WALLPAPER Select Wallpaper"
        "$ICON_RANDOM Random Wallpaper"
        "$current_mode_icon Mode: $MODE"
        "$ICON_SCHEME Scheme: $SCHEME"
        "$ICON_CONTRAST Contrast: $CONTRAST"
        "$ICON_PICKER Pick Color"
    )

    local choice
    choice=$(printf '%s\n' "${options[@]}" | rofi -dmenu -p "Wallpaper Menu")

    case "$choice" in
        "$ICON_WALLPAPER Select Wallpaper")
            show_wallpaper_selector
            ;;
        "$ICON_RANDOM Random Wallpaper")
            set_random_wallpaper
            ;;
        "$current_mode_icon Mode: $MODE")
            select_mode
            ;;
        "$ICON_SCHEME Scheme: $SCHEME")
            select_scheme
            ;;
        "$ICON_CONTRAST Contrast: $CONTRAST")
            select_contrast
            ;;
        "$ICON_PICKER Pick Color")
            pick_color
            ;;
    esac
}

# Function to show wallpaper selector
show_wallpaper_selector() {
    # Initialize swww if needed
    if ! pgrep -x "swww-daemon" > /dev/null; then
        swww init
    fi

    # Create a temporary directory for the image list
    TEMP_DIR=$(mktemp -d)
    ENTRIES_FILE="$TEMP_DIR/entries.txt"

    # Find all image files and create entries with full paths
    find "$WALLPAPER_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.gif" -o -iname "*.bmp" -o -iname "*.webp" \) -print0 | while IFS= read -r -d '' file; do
        echo -en "$(basename "$file")\0icon\x1f$file\n"
    done > "$ENTRIES_FILE"

    # Use rofi to show grid of images
    local selection
    selection=$(cat "$ENTRIES_FILE" | ~/.config/hypr/scripts/rofi_toggle.sh "rofi \
        -dmenu \
        -i \
        -p 'Select Wallpaper' \
        -show-icons \
      ")

    # Clean up
    rm -rf "$TEMP_DIR"

    # If a file was selected, get its full path from the entries
    if [ -n "$selection" ]; then
        WALLPAPER_PATH=$(find "$WALLPAPER_DIR" -type f -name "$selection" -print -quit)
        set_wallpaper "$WALLPAPER_PATH"
    fi
}

# Function to set random wallpaper
set_random_wallpaper() {
    mapfile -d $'\0' wallpapers < <(find "$WALLPAPER_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.gif" -o -iname "*.bmp" -o -iname "*.webp" \) -print0)
    if [ ${#wallpapers[@]} -gt 0 ]; then
        random_index=$((RANDOM % ${#wallpapers[@]}))
        set_wallpaper "${wallpapers[$random_index]}"
    fi
}
# Function to use color using HyprPicker
pick() {
    matugen color hex "$(hyprpicker -a -f hex -n -z -t)"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        "--menu")
            show_menu
            exit 0
            ;;
        "--col")
            pick
            exit 0
            ;;
        "-s")
            show_wallpaper_selector
            exit 0
            ;;
        "-r")
            set_random_wallpaper
            exit 0
            ;;
        "-p"|"--pick-color")
            pick_color
            exit 0
            ;;
        "-m"|"--mode")
            MODE="$2"
            shift 2
            ;;
        "-c"|"--contrast")
            CONTRAST="$2"
            shift 2
            ;;
        "-h"|"--help")
            cat << EOF
NAME
    wallpaper-select - A dynamic wallpaper selector with material color scheme generation

SYNOPSIS
    wallpaper-select [OPTIONS]

DESCRIPTION
    A script to select and apply wallpapers using rofi, with automatic material color scheme
    generation using matugen. Supports various color schemes and modes.

OPTIONS
    -r
        Random wallpaper mode. Selects a random wallpaper from the wallpaper directory.

    -p, --pick-color
        Launch the color picker to select a color from the screen. The color will be
        automatically copied to your clipboard.

    -m, --mode MODE
        Set the color scheme mode. [default: dark]
        Values:
            light   - Generate light theme colors
            dark    - Generate dark theme colors

    -s, --scheme SCHEME
        Set the color scheme type. [default: scheme-tonal-spot]
        Values:
            scheme-content     - Colors based on image content
            scheme-expressive  - More vibrant and expressive colors
            scheme-fidelity    - Colors closest to the source image
            scheme-fruit-salad - Varied, colorful scheme
            scheme-monochrome  - Single color variations
            scheme-neutral     - Neutral, balanced colors
            scheme-rainbow     - Full spectrum of colors
            scheme-tonal-spot  - Material You style colors

    -c, --contrast VALUE
        Adjust the contrast of the generated colors. [default: 0]
        Range: -1.0 to 1.0
            -1.0  - Minimum contrast
             0.0  - Standard contrast
             1.0  - Maximum contrast

    -h, --help
        Display this help message.

EXAMPLES
    # Open rofi wallpaper selector
    wallpaper-select.sh

    # Set random wallpaper
    wallpaper-select.sh -r

    # Set random wallpaper with expressive scheme in light mode
    wallpaper-select.sh -r -s scheme-expressive -m light

    # Set wallpaper with high contrast monochrome scheme
    wallpaper-select.sh -s scheme-monochrome -c 0.8

FILES
    $WALLPAPER_DIR
        Directory containing wallpaper images

DEPENDENCIES
    - rofi      : For the wallpaper selection interface
    - matugen   : For material color scheme generation
    - swww      : For wallpaper display and transitions

AUTHOR
    Github: https://github.com/Lunaris-Project
    Maintainer: https://github.com/N1xev
EOF
            exit 1
            ;;
    esac
done

# If no arguments, show wallpaper selector
show_menu