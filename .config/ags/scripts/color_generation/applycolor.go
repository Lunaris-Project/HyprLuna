package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

func main() {
	// Directories
	home := os.Getenv("HOME")
	xdgConfigHome := os.Getenv("XDG_CONFIG_HOME")
	if xdgConfigHome == "" {
		xdgConfigHome = filepath.Join(home, ".config")
	}

	xdgStateHome := os.Getenv("XDG_STATE_HOME")
	if xdgStateHome == "" {
		xdgStateHome = filepath.Join(home, ".local", "state")
	}

	configDir := filepath.Join(xdgConfigHome, "ags")
	stateDir := filepath.Join(xdgStateHome, "ags")
	colormodeFile := filepath.Join(stateDir, "user", "colormode.txt")

	// Change to config directory
	err := os.Chdir(configDir)
	if err != nil {
		log.Fatalf("Failed to change to config directory: %v", err)
	}

	// Read the colormode file
	lines, err := readLines(colormodeFile)
	if err != nil {
		log.Fatalf("Failed to read colormode file: %v", err)
	}

	// Transparency setup - mirroring the original script
	agsTransparency := "False"
	hyprOpacity := "1"
	rofiAlpha := "var(surface)"
	rofiAlphaElement := "var(surface-container-low)"
	termAlpha := "1"
	transProfile := "none"

	if strings.Contains(lines[1], "transparent") {
		agsTransparency = "True"
		hyprOpacity = "0.78"
		rofiAlpha = "#00000090"
		rofiAlphaElement = "#00000025"
		termAlpha = "0.9"

		if strings.Contains(lines[6], "intense") {
			transProfile = "Intense"
		} else {
			transProfile = "Normal"
		}
	}

	// Borders setup
	agsBorder := "True"
	hyprBorder := "2"

	if strings.Contains(lines[4], "noborder") {
		agsBorder = "False"
		hyprBorder = "0"
	}

	// Vibrancy setup
	vibrant := "False"

	if !strings.Contains(lines[5], "normal") {
		vibrant = "True"
	}

	// Update _mode.scss - exactly like the shell script
	scssFile := filepath.Join(stateDir, "scss", "_mode.scss")
	if fileExists(scssFile) {
		content, err := os.ReadFile(scssFile)
		if err == nil {
			strContent := string(content)

			// Use identical sed patterns from the shell script
			reBorder := regexp.MustCompile(`border:.*;`)
			reTransparent := regexp.MustCompile(`transparent:.*;`)
			reVibrant := regexp.MustCompile(`vibrant:.*;`)
			reTransProfile := regexp.MustCompile(`transProfile:.*;`)

			strContent = reBorder.ReplaceAllString(strContent, fmt.Sprintf("border:%s;", agsBorder))
			strContent = reTransparent.ReplaceAllString(strContent, fmt.Sprintf("transparent:%s;", agsTransparency))
			strContent = reVibrant.ReplaceAllString(strContent, fmt.Sprintf("vibrant:%s;", vibrant))
			strContent = reTransProfile.ReplaceAllString(strContent, fmt.Sprintf("transProfile:%s;", transProfile))

			os.WriteFile(scssFile, []byte(strContent), 0644)
		}
	} else {
		content := fmt.Sprintf("$border:%s;\n$transparent:%s;\n$vibrant:%s;\n$transProfile:%s;\n",
			agsBorder, agsTransparency, vibrant, transProfile)
		os.WriteFile(scssFile, []byte(content), 0644)
	}

	// Apply transparency settings and run in parallel (like original)
	go updateTransparency(xdgConfigHome, xdgStateHome, hyprOpacity, termAlpha, rofiAlpha, rofiAlphaElement, hyprBorder)

	// Reload AGS styles
	reloadAGS()

	fmt.Println("Applied color settings successfully")
}

func readLines(filePath string) ([]string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}

	return lines, scanner.Err()
}

func fileExists(filePath string) bool {
	info, err := os.Stat(filePath)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}

func updateTransparency(xdgConfigHome, xdgStateHome, hyprOpacity, termAlpha, rofiAlpha, rofiAlphaElement, hyprBorder string) {
	// Hyprland Transparency - exactly like the shell script
	hyprConfig := filepath.Join(xdgConfigHome, "hypr", "hyprland", "rules", "default.conf")
	hyprLine := fmt.Sprintf("windowrule = opacity %s override, class:.*", hyprOpacity)

	if fileExists(hyprConfig) {
		content, err := os.ReadFile(hyprConfig)
		if err == nil {
			lines := strings.Split(string(content), "\n")
			if len(lines) > 0 && lines[0] != hyprLine {
				lines[0] = hyprLine
				os.WriteFile(hyprConfig, []byte(strings.Join(lines, "\n")), 0644)
			}
		}
	}

	// Handle Hyprland blur settings (usually in decoration.conf)
	updateHyprlandBlur(xdgConfigHome, xdgStateHome)

	// Foot Terminal
	footConfig := filepath.Join(xdgConfigHome, "foot", "colors.ini")
	footLine := fmt.Sprintf("alpha=%s", termAlpha)

	if fileExists(footConfig) {
		content, err := os.ReadFile(footConfig)
		if err == nil {
			lines := strings.Split(string(content), "\n")
			if len(lines) > 1 && lines[1] != footLine {
				lines[1] = footLine
				os.WriteFile(footConfig, []byte(strings.Join(lines, "\n")), 0644)
			}
		}
	}

	// Kitty Terminal
	kittyConfig := filepath.Join(xdgConfigHome, "kitty", "kitty.conf")
	kittyLine := fmt.Sprintf("background_opacity %s", termAlpha)

	if fileExists(kittyConfig) {
		content, err := os.ReadFile(kittyConfig)
		if err == nil {
			lines := strings.Split(string(content), "\n")
			if len(lines) > 0 && lines[0] != kittyLine {
				lines[0] = kittyLine
				os.WriteFile(kittyConfig, []byte(strings.Join(lines, "\n")), 0644)
			}
		}
	}

	// Rofi Transparency
	rofiConfig := filepath.Join(xdgConfigHome, "rofi", "config.rasi")

	if fileExists(rofiConfig) {
		content, err := os.ReadFile(rofiConfig)
		if err == nil {
			strContent := string(content)

			// Use identical sed patterns from the shell script
			reWbg := regexp.MustCompile(`wbg:.*;`)
			reElementBg := regexp.MustCompile(`element-bg:.*;`)

			strContent = reWbg.ReplaceAllString(strContent, fmt.Sprintf("wbg:%s;", rofiAlpha))
			strContent = reElementBg.ReplaceAllString(strContent, fmt.Sprintf("element-bg:%s;", rofiAlphaElement))

			os.WriteFile(rofiConfig, []byte(strContent), 0644)
		}
	}

	// Update Hyprland border in the default.conf file
	updateHyprlandBorder(xdgConfigHome, xdgStateHome, hyprBorder)
}

