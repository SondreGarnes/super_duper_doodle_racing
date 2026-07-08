import * as THREE from 'three';
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

  // The vehicle's engine drives it along its local +Z axis, so align spawn rotation
  // with the road's initial tangent to avoid launching the car off the road.
  const spawnPoint = curve.getPointAt(0);
  const spawnTangent = curve.getTangentAt(0);
  const spawnQuaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    spawnTangent
  );

  const car = new Car(
    scene,
    world,
    { x: spawnPoint.x, y: spawnPoint.y + 1, z: spawnPoint.z },
    { x: spawnQuaternion.x, y: spawnQuaternion.y, z: spawnQuaternion.z, w: spawnQuaternion.w }
  );
  const input = new InputState();
  const chaseCamera = new ChaseCamera(camera, car.getChassisWorldPosition());
  const accumulator = new FixedTimestepAccumulator(FIXED_DT);

  // @ts-expect-error debug hook for manual/automated verification, not part of the public API
  window.__debug = { car, camera, scene, curve, world };

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
