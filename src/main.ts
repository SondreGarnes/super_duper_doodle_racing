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
