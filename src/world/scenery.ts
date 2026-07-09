import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const BUILDING_COLORS = [0xe07a5f, 0xf2cc8f, 0x81b29a, 0x3d405b];
const CANOPY_COLORS = [0x2d5a27, 0x38702f, 0x1f4d22];
const PROP_COUNT = 110;
const OFFSET_RANGE = [12, 30];

export function createScenery(
  scene: THREE.Scene,
  world: RAPIER.World,
  curve: THREE.CatmullRomCurve3
): void {
  // The track loops close to itself, so an offset from one section can land on
  // another. Reject any prop position too close to ANY point on the curve.
  const ROAD_CLEARANCE = 11;
  const roadSamples: THREE.Vector3[] = [];
  for (let i = 0; i < 300; i++) {
    roadSamples.push(curve.getPointAt(i / 300));
  }
  const isClearOfRoad = (position: THREE.Vector3) =>
    roadSamples.every((sample) => sample.distanceToSquared(position) > ROAD_CLEARANCE ** 2);

  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5c4326, roughness: 0.9 });
  const canopyMaterials = CANOPY_COLORS.map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true })
  );

  for (let i = 0; i < PROP_COUNT; i++) {
    const t = i / PROP_COUNT;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const side = i % 2 === 0 ? 1 : -1;
    const offset = OFFSET_RANGE[0] + Math.random() * (OFFSET_RANGE[1] - OFFSET_RANGE[0]);
    const position = point.clone().addScaledVector(normal, side * offset);
    if (!isClearOfRoad(position)) continue;

    // Roughly one building for every two trees: a village along a forest road.
    if (i % 3 === 0) {
      createBuilding(scene, world, position, i);
    } else {
      createTree(scene, world, position, trunkMaterial, canopyMaterials[i % canopyMaterials.length]);
    }
  }

  createMountainRing(scene);
}

function createBuilding(
  scene: THREE.Scene,
  world: RAPIER.World,
  position: THREE.Vector3,
  seed: number
): void {
  const width = 4 + Math.random() * 4;
  const depth = 4 + Math.random() * 4;
  const height = 3.5 + Math.random() * 6;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color: BUILDING_COLORS[seed % BUILDING_COLORS.length],
      roughness: 0.7,
      metalness: 0.05,
    })
  );
  mesh.position.set(position.x, height / 2, position.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Simple gabled roof cap so the boxes read as houses.
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(width, depth) * 0.72, 1.6, 4),
    new THREE.MeshStandardMaterial({ color: 0x7a3b2e, roughness: 0.8, flatShading: true })
  );
  roof.position.set(position.x, height + 0.8, position.z);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  scene.add(roof);

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, height / 2, position.z)
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2), body);
}

function createTree(
  scene: THREE.Scene,
  world: RAPIER.World,
  position: THREE.Vector3,
  trunkMaterial: THREE.MeshStandardMaterial,
  canopyMaterial: THREE.MeshStandardMaterial
): void {
  const scale = 0.8 + Math.random() * 0.7;
  const trunkHeight = 1.6 * scale;

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14 * scale, 0.2 * scale, trunkHeight, 7),
    trunkMaterial
  );
  trunk.position.set(position.x, trunkHeight / 2, position.z);
  trunk.castShadow = true;
  scene.add(trunk);

  let y = trunkHeight;
  for (const [radius, coneHeight] of [
    [1.5, 2.2],
    [1.15, 1.8],
    [0.75, 1.5],
  ]) {
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(radius * scale, coneHeight * scale, 8),
      canopyMaterial
    );
    canopy.position.set(position.x, y + (coneHeight * scale) / 2, position.z);
    canopy.castShadow = true;
    scene.add(canopy);
    y += coneHeight * scale * 0.62;
  }

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, trunkHeight / 2, position.z)
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.2 * scale, trunkHeight / 2, 0.2 * scale), body);
}

// Distant cone mountains around the horizon; the fog fades them into the sky.
function createMountainRing(scene: THREE.Scene): void {
  const material = new THREE.MeshStandardMaterial({
    color: 0x6b7f96,
    roughness: 1,
    flatShading: true,
  });
  const count = 16;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.25;
    const radius = 520 + Math.random() * 180;
    const height = 70 + Math.random() * 90;
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(height * (1.3 + Math.random() * 0.6), height, 7),
      material
    );
    mountain.position.set(Math.cos(angle) * radius, height / 2 - 4, Math.sin(angle) * radius - 70);
    scene.add(mountain);
  }
}
