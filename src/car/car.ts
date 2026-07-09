import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { driveCommandForInput, steerAngleForSpeed } from './vehicleTuning';
import { createVolvoBody, setBoostGlow } from './volvoBody';

const CHASSIS_HALF_EXTENTS = { x: 0.9, y: 0.4, z: 2.0 };
const CHASSIS_MASS = 150;
const WHEEL_RADIUS = 0.4;
const WHEEL_HALF_WIDTH = 0.2;
const SUSPENSION_REST_LENGTH = 0.35;
const MAX_BRAKE_FORCE = 40;

// Lowers the effective center of mass below the chassis's geometric center (toward
// where an engine/battery pack would sit), reducing body roll and wheelie tendency.
const CENTER_OF_MASS_OFFSET = { x: 0, y: -0.35, z: 0 };
// Box inertia tensor approximated about the geometric center (not recomputed for the
// shifted center of mass) — close enough for game-feel purposes, not a rigorous sim.
const PRINCIPAL_ANGULAR_INERTIA = {
  x: (CHASSIS_MASS / 3) * (CHASSIS_HALF_EXTENTS.y ** 2 + CHASSIS_HALF_EXTENTS.z ** 2),
  y: (CHASSIS_MASS / 3) * (CHASSIS_HALF_EXTENTS.x ** 2 + CHASSIS_HALF_EXTENTS.z ** 2),
  z: (CHASSIS_MASS / 3) * (CHASSIS_HALF_EXTENTS.x ** 2 + CHASSIS_HALF_EXTENTS.y ** 2),
};

// Opposing-velocity resistance applied each physics step, so top speed levels off
// naturally and coasting decelerates realistically instead of relying only on damping.
const ROLLING_RESISTANCE_COEFF = 6; // N per (m/s)
const DRAG_COEFF = 0.5; // N per (m/s)^2

// Additional resistance while off the road: grass caps the car around 12 m/s,
// so cutting across it never beats staying on the asphalt. Sized against the
// full drivetrain output (~700 N per rear wheel, 1400 N total).
const GRASS_ROLLING_COEFF = 60;
const GRASS_DRAG_COEFF = 4;

interface WheelDef {
  position: RAPIER.Vector3;
  isFront: boolean;
}

// The vehicle controller's engine force drives the chassis along its local +Z axis,
// so the steering (front) wheels must lead at +Z and the driven (rear) wheels trail at -Z.
const WHEEL_DEFS: WheelDef[] = [
  { position: { x: -CHASSIS_HALF_EXTENTS.x, y: -0.2, z: 1.4 }, isFront: true },
  { position: { x: CHASSIS_HALF_EXTENTS.x, y: -0.2, z: 1.4 }, isFront: true },
  { position: { x: -CHASSIS_HALF_EXTENTS.x, y: -0.2, z: -1.4 }, isFront: false },
  { position: { x: CHASSIS_HALF_EXTENTS.x, y: -0.2, z: -1.4 }, isFront: false },
];

const FRONT_SUSPENSION_STIFFNESS = 28;
const REAR_SUSPENSION_STIFFNESS = 22;
const FRONT_FRICTION_SLIP = 3.0;
const REAR_FRICTION_SLIP = 2.6;
const MAX_SUSPENSION_TRAVEL = 0.3;

// Drift mode: rear tires lose most grip so the tail slides, with just a touch of
// rear brake to help rotate. Boost force is strong enough to beat the drag ceiling.
const DRIFT_REAR_FRICTION_SLIP = 1.3;
const DRIFT_REAR_BRAKE = 0;
const BOOST_FORCE = 1400;

export class Car {
  chassisMesh: THREE.Group;
  private wheelMeshes: THREE.Mesh[] = [];
  private chassisBody: RAPIER.RigidBody;
  private vehicle: RAPIER.DynamicRayCastVehicleController;
  private world: RAPIER.World;
  private boostGlowMaterial!: THREE.MeshStandardMaterial;
  private wasDrifting = false;

