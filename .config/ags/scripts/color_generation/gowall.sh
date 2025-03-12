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

# Dynamically extract the extension from the current wallpaper
extension="${currentwallpaper##*.}"
gowall_img="gowall.${extension}"
gowall_img_path="$STATE_DIR/user/gowall/$gowall_img"
# Function to run gowall conversion (renamed to avoid shadowing the external command)
run_gowall() {
    # Use the dynamic output file name based on the input extension
    gowall convert "$currentwallpaper" -t "$gowall_theme" -o gowall
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
