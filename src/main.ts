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

  // @ts-expect-error debug hook for manual/automated verification, not part of the public API
  window.__debug = { car, camera, scene, curve, world, lapTimer };

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
