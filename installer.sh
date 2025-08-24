#!/bin/bash

# ██╗  ██╗██╗   ██╗██████╗ ██████╗ ██╗     ██╗   ██╗███╗   ██╗ █████╗
# ██║  ██║╚██╗ ██╔╝██╔══██╗██╔══██╗██║     ██║   ██║████╗  ██║██╔══██╗
# ███████║ ╚████╔╝ ██████╔╝██████╔╝██║     ██║   ██║██╔██╗ ██║███████║
# ██╔══██║  ╚██╔╝  ██╔═══╝ ██╔══██╗██║     ██║   ██║██║╚██╗██║██╔══██║
# ██║  ██║   ██║   ██║     ██║  ██║███████╗╚██████╔╝██║ ╚████║██║  ██║
# ╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝
#
# HYPRLUNA Installer for Arch Linux
# Based on the official documentation: https://hyprluna.org/docs/main-dots/installation

# --- Color Scheme (Gruvbox Dark Style, Medium Contrast) ---
C_GB_BG0_HARD="#1d2021"
C_GB_BG0="#282828"
C_GB_FG1="#ebdbb2"
C_GB_FG0="#fbf1c7"
C_GB_RED="#cc241d"
C_GB_GREEN="#98971a"
C_GB_YELLOW="#d79921"
C_GB_BLUE="#458588"
C_GB_PURPLE="#b16286"
C_GB_AQUA="#689d6a"
C_GB_GRAY="#a89984"
C_GB_ORANGE="#d65d0e"

# Mapping to script roles
C_ACCENT_PRIMARY="$C_GB_PURPLE"
C_ACCENT_SECONDARY="$C_GB_AQUA"
C_TEXT_MUTED="$C_GB_GRAY"
C_TEXT_ON_ACCENT="$C_GB_FG0"
C_WARN_TEXT="$C_GB_YELLOW"
C_INFO_TEXT="$C_GB_BLUE"
C_SUCCESS_TEXT="$C_GB_GREEN"
C_ERROR_TEXT="$C_GB_RED"
C_BORDER_COLOR="$C_GB_GRAY"

C_ANSI_PRIMARY_FG="\033[38;5;133m"
C_ANSI_SECONDARY_FG="\033[38;5;72m"
C_ANSI_TEXT_MUTED="\033[38;5;245m"
C_ANSI_TEXT_BRIGHT="\033[38;5;223m"
C_ANSI_YELLOW="\033[1;38;5;178m"
C_ANSI_GREEN="\033[38;5;106m"
C_ANSI_UNDERLINE="\033[4m"
C_ANSI_BOLD="\033[1m"
C_ANSI_RESET="\033[0m"

# --- Argument Parsing ---
BRANCH=""
REPO_URL="https://github.com/Lunaris-Project/HyprLuna.git"

show_help() {
    echo "HYPRLUNA Installer for Arch Linux"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t    Install from testers branch (development/testing version)"
    echo "  -m    Install from main branch (stable version)"
    echo "  -h    Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -m    # Install stable version from main branch"
    echo "  $0 -t    # Install testing version from testers branch"
    echo ""
    echo "Note: You must specify either -t or -m flag to proceed with installation."
    exit 0
}

# Parse command line arguments
while getopts "tmh" opt; do
    case $opt in
    t)
        BRANCH="testers"
        ;;
    m)
        BRANCH="main"
        ;;
    h)
        show_help
        ;;
    \?)
        echo "Invalid option: -$OPTARG" >&2
        echo "Use -h for help."
        exit 1
        ;;
    esac
done

# Check if branch was specified
if [ -z "$BRANCH" ]; then
    echo "Error: You must specify a branch to install from."
    echo ""
    show_help
fi

# --- Configuration and Variables ---
HYPRLUNA_INSTALL_DIR="$HOME/HyprLuna"
PARU_CLONE_DIR="/tmp/paru_install_$$"
# AGSV1_CLONE_DIR="/tmp/agsv1_install_$$"
BACKUP_DIR="$HOME/HyprLuna-User-Bak_$(date +%Y%m%d_%H%M%S)"
PARU_LOG_FILE=$(mktemp /tmp/hyprluna_paru_log.XXXXXX)

# Packages to install with pacman (basic prerequisites)
PACMAN_PREREQ_PACKAGES=(
    "base-devel" "git" "archlinux-keyring"
)

# Packages to install with paru
PARU_PACKAGES=(
    "hyprland" "axel" "bc" "coreutils" "cliphist" "cmake" "curl" "rofi-wayland" "rofi-emoji" "rofi-calc" "rofi-dmenu" "rsync" "cpio" "wget" "ripgrep" "jq" "npm" "meson"
    "typescript" "gjs" "xdg-user-dirs" "brightnessctl" "ddcutil" "pavucontrol" "wireplumber" "libdbusmenu-gtk3" "kitty"
    "playerctl" "swww" "gobject-introspection" "glib2-devel" "gvfs" "glib2" "glibc" "gtk3" "gtk-layer-shell" "libpulse"
    "pam" "gnome-bluetooth-3.0" "gammastep" "libsoup3" "libnotify" "networkmanager" "power-profiles-daemon" "upower"
    "adw-gtk-theme-git" "qt5ct" "qt5-wayland" "fontconfig" "ttf-readex-pro" "ttf-jetbrains-mono-nerd"
    "ttf-material-symbols-variable-git" "apple-fonts" "ttf-space-mono-nerd" "ttf-rubik-vf" "bibata-cursor-theme-bin"
    "bibata-rainbow-cursor-theme" "bibata-extra-cursor-theme" "bibata-cursor-translucent" "ttf-gabarito-git" "fish"
    "foot" "starship" "polkit-gnome" "gnome-keyring" "gnome-control-center" "blueberry" "webp-pixbuf-loader"
    "gtksourceview3" "yad" "ydotool" "xdg-user-dirs-gtk" "tinyxml2" "gtkmm3" "gtksourceviewmm" "cairomm"
    "xdg-desktop-portal" "xdg-desktop-portal-gtk" "xdg-desktop-portal-hyprland" "gradience" "python-libsass"
    "python-pywalfox" "matugen-bin" "python-build" "python-pillow" "python-pywal" "python-setuptools-scm"
    "python-wheel" "swappy" "wf-recorder" "grim" "tesseract" "tesseract-data-eng" "slurp" "dart-sass"
    "python-pywayland" "python-psutil" "hypridle" "hyprutils" "hyprlock" "wlogout" "wl-clipboard" "hyprpicker"
    "ghostty" "ttf-noto-sans-cjk-vf" "noto-fonts-emoji" "cava" "metar" "gowall" "go" "overskride"
    "visual-studio-code-bin" "mpv" "github-desktop-bin" "sddm" "python-yapsy" "yt-dlp" "nm-connection-editor" "fastfetch" "firefox"
)

