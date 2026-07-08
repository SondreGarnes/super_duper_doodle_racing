import { describe, it, expect } from 'vitest';
import { LapTimer } from '../src/game/lapTimer';

describe('LapTimer', () => {
  it('is not running before start() is called', () => {
    const timer = new LapTimer();
    expect(timer.isRunning()).toBe(false);
    expect(timer.getElapsedMs(5000)).toBe(0);
  });

  it('starts running and accumulates elapsed time', () => {
    const timer = new LapTimer();
    timer.start(1000);
    expect(timer.isRunning()).toBe(true);
    expect(timer.getElapsedMs(3500)).toBe(2500);
  });

  it('calling start() again after already running does not reset the start time', () => {
    const timer = new LapTimer();
    timer.start(1000);
    timer.start(2000);
    expect(timer.getElapsedMs(3000)).toBe(2000);
  });

  it('finishes the lap after progress reaches near the end and wraps back near the start', () => {
    const timer = new LapTimer();
    timer.start(0);
    timer.update(1000, 0.2);
    timer.update(2000, 0.6);
    timer.update(3000, 0.98);
    timer.update(4000, 0.01);
    expect(timer.isFinished()).toBe(true);
    expect(timer.getElapsedMs(9999)).toBe(4000);
  });

  it('does not finish from reversing back over the start line early', () => {
    const timer = new LapTimer();
    timer.start(0);
    timer.update(500, 0.02);
    timer.update(1000, 0.0);
    timer.update(1500, 0.01);
    expect(timer.isFinished()).toBe(false);
    expect(timer.isRunning()).toBe(true);
  });

  it('freezes elapsed time once finished, ignoring later update() calls', () => {
    const timer = new LapTimer();
    timer.start(0);
    timer.update(1000, 0.98);
    timer.update(2000, 0.0);
    expect(timer.isFinished()).toBe(true);
    timer.update(5000, 0.5);
    expect(timer.getElapsedMs(10000)).toBe(2000);
  });

  it('reset() returns to the not-started state', () => {
    const timer = new LapTimer();
    timer.start(0);
    timer.update(1000, 0.98);
    timer.update(2000, 0.0);
    timer.reset();
    expect(timer.isRunning()).toBe(false);
    expect(timer.isFinished()).toBe(false);
    expect(timer.getElapsedMs(9999)).toBe(0);
  });
});
