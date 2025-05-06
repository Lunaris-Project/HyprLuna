#!/usr/bin/env bash
set -euo pipefail

# Directories
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
XDG_STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"
CONFIG_DIR="$XDG_CONFIG_HOME/ags"
STATE_DIR="$XDG_STATE_HOME/ags"
COLORMODE_FILE="$STATE_DIR/user/colormode.txt"

cd "$CONFIG_DIR" || exit 1

# Read the colormode file into an array (0-indexed)
mapfile -t lines < "$COLORMODE_FILE"

# Transparency setup
if [[ "${lines[1]}" == *"transparent"* ]]; then
    ags_transparency=True
    hypr_opacity=0.9
    rofi_alpha="#00000090"
    rofi_alpha_element="#00000025"
    term_alpha=0.9
    if [[ "${lines[6]}" == *"intense"* ]]; then 
        transProfile=Intense 
    else 
        transProfile=Normal 
    fi
else
    ags_transparency=False
    hypr_opacity=1
    rofi_alpha="var(surface)"
    rofi_alpha_element="var(surface-container-low)"
    term_alpha=1
    transProfile=none
fi

# Borders setup
if [[ "${lines[4]}" == *"noborder"* ]]; then
    ags_border=False
    hypr_border="0"
else
    ags_border=True
    hypr_border="2"
fi

# Vibrancy setup
if [[ "${lines[5]}" == *"normal"* ]]; then 
    vibrant=False  
else 
    vibrant=True
fi

# Update _mode.scss only if needed
scss_file="$STATE_DIR/scss/_mode.scss"
if [ -s "$scss_file" ]; then
    sed -i \
        -e "s/border:.*;/border:${ags_border};/" \
        -e "s/\$transparent:.*;/\$transparent:${ags_transparency};/" \
        -e "s/\$vibrant:.*;/\$vibrant:${vibrant};/" \
        -e "s/\$transProfile:.*;/\$transProfile:${transProfile};/" \
        "$scss_file"
else
    {
      echo "\$border:$ags_border;"
      echo "\$transparent:$ags_transparency;"
      echo "\$vibrant:$vibrant;"
      echo "\$transProfile:$transProfile;"
    } > "$scss_file"
fi

transparency() {
    # Hyprland Transparency
    local hypr_config="$XDG_CONFIG_HOME/hypr/hyprland/rules/default.conf"
    local hypr_line="windowrule = opacity $hypr_opacity override, class:.*"
    if [[ $(sed -n '1p' "$hypr_config") != "$hypr_line" ]]; then
        sed -i "1s/.*/$hypr_line/" "$hypr_config"
    fi
    
    # Terminals Transparency
    # Foot
    local foot_config="$XDG_CONFIG_HOME/foot/colors.ini"
    local foot_line="alpha=$term_alpha"
    if [[ $(sed -n '2p' "$foot_config") != "$foot_line" ]]; then
        sed -i "2s/.*/$foot_line/" "$foot_config"
    fi
    
    # Kitty
    local kitty_config="$XDG_CONFIG_HOME/kitty/kitty.conf"
    local kitty_line="background_opacity $term_alpha"
    if [[ $(sed -n '1p' "$kitty_config") != "$kitty_line" ]]; then
        sed -i "1s/.*/$kitty_line/" "$kitty_config"
    fi
    
    # Rofi Transparency
    local rofi_config="$XDG_CONFIG_HOME/rofi/config.rasi"
    local rofi_pattern="s/wbg:.*;/wbg:$rofi_alpha;/; s/element-bg:.*;/element-bg:$rofi_alpha_element;/"
    sed -i "$rofi_pattern" "$rofi_config"
}

reload() {
    agsv1 -r "handleStyles();"
}

# Run transparency changes in parallel
transparency 


# Reload agsv1 styles
reload
