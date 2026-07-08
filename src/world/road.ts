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
    new THREE.MeshStandardMaterial({ color: 0x444444, side: THREE.DoubleSide })
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
