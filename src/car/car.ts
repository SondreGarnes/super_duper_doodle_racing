import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const CHASSIS_HALF_EXTENTS = { x: 0.9, y: 0.4, z: 2.0 };
const WHEEL_RADIUS = 0.4;
const WHEEL_HALF_WIDTH = 0.2;
const SUSPENSION_REST_LENGTH = 0.35;
const MAX_ENGINE_FORCE = 1800;
const MAX_STEER_ANGLE = 0.5;
const MAX_BRAKE_FORCE = 40;

interface WheelDef {
  position: RAPIER.Vector3;
  isFront: boolean;
}

const WHEEL_DEFS: WheelDef[] = [
  { position: { x: -CHASSIS_HALF_EXTENTS.x, y: -0.2, z: -1.4 }, isFront: true },
  { position: { x: CHASSIS_HALF_EXTENTS.x, y: -0.2, z: -1.4 }, isFront: true },
  { position: { x: -CHASSIS_HALF_EXTENTS.x, y: -0.2, z: 1.4 }, isFront: false },
  { position: { x: CHASSIS_HALF_EXTENTS.x, y: -0.2, z: 1.4 }, isFront: false },
];

export class Car {
  chassisMesh: THREE.Group;
  private wheelMeshes: THREE.Mesh[] = [];
  private chassisBody: RAPIER.RigidBody;
  private vehicle: RAPIER.DynamicRayCastVehicleController;
  private world: RAPIER.World;

  constructor(
    scene: THREE.Scene,
    world: RAPIER.World,
    startPos: { x: number; y: number; z: number }
  ) {
    this.world = world;

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(startPos.x, startPos.y, startPos.z)
      .setLinearDamping(0.1)
      .setAngularDamping(0.5);
    this.chassisBody = world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      CHASSIS_HALF_EXTENTS.x,
      CHASSIS_HALF_EXTENTS.y,
      CHASSIS_HALF_EXTENTS.z
    ).setMass(150);
    world.createCollider(colliderDesc, this.chassisBody);

    this.vehicle = world.createVehicleController(this.chassisBody);

    for (const def of WHEEL_DEFS) {
      const suspensionDirection = { x: 0, y: -1, z: 0 };
      const axleDirection = { x: -1, y: 0, z: 0 };
      this.vehicle.addWheel(
        def.position,
        suspensionDirection,
        axleDirection,
        SUSPENSION_REST_LENGTH,
        WHEEL_RADIUS
      );
    }

    for (let i = 0; i < WHEEL_DEFS.length; i++) {
      this.vehicle.setWheelSuspensionStiffness(i, 24);
      this.vehicle.setWheelMaxSuspensionTravel(i, 0.3);
      this.vehicle.setWheelFrictionSlip(i, 2.5);
    }

    this.chassisMesh = new THREE.Group();
    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        CHASSIS_HALF_EXTENTS.x * 2,
        CHASSIS_HALF_EXTENTS.y * 2,
        CHASSIS_HALF_EXTENTS.z * 2
      ),
      new THREE.MeshStandardMaterial({ color: 0xdd2222 })
    );
    this.chassisMesh.add(bodyMesh);
    scene.add(this.chassisMesh);

    for (const def of WHEEL_DEFS) {
      const wheelMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_HALF_WIDTH * 2, 16),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
      );
      wheelMesh.rotation.z = Math.PI / 2;
      scene.add(wheelMesh);
      this.wheelMeshes.push(wheelMesh);
    }
  }

  applyInput(input: { throttle: number; brake: number; steer: number; handbrake: boolean }): void {
    const engineForce = input.throttle * MAX_ENGINE_FORCE;
    const brakeForce = input.brake * MAX_BRAKE_FORCE;
    const steerAngle = input.steer * MAX_STEER_ANGLE;

    for (let i = 0; i < WHEEL_DEFS.length; i++) {
      const def = WHEEL_DEFS[i];
      this.vehicle.setWheelEngineForce(i, def.isFront ? 0 : engineForce);
      this.vehicle.setWheelBrake(i, input.handbrake && !def.isFront ? MAX_BRAKE_FORCE : brakeForce);
      if (def.isFront) {
        this.vehicle.setWheelSteering(i, steerAngle);
      }
    }
  }

  update(): void {
    this.vehicle.updateVehicle(this.world.timestep);

    const translation = this.chassisBody.translation();
    const rotation = this.chassisBody.rotation();
    this.chassisMesh.position.set(translation.x, translation.y, translation.z);
    this.chassisMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

    for (let i = 0; i < WHEEL_DEFS.length; i++) {
      const wheelMesh = this.wheelMeshes[i];
      const connection = this.vehicle.wheelChassisConnectionPointCs(i)!;
      const suspensionLength = this.vehicle.wheelSuspensionLength(i) ?? SUSPENSION_REST_LENGTH;
      const steering = this.vehicle.wheelSteering(i) ?? 0;
      const rotationRad = this.vehicle.wheelRotation(i) ?? 0;

      const localPos = new THREE.Vector3(connection.x, connection.y - suspensionLength, connection.z);
      const worldPos = localPos.clone().applyQuaternion(this.chassisMesh.quaternion).add(this.chassisMesh.position);
      wheelMesh.position.copy(worldPos);

      const wheelQuat = new THREE.Quaternion()
        .setFromEuler(new THREE.Euler(0, steering, 0))
        .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rotationRad, 0, 0)));
      wheelMesh.quaternion.copy(this.chassisMesh.quaternion).multiply(wheelQuat);
      wheelMesh.rotateZ(Math.PI / 2);
    }
  }

  getChassisWorldPosition(): THREE.Vector3 {
    return this.chassisMesh.position.clone();
  }

  getChassisWorldQuaternion(): THREE.Quaternion {
    return this.chassisMesh.quaternion.clone();
  }
}
