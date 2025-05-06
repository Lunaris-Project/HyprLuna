#!/bin/bash

# Set default direction
direction=${1:-"recv"}

# Get initial bytes
get_initial_bytes() {
    case "$direction" in
        "recv")
            init_bytes=$(cat /proc/net/dev | grep -v lo | awk '{sum += $2} END {print sum}')
            ;;
        "sent")
            init_bytes=$(cat /proc/net/dev | grep -v lo | awk '{sum += $10} END {print sum}')
            ;;
        *)
            echo "wrong direction: $direction"
            exit 1
            ;;
    esac
}

# Get final bytes
get_final_bytes() {
    case "$direction" in
        "recv")
            final_bytes=$(cat /proc/net/dev | grep -v lo | awk '{sum += $2} END {print sum}')
            ;;
        "sent")
            final_bytes=$(cat /proc/net/dev | grep -v lo | awk '{sum += $10} END {print sum}')
            ;;
    esac
}

# Calculate and format bandwidth
calculate_bandwidth() {
    i=0
    divider=1000
    bandwidth=$((final_bytes - init_bytes))
    units=("B" "KB" "MB" "GB" "TB" "PB" "EB")
    
    while (( $(echo "$bandwidth >= $divider" | bc -l) )); do
        i=$((i + 1))
        bandwidth=$(echo "scale=1; $bandwidth / $divider" | bc)
    done
    
    printf "%.1f%s/s\n" $bandwidth "${units[$i]}"
}

# Main execution
get_initial_bytes
sleep 1
get_final_bytes
calculate_bandwidth