function fish_prompt -d "Write out the prompt"
    # This shows up as USER@HOST /home/user/ >, with the directory colored
    # $USER and $hostname are set by fish, so you can just use them
    # instead of using `whoami` and `hostname`
    printf '%s@%s %s%s%s > ' $USER $hostname \
        (set_color $fish_color_cwd) (prompt_pwd) (set_color normal)
end
function set_kitty_colors
    set color_file ~/.cache/ags/user/generated/kitty-colors.conf
    if test -f $color_file
        kitty @ set-colors --all --configured $color_file
    else
        echo "Color scheme file not found: $color_file"
    end
end

if status is-interactive
    set fish_greeting
    set_kitty_colors
    # fastfetch
    #pokemon-colorscripts-go \
    #    -s \
    #    --no-title
end

starship init fish | source
if test -f ~/.cache/ags/user/generated/terminal/sequences.txt
    cat ~/.cache/ags/user/generated/terminal/sequences.txt
end

alias pamcan=pacman
alias settings="gjs ~/.config/ags/assets/settings.js"
alias bar="nvim ~/.config/ags/modules/bar/main.js"
alias barmodes="nvim ~/.config/ags/modules/bar/modes"
alias config="nvim ~/.ags/config.json"
alias default="micro ~/.config/ags/modules/.configuration/user_options.default.json"
alias colors="kitty @ set-colors -a -c ~/.cache/ags/user/generated/kitty-colors.conf"
