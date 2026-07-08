# Realistic Physics, Longer Track, and Lap Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing driving game's vehicle physics feel more realistic, replace the short road loop with a longer/more varied circuit, and add a lap timer (start on movement, stop on lap completion) with `R` to reset car and timer.

**Architecture:** All new tuning logic that can be pure (engine force curve, steering curve, track-progress lookup, lap timer state machine, time formatting) lives in small standalone modules so it's unit-testable without a running Rapier/Three.js instance. `Car` gains a `reset()` method and calls the new pure tuning functions each physics step. `main.ts` wires a new `LapTimer` + `TimerDisplay` pair, updated each frame from the car's track progress, and handles the `R` key by resetting both the car and the timer.

**Tech Stack:** Same as existing project — Three.js, `@dimforge/rapier3d-compat`, Vite, TypeScript, Vitest.

## Global Constraints

- No new external dependencies, models, or textures (per original spec) — timer UI is a plain DOM overlay, not a 3D object.
- Fixed-timestep physics loop (1/60s, accumulator-driven) must remain intact; all new per-step forces (drag, resistance) are applied inside the existing fixed-step callback in `main.ts`.
- Must preserve the stability properties already verified for the original track: all 4 wheels grounded during normal driving, no chassis pitch/roll runaway ("wheelie"), chase camera never dips below the car.
- Timer only stops on completing at least ~0.6 of the lap and returning near the start (guards against instantly finishing by reversing over the line).

---

## File Structure

- Modify `src/world/road.ts` — bigger `ROAD_POINTS`; add exported `getSpawnTransform(curve)` helper (shared by initial spawn and reset).
- Modify `src/world/scenery.ts` — raise `PROP_COUNT` to match the larger track.
- Create `src/car/vehicleTuning.ts` — pure functions `engineForceForSpeed` and `steerAngleForSpeed`.
- Modify `src/car/car.ts` — use the tuning functions, add drag/rolling resistance, lower center of mass, per-axle suspension/friction tuning, add `reset()`.
- Create `src/world/trackProgress.ts` — pure `getTrackProgress(curve, position)` helper.
- Create `src/game/lapTimer.ts` — `LapTimer` class (start/update/finish/reset state machine).
- Create `src/ui/timerDisplay.ts` — `TimerDisplay` class (DOM overlay) + exported pure `formatTime`.
- Modify `src/car/input.ts` — add one-shot `resetPressed` flag for the `R` key.
- Modify `src/scene.ts` — enable shadow mapping.
- Modify `src/main.ts` — wire timer, reset handling, resistance force call, spawn via shared helper.
- Tests: `tests/vehicleTuning.test.ts`, `tests/trackProgress.test.ts`, `tests/lapTimer.test.ts`, `tests/timerDisplay.test.ts`.

## Interfaces Contract (used across tasks)

- `engineForceForSpeed(speed: number, throttle: number): number`
- `steerAngleForSpeed(speed: number, steerInput: number): number`
- `getTrackProgress(curve: THREE.CatmullRomCurve3, position: THREE.Vector3): number` — returns 0..1
- `getSpawnTransform(curve: THREE.CatmullRomCurve3): { position: THREE.Vector3; quaternion: THREE.Quaternion }`
- `Car.reset(position: THREE.Vector3, quaternion: THREE.Quaternion): void`
- `Car.applyResistance(dt: number): void`
- `LapTimer.start(nowMs: number)`, `.update(nowMs: number, progress: number)`, `.reset()`, `.isRunning(): boolean`, `.isFinished(): boolean`, `.getElapsedMs(nowMs: number): number`
- `TimerDisplay.update(elapsedMs: number, isFinished: boolean): void`; exported `formatTime(ms: number): string`
- `InputState.resetPressed: boolean` — true for exactly one `update()` call after `R` is pressed

---

### Task 1: Expand the track and scenery density

**Files:**
- Modify: `src/world/road.ts`
- Modify: `src/world/scenery.ts`

**Interfaces:**
- Produces: same `createRoad` return shape (`{ curve }`); `curve` now spans a larger area with more turns.

- [ ] **Step 1: Replace `ROAD_POINTS` in `src/world/road.ts` with a longer circuit**

Replace the `ROAD_POINTS` array (currently 8 points) with:

