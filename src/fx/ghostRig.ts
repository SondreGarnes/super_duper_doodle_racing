import * as THREE from 'three';
import { createVolvoBody } from '../car/volvoBody';
import { GhostPose } from '../game/ghost';

// The best-lap ghost: the same Volvo silhouette rendered as a single translucent
// hologram material, no shadows, hidden whenever there is no pose to show.
export class GhostRig {
  private group: THREE.Group;

  constructor(scene: THREE.Scene) {
    const { group } = createVolvoBody();
    const hologram = new THREE.MeshStandardMaterial({
      color: 0xa5d8ff,
      transparent: true,
      opacity: 0.3,
      roughness: 0.4,
      metalness: 0.1,
      depthWrite: false,
    });
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = hologram;
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
    this.group = group;
    this.group.visible = false;
    scene.add(this.group);
  }

  isVisible(): boolean {
    return this.group.visible;
  }

  setPose(pose: GhostPose | null): void {
    if (!pose) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.group.position.set(pose.x, pose.y, pose.z);
    this.group.quaternion.set(pose.qx, pose.qy, pose.qz, pose.qw);
  }
}
