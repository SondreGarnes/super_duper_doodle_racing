// Mario Kart-style drift boost: holding a drift charges through tiers; releasing
// grants a temporary speed boost whose duration grows with the tier reached.
const TIER_THRESHOLDS_S = [0.7, 1.6, 2.8];
const BOOST_DURATIONS_S = [0, 0.8, 1.5, 2.4];
const DRIFT_ENTER_SPEED = 6;
const DRIFT_EXIT_SPEED = 3.5;

// Hysteresis on the speed gate: a drift needs decent speed to start, but scrubbing
// speed mid-slide shouldn't instantly cancel it (that would drop the earned charge).
export function isDriftInput(
  handbrake: boolean,
  steer: number,
  signedSpeed: number,
  alreadyDrifting = false
): boolean {
  const minSpeed = alreadyDrifting ? DRIFT_EXIT_SPEED : DRIFT_ENTER_SPEED;
  return handbrake && steer !== 0 && signedSpeed > minSpeed;
}

export class DriftBoost {
  private driftTime = 0;
  private drifting = false;
  private boostRemaining = 0;

  update(dt: number, driftInput: boolean): void {
    if (driftInput) {
      this.drifting = true;
      this.driftTime += dt;
    } else {
      if (this.drifting) {
        this.boostRemaining = Math.max(this.boostRemaining, BOOST_DURATIONS_S[this.tierFor(this.driftTime)]);
      }
      this.drifting = false;
      this.driftTime = 0;
      this.boostRemaining = Math.max(0, this.boostRemaining - dt);
    }
  }

  private tierFor(driftTime: number): number {
    let tier = 0;
    for (const threshold of TIER_THRESHOLDS_S) {
      if (driftTime >= threshold) tier++;
    }
    return tier;
  }

  isDrifting(): boolean {
    return this.drifting;
  }

  // 0 = no charge yet, 1..3 = boost tier earned so far (MK: blue/orange/purple sparks).
  chargeTier(): number {
    return this.drifting ? this.tierFor(this.driftTime) : 0;
  }

  // 0..1 progress toward the next tier (1 when maxed), for HUD charge bars.
  chargeProgress(): number {
    if (!this.drifting) return 0;
    const tier = this.tierFor(this.driftTime);
    if (tier >= TIER_THRESHOLDS_S.length) return 1;
    const prev = tier === 0 ? 0 : TIER_THRESHOLDS_S[tier - 1];
    const next = TIER_THRESHOLDS_S[tier];
    return (this.driftTime - prev) / (next - prev);
  }

  isBoosting(): boolean {
    return this.boostRemaining > 0;
  }

  reset(): void {
    this.driftTime = 0;
    this.drifting = false;
    this.boostRemaining = 0;
  }
}
