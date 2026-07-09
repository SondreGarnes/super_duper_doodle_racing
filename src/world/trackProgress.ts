import * as THREE from 'three';

const PROGRESS_SAMPLES = 200;
const REFINE_STEPS = 8;

export interface TrackLocation {
  progress: number;
  distance: number;
}

// Locates the car relative to a closed track curve: normalized progress (0..1)
// plus distance from the road centerline. The coarse pass (1/200 resolution) is
// fine for lap timing, but distance needs a local refinement pass — at ~4 m
// sample spacing the nearest-sample distance can overestimate by a couple of
// meters, which matters for off-road detection.
export function getTrackLocation(
  curve: THREE.CatmullRomCurve3,
  position: THREE.Vector3
): TrackLocation {
  let closestIndex = 0;
  let closestDistSq = Infinity;

  for (let i = 0; i < PROGRESS_SAMPLES; i++) {
    const point = curve.getPointAt(i / PROGRESS_SAMPLES);
    const distSq = point.distanceToSquared(position);
    if (distSq < closestDistSq) {
      closestDistSq = distSq;
      closestIndex = i;
    }
  }

  let bestT = closestIndex / PROGRESS_SAMPLES;
  for (let j = 1; j <= REFINE_STEPS; j++) {
    for (const direction of [-1, 1]) {
      const t =
        (closestIndex + (direction * j) / REFINE_STEPS + PROGRESS_SAMPLES) % PROGRESS_SAMPLES /
        PROGRESS_SAMPLES;
      const distSq = curve.getPointAt(t).distanceToSquared(position);
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        bestT = t;
      }
    }
  }

  return { progress: bestT, distance: Math.sqrt(closestDistSq) };
}

// Back-compat helper used by lap timing.
export function getTrackProgress(curve: THREE.CatmullRomCurve3, position: THREE.Vector3): number {
  return getTrackLocation(curve, position).progress;
}
