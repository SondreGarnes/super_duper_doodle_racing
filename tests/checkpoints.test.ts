import { describe, it, expect } from 'vitest';
import { CheckpointTracker } from '../src/game/checkpoints';

describe('CheckpointTracker', () => {
  it('starts with no checkpoints passed', () => {
    const tracker = new CheckpointTracker([0.25, 0.5, 0.75]);
    expect(tracker.passedCount()).toBe(0);
    expect(tracker.allPassed()).toBe(false);
    expect(tracker.total()).toBe(3);
  });

  it('passes a checkpoint when progress is within its capture window', () => {
    const tracker = new CheckpointTracker([0.25, 0.5, 0.75]);
    tracker.update(0.26);
    expect(tracker.passedCount()).toBe(1);
    expect(tracker.isPassed(0)).toBe(true);
  });

  it('does not pass a checkpoint when progress is outside the window', () => {
    const tracker = new CheckpointTracker([0.25, 0.5, 0.75]);
    tracker.update(0.1);
    tracker.update(0.35);
    expect(tracker.passedCount()).toBe(0);
  });

  it('requires checkpoints to be passed in order', () => {
    const tracker = new CheckpointTracker([0.25, 0.5, 0.75]);
    tracker.update(0.5);
    expect(tracker.passedCount()).toBe(0);
    tracker.update(0.75);
    expect(tracker.passedCount()).toBe(0);
    tracker.update(0.25);
    expect(tracker.passedCount()).toBe(1);
  });

  it('reports allPassed after passing every checkpoint in order', () => {
    const tracker = new CheckpointTracker([0.25, 0.5, 0.75]);
    tracker.update(0.25);
    tracker.update(0.5);
    tracker.update(0.75);
    expect(tracker.allPassed()).toBe(true);
  });

  it('resets to no checkpoints passed', () => {
    const tracker = new CheckpointTracker([0.25, 0.5]);
    tracker.update(0.25);
    tracker.update(0.5);
    tracker.reset();
    expect(tracker.passedCount()).toBe(0);
    expect(tracker.allPassed()).toBe(false);
  });
});
