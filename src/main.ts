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