# --- Helper Functions ---
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

display_logo() {
    gum style \
        --foreground "$C_ACCENT_PRIMARY" --border double --border-foreground "$C_BORDER_COLOR" \
        --align center --width 80 --margin "1 0" --padding "1" \
        "██╗  ██╗██╗   ██╗██████╗ ██████╗ ██╗     ██╗   ██╗███╗   ██╗ █████╗ " \
        "██║  ██║╚██╗ ██╔╝██╔══██╗██╔══██╗██║     ██║   ██║████╗  ██║██╔══██╗" \
        "███████║ ╚████╔╝ ██████╔╝██████╔╝██║     ██║   ██║██╔██╗ ██║███████║" \
        "██╔══██║  ╚██╔╝  ██╔═══╝ ██╔══██╗██║     ██║   ██║██║╚██╗██║██╔══██║" \
        "██║  ██║   ██║   ██║     ██║  ██║███████╗╚██████╔╝██║ ╚████║██║  ██║" \
        "╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝" \
        "" \
        "$(gum style --foreground "$C_ACCENT_SECONDARY" 'HYPRLUNA Installer for Arch Linux')"
}

show_section_progress() {
    local current=$1
    local total=$2
    local section_name=$3
    local width=50
    local progress_char="#"
    local progress=$((current * 100 / total))
    local filled_count=$((progress * width / 100))

    local bar_str=""
    if [ "$filled_count" -gt 0 ]; then
        for i in $(seq 1 "$filled_count"); do
            if ((i % 2 != 0)); then
                bar_str+="${C_ANSI_PRIMARY_FG}${progress_char}"
            else
                bar_str+="${C_ANSI_SECONDARY_FG}${progress_char}"
            fi
        done
    fi
    bar_str+="${C_ANSI_RESET}"

    local unfilled_count=$((width - filled_count))
    if [ "$unfilled_count" -lt 0 ]; then unfilled_count=0; fi

    local unfilled_spaces=""
    if [ "$unfilled_count" -gt 0 ]; then
        unfilled_spaces=$(printf "%${unfilled_count}s" "")
    fi

    printf "\n"
    gum style --foreground "$C_ACCENT_PRIMARY" --bold "OVERALL INSTALLATION PROGRESS"
    printf "%b%s %d%% - %s\n" "[${bar_str}" "${unfilled_spaces}]" "$progress" "$section_name"
    printf "\n"
}

generate_simple_progress_bar() {
    local current_val=$1
    local total_val=$2
    local bar_width=${3:-25}
    local char="#"

    local progress_val=$((current_val * 100 / total_val))
    local filled_units=$((progress_val * bar_width / 100))

    local bar_str=""
    if [ "$filled_units" -gt 0 ]; then
        for i_fill in $(seq 1 "$filled_units"); do
            if ((i_fill % 2 != 0)); then
                bar_str+="${C_ANSI_PRIMARY_FG}${char}"
            else
                bar_str+="${C_ANSI_SECONDARY_FG}${char}"
            fi
        done
        bar_str+="${C_ANSI_RESET}"
    fi
    echo "$bar_str"
}

run_with_spinner() {
    local title="$1"
    shift
    local command_to_run="$@"
    local temp_log
    temp_log=$(mktemp)

    gum spin --spinner dot --title "$title" \
        --title.foreground "$C_ACCENT_SECONDARY" --spinner.foreground "$C_ACCENT_PRIMARY" \
        -- bash -c "$command_to_run" >"$temp_log" 2>&1

    local ret_code=$?

    if [ $ret_code -ne 0 ]; then
        gum style --padding "0 1" --foreground "$C_WARN_TEXT" "Command failed with code $ret_code:"
        gum style --padding "0 2" --foreground "$C_TEXT_MUTED" "$(tail -n 5 "$temp_log")"
    fi
    rm -f "$temp_log"
    return $ret_code
}

gum_confirm() {
    local prompt_message="$1"
    gum confirm "$prompt_message" \
        --affirmative "Yes" --negative "No" \
        --prompt.foreground "$C_ACCENT_SECONDARY" \
        --selected.background "$C_ACCENT_PRIMARY" --selected.foreground "$C_TEXT_ON_ACCENT" \
        --unselected.foreground "$C_TEXT_MUTED"
}

# --- Initial GUM Check ---
if ! command_exists gum; then
    echo "---------------------------------------------------------------------"
    echo " HYPRLUNA Installer requires GUM for its graphical interface."
    echo " GUM does not seem to be installed on your system."
    echo "---------------------------------------------------------------------"
    printf "Do you want the script to try to install GUM? (y/N): "
    read -r install_gum_choice
    if [[ "$install_gum_choice" =~ ^([yY])$ ]]; then
        echo "Attempting to install GUM..."
        if sudo pacman -S --noconfirm gum; then
            echo "GUM installed successfully from official repositories."
        else
            echo "Attempting to install GUM from AUR..."
            if ! command_exists git || ! pacman -Q base-devel >/dev/null 2>&1; then
                echo "Installing git and base-devel..."
                sudo pacman -S --noconfirm --needed git base-devel || {
                    echo "Error: Could not install git and base-devel."
                    echo "GUM is required to continue. Aborting."
                    exit 1
                }
            fi
            temp_gum_dir=$(mktemp -d /tmp/gum_aur_XXXXXX)
            if git clone https://aur.archlinux.org/gum.git "$temp_gum_dir"; then
                (cd "$temp_gum_dir" && makepkg -si --noconfirm)
                rm -rf "$temp_gum_dir"
            else
                echo "Error cloning GUM repository from AUR."
            fi
        fi

        if command_exists gum; then
            echo "GUM installed successfully. Continuing..."
            sleep 1
        else
            echo "Error: Could not install GUM. Please install it manually."
            exit 1
        fi
    else
        echo "GUM is required to continue. Aborting."
        exit 1
    fi
