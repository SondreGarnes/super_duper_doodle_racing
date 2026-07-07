import { describe, it, expect } from 'vitest';
import { SpringDamper3 } from '../src/camera/chaseCamera';
import * as THREE from 'three';

describe('SpringDamper3', () => {
  it('starts at the given initial position', () => {
    const spring = new SpringDamper3(new THREE.Vector3(1, 2, 3), 5, 1);
    expect(spring.position.equals(new THREE.Vector3(1, 2, 3))).toBe(true);
  });

  it('moves toward the target over time without overshooting wildly (critically damped)', () => {
    const spring = new SpringDamper3(new THREE.Vector3(0, 0, 0), 8, 1);
    const target = new THREE.Vector3(10, 0, 0);
    let lastDist = spring.position.distanceTo(target);
    for (let i = 0; i < 200; i++) {
      spring.update(target, 1 / 60);
      const dist = spring.position.distanceTo(target);
      expect(dist).toBeLessThanOrEqual(lastDist + 1e-6);
      lastDist = dist;
    }
    expect(spring.position.distanceTo(target)).toBeLessThan(0.05);
  });
});