  constructor(
    scene: THREE.Scene,
    world: RAPIER.World,
    startPos: { x: number; y: number; z: number },
    startRotation: { x: number; y: number; z: number; w: number } = { x: 0, y: 0, z: 0, w: 1 }
  ) {
    this.world = world;

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(startPos.x, startPos.y, startPos.z)
      .setRotation(startRotation)
      .setLinearDamping(0.1)
      .setAngularDamping(1.5)
      .setAdditionalMassProperties(
        CHASSIS_MASS,
        CENTER_OF_MASS_OFFSET,
        PRINCIPAL_ANGULAR_INERTIA,
        { x: 0, y: 0, z: 0, w: 1 }
      );
    this.chassisBody = world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      CHASSIS_HALF_EXTENTS.x,
      CHASSIS_HALF_EXTENTS.y,
      CHASSIS_HALF_EXTENTS.z
    ).setDensity(0);
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
      const isFront = WHEEL_DEFS[i].isFront;
      this.vehicle.setWheelSuspensionStiffness(
        i,
        isFront ? FRONT_SUSPENSION_STIFFNESS : REAR_SUSPENSION_STIFFNESS
      );
      this.vehicle.setWheelMaxSuspensionTravel(i, MAX_SUSPENSION_TRAVEL);
      this.vehicle.setWheelFrictionSlip(i, isFront ? FRONT_FRICTION_SLIP : REAR_FRICTION_SLIP);
    }

    this.chassisMesh = new THREE.Group();
    const { group: volvoBody, boostGlow } = createVolvoBody();
    this.boostGlowMaterial = boostGlow;
    this.chassisMesh.add(volvoBody);
    scene.add(this.chassisMesh);

    const tireMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.8,
      metalness: 0.1,
    });
    const hubcapMaterial = new THREE.MeshStandardMaterial({
      color: 0xc8ccd4,
      roughness: 0.3,
      metalness: 0.85,
    });
    for (const def of WHEEL_DEFS) {
      const wheelMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_HALF_WIDTH * 2, 20),
        tireMaterial
      );
      // Classic Volvo steelie: a flat silver disc inset into the tire.
      const hubcap = new THREE.Mesh(
        new THREE.CylinderGeometry(WHEEL_RADIUS * 0.55, WHEEL_RADIUS * 0.55, WHEEL_HALF_WIDTH * 2 + 0.02, 14),
        hubcapMaterial
      );
      wheelMesh.add(hubcap);
      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.castShadow = true;
      scene.add(wheelMesh);
      this.wheelMeshes.push(wheelMesh);
    }
  }

  applyInput(
    input: { throttle: number; brake: number; steer: number; handbrake: boolean },
    drifting = false
  ): void {
    const currentSpeed = this.getSignedSpeed();
    const { engineForce, brakeForce } = driveCommandForInput(
      currentSpeed,
      input.throttle,
      input.brake
    );
    // Softer steering during a drift keeps it a controlled slide instead of a spin.
    const steerAngle = steerAngleForSpeed(currentSpeed, input.steer) * (drifting ? 0.55 : 1);

    // Only touch wheel friction on drift transitions; rewriting it every step
    // disturbs the vehicle controller's contact state and costs traction.
    if (drifting !== this.wasDrifting) {
      this.wasDrifting = drifting;
      for (let i = 0; i < WHEEL_DEFS.length; i++) {
        if (WHEEL_DEFS[i].isFront) continue;
        // Mario Kart drift: rear end goes loose but keeps driving instead of locking up.
        this.vehicle.setWheelFrictionSlip(i, drifting ? DRIFT_REAR_FRICTION_SLIP : REAR_FRICTION_SLIP);
      }
    }

    for (let i = 0; i < WHEEL_DEFS.length; i++) {
      const def = WHEEL_DEFS[i];
      this.vehicle.setWheelEngineForce(i, def.isFront ? 0 : engineForce);
      if (drifting) {
        this.vehicle.setWheelBrake(i, def.isFront ? brakeForce : DRIFT_REAR_BRAKE);
      } else {
        this.vehicle.setWheelBrake(i, input.handbrake && !def.isFront ? MAX_BRAKE_FORCE : brakeForce);
      }
      if (def.isFront) {
        this.vehicle.setWheelSteering(i, steerAngle);
      }
    }
  }

  // Extra forward push while a drift boost is active, applied along the chassis heading.
  applyBoost(dt: number): void {
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.chassisMesh.quaternion);
    const impulse = BOOST_FORCE * dt;
    this.chassisBody.applyImpulse(
      { x: forward.x * impulse, y: 0, z: forward.z * impulse },
      true
    );
  }

  // Forward speed with a reliable sign (velocity projected onto the chassis heading);
  // Rapier's currentVehicleSpeed() sign is unstable at low speeds.
  getSignedSpeed(): number {
    const vel = this.chassisBody.linvel();
    const rot = this.chassisBody.rotation();
    const forwardX = 2 * (rot.x * rot.z + rot.w * rot.y);
    const forwardZ = 1 - 2 * (rot.x * rot.x + rot.y * rot.y);
    return vel.x * forwardX + vel.z * forwardZ;
  }

  // Chassis forward direction projected onto the ground plane.
  getForwardXZ(): { x: number; z: number } {
    const rot = this.chassisBody.rotation();
    return {
      x: 2 * (rot.x * rot.z + rot.w * rot.y),
      z: 1 - 2 * (rot.x * rot.x + rot.y * rot.y),
    };
  }

  setBoosting(boosting: boolean): void {
    setBoostGlow(this.boostGlowMaterial, boosting);
  }

  // Rear wheel contact-patch positions in world space, for drift smoke emission.
  getRearWheelWorldPositions(): THREE.Vector3[] {
    return WHEEL_DEFS.flatMap((def, i) => {
      if (def.isFront) return [];
      const connection = this.vehicle.wheelChassisConnectionPointCs(i)!;
      const suspensionLength = this.vehicle.wheelSuspensionLength(i) ?? SUSPENSION_REST_LENGTH;
      const localPos = new THREE.Vector3(
        connection.x,
        connection.y - suspensionLength - WHEEL_RADIUS * 0.5,
        connection.z
      );
      return [localPos.applyQuaternion(this.chassisMesh.quaternion).add(this.chassisMesh.position)];
    });
  }

  applyResistance(dt: number, onGrass = false): void {
    const vel = this.chassisBody.linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    if (speed < 1e-4) return;

    const rolling = ROLLING_RESISTANCE_COEFF + (onGrass ? GRASS_ROLLING_COEFF : 0);
    const drag = DRAG_COEFF + (onGrass ? GRASS_DRAG_COEFF : 0);
    const resistanceForce = rolling * speed + drag * speed * speed;
    const impulseMag = -resistanceForce * dt;
    const dirX = vel.x / speed;
    const dirZ = vel.z / speed;
    this.chassisBody.applyImpulse({ x: dirX * impulseMag, y: 0, z: dirZ * impulseMag }, true);
  }

  reset(position: THREE.Vector3, quaternion: THREE.Quaternion): void {
    this.chassisBody.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    this.chassisBody.setRotation(
      { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w },
      true
    );
    this.chassisBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.chassisBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  // Runs the vehicle controller (suspension raycasts + wheel forces) for one fixed
  // physics step. Must be called once per world.step(), not per render frame.
  stepVehicle(): void {
    this.vehicle.updateVehicle(this.world.timestep);
  }

  update(): void {
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
