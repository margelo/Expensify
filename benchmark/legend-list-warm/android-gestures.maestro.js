/* global http, GESTURE_URL, SCROLL_FLOW, RUN_LABEL, output, json */
// The wrapper starts this loopback-only bridge before Flashlight measures.
// Maestro owns navigation/assertions; Android schedules each DOWN/MOVE/UP.
const response = http.post(GESTURE_URL, {
    body: JSON.stringify({flow: SCROLL_FLOW, label: RUN_LABEL}),
});
if (response.status !== 200) {
    throw new Error(`Android gesture sequence failed: ${response.body}`);
}
output.gestures = json(response.body);
