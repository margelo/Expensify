# Warm report-list benchmark

This benchmark compares FlashList and LegendList while scrolling the same
fully hydrated `#qddx` report (`reportID=2636639376691898`). Network requests,
pagination, authentication, and app launch are excluded from the measured
interval. Opening the report from Inbox, initial list rendering, and scrolling
are included.

## Builds

- FlashList: `ExpensifyApp4` at `5077f90c11b`, bundle ID
  `com.chrispader.expensify.expensifylite.flashlist` on iOS and
  `com.chrispader.expensify.flashlist` on Android.
- LegendList: `ExpensifyApp5` at `f6679c2b4dc`, bundle ID
  `com.chrispader.expensify.expensifylite.legendlist` on iOS and
  `com.chrispader.expensify.legendlist` on Android.

Both apps must use release builds, the same account and environment, the same
device settings, and a locally hydrated copy of `#qddx`.

## Maestro flows

`warm-fast-scroll.prepare-inbox.maestro.yaml` is the Flashlight
`--beforeEachCommand`. It relaunches the app, returns an already-open report to
Inbox, and stops with the `#qddx` row visible. Flashlight starts measuring only
after this preparation succeeds.

`warm-fast-scroll.open-report.maestro.yaml` runs inside the measured command.
It leaves four seconds of Inbox baseline, taps `#qddx`, waits for the composer
and initial list render, then keeps the requested three-second pause inside the
measurement. Reports skip the first two seconds of profiler warm-up, leaving
at least two seconds of stable FPS before the tap.

`warm-fast-scroll.stress.maestro.yaml` is the full visual E2E flow. It opens
`#qddx`, waits three seconds, sends two 50 ms flings about 200 ms apart, waits
two seconds, sends two 30 ms flings, waits two seconds, and sends five 30 ms
flings to reach the oldest actions. It then mirrors the same sequence back to
the live tail. `warm-fast-scroll.maestro.yaml` preserves the previous
four-round-trip flow as a separate reference.

On Android, `warm-fast-scroll.android.test.sh <device-id> <app-id>` is the
Flashlight `--testCommand`. It first runs the measured Maestro report-opening
flow, then calls `warm-fast-scroll.android.sh` for the stress gestures. Maestro
2.8.0 spends several seconds waiting after every Android swipe even when
`waitToSettleTimeoutMs` is set to 1 ms, so the measured runner uses direct ADB
input for genuinely consecutive gestures. Maestro still owns report selection
and the initial-render assertions.

`warm-fast-scroll.setup.maestro.yaml` and
`warm-fast-scroll.stress.maestro.yaml` retain the full visual E2E flow.
`warm-fast-scroll.maestro.yaml` retains the earlier four-round-trip reference
flow.

## Sampling protocol

- Use connected physical devices only.
- Keep the device plugged in, unlocked, and otherwise idle.
- Disable Low Power Mode and keep thermal conditions stable.
- Run five samples per implementation in alternating order.
- Discard a sample if the app is not on `#qddx`, pagination or another network
  request occurs, a system overlay appears, or automation fails.
- Compare medians and individual samples. Five samples are not sufficient for
  a reliable p95.

On iOS, collect wall-clock duration, app CPU, peak memory, and animation hitch
metrics with XCTest while keeping setup outside the `measure` block. On
Android, use `flashlight test` to capture CPU, memory, UI FPS, and React Native
JS Performance graphs. Generate the report with `--skip 2000` and the FlashList
JSON first so FlashList is the left baseline and LegendList deltas appear on
the right.

Generated result bundles, traces, screenshots, and Flashlight reports belong
in `artifacts/`, which is ignored by Git.

## iOS HTML report

XCTest stores performance data in `.xcresult` bundles and Xcode can display it,
but XCTest does not generate a standalone HTML comparison report. After
extracting successful samples into the JSON shape used by
`artifacts/ios-physical-20260826-native/results.json`, generate the static
dashboard with:

```sh
node benchmark/legend-list-warm/generate-ios-native-report.mjs \
    --input benchmark/legend-list-warm/artifacts/ios-physical-20260826-native/results.json \
    --output benchmark/legend-list-warm/artifacts/ios-physical-20260826-native/report.html
```

The generator validates all required metrics and embeds the input JSON into
`ios-native-report.template.html`. The resulting report has no runtime or
network dependencies and works both through a local HTTP server and directly
from a `file://` URL.
