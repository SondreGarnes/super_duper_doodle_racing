# 3D Driving Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A web-based 3D game where the player drives a low-poly car around a street loop with smooth camera motion and realistic Rapier-driven vehicle physics.

**Architecture:** Vite + TypeScript app. Three.js owns rendering (scene/camera/meshes). Rapier3D (WASM, `@dimforge/rapier3d-compat`) owns physics, stepped on a fixed timestep via an accumulator decoupled from `requestAnimationFrame`. The car is a single rigid-body chassis driven by Rapier's `RayVehicleController` (4 wheels, raycast suspension). A spring-damped chase camera follows the chassis. The road is a spline-based ribbon mesh with a matching static collider; buildings/props are static boxes with matching Rapier colliders.

**Tech Stack:** Three.js, `@dimforge/rapier3d-compat`, Vite, TypeScript, Vitest (for pure-logic unit tests).

## Global Constraints

- No backend, no multiplayer, no external 3D model/texture assets — all meshes built from primitives (per spec).
- Physics must run on a fixed timestep (1/60s) via an accumulator, decoupled from render framerate (per spec).
- Controls: W/Up throttle, S/Down brake-reverse, A/D or Left/Right steer, Space handbrake (per spec).
- Camera: 3rd-person chase, spring-damped, no hard snapping (per spec).
- Visual style: low-poly, flat-shaded, bright colors (per spec).

---

## File Structure

- `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` — project scaffold
- `src/main.ts` — entry point: wires scene, physics, world, car, camera, input, and runs the render/physics loop
- `src/scene.ts` — Three.js `WebGLRenderer`, `Scene`, `PerspectiveCamera`, lighting, resize handling
- `src/physics.ts` — Rapier world init (async, since Rapier WASM loads async) + `FixedTimestepAccumulator` class for decoupled stepping
- `src/world/road.ts` — spline definition, road ribbon mesh, static road collider, boundary colliders
- `src/world/scenery.ts` — building/prop placement (boxes) with matching static colliders
- `src/car/car.ts` — `Car` class: chassis rigid body, `RayVehicleController` setup, wheel meshes, per-frame sync of wheel visuals to raycast state, `applyInput` method
- `src/car/input.ts` — `InputState` class: keyboard event listeners, exposes `{ throttle, brake, steer, handbrake }`
- `src/camera/chaseCamera.ts` — `ChaseCamera` class: pure spring-damper math (unit-testable) + Three.js camera update
- `tests/chaseCamera.test.ts` — unit tests for the spring-damper math
- `tests/physics.test.ts` — unit tests for the fixed-timestep accumulator

## Interfaces Contract (used across tasks)

- `FixedTimestepAccumulator.tick(deltaSeconds: number, stepFn: () => void): void` — calls `stepFn` zero or more times at fixed `dt`
- `Car.applyInput(input: { throttle: number; brake: number; steer: number; handbrake: boolean }): void`
- `Car.update(): void` — syncs wheel/chassis meshes to physics state, call once per render frame after physics step(s)
- `Car.chassisMesh: THREE.Group` — root mesh, camera target
- `ChaseCamera.update(targetPosition: THREE.Vector3, targetQuaternion: THREE.Quaternion, dt: number): void`
- `InputState.throttle/brake/steer: number` (each -1..1 or 0..1), `InputState.handbrake: boolean`

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/scene.ts`

**Interfaces:**
- Produces: `createScene(): { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer }` used by all later rendering tasks.

- [ ] **Step 1: Init package.json and install dependencies**

```bash
cd /Users/sondregarnaes/Documents/Game
npm init -y
npm install three @dimforge/rapier3d-compat
npm install -D typescript vite vitest @types/three
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
});
```

- [ ] **Step 4: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Driving Game</title>
    <style>
      html, body { margin: 0; padding: 0; overflow: hidden; height: 100%; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Write `src/scene.ts`**

```ts
import * as THREE from 'three';

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ecae6);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
  sunLight.position.set(20, 30, 10);
  scene.add(sunLight);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer };
}
```

- [ ] **Step 6: Write `src/main.ts` with a sanity-check spinning cube**

```ts
import * as THREE from 'three';
import { createScene } from './scene';