```ts
const ROAD_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(45, 0, 2),
  new THREE.Vector3(90, 0, 0),
  new THREE.Vector3(125, 0, -20),
  new THREE.Vector3(145, 0, -55),
  new THREE.Vector3(140, 0, -95),
  new THREE.Vector3(110, 0, -125),
  new THREE.Vector3(65, 0, -135),
  new THREE.Vector3(25, 0, -115),
  new THREE.Vector3(10, 0, -85),
  new THREE.Vector3(35, 0, -60),
  new THREE.Vector3(15, 0, -30),
  new THREE.Vector3(-25, 0, -20),
  new THREE.Vector3(-65, 0, -35),
  new THREE.Vector3(-100, 0, -65),
  new THREE.Vector3(-120, 0, -100),
  new THREE.Vector3(-110, 0, -140),
  new THREE.Vector3(-70, 0, -155),
  new THREE.Vector3(-25, 0, -140),
  new THREE.Vector3(-5, 0, -100),
  new THREE.Vector3(-15, 0, -50),
  new THREE.Vector3(-20, 0, -20),
];
```

This traces a closed loop roughly 5x the area of the original: a straight run from the start (points 0-2), sweeping turns through points 3-7, a hairpin around points 8-10 (sharp pull back toward the inside of the curve), more sweepers through 11-17, and a final run back to the start through 18-21.

- [ ] **Step 2: Enlarge the ground plane to cover the bigger track**

In `src/world/road.ts`, the ground mesh and collider currently use `400`/`200` half-extents. Update both to comfortably cover the new track's ~280x300 unit span:

```ts
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: 0x3a5f3a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(450, 0.05, 450).setTranslation(0, -0.1, 0),
    groundBody
  );
```

- [ ] **Step 3: Raise scenery density to match the longer track**

In `src/world/scenery.ts`, change:

```ts
const PROP_COUNT = 40;
```

to:

```ts
const PROP_COUNT = 110;
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/world/road.ts src/world/scenery.ts
git commit -m "Expand track to a longer circuit with a hairpin and straight"
```

---

### Task 2: Pure vehicle-tuning functions (engine curve, speed-sensitive steering)

**Files:**
- Create: `src/car/vehicleTuning.ts`
- Test: `tests/vehicleTuning.test.ts`

**Interfaces:**
- Produces: `engineForceForSpeed(speed: number, throttle: number): number` and `steerAngleForSpeed(speed: number, steerInput: number): number`, consumed by `Car.applyInput` in Task 3.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/vehicleTuning.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/car/vehicleTuning.ts` does not exist.

- [ ] **Step 3: Write `src/car/vehicleTuning.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `tests/vehicleTuning.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/car/vehicleTuning.ts tests/vehicleTuning.test.ts
git commit -m "Add pure engine-curve and speed-sensitive steering functions"
```

---

### Task 3: Wire tuning into Car, add drag/resistance, lower center of mass, per-axle suspension

**Files:**
- Modify: `src/car/car.ts`

**Interfaces:**
- Consumes: `engineForceForSpeed`, `steerAngleForSpeed` (Task 2)
- Produces: `Car.applyResistance(dt: number): void` and `Car.reset(position: THREE.Vector3, quaternion: THREE.Quaternion): void`, both consumed by `main.ts` in Task 7.

- [ ] **Step 1: Add the import and update wheel/suspension constants**

At the top of `src/car/car.ts`, add the import:

```ts
import { engineForceForSpeed, steerAngleForSpeed } from './vehicleTuning';
```

Replace the constant block:

```ts
const CHASSIS_HALF_EXTENTS = { x: 0.9, y: 0.4, z: 2.0 };
const WHEEL_RADIUS = 0.4;
const WHEEL_HALF_WIDTH = 0.2;
const SUSPENSION_REST_LENGTH = 0.35;
// Keeps peak acceleration under ~1/3 g (500N / 150kg chassis) so the rear-wheel-drive
// torque doesn't pitch the nose up and lift the front wheels off the ground (a "wheelie").
const MAX_ENGINE_FORCE = 500;
const MAX_STEER_ANGLE = 0.5;
const MAX_BRAKE_FORCE = 40;
```

with:

