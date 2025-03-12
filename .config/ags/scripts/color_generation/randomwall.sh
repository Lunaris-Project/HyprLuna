#!/bin/bash
WALLPAPER_DIR="${1:-$HOME/Pictures/Wallpapers}"
SCRIPTS_DIR="$HOME/.config/ags/scripts/color_generation"
colorgen_script="$SCRIPTS_DIR/colorgen.sh"
RANDOM_WALLPAPER=$(find "$WALLPAPER_DIR" -type f \( -iname "*.jpg" -o -iname "*.png" -o -iname "*.webp" -o -iname "*.gif" -o  -iname "*.jpeg" -o -iname "*.bmp" \) | shuf -n 1)

sh $colorgen_script "$RANDOM_WALLPAPER" &
exit