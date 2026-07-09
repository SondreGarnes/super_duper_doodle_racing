import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getTrackProgress, getTrackLocation } from '../src/world/trackProgress';

function makeTestCurve(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(20, 0, 0),
      new THREE.Vector3(20, 0, 20),
      new THREE.Vector3(0, 0, 20),
    ],
    true,
    'catmullrom',
    0.5
  );
}

describe('getTrackProgress', () => {
  it('returns ~0 for a position at the start of the curve', () => {
    const curve = makeTestCurve();
    const progress = getTrackProgress(curve, curve.getPointAt(0));
    expect(progress).toBeLessThan(0.01);
  });

  it('returns the matching progress value for a point sampled mid-curve', () => {
    const curve = makeTestCurve();
    const target = curve.getPointAt(0.4);
    const progress = getTrackProgress(curve, target);
    expect(progress).toBeCloseTo(0.4, 1);
  });

  it('wraps back toward 0 for a position near the end of the closed loop', () => {
    const curve = makeTestCurve();
    const target = curve.getPointAt(0.98);
    const progress = getTrackProgress(curve, target);
    expect(progress).toBeGreaterThan(0.9);
  });
});

describe('getTrackLocation', () => {
  it('reports near-zero distance for a point on the centerline', () => {
    const curve = makeTestCurve();
    const { distance } = getTrackLocation(curve, curve.getPointAt(0.37));
    expect(distance).toBeLessThan(0.3);
  });

  it('reports the lateral offset for a point beside the track', () => {
    const curve = makeTestCurve();
    const point = curve.getPointAt(0.4);
    const tangent = curve.getTangentAt(0.4);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const offset = point.clone().addScaledVector(normal, 6);
    const { distance, progress } = getTrackLocation(curve, offset);
    expect(distance).toBeGreaterThan(5.3);
    expect(distance).toBeLessThan(6.7);
    expect(progress).toBeCloseTo(0.4, 1);
  });
});