```ts
const CHASSIS_HALF_EXTENTS = { x: 0.9, y: 0.4, z: 2.0 };
const CHASSIS_MASS = 150;
const WHEEL_RADIUS = 0.4;
const WHEEL_HALF_WIDTH = 0.2;
const SUSPENSION_REST_LENGTH = 0.35;
const MAX_BRAKE_FORCE = 40;

// Lowers the effective center of mass below the chassis's geometric center (toward
// where an engine/battery pack would sit), reducing body roll and wheelie tendency.
const CENTER_OF_MASS_OFFSET = { x: 0, y: -0.35, z: 0 };
// Box inertia tensor approximated about the geometric center (not recomputed for the
// shifted center of mass) — close enough for game-feel purposes, not a rigorous sim.
const PRINCIPAL_ANGULAR_INERTIA = {
  x: (CHASSIS_MASS / 3) * (CHASSIS_HALF_EXTENTS.y ** 2 + CHASSIS_HALF_EXTENTS.z ** 2),
  y: (CHASSIS_MASS / 3) * (CHASSIS_HALF_EXTENTS.x ** 2 + CHASSIS_HALF_EXTENTS.z ** 2),
  z: (CHASSIS_MASS / 3) * (CHASSIS_HALF_EXTENTS.x ** 2 + CHASSIS_HALF_EXTENTS.y ** 2),
};

// Opposing-velocity resistance applied each physics step, so top speed levels off
// naturally and coasting decelerates realistically instead of relying only on damping.
const ROLLING_RESISTANCE_COEFF = 6; // N per (m/s)
const DRAG_COEFF = 0.5; // N per (m/s)^2
```

- [ ] **Step 2: Give front and rear wheels different suspension/friction tuning**

Replace the `WheelDef` interface and `WHEEL_DEFS` array:

```ts
interface WheelDef {
  position: RAPIER.Vector3;
  isFront: boolean;
}

// The vehicle controller's engine force drives the chassis along its local +Z axis,
// so the steering (front) wheels must lead at +Z and the driven (rear) wheels trail at -Z.
const WHEEL_DEFS: WheelDef[] = [
  { position: { x: -CHASSIS_HALF_EXTENTS.x, y: -0.2, z: 1.4 }, isFront: true },
  { position: { x: CHASSIS_HALF_EXTENTS.x, y: -0.2, z: 1.4 }, isFront: true },
  { position: { x: -CHASSIS_HALF_EXTENTS.x, y: -0.2, z: -1.4 }, isFront: false },
  { position: { x: CHASSIS_HALF_EXTENTS.x, y: -0.2, z: -1.4 }, isFront: false },
];

const FRONT_SUSPENSION_STIFFNESS = 28;
const REAR_SUSPENSION_STIFFNESS = 22;
const FRONT_FRICTION_SLIP = 3.0;
const REAR_FRICTION_SLIP = 2.6;
const MAX_SUSPENSION_TRAVEL = 0.3;
```

- [ ] **Step 3: Replace mass assignment with `setAdditionalMassProperties` and the collider's density**

Replace:

```ts
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(startPos.x, startPos.y, startPos.z)
      .setRotation(startRotation)
      .setLinearDamping(0.1)
      .setAngularDamping(1.5);
    this.chassisBody = world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      CHASSIS_HALF_EXTENTS.x,
      CHASSIS_HALF_EXTENTS.y,
      CHASSIS_HALF_EXTENTS.z
    ).setMass(150);
    world.createCollider(colliderDesc, this.chassisBody);
```

with:

```ts
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(startPos.x, startPos.y, startPos.z)
      .setRotation(startRotation)
      .setLinearDamping(0.1)
      .setAngularDamping(1.5)
      .setAdditionalMassProperties(
        CHASSIS_MASS,
        CENTER_OF_MASS_OFFSET,
        PRINCIPAL_ANGULAR_INERTIA,
        { x: 0, y: 0, z: 0, w: 1 }
      );
    this.chassisBody = world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      CHASSIS_HALF_EXTENTS.x,
      CHASSIS_HALF_EXTENTS.y,
      CHASSIS_HALF_EXTENTS.z
    ).setDensity(0);
    world.createCollider(colliderDesc, this.chassisBody);
```

(`setDensity(0)` prevents the collider from contributing additional mass on top of `setAdditionalMassProperties`.)

- [ ] **Step 4: Apply per-axle suspension/friction tuning**

Replace:

```ts
    for (let i = 0; i < WHEEL_DEFS.length; i++) {
      this.vehicle.setWheelSuspensionStiffness(i, 24);
      this.vehicle.setWheelMaxSuspensionTravel(i, 0.3);
      this.vehicle.setWheelFrictionSlip(i, 2.5);
    }
```

with:

