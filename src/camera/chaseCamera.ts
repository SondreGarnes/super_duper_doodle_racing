import * as THREE from 'three';

// Critically damped spring: dampingRatio = 1 means no overshoot.
export class SpringDamper3 {
  position: THREE.Vector3;
  private velocity = new THREE.Vector3();

  constructor(
    initial: THREE.Vector3,
    private readonly stiffness: number,
    private readonly dampingRatio: number
  ) {
    this.position = initial.clone();
  }

  update(target: THREE.Vector3, dt: number): void {
    const damping = 2 * this.dampingRatio * Math.sqrt(this.stiffness);
    const displacement = this.position.clone().sub(target);
    const springForce = displacement.multiplyScalar(-this.stiffness);
    const dampingForce = this.velocity.clone().multiplyScalar(-damping);
    const acceleration = springForce.add(dampingForce);

    this.velocity.addScaledVector(acceleration, dt);
    this.position.addScaledVector(this.velocity, dt);
  }
}

const CAMERA_OFFSET = new THREE.Vector3(0, 3.5, -8);
const LOOK_AHEAD = new THREE.Vector3(0, 1, 3);
const MIN_CAMERA_HEIGHT_ABOVE_TARGET = 1;

// Extracts only the yaw (rotation about world +Y) from a quaternion, discarding pitch/roll.
// The chase camera must never bank, tilt, or dive underground when the chassis pitches or
// rolls (e.g. from a bump or collision) — only its heading should steer the camera.
function yawOnly(quaternion: THREE.Quaternion): THREE.Quaternion {
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
  const yaw = Math.atan2(forward.x, forward.z);
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

export class ChaseCamera {
  private positionSpring: SpringDamper3;
  private lookAtSpring: SpringDamper3;

  constructor(private readonly camera: THREE.PerspectiveCamera, initialTarget: THREE.Vector3) {
    this.positionSpring = new SpringDamper3(initialTarget.clone().add(CAMERA_OFFSET), 30, 1);
    this.lookAtSpring = new SpringDamper3(initialTarget.clone(), 40, 1);
  }

  update(targetPosition: THREE.Vector3, targetQuaternion: THREE.Quaternion, dt: number): void {
    const heading = yawOnly(targetQuaternion);
    const desiredCameraPos = targetPosition.clone().add(CAMERA_OFFSET.clone().applyQuaternion(heading));
    const desiredLookAt = targetPosition.clone().add(LOOK_AHEAD.clone().applyQuaternion(heading));

    this.positionSpring.update(desiredCameraPos, dt);
    this.lookAtSpring.update(desiredLookAt, dt);

    const minHeight = targetPosition.y + MIN_CAMERA_HEIGHT_ABOVE_TARGET;
    this.camera.position.copy(this.positionSpring.position);
    this.camera.position.y = Math.max(this.camera.position.y, minHeight);
    this.camera.lookAt(this.lookAtSpring.position);
  }
}
