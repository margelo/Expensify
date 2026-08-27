#!/usr/bin/env bash

set -euo pipefail

device_id="${1:?Pass the physical Android device ID as the first argument}"
app_id="${2:?Pass the Android application ID as the second argument}"
script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
maestro_output_directory="$(mktemp -d /private/tmp/expensify-warm-scroll-maestro.XXXXXX)"

maestro test \
    -e "APP_ID=${app_id}" \
    "${script_directory}/warm-fast-scroll.open-report.maestro.yaml" \
    --test-output-dir "${maestro_output_directory}"

"${script_directory}/warm-fast-scroll.android.sh" "${device_id}"