const { scene, camera, renderer } = createScene();

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xff5555 })
);
scene.add(cube);

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();
```

- [ ] **Step 7: Add npm scripts to `package.json`**

Edit `package.json` to add:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  }
}
```

- [ ] **Step 8: Verify it runs**

Run: `npm run dev` and open the printed local URL in a browser.
Expected: A sky-blue page with a red rotating cube. No console errors.

Stop the dev server (Ctrl+C) after confirming.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json index.html src/main.ts src/scene.ts
git commit -m "Scaffold Vite + Three.js project with sanity-check scene"
```

---

### Task 2: Fixed-timestep physics accumulator + Rapier world init

**Files:**
- Create: `src/physics.ts`
- Test: `tests/physics.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (pure logic + Rapier init)
- Produces: `FixedTimestepAccumulator` class used by `main.ts`'s render loop (Task 7); `createPhysicsWorld(): Promise<RAPIER.World>` used by Task 3+ for adding colliders/bodies.

- [ ] **Step 1: Write the failing test for the accumulator**

```ts
// tests/physics.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `src/physics.ts` does not export `FixedTimestepAccumulator` (module not found or undefined export).

- [ ] **Step 3: Write `src/physics.ts`**

```ts
import RAPIER from '@dimforge/rapier3d-compat';

export class FixedTimestepAccumulator {
  private accumulated = 0;

  constructor(private readonly fixedStep: number) {}

  tick(deltaSeconds: number, stepFn: () => void): void {
    this.accumulated += deltaSeconds;
    while (this.accumulated >= this.fixedStep) {
      stepFn();
      this.accumulated -= this.fixedStep;
    }
  }
}

