import * as THREE from 'three';

const GATE_HALF_SPAN = 5.5;
const PYLON_HEIGHT = 4;
const PENDING_COLOR = 0x38bdf8;
const PASSED_COLOR = 0x4ade80;

export interface CheckpointGate {
  setPassed(passed: boolean): void;
}

// Builds a glowing arch (two pylons + overhead beam) across the road at each
// checkpoint fraction. Returned gates can be tinted green once passed.
export function createCheckpointGates(
  scene: THREE.Scene,
  curve: THREE.CatmullRomCurve3,
  fractions: number[]
): CheckpointGate[] {
  return fractions.map((t) => {
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color: PENDING_COLOR,
      emissive: PENDING_COLOR,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    });

    const pylonGeometry = new THREE.CylinderGeometry(0.18, 0.24, PYLON_HEIGHT, 12);
    for (const dir of [1, -1]) {
      const pylon = new THREE.Mesh(pylonGeometry, material);
      pylon.position
        .copy(point)
        .addScaledVector(side, dir * GATE_HALF_SPAN)
        .setY(PYLON_HEIGHT / 2);
      pylon.castShadow = true;
      group.add(pylon);
    }

    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(GATE_HALF_SPAN * 2, 0.3, 0.3),
      material
    );
    beam.position.copy(point).setY(PYLON_HEIGHT);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), side);
    beam.castShadow = true;
    group.add(beam);

    scene.add(group);

    return {
      setPassed(passed: boolean) {
        const color = passed ? PASSED_COLOR : PENDING_COLOR;
        material.color.setHex(color);
        material.emissive.setHex(color);
      },
    };
  });
}

// Start/finish gantry: two solid towers and a checkered banner across the road.
export function createStartGantry(scene: THREE.Scene, curve: THREE.CatmullRomCurve3): void {
  const point = curve.getPointAt(0);
  const tangent = curve.getTangentAt(0);
  const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

  // Tall enough that the chase camera never sits inside the banner at lap start.
  const towerMaterial = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 });
  const towerGeometry = new THREE.BoxGeometry(0.6, 8.5, 0.6);
  for (const dir of [1, -1]) {
    const tower = new THREE.Mesh(towerGeometry, towerMaterial);
    tower.position
      .copy(point)
      .addScaledVector(side, dir * (GATE_HALF_SPAN + 0.5))
      .setY(4.25);
    tower.castShadow = true;
    scene.add(tower);
  }

  const banner = new THREE.Mesh(
    new THREE.BoxGeometry((GATE_HALF_SPAN + 0.5) * 2, 1.3, 0.2),
    new THREE.MeshStandardMaterial({ map: makeCheckerTexture(), roughness: 0.6 })
  );
  banner.position.copy(point).setY(7.6);
  banner.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), side);
  banner.castShadow = true;
  scene.add(banner);

  // Checkered start line painted on the road surface.
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(GATE_HALF_SPAN * 2, 0.02, 2),
    new THREE.MeshStandardMaterial({ map: makeCheckerTexture(), roughness: 0.9 })
  );
  line.position.copy(point).setY(0.02);
  line.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), side);
  line.receiveShadow = true;
  scene.add(line);
}

function makeCheckerTexture(): THREE.CanvasTexture {
  const size = 64;
  const cell = 8;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  for (let y = 0; y < size / cell; y++) {
    for (let x = 0; x < size / cell; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#111111';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  return texture;
}