```ts
    for (let i = 0; i < WHEEL_DEFS.length; i++) {
      const isFront = WHEEL_DEFS[i].isFront;
      this.vehicle.setWheelSuspensionStiffness(
        i,
        isFront ? FRONT_SUSPENSION_STIFFNESS : REAR_SUSPENSION_STIFFNESS
      );
      this.vehicle.setWheelMaxSuspensionTravel(i, MAX_SUSPENSION_TRAVEL);
      this.vehicle.setWheelFrictionSlip(i, isFront ? FRONT_FRICTION_SLIP : REAR_FRICTION_SLIP);
    }
```

- [ ] **Step 5: Use the tuning functions in `applyInput`**

Replace:

```ts
  applyInput(input: { throttle: number; brake: number; steer: number; handbrake: boolean }): void {
    const engineForce = input.throttle * MAX_ENGINE_FORCE;
    const brakeForce = input.brake * MAX_BRAKE_FORCE;
    const steerAngle = input.steer * MAX_STEER_ANGLE;

    for (let i = 0; i < WHEEL_DEFS.length; i++) {
      const def = WHEEL_DEFS[i];
      this.vehicle.setWheelEngineForce(i, def.isFront ? 0 : engineForce);
      this.vehicle.setWheelBrake(i, input.handbrake && !def.isFront ? MAX_BRAKE_FORCE : brakeForce);
      if (def.isFront) {
        this.vehicle.setWheelSteering(i, steerAngle);
      }
    }
  }
```

with:

```ts
  applyInput(input: { throttle: number; brake: number; steer: number; handbrake: boolean }): void {
    const currentSpeed = this.vehicle.currentVehicleSpeed();
    const engineForce = engineForceForSpeed(currentSpeed, input.throttle);
    const brakeForce = input.brake * MAX_BRAKE_FORCE;
    const steerAngle = steerAngleForSpeed(currentSpeed, input.steer);

    for (let i = 0; i < WHEEL_DEFS.length; i++) {
      const def = WHEEL_DEFS[i];
      this.vehicle.setWheelEngineForce(i, def.isFront ? 0 : engineForce);
      this.vehicle.setWheelBrake(i, input.handbrake && !def.isFront ? MAX_BRAKE_FORCE : brakeForce);
      if (def.isFront) {
        this.vehicle.setWheelSteering(i, steerAngle);
      }
    }
  }

  applyResistance(dt: number): void {
    const vel = this.chassisBody.linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    if (speed < 1e-4) return;

    const resistanceForce = ROLLING_RESISTANCE_COEFF * speed + DRAG_COEFF * speed * speed;
    const impulseMag = -resistanceForce * dt;
    const dirX = vel.x / speed;
    const dirZ = vel.z / speed;
    this.chassisBody.applyImpulse({ x: dirX * impulseMag, y: 0, z: dirZ * impulseMag }, true);
  }

  reset(position: THREE.Vector3, quaternion: THREE.Quaternion): void {
    this.chassisBody.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    this.chassisBody.setRotation(
      { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
      true
    );
    this.chassisBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.chassisBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors. If `setAdditionalMassProperties` or `RigidBody.linvel()`/`applyImpulse` signatures don't match, check against `node_modules/@dimforge/rapier3d-compat/dynamics/rigid_body.d.ts` and align exactly.

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: All existing and new tests still pass (car.ts changes don't affect the pure-function tests, but confirms nothing else broke).

- [ ] **Step 8: Commit**

```bash
git add src/car/car.ts
git commit -m "Use engine curve, speed-sensitive steering, drag/resistance, lower CoM, per-axle suspension"
```

---

### Task 4: Track progress helper

**Files:**
- Create: `src/world/trackProgress.ts`
- Test: `tests/trackProgress.test.ts`

**Interfaces:**
- Produces: `getTrackProgress(curve: THREE.CatmullRomCurve3, position: THREE.Vector3): number`, consumed by `main.ts` (Task 7) to feed `LapTimer.update`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/trackProgress.test.ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getTrackProgress } from '../src/world/trackProgress';

function makeTestCurve(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(20, 0, 0),
      new THREE.Vector3(20, 0, 20),
      new THREE.Vector3(0, 0, 20),
    ],
    true,
    'catmullrom',
    0.5
  );
}

describe('getTrackProgress', () => {
  it('returns ~0 for a position at the start of the curve', () => {
    const curve = makeTestCurve();
    const progress = getTrackProgress(curve, curve.getPointAt(0));
    expect(progress).toBeLessThan(0.01);
  });

  it('returns the matching progress value for a point sampled mid-curve', () => {
    const curve = makeTestCurve();
    const target = curve.getPointAt(0.4);
    const progress = getTrackProgress(curve, target);
    expect(progress).toBeCloseTo(0.4, 1);
  });

  it('wraps back toward 0 for a position near the end of the closed loop', () => {
    const curve = makeTestCurve();
    const target = curve.getPointAt(0.98);
    const progress = getTrackProgress(curve, target);
    expect(progress).toBeGreaterThan(0.9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `src/world/trackProgress.ts` does not exist.

- [ ] **Step 3: Write `src/world/trackProgress.ts`**

```ts
import * as THREE from 'three';