fi

# --- Main Installer Flow ---
clear
display_logo

# Centered Welcome Message Block - MODIFIED for better list presentation
gum style --padding "1 2" --margin "1 0" --align center --width 80 --border normal --border-foreground "$C_BORDER_COLOR" \
    "$(gum style --bold --foreground "$C_ACCENT_PRIMARY" 'Welcome to HYPRLUNA installer!')" \
    "" \
    "$(gum style --foreground "$C_TEXT_MUTED" 'This script follows the steps from the official HyprLuna documentation.')" \
    "$(gum style --foreground "$C_TEXT_MUTED" "Source: $(gum style --underline --foreground "$C_ACCENT_SECONDARY" 'https://hyprluna.org/docs/main-dots/installation')")" \
    "" \
    "$(gum style --bold --foreground "$C_ACCENT_SECONDARY" "Installing from branch: $(gum style --foreground "$C_ACCENT_PRIMARY" "$BRANCH")")" \
    "" \
    "$(gum style --bold --foreground "$C_ACCENT_SECONDARY" 'The following steps will be performed:')" \
    "$(
        gum style --foreground "$C_TEXT_MUTED" --margin "0 0 0 2" \
            "$(gum style --foreground "$C_ACCENT_PRIMARY" '→') 1. Verify & Install Prerequisites" \
            "$(gum style --foreground "$C_ACCENT_PRIMARY" '→') 2. Install AUR Helper (paru)" \
            "$(gum style --foreground "$C_ACCENT_PRIMARY" '→') 3. Install HyprLuna Dependencies" \
            "$(gum style --foreground "$C_ACCENT_PRIMARY" '→') 4. Install AGS v1 (Aylur's GTK Shell)" \
            "$(gum style --foreground "$C_ACCENT_PRIMARY" '→') 5. Backup Existing User Configurations (Optional)" \
            "$(gum style --foreground "$C_ACCENT_PRIMARY" '→') 6. Clone & Set Up HyprLuna" \
            "$(gum style --foreground "$C_ACCENT_PRIMARY" '→') 7. Configure SDDM (Astronaut Theme)"
    )" \
    "" \
    "$(gum style --foreground "$C_WARN_TEXT" 'Some steps will require sudo privileges.')" \
    "$(gum style --foreground "$C_TEXT_MUTED" 'The script will guide you through each step and ask for confirmation.')"

if ! gum_confirm "Are you ready to begin the HyprLuna installation?"; then
    gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "Installation cancelled by the user."
    exit 0
fi

# --- STEP 0: BASIC PREREQUISITES ---
TOTAL_STEPS=7
CURRENT_STEP=1
show_section_progress "$CURRENT_STEP" "$TOTAL_STEPS" "STEP 0: Verifying basic prerequisites"
gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "STEP 0: Verifying basic prerequisites."
missing_pacman_pkgs=()
for pkg in "${PACMAN_PREREQ_PACKAGES[@]}"; do
    if ! pacman -Q "$pkg" >/dev/null 2>&1; then
        missing_pacman_pkgs+=("$pkg")
    fi
done