export async function createPhysicsWorld(): Promise<RAPIER.World> {
  await RAPIER.init();
  const gravity = { x: 0.0, y: -9.81, z: 0.0 };
  return new RAPIER.World(gravity);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 3 tests in `tests/physics.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/physics.ts tests/physics.test.ts
git commit -m "Add fixed-timestep accumulator and Rapier world init"
```

---

### Task 3: Road world (spline mesh + colliders) and ground

**Files:**
- Create: `src/world/road.ts`

**Interfaces:**
- Consumes: `RAPIER.World` (from Task 2's `createPhysicsWorld`)
- Produces: `createRoad(scene: THREE.Scene, world: RAPIER.World): { curve: THREE.CatmullRomCurve3 }` — road mesh + ground plane added to scene, matching static colliders added to `world`. The returned `curve` is used by Task 8 (scenery placement) to scatter props alongside the road, and optionally by a future task to place the car's start position.

- [ ] **Step 1: Write `src/world/road.ts`**

```ts
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const ROAD_WIDTH = 8;
const ROAD_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(30, 0, -10),
  new THREE.Vector3(50, 0, -40),
  new THREE.Vector3(30, 0, -70),
  new THREE.Vector3(-10, 0, -80),
  new THREE.Vector3(-40, 0, -55),
  new THREE.Vector3(-40, 0, -15),
  new THREE.Vector3(-15, 0, 10),
];

export function createRoad(scene: THREE.Scene, world: RAPIER.World) {
  const curve = new THREE.CatmullRomCurve3(ROAD_POINTS, true, 'catmullrom', 0.5);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0x3a5f3a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(200, 0.05, 200).setTranslation(0, -0.1, 0),
    groundBody
  );

  const segments = 200;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const left = point.clone().addScaledVector(normal, ROAD_WIDTH / 2);
    const right = point.clone().addScaledVector(normal, -ROAD_WIDTH / 2);

    positions.push(left.x, 0.01, left.z, right.x, 0.01, right.z);

    if (i < segments) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = i * 2 + 2;
      const d = i * 2 + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const roadGeometry = new THREE.BufferGeometry();
  roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roadGeometry.setIndex(indices);
  roadGeometry.computeVertexNormals();

  const roadMesh = new THREE.Mesh(
    roadGeometry,
    new THREE.MeshStandardMaterial({ color: 0x444444 })
  );
  scene.add(roadMesh);

  const roadBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const vertices = new Float32Array(positions);
  const indexArray = new Uint32Array(indices);
  world.createCollider(
    RAPIER.ColliderDesc.trimesh(vertices, indexArray),
    roadBody
  );

  return { curve };
}
```

- [ ] **Step 2: Wire it into `src/main.ts` temporarily to visually verify**

Edit `src/main.ts`, replacing the sanity-check cube block with:

```ts
import * as THREE from 'three';
import { createScene } from './scene';
import { createPhysicsWorld } from './physics';
import { createRoad } from './world/road';

async function main() {
  const { scene, camera, renderer } = createScene();
  camera.position.set(0, 60, 60);
  camera.lookAt(0, 0, -30);

  const world = await createPhysicsWorld();
  createRoad(scene, world);

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
}

main();
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`, open the browser.
Expected: A top-down-ish view showing a dark gray winding road loop on a green ground plane, no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/world/road.ts src/main.ts
git commit -m "Add spline-based road mesh with matching Rapier colliders"
```

---

### Task 4: Keyboard input handling

**Files:**
- Create: `src/car/input.ts`

**Interfaces:**
- Produces: `InputState` class with fields `throttle: number` (0..1), `brake: number` (0..1), `steer: number` (-1..1), `handbrake: boolean`, consumed by `Car.applyInput` (Task 5) via `main.ts`'s loop (Task 7).

- [ ] **Step 1: Write `src/car/input.ts`**

```ts
export class InputState {
  throttle = 0;
  brake = 0;
  steer = 0;
  handbrake = false;

  private keys = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
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
  }
}
```

- [ ] **Step 2: Verify by type-checking**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/car/input.ts
git commit -m "Add keyboard input state tracking"
```

---

### Task 5: Car chassis + RayVehicleController

**Files:**
- Create: `src/car/car.ts`

**Interfaces:**
- Consumes: `RAPIER.World` (Task 2), `THREE.Scene` (Task 1), `InputState`-shaped object (Task 4)
- Produces: `Car` class:
  - `constructor(scene: THREE.Scene, world: RAPIER.World, startPos: { x: number; y: number; z: number })`
  - `applyInput(input: { throttle: number; brake: number; steer: number; handbrake: boolean }): void`
  - `update(): void` — call once per render frame after physics steps, syncs meshes to physics state
  - `chassisMesh: THREE.Group` — used as chase-camera target (Task 6/7)
  - `getChassisWorldPosition(): THREE.Vector3` and `getChassisWorldQuaternion(): THREE.Quaternion` — used by chase camera (Task 7)

- [ ] **Step 1: Write `src/car/car.ts`**

```ts
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const CHASSIS_HALF_EXTENTS = { x: 0.9, y: 0.4, z: 2.0 };
const WHEEL_RADIUS = 0.4;
const WHEEL_HALF_WIDTH = 0.2;
const SUSPENSION_REST_LENGTH = 0.35;
const MAX_ENGINE_FORCE = 1800;
const MAX_STEER_ANGLE = 0.5;
const MAX_BRAKE_FORCE = 40;

interface WheelDef {
  position: RAPIER.Vector3;
  isFront: boolean;
}

const WHEEL_DEFS: WheelDef[] = [
  { position: { x: -CHASSIS_HALF_EXTENTS.x, y: -0.2, z: -1.4 }, isFront: true },
  { position: { x: CHASSIS_HALF_EXTENTS.x, y: -0.2, z: -1.4 }, isFront: true },
  { position: { x: -CHASSIS_HALF_EXTENTS.x, y: -0.2, z: 1.4 }, isFront: false },
  { position: { x: CHASSIS_HALF_EXTENTS.x, y: -0.2, z: 1.4 }, isFront: false },
];

export class Car {
  chassisMesh: THREE.Group;
  private wheelMeshes: THREE.Mesh[] = [];
  private chassisBody: RAPIER.RigidBody;
  private vehicle: RAPIER.DynamicRayCastVehicleController;
  private world: RAPIER.World;

  constructor(
    scene: THREE.Scene,
    world: RAPIER.World,
    startPos: { x: number; y: number; z: number }
  ) {
    this.world = world;

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(startPos.x, startPos.y, startPos.z)
      .setLinearDamping(0.1)
      .setAngularDamping(0.5);
    this.chassisBody = world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      CHASSIS_HALF_EXTENTS.x,
      CHASSIS_HALF_EXTENTS.y,
      CHASSIS_HALF_EXTENTS.z
    ).setMass(150);
    world.createCollider(colliderDesc, this.chassisBody);

    this.vehicle = world.createVehicleController(this.chassisBody);

    for (const def of WHEEL_DEFS) {
      const suspensionDirection = { x: 0, y: -1, z: 0 };
      const axleDirection = { x: -1, y: 0, z: 0 };
      this.vehicle.addWheel(
        def.position,
        suspensionDirection,
        axleDirection,
        SUSPENSION_REST_LENGTH,
        WHEEL_RADIUS
      );
    }

    for (let i = 0; i < WHEEL_DEFS.length; i++) {
      this.vehicle.setWheelSuspensionStiffness(i, 24);
      this.vehicle.setWheelMaxSuspensionTravel(i, 0.3);
      this.vehicle.setWheelFrictionSlip(i, 2.5);
    }

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
  }

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

  update(): void {
    this.vehicle.updateVehicle(this.world.timestep);

    const translation = this.chassisBody.translation();
    const rotation = this.chassisBody.rotation();
    this.chassisMesh.position.set(translation.x, translation.y, translation.z);
    this.chassisMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

    for (let i = 0; i < WHEEL_DEFS.length; i++) {
      const wheelMesh = this.wheelMeshes[i];
      const connection = this.vehicle.wheelChassisConnectionPointCs(i)!;
      const suspensionLength = this.vehicle.wheelSuspensionLength(i) ?? SUSPENSION_REST_LENGTH;
      const steering = this.vehicle.wheelSteering(i) ?? 0;
      const rotationRad = this.vehicle.wheelRotation(i) ?? 0;

      const localPos = new THREE.Vector3(connection.x, connection.y - suspensionLength, connection.z);
      const worldPos = localPos.clone().applyQuaternion(this.chassisMesh.quaternion).add(this.chassisMesh.position);
      wheelMesh.position.copy(worldPos);

      const wheelQuat = new THREE.Quaternion()
        .setFromEuler(new THREE.Euler(0, steering, 0))
        .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationRad, 0, 0)));
      wheelMesh.quaternion.copy(this.chassisMesh.quaternion).multiply(wheelQuat);
      wheelMesh.rotateZ(Math.PI / 2);
    }
  }

  getChassisWorldPosition(): THREE.Vector3 {
    return this.chassisMesh.position.clone();
  }

  getChassisWorldQuaternion(): THREE.Quaternion {
    return this.chassisMesh.quaternion.clone();
  }
}
```

- [ ] **Step 2: Verify by type-checking**

Run: `npx tsc --noEmit`
Expected: No type errors. If Rapier's TypeScript types name methods differently (e.g. `wheelChassisConnectionPointCs` vs another casing), fix names to match `node_modules/@dimforge/rapier3d-compat/rapier.d.ts` — search it with `grep -i wheel node_modules/@dimforge/rapier3d-compat/rapier.d.ts` and align method names exactly.

- [ ] **Step 3: Commit**

```bash
git add src/car/car.ts
git commit -m "Add Car class with Rapier RayVehicleController"
```

---

### Task 6: Chase camera (spring-damped)

**Files:**
- Create: `src/camera/chaseCamera.ts`
- Test: `tests/chaseCamera.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks for the math core (pure); consumes `THREE.PerspectiveCamera` (Task 1) for the apply step
- Produces: `SpringDamper3` class (pure, unit-tested) and `ChaseCamera` class with `update(targetPosition: THREE.Vector3, targetQuaternion: THREE.Quaternion, dt: number): void`, used by `main.ts` (Task 7).

- [ ] **Step 1: Write the failing test for the spring-damper math**

```ts
// tests/chaseCamera.test.ts
import { describe, it, expect } from 'vitest';
import { SpringDamper3 } from '../src/camera/chaseCamera';
import * as THREE from 'three';

describe('SpringDamper3', () => {
  it('starts at the given initial position', () => {
    const spring = new SpringDamper3(new THREE.Vector3(1, 2, 3), 5, 1);
    expect(spring.position.equals(new THREE.Vector3(1, 2, 3))).toBe(true);
  });

  it('moves toward the target over time without overshooting wildly (critically damped)', () => {
    const spring = new SpringDamper3(new THREE.Vector3(0, 0, 0), 8, 1);
    const target = new THREE.Vector3(10, 0, 0);
    let lastDist = spring.position.distanceTo(target);
    for (let i = 0; i < 120; i++) {
      spring.update(target, 1 / 60);
      const dist = spring.position.distanceTo(target);
      expect(dist).toBeLessThanOrEqual(lastDist + 1e-6);
      lastDist = dist;
    }
    expect(spring.position.distanceTo(target)).toBeLessThan(0.05);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `src/camera/chaseCamera.ts` does not exist yet.

- [ ] **Step 3: Write `src/camera/chaseCamera.ts`**

```ts
import * as THREE from 'three';

// Critically damped spring: dampingRatio = 1 means no overshoot.
export class SpringDamper3 {
  position: THREE.Vector3;
  private velocity = new THREE.Vector3();

  constructor(
    initial: THREE.Vector3,
    private readonly stiffness: number,
    private readonly dampingRatio: number
  ) {
    this.position = initial.clone();
  }

  update(target: THREE.Vector3, dt: number): void {
    const damping = 2 * this.dampingRatio * Math.sqrt(this.stiffness);
    const displacement = this.position.clone().sub(target);
    const springForce = displacement.multiplyScalar(-this.stiffness);
    const dampingForce = this.velocity.clone().multiplyScalar(-damping);
    const acceleration = springForce.add(dampingForce);

    this.velocity.addScaledVector(acceleration, dt);
    this.position.addScaledVector(this.velocity, dt);
  }
}

const CAMERA_OFFSET = new THREE.Vector3(0, 3.5, -8);
const LOOK_AHEAD = new THREE.Vector3(0, 1, 3);

export class ChaseCamera {
  private positionSpring: SpringDamper3;
  private lookAtSpring: SpringDamper3;

  constructor(private readonly camera: THREE.PerspectiveCamera, initialTarget: THREE.Vector3) {
    this.positionSpring = new SpringDamper3(initialTarget.clone().add(CAMERA_OFFSET), 30, 1);
    this.lookAtSpring = new SpringDamper3(initialTarget.clone(), 40, 1);
  }

  update(targetPosition: THREE.Vector3, targetQuaternion: THREE.Quaternion, dt: number): void {
    const desiredCameraPos = targetPosition
      .clone()
      .add(CAMERA_OFFSET.clone().applyQuaternion(targetQuaternion));
    const desiredLookAt = targetPosition
      .clone()
      .add(LOOK_AHEAD.clone().applyQuaternion(targetQuaternion));

    this.positionSpring.update(desiredCameraPos, dt);
    this.lookAtSpring.update(desiredLookAt, dt);

    this.camera.position.copy(this.positionSpring.position);
    this.camera.lookAt(this.lookAtSpring.position);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — both tests in `tests/chaseCamera.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/camera/chaseCamera.ts tests/chaseCamera.test.ts
git commit -m "Add spring-damped chase camera"
```

---

### Task 7: Wire everything together in the main loop

**Files:**
- Modify: `src/main.ts` (full rewrite of the temporary Task 3 version)

**Interfaces:**
- Consumes: `createScene` (Task 1), `createPhysicsWorld` + `FixedTimestepAccumulator` (Task 2), `createRoad` (Task 3), `InputState` (Task 4), `Car` (Task 5), `ChaseCamera` (Task 6)

- [ ] **Step 1: Rewrite `src/main.ts`**

```ts
import { createScene } from './scene';
import { createPhysicsWorld, FixedTimestepAccumulator } from './physics';
import { createRoad } from './world/road';
import { createScenery } from './world/scenery';
import { InputState } from './car/input';
import { Car } from './car/car';
import { ChaseCamera } from './camera/chaseCamera';

const FIXED_DT = 1 / 60;

async function main() {
  const { scene, camera, renderer } = createScene();

  const world = await createPhysicsWorld();
  const { curve } = createRoad(scene, world);
  createScenery(scene, world, curve);

  const car = new Car(scene, world, { x: 0, y: 1, z: 0 });
  const input = new InputState();
  const chaseCamera = new ChaseCamera(camera, car.getChassisWorldPosition());
  const accumulator = new FixedTimestepAccumulator(FIXED_DT);

  let lastTime = performance.now();

  function animate(now: number) {
    requestAnimationFrame(animate);
    const deltaSeconds = Math.min((now - lastTime) / 1000, 0.25);
    lastTime = now;

    input.update();

    accumulator.tick(deltaSeconds, () => {
      car.applyInput(input);
      world.step();
    });

    car.update();
    chaseCamera.update(car.getChassisWorldPosition(), car.getChassisWorldQuaternion(), deltaSeconds);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}

main();
```

- [ ] **Step 2: Verify by type-checking**

Run: `npx tsc --noEmit`
Expected: No type errors (Task 8 must land first to provide `createScenery`; if running this task before Task 8, temporarily comment out the `createScenery` import/call, verify, then restore once Task 8 lands).

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "Wire scene, physics, road, car, input, and camera into main loop"
```

---

### Task 8: Scenery, boundaries, and manual drive test

**Files:**
- Create: `src/world/scenery.ts`

**Interfaces:**
- Consumes: `THREE.Scene`, `RAPIER.World`, `THREE.CatmullRomCurve3` (from Task 3's `createRoad`)
- Produces: `createScenery(scene: THREE.Scene, world: RAPIER.World, curve: THREE.CatmullRomCurve3): void`, called from `main.ts` (Task 7)

- [ ] **Step 1: Write `src/world/scenery.ts`**

```ts
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const BUILDING_COLORS = [0xe07a5f, 0xf2cc8f, 0x81b29a, 0x3d405b];
const PROP_COUNT = 40;
const OFFSET_RANGE = [10, 25];

export function createScenery(
  scene: THREE.Scene,
  world: RAPIER.World,
  curve: THREE.CatmullRomCurve3
): void {
  for (let i = 0; i < PROP_COUNT; i++) {
    const t = i / PROP_COUNT;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const side = i % 2 === 0 ? 1 : -1;
    const offset = OFFSET_RANGE[0] + Math.random() * (OFFSET_RANGE[1] - OFFSET_RANGE[0]);

    const position = point.clone().addScaledVector(normal, side * offset);
    const width = 3 + Math.random() * 4;
    const depth = 3 + Math.random() * 4;
    const height = 4 + Math.random() * 12;

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({
        color: BUILDING_COLORS[i % BUILDING_COLORS.length],
      })
    );
    mesh.position.set(position.x, height / 2, position.z);
    scene.add(mesh);

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, height / 2, position.z)
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2), body);
  }
}
```

- [ ] **Step 2: Restore `createScenery` wiring in `src/main.ts` if it was commented out in Task 7**

Confirm `src/main.ts` imports and calls `createScenery(scene, world, curve)` as written in Task 7 Step 1.

- [ ] **Step 3: Verify by type-checking**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 4: Manual drive test**

Run: `npm run dev`, open the browser.

Verify:
1. Car spawns on the road and is visible with 4 wheels.
2. Pressing W accelerates the car forward smoothly; releasing lets it coast/decelerate.
3. A/D or arrow keys steer left/right; the front wheels visually turn.
4. S brakes / reverses.
5. Space applies the handbrake and the rear wheels lose traction (car can slide/drift).
6. The chase camera follows smoothly through turns with no jitter or snapping.
7. The car collides with buildings/props instead of passing through them.
8. No console errors during driving.

- [ ] **Step 5: Commit**

```bash
git add src/world/scenery.ts src/main.ts
git commit -m "Add scenery/buildings with colliders; complete drivable loop"
```

---

## Self-Review Notes

- **Spec coverage:** Stack (Three.js+Rapier+Vite/TS) — Task 1/2. Road/world — Task 3. Car+physics — Task 5. Controls — Task 4/5. Camera — Task 6. Fixed-timestep loop — Task 2/7. Scenery/boundaries — Task 8. Low-poly style — flat primitive meshes throughout, no textures. All spec sections covered.
- **Placeholder scan:** No TBD/TODO markers; every step has complete code or an exact command with expected output.
- **Type consistency:** `Car.applyInput`, `Car.update`, `Car.chassisMesh`, `Car.getChassisWorldPosition/Quaternion` used identically across Task 5 and Task 7. `InputState` fields (`throttle`, `brake`, `steer`, `handbrake`) match between Task 4 and Task 5's `applyInput` signature. `FixedTimestepAccumulator.tick` signature matches between Task 2 and Task 7. `createRoad` returns `{ curve }` (Task 3), consumed by `createScenery` (Task 8) and passed through in Task 7.
