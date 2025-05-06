# Multi-Monitor Support Plan for AGS

## Overview

This document outlines a comprehensive plan for improving multi-monitor support in AGS (Aylur's GTK Shell), focusing on performance optimization, reducing unnecessary logging, and providing a better user experience when using multiple displays.

## Current Issues

1. **Performance Degradation**: AGS becomes noticeably slower when connecting a second monitor
2. **Excessive Logging**: Too many log messages when using multiple monitors
3. **Widget Reuse Issues**: GTK warnings about widget reuse across containers
4. **Inefficient Component Creation**: Components are created for all monitors regardless of configuration
5. **Inconsistent Bar Mode Switching**: Bar modes don't work consistently across monitors

## Technical Analysis

### Monitor Detection System

The current monitor detection system in `modules/.commondata/monitordetection.js` has several inefficiencies:

- Excessive logging of monitor changes
- Unnecessary AGS restarts when monitors change
- Inefficient primary monitor detection logic
- Lack of proper caching for monitor information

### Widget Creation for Multiple Monitors

The `forMonitors()` function in `config.js` creates widgets for all connected monitors, even when only one monitor is targeted:

```javascript
function forMonitors(widget) {
  const n = Gdk.Display.get_default()?.get_n_monitors() || 1;
  return range(n, 0).map(widget).flat(1);
}
```

This leads to unnecessary widget creation and performance degradation.

### Bar Component Management

The bar component system in `modules/bar/main.js` has issues with widget reuse:

- Widgets are not properly destroyed before recreation
- Corner widgets are reused across containers
- No proper factory pattern for component creation

### Configuration System

The configuration system lacks granular monitor-specific settings:

- Limited options for monitor selection (only "primary" or specific monitor name)
- No monitor-specific bar modes
- No way to specify different configurations for different monitors

## Implementation Plan

### 1. Optimize Monitor Detection

**File**: `modules/.commondata/monitordetection.js`

- Reduce unnecessary logging
- Implement proper caching of monitor information
- Optimize primary monitor detection
- Remove automatic AGS restarts on monitor changes
- Add debouncing for monitor change events

```javascript
// Example implementation
export const detectPrimaryMonitor = () => {
  // Check cache first
  if (monitorCache.primary && !monitorCache.invalidated) {
    return monitorCache.primary;
  }
  
  try {
    // Implementation with reduced logging
    const focusedMonitor = Hyprland.active.monitor.id;
    if (focusedMonitor !== undefined) {
      monitorCache.primary = focusedMonitor;
      return focusedMonitor;
    }
    
    const gdkPrimary = Gdk.Display.get_default()?.get_primary_monitor() || 0;
    monitorCache.primary = gdkPrimary;
    return gdkPrimary;
  } catch (error) {
    return 0;
  }
};
```

### 2. Optimize Widget Creation

**File**: `config.js`

- Modify `forMonitors()` to respect the `monitorMode` setting
- Only create widgets for the target monitor when specified
- Implement proper widget cleanup and disposal

```javascript
function forMonitors(widget) {
  // Get the target monitor based on barMonitorMode
  const targetMonitorName = barMonitorMode.value;
  
  // If monitorMode is set to a specific monitor name (not "primary"),
  // and there are multiple monitors, only create widgets for the target monitor
  if (targetMonitorName !== "primary" && Hyprland.monitors.length > 1) {
    const targetMonitor = findMonitorByName(targetMonitorName);
    return [widget(targetMonitor)].flat(1);
  }
  
  // Otherwise, create widgets for all monitors (original behavior)
  const n = Gdk.Display.get_default()?.get_n_monitors() || 1;
  return range(n, 0).map(widget).flat(1);
}
```

### 3. Fix Widget Reuse Issues

**File**: `modules/bar/main.js`

- Implement proper widget destruction before recreation
- Use factory pattern for component creation
- Fix corner widget issues

```javascript
// Example implementation for corner widgets
const createCorner = (monitor, side) => {
  // Generate a unique cache key
  const cacheKey = `${monitor}-${side}`;
  
  // Check if we already have a cached corner
  if (cornerCache.has(cacheKey)) {
    return cornerCache.get(cacheKey);
  }
  
  // Create the corner window with optimized hooks
  const cornerWindow = Widget.Window({
    // Window properties...
    child: (() => {
      // Create a fresh instance of RoundedCorner to avoid widget reuse issues
      return RoundedCorner(
        getCornerStyle(/* parameters */),
        { className: "corner" }
      );
    })(),
    setup: (self) => {
      // Setup with proper cleanup...
      self.hook(currentShellMode, () => {
        // Destroy old child first to prevent widget reuse issues
        if (self.child && typeof self.child.destroy === 'function') {
          self.child.destroy();
        }
        self.child = RoundedCorner(/* parameters */);
      });
    }
  });
  
  // Cache the corner window
  cornerCache.set(cacheKey, cornerWindow);
  
  return cornerWindow;
};
```

### 4. Improve Bar Mode Management

**File**: `variables.js`

- Optimize mode switching to be monitor-specific
- Reduce unnecessary updates when switching modes
- Fix position toggling for specific monitors
- Implement debouncing for mode changes

```javascript
// Example implementation
globalThis["cycleMode"] = () => {
  // Get the target monitor based on barMonitorMode
  const targetMonitorName = barMonitorMode.value;
  const targetMonitor = findMonitorByName(targetMonitorName);

  // Get the current mode from the target monitor
  const currentNum = parseInt(currentShellMode.value[targetMonitor]) || 0;

  // Calculate the next mode (cycle through all 11 modes, 0-10)
  const nextMode = (currentNum + 1) % 11;

  // Update the mode for the target monitor only
  updateMonitorShellMode(currentShellMode, targetMonitor, nextMode.toString());
};
```

### 5. Enhance Configuration Options

**File**: `modules/.configuration/user_options.default.json`

- Add monitor-specific settings
- Implement monitor-specific bar modes
- Add monitor name selection instead of just "primary"

```json
{
  "bar": {
    "position": "top",
    "monitorMode": "primary",
    "monitorSpecific": {
      "enabled": false,
      "configs": [
        {
          "name": "eDP-1",
          "position": "top",
          "mode": "0"
        },
        {
          "name": "HDMI-A-1",
          "position": "bottom",
          "mode": "2"
        }
      ]
    }
  }
}
```

## Performance Optimizations

### 1. Caching

- Implement a monitor information cache
- Cache bar components to avoid recreation
- Add proper cache invalidation on significant changes

### 2. Lazy Loading

- Only load components for active monitors
- Defer loading of non-essential components
- Implement progressive loading for complex widgets

### 3. Event Debouncing

- Debounce monitor change events
- Reduce frequency of updates on monitor changes
- Batch updates when possible

### 4. Widget Pooling

- Implement widget pooling for frequently used components
- Reuse widgets when possible instead of creating new ones
- Properly clean up unused widgets

## Testing Strategy

### 1. Configuration Testing

- Test with different monitor configurations:
  - Single monitor
  - Dual monitors with different resolutions
  - Triple monitors with mixed scaling
  - Connecting/disconnecting monitors at runtime

### 2. Performance Testing

- Measure startup time with different monitor configurations
- Monitor memory usage with multiple monitors
- Test responsiveness when switching modes

### 3. Compatibility Testing

- Test with different Hyprland versions
- Test with different GTK themes
- Test with different scaling factors

## Implementation Priorities

1. Fix widget reuse issues causing GTK warnings
2. Optimize `forMonitors()` to respect `monitorMode`
3. Reduce excessive logging
4. Implement proper caching
5. Enhance configuration options

## Conclusion

This plan addresses the core issues with multi-monitor support in AGS while maintaining compatibility with existing configurations. By implementing these changes, we can significantly improve performance, reduce unnecessary logging, and provide a better user experience when using multiple displays.

The implementation focuses on optimizing the existing codebase rather than rewriting large portions, making it easier to maintain and less likely to introduce new bugs.