const PROGRESS_SAMPLES = 200;

// Returns the car's normalized progress (0..1) around a closed track curve, found via
// nearest-sample projection. Sample resolution (1/200) is sufficient for lap timing.
export function getTrackProgress(curve: THREE.CatmullRomCurve3, position: THREE.Vector3): number {
  let closestT = 0;
  let closestDistSq = Infinity;

  for (let i = 0; i < PROGRESS_SAMPLES; i++) {
    const t = i / PROGRESS_SAMPLES;
    const point = curve.getPointAt(t);
    const distSq = point.distanceToSquared(position);
    if (distSq < closestDistSq) {
      closestDistSq = distSq;
      closestT = t;
    }
  }

  return closestT;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all tests in `tests/trackProgress.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/world/trackProgress.ts tests/trackProgress.test.ts
git commit -m "Add track-progress lookup helper for lap timing"
```

---

### Task 5: LapTimer state machine

**Files:**
- Create: `src/game/lapTimer.ts`
- Test: `tests/lapTimer.test.ts`

**Interfaces:**
- Produces: `LapTimer` class, consumed by `main.ts` (Task 7).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lapTimer.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `src/game/lapTimer.ts` does not exist.

- [ ] **Step 3: Write `src/game/lapTimer.ts`**

```ts
const FINISH_PROGRESS_THRESHOLD = 0.97;
const START_PROGRESS_THRESHOLD = 0.03;
const MIN_PROGRESS_BEFORE_FINISH = 0.6;

export class LapTimer {
  private startTimeMs: number | null = null;
  private finishTimeMs: number | null = null;
  private maxProgressSeen = 0;

  start(nowMs: number): void {
    if (this.startTimeMs !== null || this.finishTimeMs !== null) return;
    this.startTimeMs = nowMs;
  }

  update(nowMs: number, progress: number): void {
    if (this.startTimeMs === null || this.finishTimeMs !== null) return;

    if (progress > this.maxProgressSeen) {
      this.maxProgressSeen = progress;
    }

    const hasReachedNearEnd = this.maxProgressSeen >= FINISH_PROGRESS_THRESHOLD;
    const hasWrappedToStart = progress <= START_PROGRESS_THRESHOLD;
    const coveredEnoughDistance = this.maxProgressSeen >= MIN_PROGRESS_BEFORE_FINISH;

    if (hasReachedNearEnd && hasWrappedToStart && coveredEnoughDistance) {
      this.finishTimeMs = nowMs;
    }
  }

  reset(): void {
    this.startTimeMs = null;
    this.finishTimeMs = null;
    this.maxProgressSeen = 0;
  }

  isRunning(): boolean {
    return this.startTimeMs !== null && this.finishTimeMs === null;
  }

  isFinished(): boolean {
    return this.finishTimeMs !== null;
  }

  getElapsedMs(nowMs: number): number {
    if (this.startTimeMs === null) return 0;
    const endTime = this.finishTimeMs ?? nowMs;
    return endTime - this.startTimeMs;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tests in `tests/lapTimer.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/game/lapTimer.ts tests/lapTimer.test.ts
git commit -m "Add LapTimer start/finish/reset state machine"
```

---

### Task 6: Timer display overlay

**Files:**
- Create: `src/ui/timerDisplay.ts`
- Test: `tests/timerDisplay.test.ts`

**Interfaces:**
- Produces: exported `formatTime(ms: number): string` (pure, tested) and `TimerDisplay` class with `update(elapsedMs: number, isFinished: boolean): void`, consumed by `main.ts` (Task 7).

- [ ] **Step 1: Write the failing test for `formatTime`**

```ts
// tests/timerDisplay.test.ts
import { describe, it, expect } from 'vitest';
import { formatTime } from '../src/ui/timerDisplay';

describe('formatTime', () => {
  it('formats zero as 00:00.000', () => {
    expect(formatTime(0)).toBe('00:00.000');
  });

  it('formats sub-minute times with padded milliseconds', () => {
    expect(formatTime(1234)).toBe('00:01.234');
  });

  it('formats minutes correctly', () => {
    expect(formatTime(61234)).toBe('01:01.234');
  });

  it('clamps negative input to zero', () => {
    expect(formatTime(-500)).toBe('00:00.000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `src/ui/timerDisplay.ts` does not exist.

- [ ] **Step 3: Write `src/ui/timerDisplay.ts`**

```ts
export function formatTime(ms: number): string {
  const totalMs = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  const pad = (n: number, len: number) => n.toString().padStart(len, '0');
  return `${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
}

export class TimerDisplay {
  private element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.position = 'fixed';
    this.element.style.top = '16px';
    this.element.style.left = '16px';
    this.element.style.padding = '8px 14px';
    this.element.style.fontFamily = 'monospace';
    this.element.style.fontSize = '24px';
    this.element.style.color = '#ffffff';
    this.element.style.background = 'rgba(0, 0, 0, 0.4)';
    this.element.style.borderRadius = '6px';
    this.element.style.pointerEvents = 'none';
    document.body.appendChild(this.element);
  }

  update(elapsedMs: number, isFinished: boolean): void {
    const timeText = formatTime(elapsedMs);
    const hint = isFinished
      ? '<div style="font-size:14px;margin-top:4px;">Press R to reset</div>'
      : '';
    this.element.style.color = isFinished ? '#4ade80' : '#ffffff';
    this.element.innerHTML = `${timeText}${hint}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all tests in `tests/timerDisplay.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/timerDisplay.ts tests/timerDisplay.test.ts
git commit -m "Add lap timer HTML overlay display"
```

---

### Task 7: Reset key, shared spawn helper, and full wiring in main.ts

**Files:**
- Modify: `src/car/input.ts`
- Modify: `src/world/road.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `Car.reset`, `Car.applyResistance` (Task 3), `getTrackProgress` (Task 4), `LapTimer` (Task 5), `TimerDisplay` (Task 6)
- Produces: `getSpawnTransform(curve)` in `road.ts`, `InputState.resetPressed` in `input.ts`

- [ ] **Step 1: Add a one-shot reset flag to `InputState`**

Replace the full contents of `src/car/input.ts`:

```ts
export class InputState {
  throttle = 0;
  brake = 0;
  steer = 0;
  handbrake = false;
  resetPressed = false;

  private keys = new Set<string>();
  private resetQueued = false;

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'KeyR') this.resetQueued = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  update(): void {
    const forward = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const backward = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');

    this.throttle = forward ? 1 : 0;
    this.brake = backward ? 1 : 0;
    this.steer = (left ? 1 : 0) - (right ? 1 : 0);
    this.handbrake = this.keys.has('Space');

    this.resetPressed = this.resetQueued;
    this.resetQueued = false;
  }
}
```

- [ ] **Step 2: Add `getSpawnTransform` to `src/world/road.ts`**

Add this export at the end of `src/world/road.ts` (after the existing `createRoad` function):

```ts
export function getSpawnTransform(curve: THREE.CatmullRomCurve3): {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
} {
  const point = curve.getPointAt(0);
  const tangent = curve.getTangentAt(0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
  return { position: new THREE.Vector3(point.x, point.y + 1, point.z), quaternion };
}
```

- [ ] **Step 3: Rewrite `src/main.ts`**

Replace the full contents of `src/main.ts`:

```ts
import { createScene } from './scene';
import { createPhysicsWorld, FixedTimestepAccumulator } from './physics';
import { createRoad, getSpawnTransform } from './world/road';
import { createScenery } from './world/scenery';
import { getTrackProgress } from './world/trackProgress';
import { InputState } from './car/input';
import { Car } from './car/car';
import { ChaseCamera } from './camera/chaseCamera';
import { LapTimer } from './game/lapTimer';
import { TimerDisplay } from './ui/timerDisplay';

const FIXED_DT = 1 / 60;

async function main() {
  const { scene, camera, renderer } = createScene();

  const world = await createPhysicsWorld();
  const { curve } = createRoad(scene, world);
  createScenery(scene, world, curve);

  const spawn = getSpawnTransform(curve);
  const car = new Car(
    scene,
    world,
    { x: spawn.position.x, y: spawn.position.y, z: spawn.position.z },
    { x: spawn.quaternion.x, y: spawn.quaternion.y, z: spawn.quaternion.z, w: spawn.quaternion.w }
  );
  const input = new InputState();
  const chaseCamera = new ChaseCamera(camera, car.getChassisWorldPosition());
  const accumulator = new FixedTimestepAccumulator(FIXED_DT);
  const lapTimer = new LapTimer();
  const timerDisplay = new TimerDisplay();

  let lastTime = performance.now();

  function animate(now: number) {
    requestAnimationFrame(animate);
    const deltaSeconds = Math.min((now - lastTime) / 1000, 0.25);
    lastTime = now;

    input.update();

    if (input.resetPressed) {
      car.reset(spawn.position, spawn.quaternion);
      lapTimer.reset();
    }

    if (!lapTimer.isFinished() && (input.throttle > 0 || input.brake > 0)) {
      lapTimer.start(now);
    }

    accumulator.tick(deltaSeconds, () => {
      car.applyInput(input);
      car.applyResistance(FIXED_DT);
      world.step();
    });

    car.update();
    chaseCamera.update(car.getChassisWorldPosition(), car.getChassisWorldQuaternion(), deltaSeconds);

    const progress = getTrackProgress(curve, car.getChassisWorldPosition());
    lapTimer.update(now, progress);
    timerDisplay.update(lapTimer.getElapsedMs(now), lapTimer.isFinished());

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}

main();
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass (this task doesn't add new unit tests — its correctness is verified end-to-end in Task 9).

- [ ] **Step 6: Commit**

```bash
git add src/car/input.ts src/world/road.ts src/main.ts
git commit -m "Wire lap timer, reset key, and resistance force into main loop"
```

---

### Task 8: Shadow mapping and material polish

**Files:**
- Modify: `src/scene.ts`
- Modify: `src/car/car.ts`
- Modify: `src/world/road.ts`
- Modify: `src/world/scenery.ts`

**Interfaces:**
- No new exported interfaces — purely visual changes to existing functions.

- [ ] **Step 1: Enable shadow mapping in `src/scene.ts`**

In `src/scene.ts`, after the renderer is created, add shadow map setup, and configure the sun light to cast shadows with a frustum sized for the larger track:

Replace:

```ts
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
  sunLight.position.set(20, 30, 10);
  scene.add(sunLight);
```

with:

```ts
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
  sunLight.position.set(60, 90, 30);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -300;
  sunLight.shadow.camera.right = 300;
  sunLight.shadow.camera.top = 300;
  sunLight.shadow.camera.bottom = -300;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 400;
  scene.add(sunLight);
```

- [ ] **Step 2: Enable shadows on the car meshes and retune materials**

In `src/car/car.ts`, update the chassis and wheel mesh creation. Replace:

```ts
    this.chassisMesh = new THREE.Group();
    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        CHASSIS_HALF_EXTENTS.x * 2,
        CHASSIS_HALF_EXTENTS.y * 2,
        CHASSIS_HALF_EXTENTS.z * 2
      ),
      new THREE.MeshStandardMaterial({ color: 0xdd2222 })
    );
    this.chassisMesh.add(bodyMesh);
    scene.add(this.chassisMesh);

    for (const def of WHEEL_DEFS) {
      const wheelMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_HALF_WIDTH * 2, 16),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
      );
      wheelMesh.rotation.z = Math.PI / 2;
      scene.add(wheelMesh);
      this.wheelMeshes.push(wheelMesh);
    }
```

with:

```ts
    this.chassisMesh = new THREE.Group();
    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        CHASSIS_HALF_EXTENTS.x * 2,
        CHASSIS_HALF_EXTENTS.y * 2,
        CHASSIS_HALF_EXTENTS.z * 2
      ),
      new THREE.MeshStandardMaterial({ color: 0xdd2222, roughness: 0.4, metalness: 0.3 })
    );
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.chassisMesh.add(bodyMesh);
    scene.add(this.chassisMesh);

    for (const def of WHEEL_DEFS) {
      const wheelMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_HALF_WIDTH * 2, 16),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.1 })
      );
      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.castShadow = true;
      scene.add(wheelMesh);
      this.wheelMeshes.push(wheelMesh);
    }
