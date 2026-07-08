import * as THREE from 'three';

const PROGRESS_SAMPLES = 200;

// Returns the car's normalized progress (0..1) around a closed track curve, found via
// nearest-sample projection. Sample resolution (1/200) is sufficient for lap timing.
export function getTrackProgress(curve: THREE.CatmullRomCurve3, position: THREE.Vector3): number {
  let closestT = 0;
  let closestDistSq = Infinity;

  for (let i = 0; i < PROGRESS_SAMPLES; i++) {
    const t = i / PROGRESS_SAMPLES;
    const point = curve.getPointAt(t);
    const distSq = point.distanceToSquared(position);
    if (distSq < closestDistSq) {
      closestDistSq = distSq;
      closestT = t;
    }
  }

  return closestT;
}
