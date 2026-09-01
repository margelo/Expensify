/* eslint-disable import/extensions -- Run directly with Node's native TypeScript loader. */
import assert from 'node:assert/strict';
import {test} from 'node:test';

import {gesturePlan} from './android-gesture-plan.ts';

const screen = {width: 1080, height: 2280, density: 2.625};

test('fast flow matches three ten-pan XCTest bursts toward older messages', () => {
    const plan = gesturePlan({flow: 'fast', ...screen});
    assert.deepEqual([plan.x, plan.startY, plan.endY], [540, 684, 1414]);
    assert.deepEqual(plan.batches, [
        {count: 10, durationMs: 79, releaseGapMs: 40, pauseAfterMs: 2000},
        {count: 10, durationMs: 53, releaseGapMs: 40, pauseAfterMs: 2000},
        {count: 10, durationMs: 53, releaseGapMs: 40, pauseAfterMs: 5000},
    ]);
});

test('slow flow is thirty individual released pans with no inter-batch pause', () => {
    assert.deepEqual(gesturePlan({flow: 'slow', ...screen}).batches, [{count: 30, durationMs: 309, releaseGapMs: 40, pauseAfterMs: 5000}]);
});

test('equivalent logical screens keep swipe durations across pixel densities', () => {
    const lowDensity = gesturePlan({
        flow: 'fast',
        width: 540,
        height: 1140,
        density: 1.3125,
    });
    assert.deepEqual(lowDensity.batches, gesturePlan({flow: 'fast', ...screen}).batches);
});

test('too-short gestures retain the XCTest 32ms minimum', () => {
    assert.equal(gesturePlan({flow: 'fast', width: 200, height: 200, density: 3}).batches.at(0)?.durationMs, 32);
});

test('invalid screen measurements fail before injecting gestures', () => {
    assert.throws(() => gesturePlan({flow: 'fast', ...screen, density: 0}));
    assert.throws(() => gesturePlan({flow: 'slow', ...screen, height: NaN}));
});
