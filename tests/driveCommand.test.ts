import { describe, it, expect } from 'vitest';
import { driveCommandForInput } from '../src/car/vehicleTuning';

describe('driveCommandForInput', () => {
  it('drives forward under throttle with no brake', () => {
    const cmd = driveCommandForInput(10, 1, 0);
    expect(cmd.engineForce).toBeGreaterThan(0);
    expect(cmd.brakeForce).toBe(0);
  });

  it('brakes when brake is pressed while moving forward', () => {
    const cmd = driveCommandForInput(15, 0, 1);
    expect(cmd.engineForce).toBe(0);
    expect(cmd.brakeForce).toBeGreaterThan(0);
  });

  it('reverses when brake is pressed while stopped', () => {
    const cmd = driveCommandForInput(0, 0, 1);
    expect(cmd.engineForce).toBeLessThan(0);
    expect(cmd.brakeForce).toBe(0);
  });

  it('keeps reversing while already moving backward', () => {
    const cmd = driveCommandForInput(-4, 0, 1);
    expect(cmd.engineForce).toBeLessThan(0);
    expect(cmd.brakeForce).toBe(0);
  });

  it('caps reverse speed', () => {
    const cmd = driveCommandForInput(-12, 0, 1);
    expect(cmd.engineForce).toBe(0);
    expect(cmd.brakeForce).toBe(0);
  });

  it('coasts with no pedals pressed', () => {
    expect(driveCommandForInput(10, 0, 0)).toEqual({ engineForce: 0, brakeForce: 0 });
  });

  it('throttle wins over brake', () => {
    const cmd = driveCommandForInput(10, 1, 1);
    expect(cmd.engineForce).toBeGreaterThan(0);
    expect(cmd.brakeForce).toBe(0);
  });
});
