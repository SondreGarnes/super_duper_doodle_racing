// Peak engine force (N). Reachable once past LOW_SPEED_RAMP_END, held through
// PEAK_SPEED_END, then tapered linearly to 0 by TOP_SPEED.
const MAX_ENGINE_FORCE = 700;
const LOW_SPEED_RAMP_START_FACTOR = 0.4;
const LOW_SPEED_RAMP_END = 4;
const PEAK_SPEED_END = 16;
const TOP_SPEED = 32;

export function engineForceForSpeed(speed: number, throttle: number): number {
  const absSpeed = Math.abs(speed);
  let factor: number;

  if (absSpeed < LOW_SPEED_RAMP_END) {
    const t = absSpeed / LOW_SPEED_RAMP_END;
    factor = LOW_SPEED_RAMP_START_FACTOR + (1 - LOW_SPEED_RAMP_START_FACTOR) * t;
  } else if (absSpeed < PEAK_SPEED_END) {
    factor = 1;
  } else if (absSpeed < TOP_SPEED) {
    factor = 1 - (absSpeed - PEAK_SPEED_END) / (TOP_SPEED - PEAK_SPEED_END);
  } else {
    factor = 0;
  }

  return MAX_ENGINE_FORCE * factor * throttle;
}

// Steering angle (radians) scales down from MAX_STEER_ANGLE at standstill to
// MIN_STEER_ANGLE by STEER_SPEED_FALLOFF speed, so the car doesn't snap-turn at speed.
const MAX_STEER_ANGLE = 0.5;
const MIN_STEER_ANGLE = 0.15;
const STEER_SPEED_FALLOFF = 22;

export function steerAngleForSpeed(speed: number, steerInput: number): number {
  const absSpeed = Math.abs(speed);
  const t = Math.min(absSpeed / STEER_SPEED_FALLOFF, 1);
  const maxAngle = MAX_STEER_ANGLE - t * (MAX_STEER_ANGLE - MIN_STEER_ANGLE);
  return steerInput * maxAngle;
}
