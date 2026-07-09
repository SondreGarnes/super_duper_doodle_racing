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

// Reverse: pressing brake while (nearly) stopped or already rolling backward engages
// reverse drive instead of braking, capped at a walking-pace top speed.
const REVERSE_ENGINE_FORCE = 450;
const REVERSE_TOP_SPEED = 9;
const REVERSE_ENGAGE_SPEED = 0.8;
const MAX_BRAKE_FORCE = 40;

export interface DriveCommand {
  engineForce: number;
  brakeForce: number;
}

// Maps throttle/brake pedals plus the signed forward speed to engine and brake forces.
// Throttle always drives forward; brake acts as a brake while moving forward and as
// reverse drive once the car is (nearly) stopped or moving backward.
export function driveCommandForInput(
  signedSpeed: number,
  throttle: number,
  brake: number
): DriveCommand {
  if (throttle > 0) {
    return { engineForce: engineForceForSpeed(signedSpeed, throttle), brakeForce: 0 };
  }

  if (brake > 0) {
    if (signedSpeed > REVERSE_ENGAGE_SPEED) {
      return { engineForce: 0, brakeForce: brake * MAX_BRAKE_FORCE };
    }
    if (signedSpeed <= -REVERSE_TOP_SPEED) {
      return { engineForce: 0, brakeForce: 0 };
    }
    return { engineForce: -REVERSE_ENGINE_FORCE * brake, brakeForce: 0 };
  }

  return { engineForce: 0, brakeForce: 0 };
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