if [ ${#missing_pacman_pkgs[@]} -gt 0 ]; then
    gum style --padding "0 1" --foreground "$C_WARN_TEXT" "Required packages: $(gum style --bold --foreground "$C_ACCENT_PRIMARY" "${missing_pacman_pkgs[*]}")."
    if gum_confirm "Install these packages now?"; then
        if ! run_with_spinner "Installing base packages..." "sudo pacman -S --noconfirm --needed ${missing_pacman_pkgs[*]}"; then
            gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Could not install base packages. Aborting."
            exit 1
        fi
        gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_SUCCESS_TEXT" "Base packages installed successfully."
    else
        gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Installation cancelled. Missing base packages."
        exit 1
    fi
else
    gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "Basic prerequisites already installed."
fi

gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "Updating system (recommended)."
if gum_confirm "Update the system now?"; then
    run_with_spinner "Updating archlinux-keyring..." "sudo pacman -S --noconfirm --needed archlinux-keyring"
    run_with_spinner "Updating the system..." "sudo pacman -Syyu --noconfirm"
else
    gum log --level warn --level.foreground "$C_WARN_TEXT" --message.foreground "$C_WARN_TEXT" "System update skipped."
fi

# --- STEP 1: INSTALL AUR HELPER (paru) ---
CURRENT_STEP=2
show_section_progress "$CURRENT_STEP" "$TOTAL_STEPS" "STEP 1: Installing AUR Helper (paru)"
gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "STEP 1: Installing AUR Helper (paru)."
if command_exists paru; then
    gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "AUR Helper 'paru' is already installed."
else
    if gum_confirm "Install 'paru' now?"; then
        rm -rf "$PARU_CLONE_DIR"
        mkdir -p "$PARU_CLONE_DIR"

        if ! run_with_spinner "Cloning paru from AUR..." "git clone https://aur.archlinux.org/paru.git $PARU_CLONE_DIR"; then
            gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Failed to clone 'paru'. Aborting."
            rm -rf "$PARU_CLONE_DIR"
            exit 1
        fi

        original_dir=$(pwd)
        cd "$PARU_CLONE_DIR" || {
            gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Could not access $PARU_CLONE_DIR"
            rm -rf "$PARU_CLONE_DIR"
            exit 1
        }

        if ! run_with_spinner "Installing paru..." "makepkg -si --noconfirm"; then
            gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Failed to install 'paru'. Aborting."
            cd "$original_dir"
            rm -rf "$PARU_CLONE_DIR"
            exit 1
        fi

        cd "$original_dir"
        rm -rf "$PARU_CLONE_DIR"
        gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_SUCCESS_TEXT" "'paru' installed successfully."
    else
        gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "'paru' is required to continue. Aborting."
        exit 1
    fi
fi

# --- STEP 2: INSTALL REQUIRED PACKAGES (with paru) ---
CURRENT_STEP=3
show_section_progress "$CURRENT_STEP" "$TOTAL_STEPS" "STEP 2: Installing HyprLuna Dependencies"
gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "STEP 2: Installing required packages for HyprLuna."

# Separate python packages
PYTHON_PACKAGES=()
OTHER_PACKAGES=()
for pkg in "${PARU_PACKAGES[@]}"; do
    if [[ "$pkg" == python-* ]]; then
        PYTHON_PACKAGES+=("$pkg")
    else
        OTHER_PACKAGES+=("$pkg")
    fi
done

gum style --padding "0 1" --foreground "$C_ACCENT_SECONDARY" "${#PARU_PACKAGES[@]} packages will be installed (many from AUR)."
gum style --padding "0 1" --foreground "$C_TEXT_MUTED" "Installation log: $(gum style --bold --foreground "$C_INFO_TEXT" "$PARU_LOG_FILE")"
gum style --padding "0 1" --foreground "$C_WARN_TEXT" "This process can be lengthy and may involve compilations."

if gum_confirm "Proceed with package installation?"; then
    TOTAL_PACKAGES=${#PARU_PACKAGES[@]}
    PROCESSED_COUNT=0
    FAILED_PACKAGES=()
    SKIPPED_PACKAGES=()
    SUCCESS_PACKAGES=()

    echo "=== HyprLuna Package Installation Log ($(date)) ===" >"$PARU_LOG_FILE"
    echo "Total packages to install: $TOTAL_PACKAGES" >>"$PARU_LOG_FILE"
    echo "Python packages to install first: ${#PYTHON_PACKAGES[@]}" >>"$PARU_LOG_FILE"
    echo "Other packages to install: ${#OTHER_PACKAGES[@]}" >>"$PARU_LOG_FILE"
    echo "" >>"$PARU_LOG_FILE"

    is_package_installed() {
        pacman -Q "$1" &>/dev/null
    }

    # Install Python packages first
    if [ ${#PYTHON_PACKAGES[@]} -gt 0 ]; then
        gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "Installing Python packages..."
        echo "Installing Python packages..."
        for pkg in "${PYTHON_PACKAGES[@]}"; do
            PROCESSED_COUNT=$((PROCESSED_COUNT + 1))
            PROGRESS=$((PROCESSED_COUNT * 100 / TOTAL_PACKAGES))

            pkg_bar_fill_str=$(generate_simple_progress_bar "$PROCESSED_COUNT" "$TOTAL_PACKAGES" 25)

            printf "\r%b %d%% (%d/%d) - Installing (Python): %-30.30s " "[${pkg_bar_fill_str}]" "$PROGRESS" "$PROCESSED_COUNT" "$TOTAL_PACKAGES" "$pkg"

            if is_package_installed "$pkg"; then
                echo "SKIPPED: $pkg is already installed." >>"$PARU_LOG_FILE"
                SKIPPED_PACKAGES+=("$pkg")
            else
                echo "=== Installing $pkg ($PROCESSED_COUNT/$TOTAL_PACKAGES) ===" >>"$PARU_LOG_FILE"
                if ! paru -S --noconfirm --needed "$pkg" >>"$PARU_LOG_FILE" 2>&1; then
                    FAILED_PACKAGES+=("$pkg")
                    echo "FAILURE: Installation of $pkg failed." >>"$PARU_LOG_FILE"
                else
                    SUCCESS_PACKAGES+=("$pkg")
                    echo "SUCCESS: $pkg installed successfully." >>"$PARU_LOG_FILE"
                fi
                echo "" >>"$PARU_LOG_FILE"
            fi
        done
        printf "\n"
        gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_TEXT_MUTED" "Python packages processed."
    fi

    # Install other packages
    if [ ${#OTHER_PACKAGES[@]} -gt 0 ]; then
        gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "Installing remaining packages..."
        echo "Installing remaining packages..."
        for pkg in "${OTHER_PACKAGES[@]}"; do
            PROCESSED_COUNT=$((PROCESSED_COUNT + 1))
            PROGRESS=$((PROCESSED_COUNT * 100 / TOTAL_PACKAGES))

            pkg_bar_fill_str=$(generate_simple_progress_bar "$PROCESSED_COUNT" "$TOTAL_PACKAGES" 25)

            printf "\r%b %d%% (%d/%d) - Installing (Other): %-30.30s " "[${pkg_bar_fill_str}]" "$PROGRESS" "$PROCESSED_COUNT" "$TOTAL_PACKAGES" "$pkg"

            if is_package_installed "$pkg"; then
                echo "SKIPPED: $pkg is already installed." >>"$PARU_LOG_FILE"
                SKIPPED_PACKAGES+=("$pkg")
            else
                echo "=== Installing $pkg ($PROCESSED_COUNT/$TOTAL_PACKAGES) ===" >>"$PARU_LOG_FILE"
                if ! paru -S --noconfirm --needed "$pkg" >>"$PARU_LOG_FILE" 2>&1; then
                    FAILED_PACKAGES+=("$pkg")
                    echo "FAILURE: Installation of $pkg failed." >>"$PARU_LOG_FILE"
                else
                    SUCCESS_PACKAGES+=("$pkg")
                    echo "SUCCESS: $pkg installed successfully." >>"$PARU_LOG_FILE"
                fi
                echo "" >>"$PARU_LOG_FILE"
            fi
        done
        printf "\n"
        gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_TEXT_MUTED" "Remaining packages processed."
    fi

    echo "=== Installation Summary ===" >>"$PARU_LOG_FILE"
    echo "Successful packages: ${#SUCCESS_PACKAGES[@]}" >>"$PARU_LOG_FILE"
    echo "Skipped packages (already installed): ${#SKIPPED_PACKAGES[@]}" >>"$PARU_LOG_FILE"
    echo "Failed packages: ${#FAILED_PACKAGES[@]}" >>"$PARU_LOG_FILE"

    if [ ${#FAILED_PACKAGES[@]} -gt 0 ]; then
        gum log --level warn --level.foreground "$C_WARN_TEXT" --message.foreground "$C_WARN_TEXT" "Some packages failed to install: $(gum style --bold --foreground "$C_ACCENT_PRIMARY" "${FAILED_PACKAGES[*]}")"
        gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "Check the log at $(gum style --underline --foreground "$C_INFO_TEXT" "$PARU_LOG_FILE")"

        if gum_confirm "Continue despite errors?"; then
            gum log --level warn --level.foreground "$C_WARN_TEXT" --message.foreground "$C_WARN_TEXT" "Continuing with installation. Some components might not work."
        else
            gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Installation cancelled due to package errors."
            gum_confirm "View the installation log now?" && gum pager <"$PARU_LOG_FILE"
            exit 1
        fi
    else
        gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_SUCCESS_TEXT" "All packages processed successfully."
        gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "Installed: ${#SUCCESS_PACKAGES[@]} | Skipped: ${#SKIPPED_PACKAGES[@]}"
    fi

    if gum_confirm "View detailed installation log?"; then
        gum pager <"$PARU_LOG_FILE"
    fi
else
    gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Package installation cancelled. Aborting."
    exit 1
fi

# --- STEP 3: INSTALL LATEST AGS V1 ---
CURRENT_STEP=4
show_section_progress "$CURRENT_STEP" "$TOTAL_STEPS" "STEP 3: Installing AGS v1"
gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "STEP 3: Installing AGS v1 (Aylur's GTK Shell)."

if gum_confirm "Install AGS v1?"; then

    gum style --padding "0 1" --foreground "$C_TEXT_MUTED" "Installing AGS v1 by copying binaries to their appropriate paths you'll be prompted for your password:"
    sudo cp -r ./ags_bin_lib/com.github.Aylur.ags/ /usr/share/
    sudo cp -r ./ags_bin_lib/agsv1/ /usr/lib/
    sudo ln -sf /usr/share/com.github.Aylur.ags/com.github.Aylur.ags /usr/bin/agsv1

    rm -rf "$AGSV1_CLONE_DIR"
    gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_SUCCESS_TEXT" "AGS v1 installed successfully."
else
    gum log --level warn --level.foreground "$C_WARN_TEXT" --message.foreground "$C_WARN_TEXT" "AGS v1 installation skipped."
fi

# --- STEP 4: CREATE BACKUP (Optional) ---
CURRENT_STEP=5
show_section_progress "$CURRENT_STEP" "$TOTAL_STEPS" "STEP 4: Backing up existing configurations"
gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "STEP 4: Backing up existing configurations."

if gum_confirm "Create a backup of your configurations in '$BACKUP_DIR'?"; then
    mkdir -p "$BACKUP_DIR"
    dirs_to_backup=("$HOME/.config" "$HOME/.local" "$HOME/.fonts" "$HOME/.ags" "$HOME/Pictures")
    total_dirs=${#dirs_to_backup[@]}
    processed_dirs=0

    echo "Creating backup of configurations..."
    for dir_path in "${dirs_to_backup[@]}"; do
        processed_dirs=$((processed_dirs + 1))
        progress=$((processed_dirs * 100 / total_dirs))
        dir_name=$(basename "$dir_path")

        backup_bar_fill_str=$(generate_simple_progress_bar "$processed_dirs" "$total_dirs" 25)

        printf "\r%b %d%% (%d/%d) - Backing up: %-30.30s " "[${backup_bar_fill_str}]" "$progress" "$processed_dirs" "$total_dirs" "$dir_name"

        if [ -d "$dir_path" ]; then
            rsync -aq "$dir_path" "$BACKUP_DIR/" >/dev/null 2>&1 || {
                echo "Error backing up $dir_name." >>"$PARU_LOG_FILE"
            }
        else
            echo "$dir_name not found for backup." >>"$PARU_LOG_FILE"
        fi
    done
    printf "\n"
    gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_TEXT_MUTED" "Backup completed in $(gum style --underline --foreground "$C_INFO_TEXT" "$BACKUP_DIR")."
else
    gum log --level warn --level.foreground "$C_WARN_TEXT" --message.foreground "$C_WARN_TEXT" "Backup creation skipped."
fi

# --- STEP 5: CLONE AND CONFIGURE HYPRLUNA ---
CURRENT_STEP=6
show_section_progress "$CURRENT_STEP" "$TOTAL_STEPS" "STEP 5: Cloning and configuring HyprLuna"
gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "STEP 5: Cloning and configuring HyprLuna."

if [ -d "$HYPRLUNA_INSTALL_DIR" ]; then
    gum log --level warn --level.foreground "$C_WARN_TEXT" --message.foreground "$C_WARN_TEXT" "Directory $(gum style --bold "$HYPRLUNA_INSTALL_DIR") already exists."

    # Check if it's a git repository
    if [ -d "$HYPRLUNA_INSTALL_DIR/.git" ]; then
        # Offer options for existing repository
        repo_action=$(gum choose --header="What would you like to do with the existing HyprLuna installation?" \
            --cursor.foreground="$C_ACCENT_PRIMARY" \
            --selected.foreground="$C_TEXT_ON_ACCENT" --selected.background="$C_ACCENT_PRIMARY" \
            "Skip (keep existing installation)" \
            "Update (pull latest changes)" \
            "Reinstall (remove and clone again)")

        case "$repo_action" in
        "Skip (keep existing installation)")
            gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "Keeping existing HyprLuna installation."
            ;;
        "Update (pull latest changes)")
            gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "Updating existing HyprLuna installation..."
            original_dir_update=$(pwd)
            cd "$HYPRLUNA_INSTALL_DIR" || {
                gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Could not access $HYPRLUNA_INSTALL_DIR. Aborting."
                exit 1
            }

            # Switch to the specified branch and pull latest changes
            if ! run_with_spinner "Switching to $BRANCH branch..." "git checkout $BRANCH"; then
                gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Could not switch to $BRANCH branch. Aborting."
                cd "$original_dir_update" || true
                exit 1
            fi

            if ! run_with_spinner "Updating HyprLuna from $BRANCH branch..." "git pull origin $BRANCH"; then
                gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Could not update HyprLuna from $BRANCH branch. Aborting."
                cd "$original_dir_update" || true
                exit 1
            fi

            gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_SUCCESS_TEXT" "HyprLuna updated successfully from $BRANCH branch."
            cd "$original_dir_update" || true
            ;;
        "Reinstall (remove and clone again)")
            gum log --level warn --level.foreground "$C_WARN_TEXT" --message.foreground "$C_WARN_TEXT" "Removing existing installation for a fresh clone..."
            if ! run_with_spinner "Deleting existing directory $HYPRLUNA_INSTALL_DIR..." "rm -rf $HYPRLUNA_INSTALL_DIR"; then
                gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Could not delete directory $HYPRLUNA_INSTALL_DIR. Aborting."
                exit 1
            fi
            gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_SUCCESS_TEXT" "Directory $HYPRLUNA_INSTALL_DIR deleted."

            # Clone fresh repository
            if ! run_with_spinner "Cloning HyprLuna ($BRANCH branch)..." "git clone -b $BRANCH $REPO_URL $HYPRLUNA_INSTALL_DIR"; then
                gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Could not clone HyprLuna from $BRANCH branch. Aborting."
                exit 1
            fi
            ;;
        esac
    else
        # Directory exists but not a git repository
        gum log --level warn --level.foreground "$C_WARN_TEXT" --message.foreground "$C_WARN_TEXT" "Directory exists but is not a git repository."
        if gum_confirm "Remove existing directory and clone HyprLuna?"; then
            if ! run_with_spinner "Deleting existing directory $HYPRLUNA_INSTALL_DIR..." "rm -rf $HYPRLUNA_INSTALL_DIR"; then
                gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Could not delete directory $HYPRLUNA_INSTALL_DIR. Aborting."
                exit 1
            fi
            gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_SUCCESS_TEXT" "Directory $HYPRLUNA_INSTALL_DIR deleted."

            # Clone fresh repository
            if ! run_with_spinner "Cloning HyprLuna ($BRANCH branch)..." "git clone -b $BRANCH $REPO_URL $HYPRLUNA_INSTALL_DIR"; then
                gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Could not clone HyprLuna from $BRANCH branch. Aborting."
                exit 1
            fi
        else
            gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Cannot continue without a proper HyprLuna installation. Aborting."
            exit 1
        fi
    fi
else
    # Directory doesn't exist, clone fresh
    if ! run_with_spinner "Cloning HyprLuna ($BRANCH branch)..." "git clone -b $BRANCH $REPO_URL $HYPRLUNA_INSTALL_DIR"; then
        gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Could not clone HyprLuna from $BRANCH branch. Aborting."
        exit 1
    fi
fi

# Success message based on the action taken (repo_action may not be set if directory didn't exist)
if [ -n "${repo_action:-}" ]; then
    if [ "$repo_action" = "Skip (keep existing installation)" ]; then
        gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_TEXT_MUTED" "Using existing HyprLuna installation at $(gum style --underline --foreground "$C_INFO_TEXT" "$HYPRLUNA_INSTALL_DIR")."
    elif [ "$repo_action" = "Update (pull latest changes)" ]; then
        gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_TEXT_MUTED" "HyprLuna updated from $BRANCH branch at $(gum style --underline --foreground "$C_INFO_TEXT" "$HYPRLUNA_INSTALL_DIR")."
    else
        gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_TEXT_MUTED" "HyprLuna ($BRANCH branch) cloned to $(gum style --underline --foreground "$C_INFO_TEXT" "$HYPRLUNA_INSTALL_DIR")."
    fi
else
    gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_TEXT_MUTED" "HyprLuna ($BRANCH branch) cloned to $(gum style --underline --foreground "$C_INFO_TEXT" "$HYPRLUNA_INSTALL_DIR")."
fi

original_dir_step5=$(pwd)
cd "$HYPRLUNA_INSTALL_DIR" || {
    gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Could not access $HYPRLUNA_INSTALL_DIR. Aborting."
    exit 1
}

# Only apply configuration files if not using "Skip" option
if [ "${repo_action:-}" != "Skip (keep existing installation)" ]; then
    gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "Copying configuration files..."
else
    gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "Skipping configuration files (using existing installation)..."
fi

setup_actions=(
    "rsync -aq --remove-source-files .config/ $HOME/.config/"
    "rsync -aq --remove-source-files .local/ $HOME/.local/"
    "rsync -aq --remove-source-files .cache/ $HOME/.cache/"
    "[ -d .vscode ] && rsync -aq --remove-source-files .vscode/ $HOME/.vscode/ || echo 'Directory .vscode not found in repo.'"
    "[ -d .fonts ] && rsync -aq --remove-source-files .fonts/ $HOME/.fonts/ && fc-cache -f || echo 'Directory .fonts not found in repo.'"
    "[ -d .ags ] && rsync -aq --remove-source-files .ags/ $HOME/.ags/ || echo 'Directory .ags not found in repo.'"
    "[ -d Pictures ] && rsync -aq Pictures/ $HOME/Pictures/ || echo 'Directory Pictures not found in repo.'"
    "[ -d $HOME/.config/hypr/scripts ] && chmod -R +x $HOME/.config/hypr/scripts/ || echo 'Hypr scripts directory not found for chmod.'"
    "[ -d $HOME/.config/ags/scripts/hyprland ] && chmod -R +x $HOME/.config/ags/scripts/hyprland/ || echo 'AGS/Hyprland scripts directory not found for chmod.'"
    "[ -d $HOME/.config/ags/modules/sideleft/tools ] && chmod -R +x $HOME/.config/ags/modules/sideleft/tools/changeres.sh || echo 'AGS/modules/sideleft/tools scripts directory not found for chmod.'"
    "sudo systemctl enable sddm.service"
    "hyprpm update"
    "hyprpm add https://github.com/hyprwm/hyprland-plugins"
    "hyprpm enable hyprexpo"
    "hyprpm reload"
    "hyprctl reload"
    "chmod +x ~/.config/ags/lunactl"
    "sudo cp ~/.config/ags/lunactl /usr/bin/"
    "chmod +x /usr/bin/lunactl"
)

total_actions=${#setup_actions[@]}

# Only execute setup actions if not using "Skip" option
if [ "${repo_action:-}" != "Skip (keep existing installation)" ]; then
    echo "Copying configuration files..." | tee -a "$PARU_LOG_FILE"
    echo "--- Start of Setup Actions ---" >>"$PARU_LOG_FILE"

    for i in "${!setup_actions[@]}"; do
        action="${setup_actions[$i]}"
        action_num=$((i + 1))
        progress=$((action_num * 100 / total_actions))

        setup_bar_fill_str=$(generate_simple_progress_bar "$action_num" "$total_actions" 25)

        printf "\r%b %d%% (%d/%d) - Applying configuration...      " "[${setup_bar_fill_str}]" "$progress" "$action_num" "$total_actions"

        echo "Executing setup_action $action_num/$total_actions: $action" >>"$PARU_LOG_FILE"

        action_output_tmp=$(mktemp)
        if eval "$action" >"$action_output_tmp" 2>&1; then
            echo "SUCCESS: $action" >>"$PARU_LOG_FILE"
        else
            ret_code=$?
            echo "FAILURE ($ret_code): $action" >>"$PARU_LOG_FILE"
            echo "Failure output:" >>"$PARU_LOG_FILE"
            cat "$action_output_tmp" >>"$PARU_LOG_FILE"
        fi
        rm -f "$action_output_tmp"
    done
    printf "\n"
    echo "--- End of Setup Actions ---" >>"$PARU_LOG_FILE"
    gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_SUCCESS_TEXT" "HyprLuna configuration applied."
else
    echo "Skipping configuration files (using existing installation)..." >>"$PARU_LOG_FILE"
    gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "Using existing HyprLuna configuration."
fi
cd "$original_dir_step5" || true

# --- STEP 6: CONFIGURE SDDM ---
CURRENT_STEP=7
show_section_progress "$CURRENT_STEP" "$TOTAL_STEPS" "STEP 6: Configuring SDDM"
gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "STEP 6: Configuring SDDM (sddm-astronaut-theme)."

if ! pacman -Q sddm &>/dev/null; then
    gum log --level warn --level.foreground "$C_WARN_TEXT" --message.foreground "$C_WARN_TEXT" "SDDM is not installed."
    if gum_confirm "Install SDDM now?"; then
        if ! run_with_spinner "Installing SDDM..." "sudo pacman -S --noconfirm sddm"; then
            gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Could not install SDDM. Skipping theme configuration."
        else
            gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_SUCCESS_TEXT" "SDDM installed successfully."
        fi
    else
        gum log --level warn --level.foreground "$C_WARN_TEXT" --message.foreground "$C_WARN_TEXT" "SDDM not installed. Skipping theme configuration."
    fi
fi

if pacman -Q sddm &>/dev/null; then
    gum style --padding "0 1" --foreground "$C_TEXT_MUTED" "The next step will configure the SDDM Astronaut theme." \
        "$(gum style --bold --foreground "$C_WARN_TEXT" 'IMPORTANT: Select OPTION 1 when prompted.')"

    if gum_confirm "Configure SDDM Astronaut theme?"; then
        sddm_setup_url="https://raw.githubusercontent.com/keyitdev/sddm-astronaut-theme/master/setup.sh"
        if ! curl -s --head --fail "$sddm_setup_url" >/dev/null; then
            gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "Cannot access SDDM configuration script."
            gum log --level warn --level.foreground "$C_WARN_TEXT" --message.foreground "$C_WARN_TEXT" "You can install it manually later."
        else
            sddm_cmd="sh -c \"\$(curl -fsSL $sddm_setup_url)\""
            gum style --border normal --border-foreground "$C_BORDER_COLOR" --padding "1" --align center \
                "$(gum style --foreground "$C_ACCENT_SECONDARY" 'Running SDDM Astronaut Theme script...')" \
                "$(gum style --foreground "$C_WARN_TEXT" 'SELECT OPTION 1 when prompted.')" \
                "This installer will temporarily yield control."

            eval "$sddm_cmd"
            sddm_script_ret_code=$?

            if [[ $sddm_script_ret_code -eq 0 ]]; then
                gum log --level info --level.foreground "$C_SUCCESS_TEXT" --message.foreground "$C_SUCCESS_TEXT" "SDDM theme configured successfully."
                if ! systemctl is-enabled sddm.service &>/dev/null; then
                    run_with_spinner "Enabling SDDM..." "sudo systemctl enable sddm.service"
                    gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "SDDM enabled as a startup service."
                fi
            else
                gum log --level error --level.foreground "$C_ERROR_TEXT" --message.foreground "$C_ERROR_TEXT" "SDDM theme configuration failed."
            fi
        fi
    else
        gum log --level warn --level.foreground "$C_WARN_TEXT" --message.foreground "$C_WARN_TEXT" "SDDM theme configuration skipped."
        gum style --foreground "$C_TEXT_MUTED" "You can configure it later with:"
        echo "sh -c \"\$(curl -fsSL https://raw.githubusercontent.com/keyitdev/sddm-astronaut-theme/master/setup.sh)\""
    fi
else
    gum log --level warn --level.foreground "$C_WARN_TEXT" --message.foreground "$C_WARN_TEXT" "SDDM is not installed. Skipping theme configuration."
fi

# --- FINAL CLEANUP ---
# rm -rf "$PARU_CLONE_DIR" "$AGSV1_CLONE_DIR" 2>/dev/null
gum log --level info --level.foreground "$C_INFO_TEXT" --message.foreground "$C_TEXT_MUTED" "Cleanup of temporary files completed."

# --- FINAL MESSAGE ---
clear
display_logo

BOX_CONTENT_WIDTH=63

printf_box_line() {
    local text_content="$1"
    local text_len_visible
    text_len_visible=$(echo -e "$text_content" | sed -r "s/\x1B\[([0-9]{1,3}(;[0-9]{1,2})?)?[mGK]//g" | wc -c)
    text_len_visible=$((text_len_visible - 1))

    local padding_needed=$((BOX_CONTENT_WIDTH - text_len_visible))
    if [ $padding_needed -lt 0 ]; then padding_needed=0; fi
    local padding_spaces
    padding_spaces=$(printf "%${padding_needed}s" "")

    echo -e "${C_ANSI_PRIMARY_FG}│${C_ANSI_RESET} ${text_content}${padding_spaces} ${C_ANSI_PRIMARY_FG}│${C_ANSI_RESET}"
}

printf "\n\n"
echo -e "${C_ANSI_PRIMARY_FG}┌$(printf '%*s' "$BOX_CONTENT_WIDTH" '' | tr ' ' '─')┐${C_ANSI_RESET}"
printf_box_line ""
printf_box_line "              ${C_ANSI_BOLD}HYPRLUNA INSTALLATION COMPLETE!${C_ANSI_RESET}           "
printf_box_line ""
echo -e "${C_ANSI_PRIMARY_FG}├$(printf '%*s' "$BOX_CONTENT_WIDTH" '' | tr ' ' '─')┤${C_ANSI_RESET}"
printf_box_line "${C_ANSI_SECONDARY_FG}Summary:${C_ANSI_RESET}"
printf_box_line "${C_ANSI_TEXT_BRIGHT}- System prerequisites installed${C_ANSI_RESET}"
printf_box_line "${C_ANSI_TEXT_BRIGHT}- HyprLuna packages installed${C_ANSI_RESET}"
printf_box_line "${C_ANSI_TEXT_BRIGHT}- AGS v1 installed (if selected)${C_ANSI_RESET}"
printf_box_line "${C_ANSI_TEXT_BRIGHT}- HyprLuna configured${C_ANSI_RESET}"
printf_box_line "${C_ANSI_TEXT_BRIGHT}- SDDM configured (if selected)${C_ANSI_RESET}"
printf_box_line ""
printf_box_line "${C_ANSI_YELLOW}NEXT STEPS:${C_ANSI_RESET}"
printf_box_line "${C_ANSI_TEXT_BRIGHT}1. REBOOT YOUR SYSTEM to apply all changes${C_ANSI_RESET}"
printf_box_line "${C_ANSI_TEXT_BRIGHT}2. In SDDM, select Hyprland as your session${C_ANSI_RESET}"
printf_box_line "${C_ANSI_TEXT_BRIGHT}3. Log in to enjoy your new setup${C_ANSI_RESET}"
printf_box_line ""
log_line_text="${C_ANSI_TEXT_BRIGHT}Installation log: ${C_ANSI_UNDERLINE}${PARU_LOG_FILE}${C_ANSI_RESET}"
printf_box_line "$log_line_text"
echo -e "${C_ANSI_PRIMARY_FG}└$(printf '%*s' "$BOX_CONTENT_WIDTH" '' | tr ' ' '─')┘${C_ANSI_RESET}"

if [ -d "$BACKUP_DIR" ]; then
    echo -e "\n${C_ANSI_TEXT_BRIGHT}Backup created in: ${C_ANSI_UNDERLINE}$BACKUP_DIR${C_ANSI_RESET}\n"
fi

echo -e "\n${C_ANSI_BOLD}${C_ANSI_GREEN}Enjoy your new HYPRLUNA setup!${C_ANSI_RESET}\n"

BOX_RESTART_WIDTH=63
echo -e "${C_ANSI_PRIMARY_FG}┌$(printf '%*s' "$BOX_RESTART_WIDTH" '' | tr ' ' '─')┐${C_ANSI_RESET}"
restart_options_text="                 ${C_ANSI_YELLOW}REBOOT OPTIONS:${C_ANSI_RESET}                 "
restart_options_len=$(echo -e "$restart_options_text" | sed -r "s/\x1B\[([0-9]{1,3}(;[0-9]{1,2})?)?[mGK]//g" | wc -c)
restart_options_len=$((restart_options_len - 1))
restart_padding_needed=$((BOX_RESTART_WIDTH - restart_options_len))
if [ $restart_padding_needed -lt 0 ]; then restart_padding_needed=0; fi
restart_padding_spaces=$(printf "%${restart_padding_needed}s" "")
echo -e "${C_ANSI_PRIMARY_FG}│${C_ANSI_RESET} ${restart_options_text}${restart_padding_spaces} ${C_ANSI_PRIMARY_FG}│${C_ANSI_RESET}"
echo -e "${C_ANSI_PRIMARY_FG}└$(printf '%*s' "$BOX_RESTART_WIDTH" '' | tr ' ' '─')┘${C_ANSI_RESET}"

printf "${C_ANSI_TEXT_BRIGHT}Reboot the system now? (y/n): ${C_ANSI_RESET}"
read -r choice
if [[ "$choice" =~ ^[Yy]$ ]]; then
    echo -e "${C_ANSI_GREEN}Rebooting the system...${C_ANSI_RESET}"
    sudo systemctl reboot
else
    printf "${C_ANSI_TEXT_BRIGHT}Restart display manager service? (will log you out) (y/n): ${C_ANSI_RESET}"
    read -r choice
    if [[ "$choice" =~ ^[Yy]$ ]]; then
        echo -e "${C_ANSI_GREEN}Restarting display manager service...${C_ANSI_RESET}"
        sudo systemctl restart display-manager.service
    else
        echo -e "${C_ANSI_YELLOW}Remember to reboot to apply all changes.${C_ANSI_RESET}"
    fi
fi

exit 0