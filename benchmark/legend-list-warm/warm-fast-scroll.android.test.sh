#!/usr/bin/env bash

set -euo pipefail

device_id="${1:?Pass the physical Android device ID as the first argument}"
app_id="${2:?Pass the Android application ID as the second argument}"
script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
scroll_flow="${3:-fast}"
output_directory="${4:-$(mktemp -d /private/tmp/expensify-warm-scroll-maestro.XXXXXX)}"

# The suite supplies an already-running native gesture bridge. Standalone
# invocations also work, but helper setup then occurs inside the command.
node "${script_directory}/run-android-benchmark.ts" \
    --device "${device_id}" \
    --app "${app_id}" \
    --flow "${scroll_flow}" \
    --output "${output_directory}" \
    --skip-prepare
