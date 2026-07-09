import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const ROAD_WIDTH = 8;
const ROAD_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(45, 0, 2),
  new THREE.Vector3(90, 0, 0),
  new THREE.Vector3(125, 0, -20),
  new THREE.Vector3(145, 0, -55),
  new THREE.Vector3(140, 0, -95),
  new THREE.Vector3(110, 0, -125),
  new THREE.Vector3(65, 0, -135),
  new THREE.Vector3(25, 0, -115),
  new THREE.Vector3(10, 0, -85),
  new THREE.Vector3(35, 0, -60),
  new THREE.Vector3(15, 0, -30),
  new THREE.Vector3(-25, 0, -20),
  new THREE.Vector3(-65, 0, -35),
  new THREE.Vector3(-100, 0, -65),
  new THREE.Vector3(-120, 0, -100),
  new THREE.Vector3(-110, 0, -140),
  new THREE.Vector3(-70, 0, -155),
  new THREE.Vector3(-25, 0, -140),
  new THREE.Vector3(-5, 0, -100),
  new THREE.Vector3(-15, 0, -50),
  new THREE.Vector3(-20, 0, -20),
];

export function createRoad(scene: THREE.Scene, world: RAPIER.World) {
  const curve = new THREE.CatmullRomCurve3(ROAD_POINTS, true, 'catmullrom', 0.5);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1800, 1800),
    new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(450, 0.05, 450).setTranslation(0, -0.1, 0),
    groundBody
  );

  const segments = 200;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  // One texture tile per ~8 m of track keeps the center-line dashes road-scaled.
  const textureTiles = Math.round(curve.getLength() / 8);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const left = point.clone().addScaledVector(normal, ROAD_WIDTH / 2);
    const right = point.clone().addScaledVector(normal, -ROAD_WIDTH / 2);

    positions.push(left.x, 0.01, left.z, right.x, 0.01, right.z);
    uvs.push(0, t * textureTiles, 1, t * textureTiles);

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
  roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roadGeometry.setIndex(indices);
  roadGeometry.computeVertexNormals();

  const roadMesh = new THREE.Mesh(
    roadGeometry,
    new THREE.MeshStandardMaterial({
      map: makeAsphaltTexture(),
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0,
    })
  );
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);

  createKerbs(scene, curve, segments);

  const roadBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const vertices = new Float32Array(positions);
  const indexArray = new Uint32Array(indices);
  world.createCollider(
    RAPIER.ColliderDesc.trimesh(vertices, indexArray),
    roadBody
  );

  return { curve };
}

// Asphalt with speckle noise, solid white edge lines, and a dashed center line.
// u runs across the road, v along it; one tile = one dash cycle.
function makeAsphaltTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3c3c40';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const shade = 46 + Math.floor(Math.random() * 34);
    ctx.fillStyle = `rgb(${shade},${shade},${shade + 3})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }

  ctx.fillStyle = 'rgba(240,240,240,0.9)';
  ctx.fillRect(6, 0, 5, size);
  ctx.fillRect(size - 11, 0, 5, size);
  ctx.fillRect(size / 2 - 3, 0, 6, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

// Two-tone grass noise so the huge ground plane doesn't read as one flat color.
function makeGrassTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#41693f';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3200; i++) {
    const g = 90 + Math.floor(Math.random() * 32);
    ctx.fillStyle = `rgb(${g - 40},${g},${g - 42})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 3, 3);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(90, 90);
  texture.anisotropy = 4;
  return texture;
}

// Red/white striped kerb ribbons along both road edges, colored per-vertex so a
// single mesh per side renders the alternating pattern.
function createKerbs(scene: THREE.Scene, curve: THREE.CatmullRomCurve3, segments: number): void {
  const KERB_WIDTH = 0.9;
  const red = new THREE.Color(0xd93025);
  const white = new THREE.Color(0xf5f5f5);

  for (const dir of [1, -1]) {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const inner = point.clone().addScaledVector(normal, dir * (ROAD_WIDTH / 2));
      const outer = point.clone().addScaledVector(normal, dir * (ROAD_WIDTH / 2 + KERB_WIDTH));

      positions.push(inner.x, 0.015, inner.z, outer.x, 0.015, outer.z);
      const color = Math.floor(i / 2) % 2 === 0 ? red : white;
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);

      if (i < segments) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0,
      })
    );
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}

export function getSpawnTransform(curve: THREE.CatmullRomCurve3): {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
} {
  const point = curve.getPointAt(0);
  const tangent = curve.getTangentAt(0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
  return { position: new THREE.Vector3(point.x, point.y + 1, point.z), quaternion };
}
