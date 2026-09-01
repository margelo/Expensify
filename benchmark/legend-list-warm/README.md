<!-- cspell:words qddx chrispader flashlist legendlist xcresult -->

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

The current Android paths match `RunnerTests.swift`:

| Flow | Gestures toward older messages | Pauses |
| --- | --- | --- |
| `warm-fast-bursts.maestro.yaml` | Three batches of ten individually released pans; 3,500 dp/s, then 5,250 dp/s twice | 40 ms between pans; 2 s, 2 s, and 5 s after the batches |
| `warm-slow-scrolls.maestro.yaml` | Thirty individually released pans at 900 dp/s | 40 ms between pans; 5 s at the end |

Both flows open the same report after a two-second Inbox baseline, then wait
five seconds before scrolling. They start at 50% screen width and 30% height
and end at 62% height. Android dp approximate XCTest screen points; physical
gesture durations also depend on input dispatch. Actual DOWN/UP timings are
saved for every pan. Neither current XCTest flow reverses direction.

Maestro opens the report by its stable ID instead of the iOS coordinate tap.
`android-gesture-plan.ts` is the central speed/count/coordinate configuration.
Maestro's `runScript` calls a temporary loopback-only helper started by
`run-android-benchmark.ts`. `AndroidReleasedPans.java` runs under the ADB shell
and injects DOWN/MOVE/UP events in one device process, with each UP acknowledged
before the next release gap. This avoids per-command Maestro settling and ADB
process-start delays. No root access or changes to app gesture handling are
needed. The helper is removed from the device when the runner exits normally.

Run one flow from the repository root:

```sh
node benchmark/legend-list-warm/run-android-benchmark.ts \
    --device R3CM90H6A2N \
    --app com.chrispader.expensify.legendlist \
    --flow fast \
    --output benchmark/legend-list-warm/artifacts/android-fast-manual
```

Use `--flow slow` for the slow pans. `--evidence` adds before/after screenshots
for visual validation; leave it off for performance collection. The wrapper
prepares Inbox automatically. These YAML files require the wrapper's local
gesture bridge and are not standalone Maestro Cloud flows.

Run five samples of both variants for both flows:

```sh
node benchmark/legend-list-warm/run-android-benchmark.ts \
    --mode suite \
    --device R3CM90H6A2N \
    --iterations 5 \
    --output benchmark/legend-list-warm/artifacts/android-comparison-new
```

Use a fresh output folder for a new comparison. The runner preserves each raw
recording, uses counterbalanced variant order, and generates separate native
Flashlight reports at `fast/report/report.html` and `slow/report/report.html`.
Each combined JSON retains five original iterations for Flashlight to analyze.
The suite validates existing recordings when resuming an interrupted folder;
never reuse a folder after changing apps, device settings, or gesture code.
Preparation and helper compilation/install are outside the measurement.
The runner also checks thermal status before every sample and waits outside
measurement while Android reports moderate or greater throttling. It stops
after ten minutes if the phone does not cool. Before/after thermal and battery
readings are saved per sample; heating during a run is not hidden or filtered.
Maestro CLI startup and measured-flow assertions remain inside the Flashlight
interval, so elapsed duration is not directly comparable with XCTest.

Requirements are Node 26, Java 17+, Android SDK platform 36/build-tools 36.0.0,
ADB, Maestro, and Flashlight. The SDK is resolved from `ANDROID_SDK_ROOT`,
`ANDROID_HOME`, or the standard macOS SDK location. The app release build/install
is a separate step; the benchmark never replaces either variant itself.

Local checks:

```sh
node --test benchmark/legend-list-warm/android-gesture-plan.test.ts
```

### Previous Android workload

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

`warm-fast-scroll.android.sh` retains the previous two-direction ADB workload.
`warm-fast-scroll.android.test.sh <device-id> <app-id> [fast|slow] [output]`
now delegates to the new flow runner and expects Inbox preparation beforehand.
For new measurements, use the suite command above so helper setup also stays
outside the measured interval. Maestro 2.8.0 spends several seconds waiting
after ordinary swipe commands even with `waitToSettleTimeoutMs: 1`.

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
