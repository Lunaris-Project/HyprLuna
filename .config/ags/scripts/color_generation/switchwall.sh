#!/bin/bash
# switchwall.sh
# This script lets the user select a new wallpaper, validates the image,
# and updates the AGS wallpaper configuration file.
#
# Requirements:
#   - zenity (for GUI file chooser and dialogs)
#   - ImageMagick (for checking image resolution via `identify`)
#
# The script uses a default recommended resolution for monitor 0.
# You can adjust req_width and req_height as needed.

# Recommended minimum image dimensions (monitor width and height multiplied by WALLPAPER_ZOOM_SCALE)
req_width=2400  # e.g., 1920 * 1.25
req_height=1350  # e.g., 1080 * 1.25

# Use Zenity to prompt the user to select an image file
file=$(zenity --file-selection --title "Select Wallpaper")
if [[ -z "$file" ]]; then
  zenity --error --text "No file selected. Exiting."
  exit 1
fi

# Ensure the selected file exists
if [[ ! -f "$file" ]]; then
  zenity --error --text "File does not exist."
  exit 1
fi

# Validate that the file is an image by checking its MIME type
mime=$(file --mime-type -b "$file")
case "$mime" in
  image/*) ;;  # Valid image
  *) 
    zenity --error --text "Selected file is not a valid image."
    exit 1
    ;;
esac

# Retrieve the image's resolution using ImageMagick's identify command
resolution=$(identify -format "%w %h" "$file" 2>/dev/null)
if [[ -z "$resolution" ]]; then
  zenity --error --text "Unable to determine image resolution."
  exit 1
fi

config_dir="${XDG_STATE_HOME:-$HOME/.local/state}/ags/user"
config_file="$config_dir/wallpaper.json"

# Ensure the configuration directory exists
mkdir -p "$config_dir"

# Update the configuration file with the new wallpaper path.
# For simplicity, we're writing a JSON array with a single element (for monitor 0).
echo "[\"$file\"]" > "$config_file"
exit 0