```

Note: `def` in the wheel loop is unused (iterating only for count) — this matches the existing code's style and is not a new issue introduced here.

- [ ] **Step 3: Enable shadow receiving on ground/road and retune materials**

In `src/world/road.ts`, replace:

```ts
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: 0x3a5f3a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);
```

with:

```ts
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: 0x3a5f3a, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);
```

And replace:

```ts
  const roadMesh = new THREE.Mesh(
    roadGeometry,
    new THREE.MeshStandardMaterial({ color: 0x444444, side: THREE.DoubleSide })
  );
  scene.add(roadMesh);
```

with:

```ts
  const roadMesh = new THREE.Mesh(
    roadGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x444444,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0,
    })
  );
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);
```

- [ ] **Step 4: Enable shadow casting on buildings and retune materials**

In `src/world/scenery.ts`, replace:

```ts
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({
        color: BUILDING_COLORS[i % BUILDING_COLORS.length],
      })
    );
    mesh.position.set(position.x, height / 2, position.z);
    scene.add(mesh);
```

with:

```ts
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({
        color: BUILDING_COLORS[i % BUILDING_COLORS.length],
        roughness: 0.7,
        metalness: 0.05,
      })
    );
    mesh.position.set(position.x, height / 2, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/scene.ts src/car/car.ts src/world/road.ts src/world/scenery.ts
git commit -m "Enable shadow mapping and retune materials for more depth"
```

---

### Task 9: End-to-end verification on the new track

**Files:**
- None (verification only; fix forward in the files above if issues are found)

- [ ] **Step 1: Run the full test suite one more time**

Run: `npm test`
Expected: All tests across `tests/physics.test.ts`, `tests/chaseCamera.test.ts`, `tests/vehicleTuning.test.ts`, `tests/trackProgress.test.ts`, `tests/lapTimer.test.ts`, `tests/timerDisplay.test.ts` pass.

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Headless browser verification (reuse the approach from the initial build)**

Start the dev server if not already running (`npm run dev`), then use a small Playwright script (Chromium already installed from the initial build) to:
1. Load the page, wait for init, confirm zero console errors.
2. Read `window.__debug` (the existing debug hook in `main.ts` — extend it if needed to also expose `lapTimer` for inspection) to sample chassis position/quaternion and wheel contact state while holding W, confirming: all 4 wheels stay grounded (no wheelie) through at least 5s of throttle, chassis pitch/roll stays small, camera height stays stable and never dips below the car.
3. Confirm the on-screen timer element exists in the DOM and its text updates (changes) over a few seconds of driving.
4. Press `R` and confirm the car's position snaps back to the spawn point and the timer text resets toward `00:00.xxx`.

Fix any issues found (retune constants, adjust track points if a self-intersection or stuck spot is visually confirmed) directly in the relevant task's files, then re-run this verification until clean.

- [ ] **Step 4: Manual check-in**

Report to the user: dev server URL, what was verified automatically (wheels grounded, no wheelie, camera stable, timer visible and updating, reset works), and ask them to drive a full lap themselves to confirm the timer stops correctly when crossing the finish line (full-lap completion is impractical to script reliably without steering AI, so this final confirmation is manual).

---

## Self-Review Notes

- **Spec coverage:** Longer track with hairpin/straight — Task 1. Weight transfer & grip (lower CoM, per-axle suspension/friction) — Task 3. Speed-sensitive steering — Task 2/3. Drag & rolling resistance — Task 3. Engine power curve — Task 2/3. Timer overlay — Task 6/7. Lap detection/finish — Task 4/5/7. Reset with R — Task 7. Graphics polish (shadows, materials) — Task 8. All spec sections covered.
- **Placeholder scan:** No TBD/TODO markers; every step has complete code or an exact command with expected output.
- **Type consistency:** `Car.reset(position: THREE.Vector3, quaternion: THREE.Quaternion)` matches the call in `main.ts` Task 7. `Car.applyResistance(dt: number)` matches. `getSpawnTransform` return shape (`{ position, quaternion }`) matches its use for both initial spawn and reset in `main.ts`. `LapTimer` method names/signatures match between Task 5's definition and Task 7's usage. `getTrackProgress(curve, position)` signature matches between Task 4 and Task 7. `TimerDisplay.update(elapsedMs, isFinished)` matches between Task 6 and Task 7.
