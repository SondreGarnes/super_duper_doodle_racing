import { describe, it, expect } from 'vitest';
import { engineForceForSpeed, steerAngleForSpeed } from '../src/car/vehicleTuning';

describe('engineForceForSpeed', () => {
  it('returns 0 when throttle is 0, regardless of speed', () => {
    expect(engineForceForSpeed(0, 0)).toBe(0);
    expect(engineForceForSpeed(20, 0)).toBe(0);
  });

  it('ramps up from a reduced force at standstill to full force by the ramp-end speed', () => {
    const atZero = engineForceForSpeed(0, 1);
    const atRampEnd = engineForceForSpeed(4, 1);
    expect(atZero).toBeGreaterThan(0);
    expect(atZero).toBeLessThan(atRampEnd);
    expect(atRampEnd).toBeCloseTo(700, 0);
  });

  it('holds peak force through the peak speed band', () => {
    expect(engineForceForSpeed(4, 1)).toBeCloseTo(700, 0);
    expect(engineForceForSpeed(10, 1)).toBeCloseTo(700, 0);
    expect(engineForceForSpeed(16, 1)).toBeCloseTo(700, 0);
  });

  it('tapers to 0 as speed approaches top speed', () => {
    const midTaper = engineForceForSpeed(24, 1);
    expect(midTaper).toBeGreaterThan(0);
    expect(midTaper).toBeLessThan(700);
    expect(engineForceForSpeed(32, 1)).toBeCloseTo(0, 0);
    expect(engineForceForSpeed(50, 1)).toBe(0);
  });

  it('is symmetric for negative (reverse) speed', () => {
    expect(engineForceForSpeed(-4, 1)).toBeCloseTo(engineForceForSpeed(4, 1), 5);
  });

  it('scales linearly with throttle', () => {
    expect(engineForceForSpeed(10, 0.5)).toBeCloseTo(engineForceForSpeed(10, 1) * 0.5, 5);
  });
});

describe('steerAngleForSpeed', () => {
  it('returns 0 when steerInput is 0', () => {
    expect(steerAngleForSpeed(0, 0)).toBe(0);
    expect(steerAngleForSpeed(30, 0)).toBe(0);
  });

  it('uses the maximum angle at standstill', () => {
    expect(steerAngleForSpeed(0, 1)).toBeCloseTo(0.5, 5);
  });

  it('reduces the angle as speed increases, down to a floor', () => {
    const lowSpeed = steerAngleForSpeed(5, 1);
    const highSpeed = steerAngleForSpeed(22, 1);
    const beyondFalloff = steerAngleForSpeed(60, 1);
    expect(lowSpeed).toBeLessThan(0.5);
    expect(lowSpeed).toBeGreaterThan(highSpeed);
    expect(highSpeed).toBeCloseTo(0.15, 5);
    expect(beyondFalloff).toBeCloseTo(0.15, 5);
  });

  it('preserves the sign and scale of steerInput', () => {
    expect(steerAngleForSpeed(10, -1)).toBeCloseTo(-steerAngleForSpeed(10, 1), 5);
    expect(steerAngleForSpeed(10, 0.5)).toBeCloseTo(steerAngleForSpeed(10, 1) * 0.5, 5);
  });
});
