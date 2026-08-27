const durationMs = Number(WAIT_MS);
const deadline = Date.now() + durationMs;

while (Date.now() < deadline) {
    // Maestro has no fixed-delay command. This reference flow is not used for
    // performance collection, so a short host-side wait is acceptable here.
}
