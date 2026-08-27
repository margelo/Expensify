# Warm physical-device benchmark results

Status: the first complete iOS set and the five-run Android Flashlight set are
preserved below.

The first attempted iOS samples scrolled the Inbox/LHN list instead of
`ReportActionsList` and are excluded. Their artifacts are quarantined under
`artifacts/ios-physical-20260825/invalid-lhn/`.

Both iOS apps pass the authenticated `#qddx` setup and live-tail reset. The
following physical-iPhone set used 16 round-trip flings at an XCTest velocity
of 10,000. It did not scroll fast enough to reproduce blank windows, so treat
it as a slower workload rather than the final stress comparison.

| Implementation | Sample | Measured time (s) | CPU time (s) | Peak physical memory (MB) |
| --- | ---: | ---: | ---: | ---: |
| FlashList | 1 | 51.51 | 25.21 | 470.30 |
| FlashList | 2 | 52.01 | 25.41 | 481.36 |
| FlashList | 3 | 52.46 | 25.60 | 475.79 |
| FlashList | 4 | 33.06 | 10.69 | 480.58 |
| FlashList | 5 | 36.16 | 13.67 | 348.47 |
| **FlashList median** |  | **51.51** | **25.21** | **475.79** |
| LegendList | 1 | 41.27 | 19.60 | 403.05 |
| LegendList | 2 | 38.04 | 17.33 | 345.51 |
| LegendList | 3 | 41.77 | 18.95 | 392.27 |
| LegendList | 4 | 41.96 | 19.23 | 392.81 |
| LegendList | 5 | 41.03 | 18.71 | 383.01 |
| **LegendList median** |  | **41.27** | **18.95** | **392.27** |

LegendList's medians were 19.9% lower for measured time, 24.8% lower for CPU
time, and 17.6% lower for peak physical memory in this set. FlashList's large
sample spread means these numbers are directional, not a final conclusion.
XCTest reported zero animation hitches for both implementations, so its hitch
metric was not sensitive to the visible list behavior in this workload.

## Android Flashlight comparison

The physical SM-G970F ran five samples per implementation in alternating
order. Every sample started on Inbox with a fully hydrated `#qddx`. The
measured command included four seconds of Inbox baseline, tapping the report
row with Maestro, waiting for the initial report render, a three-second pause,
the escalating 2 + 2 + 5 fling sequence toward the oldest actions, and the
mirrored sequence back to the live tail. App launch and Inbox preparation ran
before Flashlight started measuring.

The report skips the first two seconds of profiler warm-up. This leaves at
least two seconds of stable Inbox FPS before the measured tap, so the graphs
show the frame-rate drop caused by opening and rendering the report.

| Metric | FlashList | LegendList | LegendList change |
| --- | ---: | ---: | ---: |
| Average test runtime | 49.623 s | 50.602 s | +2% |
| Average UI FPS | 57.2 | 58.5 | +2% |
| Average CPU usage | 125.6% | 107.4% | -14% |
| High-CPU duration | 14.5 s | 15.7 s | +8% |
| Average RSS memory | 589.7 MB | 561.5 MB | -5% |

FlashList FPS ranged from 56.0 to 58.5 with a 1.5% coefficient of variation.
LegendList ranged from 58.0 to 58.7 with a 0.6% coefficient of variation.
Average CPU had a 6.3% coefficient of variation for FlashList and 6.0% for
LegendList. The phone temperature rose from 36.9°C to 38.8°C across the set;
alternating the order reduced, but did not remove, thermal bias.

The aggregate files are
`cli-open-report-baseline/flash-5-runs.json` and
`cli-open-report-baseline/legend-5-runs.json`. Passing FlashList first makes it
the left baseline and expresses the right-hand deltas as LegendList changes.
The generated dashboard is under
`artifacts/android-physical-20260826/report-flashlist-first/`.
