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
