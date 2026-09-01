type ScrollFlow = 'fast' | 'slow';

// Android dp approximate XCTest screen points. Coordinates use screen fractions.
const gestureSettings = {
    fastVelocity: 3500,
    acceleratedFactor: 1.5,
    slowVelocity: 900,
    releaseGapMs: 40,
    minimumDurationMs: 32,
    x: 0.5,
    startY: 0.3,
    endY: 0.62,
};

function gesturePlan({flow, width, height, density}: {flow: ScrollFlow; width: number; height: number; density: number}) {
    if (![width, height, density].every((value) => Number.isFinite(value) && value > 0)) {
        throw new Error('Screen width, height, and density must be positive');
    }
    const distanceDp = ((gestureSettings.endY - gestureSettings.startY) * height) / density;
    const batch = (velocity: number, count: number, pauseAfterMs: number) => ({
        count,
        durationMs: Math.max(gestureSettings.minimumDurationMs, Math.round((distanceDp / velocity) * 1000)),
        releaseGapMs: gestureSettings.releaseGapMs,
        pauseAfterMs,
    });
    return {
        x: Math.round(width * gestureSettings.x),
        startY: Math.round(height * gestureSettings.startY),
        endY: Math.round(height * gestureSettings.endY),
        batches:
            flow === 'fast'
                ? [
                      batch(gestureSettings.fastVelocity, 10, 2000),
                      batch(gestureSettings.fastVelocity * gestureSettings.acceleratedFactor, 10, 2000),
                      batch(gestureSettings.fastVelocity * gestureSettings.acceleratedFactor, 10, 5000),
                  ]
                : [batch(gestureSettings.slowVelocity, 30, 5000)],
    };
}

export {gesturePlan, gestureSettings};
export type {ScrollFlow};