// Add a function to update Hyprland blur settings - this is important for glass transparency
func updateHyprlandBlur(xdgConfigHome, xdgStateHome string) {
	// Read the colormode.txt to determine if transparency is enabled
	colormodeFile := filepath.Join(xdgStateHome, "ags", "user", "colormode.txt")
	lines, err := readLines(colormodeFile)
	if err != nil {
		log.Printf("Warning: Failed to read colormode.txt for blur settings: %v", err)
		return
	}

	// Check if transparency is enabled
	isTransparent := false
	if len(lines) > 1 && strings.Contains(lines[1], "transparent") {
		isTransparent = true
	}

	// Possible locations for Hyprland decoration config
	decorationPaths := []string{
		filepath.Join(xdgConfigHome, "hypr", "hyprland", "decoration.conf"),
		filepath.Join(xdgConfigHome, "hypr", "hyprland", "settings", "decoration.conf"),
		filepath.Join(xdgConfigHome, "hypr", "decoration.conf"),
	}

	// Try each path
	for _, decorationPath := range decorationPaths {
		if fileExists(decorationPath) {
			updateBlurInFile(decorationPath, isTransparent)
			break
		}
	}
}

func updateBlurInFile(filePath string, enableBlur bool) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		log.Printf("Warning: Failed to read decoration config: %v", err)
		return
	}

	strContent := string(content)

	// Patterns to find blur settings in Hyprland config
	reBlurEnabled := regexp.MustCompile(`blur\s*=\s*\w+`)
	reBlurSize := regexp.MustCompile(`blur_size\s*=\s*\d+`)
	reBlurPasses := regexp.MustCompile(`blur_passes\s*=\s*\d+`)

	// Set values based on transparency
	blurValue := "false"
	blurSize := "2"
	blurPasses := "1"

	if enableBlur {
		blurValue = "true"
		blurSize = "8"
		blurPasses = "3"
	}

	// Replace the values
	if reBlurEnabled.MatchString(strContent) {
		strContent = reBlurEnabled.ReplaceAllString(strContent, fmt.Sprintf("blur = %s", blurValue))
	}

	if reBlurSize.MatchString(strContent) {
		strContent = reBlurSize.ReplaceAllString(strContent, fmt.Sprintf("blur_size = %s", blurSize))
	}

	if reBlurPasses.MatchString(strContent) {
		strContent = reBlurPasses.ReplaceAllString(strContent, fmt.Sprintf("blur_passes = %s", blurPasses))
	}

	// Write changes back
	err = os.WriteFile(filePath, []byte(strContent), 0644)
	if err != nil {
		log.Printf("Warning: Failed to write blur settings: %v", err)
	} else {
		log.Printf("Updated blur settings in %s: blur=%s, size=%s, passes=%s",
			filePath, blurValue, blurSize, blurPasses)
	}
}

func updateHyprlandBorder(xdgConfigHome, xdgStateHome, hyprBorder string) {
	// Update Hyprland border at line 7 of layouts/default.conf as in the original script
	hyprBorderConfig := filepath.Join(xdgConfigHome, "hypr", "hyprland", "layouts", "default.conf")

	if fileExists(hyprBorderConfig) {
		content, err := os.ReadFile(hyprBorderConfig)
		if err != nil {
			log.Printf("Warning: Failed to read Hyprland border config: %v", err)
			return
		}

		lines := strings.Split(string(content), "\n")
		if len(lines) < 7 {
			log.Printf("Warning: Hyprland border config has fewer than 7 lines")
			return
		}

		// Create the line to replace - mimic exact spacing from shell script
		borderLine := fmt.Sprintf("    border_size = %s", hyprBorder)
		if lines[6] != borderLine {
			lines[6] = borderLine
			os.WriteFile(hyprBorderConfig, []byte(strings.Join(lines, "\n")), 0644)
		}
	}
}

func reloadAGS() {
	// Use the exact same command as in the shell script
	cmd := exec.Command("agsv1", "-r", "handleStyles();")
	err := cmd.Run()
	if err != nil {
		log.Printf("Warning: Failed to reload AGS styles: %v", err)
	}
}
