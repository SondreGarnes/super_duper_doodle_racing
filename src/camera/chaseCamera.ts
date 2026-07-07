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

export class ChaseCamera {
  private positionSpring: SpringDamper3;
  private lookAtSpring: SpringDamper3;

  constructor(private readonly camera: THREE.PerspectiveCamera, initialTarget: THREE.Vector3) {
    this.positionSpring = new SpringDamper3(initialTarget.clone().add(CAMERA_OFFSET), 30, 1);
    this.lookAtSpring = new SpringDamper3(initialTarget.clone(), 40, 1);
  }

  update(targetPosition: THREE.Vector3, targetQuaternion: THREE.Quaternion, dt: number): void {
    const desiredCameraPos = targetPosition
      .clone()
      .add(CAMERA_OFFSET.clone().applyQuaternion(targetQuaternion));
    const desiredLookAt = targetPosition
      .clone()
      .add(LOOK_AHEAD.clone().applyQuaternion(targetQuaternion));

    this.positionSpring.update(desiredCameraPos, dt);
    this.lookAtSpring.update(desiredLookAt, dt);

    this.camera.position.copy(this.positionSpring.position);
    this.camera.lookAt(this.lookAtSpring.position);
  }
}
