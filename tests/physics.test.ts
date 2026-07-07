import { describe, it, expect, vi } from 'vitest';
import { FixedTimestepAccumulator } from '../src/physics';

describe('FixedTimestepAccumulator', () => {
  it('calls stepFn zero times when delta is smaller than the fixed step', () => {
    const acc = new FixedTimestepAccumulator(1 / 60);
    const stepFn = vi.fn();
    acc.tick(1 / 120, stepFn);
    expect(stepFn).not.toHaveBeenCalled();
  });

  it('calls stepFn once when delta equals the fixed step', () => {
    const acc = new FixedTimestepAccumulator(1 / 60);
    const stepFn = vi.fn();
    acc.tick(1 / 60, stepFn);
    expect(stepFn).toHaveBeenCalledTimes(1);
  });

  it('calls stepFn multiple times for a large delta, and carries remainder across ticks', () => {
    const acc = new FixedTimestepAccumulator(1 / 60);
    const stepFn = vi.fn();
    acc.tick(2.5 / 60, stepFn); // 2 full steps, 0.5 step remainder
    expect(stepFn).toHaveBeenCalledTimes(2);
    acc.tick(0.5 / 60, stepFn); // remainder + this delta = 1 full step
    expect(stepFn).toHaveBeenCalledTimes(3);
  });
});
