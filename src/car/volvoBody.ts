import * as THREE from 'three';

// A Volvo 240 sedan built from boxes — fitting, since so is the real one.
// Local space matches the physics chassis: +Z forward, footprint ~1.8 x 4.0 m,
// visual beltline near y=0, roof around y=+0.55.

const BODY_COLOR = 0xc23b36; // classic Volvo red, brightened to survive ACES tone mapping
const TRIM_COLOR = 0x1a1a1a;
const GLASS_COLOR = 0x8fb6cf;
const CHROME_COLOR = 0xcccccc;

export function createVolvoBody(): { group: THREE.Group; boostGlow: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: BODY_COLOR,
    roughness: 0.35,
    metalness: 0.25,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: TRIM_COLOR, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: GLASS_COLOR,
    roughness: 0.08,
    metalness: 0.4,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: CHROME_COLOR,
    roughness: 0.25,
    metalness: 0.9,
  });

  const add = (
    geometry: THREE.BoxGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // Lower body: one slab from bumper to bumper up to the beltline.
  add(new THREE.BoxGeometry(1.76, 0.52, 4.0), bodyMat, 0, -0.08, 0);

  // Hood and trunk lids sit just above the slab so the panel lines read.
  add(new THREE.BoxGeometry(1.6, 0.06, 1.05), bodyMat, 0, 0.21, 1.42);
  add(new THREE.BoxGeometry(1.6, 0.06, 0.85), bodyMat, 0, 0.21, -1.5);

  // Greenhouse: glass band with a body-colored roof panel, set slightly rearward
  // like the real 240's cabin.
  add(new THREE.BoxGeometry(1.58, 0.36, 1.9), glassMat, 0, 0.36, -0.15);
  add(new THREE.BoxGeometry(1.64, 0.07, 1.95), bodyMat, 0, 0.57, -0.15);
  // Pillars: A/B/C uprights so the glass doesn't read as one bubble.
  for (const z of [0.78, 0.05, -1.06]) {
    for (const x of [-0.79, 0.79]) {
      add(new THREE.BoxGeometry(0.06, 0.36, 0.1), bodyMat, x, 0.36, z);
    }
  }

  // The 240's trademark giant black bumpers, wrapped slightly past the body.
  add(new THREE.BoxGeometry(1.86, 0.16, 0.22), trimMat, 0, -0.22, 2.02);
  add(new THREE.BoxGeometry(1.86, 0.16, 0.22), trimMat, 0, -0.22, -2.02);

  // Black rubbing strip along each flank.
  add(new THREE.BoxGeometry(0.03, 0.07, 3.6), trimMat, -0.895, -0.12, 0);
  add(new THREE.BoxGeometry(0.03, 0.07, 3.6), trimMat, 0.895, -0.12, 0);

  // Front fascia: chrome-framed black grille flanked by rectangular headlights.
  add(new THREE.BoxGeometry(0.5, 0.2, 0.05), chromeMat, 0, 0.02, 2.0);
  add(new THREE.BoxGeometry(0.42, 0.14, 0.06), trimMat, 0, 0.02, 2.01);
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff6cc,
    emissiveIntensity: 0.35,
    roughness: 0.3,
  });
  add(new THREE.BoxGeometry(0.36, 0.14, 0.05), headlightMat, -0.55, 0.02, 2.0);
  add(new THREE.BoxGeometry(0.36, 0.14, 0.05), headlightMat, 0.55, 0.02, 2.0);

  // Tall wrap-around taillights.
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xb01020,
    emissive: 0x800812,
    emissiveIntensity: 0.5,
    roughness: 0.4,
  });
  add(new THREE.BoxGeometry(0.44, 0.2, 0.05), taillightMat, -0.6, 0.04, -2.0);
  add(new THREE.BoxGeometry(0.44, 0.2, 0.05), taillightMat, 0.6, 0.04, -2.0);

  // Twin exhaust tips that double as the boost glow.
  const boostGlow = new THREE.MeshStandardMaterial({
    color: 0x333333,
    emissive: 0x000000,
    roughness: 0.5,
    metalness: 0.7,
  });
  add(new THREE.BoxGeometry(0.12, 0.1, 0.14), boostGlow, -0.45, -0.32, -2.04);
  add(new THREE.BoxGeometry(0.12, 0.1, 0.14), boostGlow, 0.45, -0.32, -2.04);

  // Side mirrors.
  add(new THREE.BoxGeometry(0.12, 0.1, 0.06), trimMat, -0.94, 0.24, 0.72);
  add(new THREE.BoxGeometry(0.12, 0.1, 0.06), trimMat, 0.94, 0.24, 0.72);

  return { group, boostGlow };
}

// Flame-orange emissive while boosting, back to plain steel when idle.
export function setBoostGlow(material: THREE.MeshStandardMaterial, boosting: boolean): void {
  material.emissive.setHex(boosting ? 0xff6a00 : 0x000000);
  material.emissiveIntensity = boosting ? 2.5 : 0;
}
