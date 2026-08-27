#!/usr/bin/env bash

set -euo pipefail

device_id="${1:?Pass the physical Android device ID as the first argument}"
adb_command=(adb -s "$device_id")

swipe_sequence() {
    local start_y="$1"
    local end_y="$2"
    local duration_ms="$3"
    local count="$4"
    local index=1

    while ((index <= count)); do
        "${adb_command[@]}" shell input swipe 540 "$start_y" 540 "$end_y" "$duration_ms"
        if ((index < count)); then
            sleep 0.2
        fi
        ((index += 1))
    done
}

stress_direction() {
    local start_y="$1"
    local end_y="$2"

    swipe_sequence "$start_y" "$end_y" 50 2
    sleep 2
    swipe_sequence "$start_y" "$end_y" 30 2
    sleep 2
    swipe_sequence "$start_y" "$end_y" 30 5
    sleep 2
}

# Move from the live tail to the oldest actions, then mirror the exact workload
# back to the live tail. Earlier probes showed that 20 ms gestures are dropped
# by Android input injection, while 30 ms gestures register.
stress_direction 570 1596
stress_direction 1596 570
