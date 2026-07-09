import { describe, it, expect } from 'vitest';
import { DriftBoost, isDriftInput } from '../src/game/driftBoost';

function drift(boost: DriftBoost, seconds: number) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) boost.update(dt, true);
}

describe('isDriftInput', () => {
  it('requires handbrake, steering, and enough forward speed', () => {
    expect(isDriftInput(true, 1, 15)).toBe(true);
    expect(isDriftInput(true, -1, 15)).toBe(true);
    expect(isDriftInput(false, 1, 15)).toBe(false);
    expect(isDriftInput(true, 0, 15)).toBe(false);
    expect(isDriftInput(true, 1, 2)).toBe(false);
    expect(isDriftInput(true, 1, -15)).toBe(false);
  });

  it('keeps an active drift alive at lower speeds (hysteresis)', () => {
    expect(isDriftInput(true, 1, 5, true)).toBe(true);
    expect(isDriftInput(true, 1, 5, false)).toBe(false);
    expect(isDriftInput(true, 1, 3, true)).toBe(false);
  });
});

describe('DriftBoost', () => {
  it('starts idle with no charge or boost', () => {
    const boost = new DriftBoost();
    expect(boost.isDrifting()).toBe(false);
    expect(boost.chargeTier()).toBe(0);
    expect(boost.isBoosting()).toBe(false);
  });

  it('charges through tiers the longer the drift is held', () => {
    const boost = new DriftBoost();
    drift(boost, 0.3);
    expect(boost.chargeTier()).toBe(0);
    drift(boost, 0.6); // total ~0.9s
    expect(boost.chargeTier()).toBe(1);
    drift(boost, 1.0); // total ~1.9s
    expect(boost.chargeTier()).toBe(2);
    drift(boost, 1.2); // total ~3.1s
    expect(boost.chargeTier()).toBe(3);
  });

  it('grants no boost when released before the first tier', () => {
    const boost = new DriftBoost();
    drift(boost, 0.4);
    boost.update(1 / 60, false);
    expect(boost.isBoosting()).toBe(false);
  });

  it('grants a boost on release after reaching a tier', () => {
    const boost = new DriftBoost();
    drift(boost, 1.0);
    boost.update(1 / 60, false);
    expect(boost.isBoosting()).toBe(true);
    expect(boost.isDrifting()).toBe(false);
  });

  it('higher tiers boost for longer', () => {
    const timeBoosting = (driftSeconds: number) => {
      const boost = new DriftBoost();
      drift(boost, driftSeconds);
      const dt = 1 / 60;
      let time = 0;
      boost.update(dt, false);
      while (boost.isBoosting() && time < 10) {
        boost.update(dt, false);
        time += dt;
      }
      return time;
    };
    const tier1 = timeBoosting(1.0);
    const tier3 = timeBoosting(3.0);
    expect(tier1).toBeGreaterThan(0.5);
    expect(tier3).toBeGreaterThan(tier1 + 0.5);
  });

  it('reports charge progress toward the next tier', () => {
    const boost = new DriftBoost();
    expect(boost.chargeProgress()).toBe(0);
    drift(boost, 3.0);
    expect(boost.chargeProgress()).toBe(1);
  });

  it('reset clears drift and boost state', () => {
    const boost = new DriftBoost();
    drift(boost, 2.0);
    boost.update(1 / 60, false);
    boost.reset();
    expect(boost.isBoosting()).toBe(false);
    expect(boost.chargeTier()).toBe(0);
  });
});
