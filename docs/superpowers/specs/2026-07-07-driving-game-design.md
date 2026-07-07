# 3D Driving Game — Design Spec

## Goal

A web-based 3D game where the player drives a car around a street loop. Priorities: smooth motion (no jitter, no frame-dependent physics) and good vehicle physics (real suspension/traction feel, not an arcade force hack).

## Stack

- **Rendering**: Three.js
- **Physics**: Rapier3D (`@dimforge/rapier3d-compat`, WASM), using its `RayVehicleController` for per-wheel raycast suspension and tire friction
- **Build/dev**: Vite + TypeScript
- **No backend, no multiplayer, no asset pipeline** — all meshes built procedurally from primitives (boxes, cylinders) using flat-shaded materials for a low-poly stylized look

## World

- A single road loop built from a spline (a few sweeping turns, not just an oval), rendered as a flat-shaded ribbon mesh with basic lane markings
- Low-poly scenery: buildings (boxes), trees/props scattered along the roadside, flat ground plane
- Invisible boundary colliders along the road edges / world extent so the player can't drive off into empty space
- Static Rapier colliders for the ground and any solid props (buildings) so the car can collide with them

## Car

- Body: a simple low-poly box-based car mesh (chassis + 4 wheel meshes), no external model files
- Physics: single rigid body chassis + Rapier `RayVehicleController` with 4 wheels
  - Tunable per-wheel suspension stiffness/damping/travel
  - Engine force applied to rear (or all) wheels, steering angle on front wheels
  - Handbrake reduces rear wheel friction for drifting
- Wheel meshes visually follow the raycast wheel state (suspension compression, steering angle, spin) each frame

## Controls

- W / Up: throttle
- S / Down: brake / reverse
- A/D or Left/Right: steer
- Space: handbrake

## Camera

- 3rd-person chase camera: positioned behind/above the car, spring-damped (critically damped lerp) toward target position and look-at point so it trails smoothly through turns and speed changes — no hard snapping or jitter

## Game loop

- `requestAnimationFrame` drives rendering every frame
- Physics stepped at a fixed timestep (e.g. 1/60s) via an accumulator pattern, decoupled from render framerate, so physics behavior is deterministic and smooth regardless of display refresh rate
- Render interpolates/uses latest physics state each frame

## Out of scope (for this pass)

- Multiplayer
- Lap timing / scoring / objectives
- Mobile touch controls
- Sound
- External 3D models/textures

## Testing approach

- Manual verification: run the dev server, drive the car in-browser, confirm smooth camera, responsive steering, believable suspension/traction, and that world boundaries hold
