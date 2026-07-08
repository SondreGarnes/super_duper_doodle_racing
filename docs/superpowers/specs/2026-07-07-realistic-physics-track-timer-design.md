# Realistic Physics, Longer Track, and Lap Timer — Design Spec

## Goal

Iterate on the existing driving game (Three.js + Rapier3D) to: (1) make the vehicle physics feel more realistic, (2) replace the current short road loop with a longer, more varied circuit, (3) add a lap timer that starts on movement and stops on finishing a lap, with `R` to reset car and timer, and (4) modest graphics polish (shadows, material tuning) within the existing low-poly style.

## Track

- Replace `ROAD_POINTS` in `src/world/road.ts` with a longer closed-loop control-point set (~16-18 points) spanning a larger area than the current loop, mixing:
  - At least one hairpin (tight-radius turn)
  - Several sweeping medium-radius turns
  - At least one long straight segment for reaching higher speed
- Same rendering/collider approach as today (Catmull-Rom spline → ribbon mesh + trimesh collider), just a bigger point set. `ROAD_WIDTH` and the ribbon-generation logic are unchanged.
- Scenery (`createScenery`) continues to scatter buildings alongside the new curve using the existing offset logic — no algorithm change needed since it already parametrizes off the curve.

## Physics realism

All changes are in `src/car/car.ts` unless noted.

1. **Lower center of mass & suspension retuning**: shift wheel attachment `y` and/or collider offset so the effective CoM sits lower relative to the wheelbase; retune `wheelSuspensionStiffness`, suspension travel, and `wheelFrictionSlip` per axle (front vs rear can differ) for better grip and less body roll than the current flat values.
2. **Speed-sensitive steering**: max steering angle scales down as chassis speed increases (e.g. full `MAX_STEER_ANGLE` at low speed, reduced toward a floor at high speed), computed from `RAPIER.RigidBody.linvel()` magnitude each frame in `applyInput`.
3. **Drag & rolling resistance**: each physics step, apply a force opposing the chassis's velocity: a linear rolling-resistance term plus a velocity-squared aerodynamic drag term, applied via `chassisBody.applyImpulse` (or equivalent) in `Car.update()` or a new `Car.applyResistance()` called from the fixed-step loop.
4. **Engine power curve**: replace the flat `MAX_ENGINE_FORCE * throttle` with a force curve keyed on current forward speed — reduced force near zero speed (avoids instant wheel spin/wheelie risk), a peak band at low-to-mid speed, and tapering force as the car approaches a target top speed. Implemented as a small pure function `engineForceForSpeed(speed: number, throttle: number): number` (unit-testable).

These changes must preserve the existing stability fixes from the previous iteration (no wheelies, no camera clipping) — verify via the same headless Playwright approach used previously.

## Timer & lap detection

- New module `src/game/lapTimer.ts` exporting a `LapTimer` class:
  - Tracks elapsed time in milliseconds since `start()` was called.
  - `start()`: begins timing (idempotent — no-op if already running or finished).
  - `update(carProgress: number)`: called each frame with the car's normalized progress (0..1) along the track curve (nearest-point projection onto the `CatmullRomCurve3`, reusing `curve.getPointAt`/closest-point search). Finishes the lap (stops timer) when progress wraps from near 1.0 back to near 0.0 **and** the car has covered at least e.g. 0.6 of the lap since starting (guards against falsely finishing by reversing over the line immediately).
  - `reset()`: stops and zeroes the timer, returns to "not started" state.
  - `getElapsedMs(): number` and `isFinished(): boolean` and `isRunning(): boolean` accessors.
- New module `src/ui/timerDisplay.ts` exporting a `TimerDisplay` class that creates and manages a plain HTML overlay element (absolutely positioned, top-left corner) showing `MM:SS.mmm`, turns text green and freezes when finished, shows a small "Press R to reset" hint once finished.
- `main.ts` wires: each frame, compute the car's normalized track progress (via a small helper on the road curve), feed it to `LapTimer.update()`, and refresh `TimerDisplay` from `LapTimer`'s current state. Timer starts automatically the first time `input.throttle > 0` (or brake, to allow reversing off the line) is detected.

## Reset (`R` key)

- `InputState` gains a `resetPressed: boolean` one-shot flag (true only on the frame `R` is pressed, consumed/cleared after read) alongside the existing continuous fields.
- On reset: teleport `chassisBody` back to the track's start position/rotation (same spawn logic used at startup — extracted into a reusable `getSpawnTransform(curve)` helper shared between initial spawn and reset), zero out linear and angular velocity, and call `LapTimer.reset()`.

## Graphics polish

- Enable `renderer.shadowMap.enabled = true` in `src/scene.ts`; configure the directional "sun" light to cast shadows (`sunLight.castShadow = true`, reasonable shadow camera frustum covering the track's larger extent).
- Set `castShadow`/`receiveShadow` on car body/wheel meshes, building meshes, and the ground/road meshes as appropriate (car and buildings cast; ground and road receive).
- Retune `MeshStandardMaterial` `roughness`/`metalness` values for car body, wheels, road, ground, and buildings so lighting reads with more depth (e.g. less uniformly flat-matte) while remaining flat-shaded/low-poly (no textures, no new geometry detail).

## Testing approach

- Unit tests (Vitest) for the new pure/testable logic: `engineForceForSpeed` (engine curve shape), `LapTimer` (start/update/finish/reset state machine using synthetic progress sequences, including the "must cover 0.6 of lap before finish counts" guard).
- Manual/automated verification: reuse the headless-Playwright drive-test approach from the initial build to confirm the car can complete a lap, the timer starts/stops correctly, `R` resets cleanly, and the stability properties (grounded wheels, no camera clipping) still hold on the new, longer track.

## Out of scope

- Branching track topology (single loop only, per the "longer single loop" decision)
- Point-to-point finish (lap-based finish only)
- 3D-scene-rendered timer (HTML overlay only)
- New textures, external models, or lighting beyond the existing hemisphere + directional sun setup
- Best-lap/leaderboard persistence across reloads
