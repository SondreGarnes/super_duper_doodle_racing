import { createScene } from './scene';
import { createPhysicsWorld, FixedTimestepAccumulator } from './physics';
import { createRoad } from './world/road';
// import { createScenery } from './world/scenery'; // TODO: uncomment once world/scenery.ts lands (Task 8)
import { InputState } from './car/input';
import { Car } from './car/car';
import { ChaseCamera } from './camera/chaseCamera';

const FIXED_DT = 1 / 60;

async function main() {
  const { scene, camera, renderer } = createScene();

  const world = await createPhysicsWorld();
  createRoad(scene, world);
  // createScenery(scene, world, curve); // TODO: uncomment once world/scenery.ts lands (Task 8)

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
