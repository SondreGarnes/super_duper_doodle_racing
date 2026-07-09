import { createScene } from './scene';
import { createPhysicsWorld, FixedTimestepAccumulator } from './physics';
import { createRoad, getSpawnTransform } from './world/road';
import { createScenery } from './world/scenery';
import { createCheckpointGates, createStartGantry } from './world/checkpointGates';
import { getTrackProgress } from './world/trackProgress';
import { InputState } from './car/input';
import { Car } from './car/car';
import { ChaseCamera } from './camera/chaseCamera';
import { LapTimer } from './game/lapTimer';
import { CheckpointTracker } from './game/checkpoints';
import { DriftBoost, isDriftInput } from './game/driftBoost';
import { GhostRecorder, ghostPoseAt, GhostPose } from './game/ghost';
import { loadBestLap, recordLapIfBest } from './game/bestLap';
import { TimerDisplay, createControlsHint } from './ui/timerDisplay';
import { ResultsOverlay } from './ui/resultsOverlay';
import { BoostHud } from './ui/boostHud';
import { Speedometer } from './ui/speedometer';
import { Minimap } from './ui/minimap';
import { DriftSmoke } from './fx/driftSmoke';
import { GhostRig } from './fx/ghostRig';
import { EngineSound } from './audio/engineSound';

const FIXED_DT = 1 / 60;
const CHECKPOINT_FRACTIONS = [0.25, 0.5, 0.75];

async function main() {
  const { scene, camera, composer } = createScene();

  const world = await createPhysicsWorld();
  const { curve } = createRoad(scene, world);
  createScenery(scene, world, curve);
  createStartGantry(scene, curve);
  const gates = createCheckpointGates(scene, curve, CHECKPOINT_FRACTIONS);

  const spawn = getSpawnTransform(curve);
  const car = new Car(
    scene,
    world,
    { x: spawn.position.x, y: spawn.position.y, z: spawn.position.z },
    { x: spawn.quaternion.x, y: spawn.quaternion.y, z: spawn.quaternion.z, w: spawn.quaternion.w }
  );
  const input = new InputState();
  const chaseCamera = new ChaseCamera(camera, car.getChassisWorldPosition());
  const accumulator = new FixedTimestepAccumulator(FIXED_DT);
  const lapTimer = new LapTimer();
  const checkpoints = new CheckpointTracker(CHECKPOINT_FRACTIONS);
  const timerDisplay = new TimerDisplay();
  const driftBoost = new DriftBoost();
  const boostHud = new BoostHud();
  const speedometer = new Speedometer();
  const minimap = new Minimap(curve, CHECKPOINT_FRACTIONS);
  const driftSmoke = new DriftSmoke(scene);
  const ghostRig = new GhostRig(scene);
  const ghostRecorder = new GhostRecorder();
  const engineSound = new EngineSound();
  createControlsHint();

  let bestLap = loadBestLap(window.localStorage);
  timerDisplay.setBestLap(bestLap?.timeMs ?? null);

  function restart() {
    car.reset(spawn.position, spawn.quaternion);
    lapTimer.reset();
    checkpoints.reset();
    driftBoost.reset();
    ghostRecorder.reset();
    gates.forEach((gate) => gate.setPassed(false));
  }

  const resultsOverlay = new ResultsOverlay(window.localStorage, restart);

  // @ts-expect-error debug hook for manual/automated verification, not part of the public API
  window.__debug = { car, camera, scene, curve, world, lapTimer, checkpoints, driftBoost, ghostRig };

  let lastTime = performance.now();
  let wasFinished = false;
  let wasRunning = false;

  function animate(now: number) {
    requestAnimationFrame(animate);
    const deltaSeconds = Math.min((now - lastTime) / 1000, 0.25);
    lastTime = now;

    input.update();

    if (input.resetPressed) {
      resultsOverlay.hide();
      restart();
    }

    if (input.leaderboardTogglePressed) {
      if (resultsOverlay.isOpen()) {
        resultsOverlay.hide();
      } else {
        resultsOverlay.showLeaderboard();
      }
    }

    if (input.mutePressed) {
      engineSound.toggleMute();
    }

    if (!lapTimer.isFinished() && !resultsOverlay.isOpen() && (input.throttle > 0 || input.brake > 0)) {
      lapTimer.start(now);
    }

    driftBoost.update(
      deltaSeconds,
      isDriftInput(input.handbrake, input.steer, car.getSignedSpeed(), driftBoost.isDrifting())
    );

    accumulator.tick(deltaSeconds, () => {
      car.applyInput(input, driftBoost.isDrifting());
      if (driftBoost.isBoosting()) {
        car.applyBoost(FIXED_DT);
      }
      car.applyResistance(FIXED_DT);
      car.stepVehicle();
      world.step();
    });

    car.update();
    car.setBoosting(driftBoost.isBoosting());
    driftSmoke.update(
      deltaSeconds,
      driftBoost.isDrifting() || driftBoost.isBoosting(),
      car.getRearWheelWorldPositions(),
      driftBoost.isBoosting() ? 2 : driftBoost.chargeTier()
    );
    boostHud.update(
      driftBoost.isDrifting(),
      driftBoost.chargeTier(),
      driftBoost.chargeProgress(),
      driftBoost.isBoosting()
    );
    engineSound.update(
      car.getSignedSpeed(),
      input.throttle,
      driftBoost.isDrifting(),
      driftBoost.isBoosting()
    );

    // Widen the FOV while boosting for a Mario Kart-style sense of speed.
    const targetFov = driftBoost.isBoosting() ? 72 : 60;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * Math.min(deltaSeconds * 8, 1);
      camera.updateProjectionMatrix();
    }

    chaseCamera.update(car.getChassisWorldPosition(), car.getChassisWorldQuaternion(), deltaSeconds);

    const progress = getTrackProgress(curve, car.getChassisWorldPosition());
    if (lapTimer.isRunning()) {
      checkpoints.update(progress);
      CHECKPOINT_FRACTIONS.forEach((_, i) => gates[i].setPassed(checkpoints.isPassed(i)));
    }
    lapTimer.update(now, progress, checkpoints.allPassed());

    // Ghost: record this lap and replay the best one, both on lap time.
    const elapsedMs = lapTimer.getElapsedMs(now);
    let ghostPose: GhostPose | null = null;
    if (lapTimer.isRunning()) {
      if (!wasRunning) ghostRecorder.reset();
      const pos = car.getChassisWorldPosition();
      const quat = car.getChassisWorldQuaternion();
      ghostRecorder.record({
        t: elapsedMs,
        x: pos.x,
        y: pos.y,
        z: pos.z,
        qx: quat.x,
        qy: quat.y,
        qz: quat.z,
        qw: quat.w,
      });
      if (bestLap) {
        ghostPose = ghostPoseAt(bestLap.samples, elapsedMs);
      }
    }
    ghostRig.setPose(ghostPose);
    wasRunning = lapTimer.isRunning();

    timerDisplay.update(elapsedMs, lapTimer.isFinished(), {
      passed: checkpoints.passedCount(),
      total: checkpoints.total(),
    });
    speedometer.update(car.getSignedSpeed(), driftBoost.isBoosting(), deltaSeconds);
    const forward = car.getForwardXZ();
    minimap.update(
      car.getChassisWorldPosition(),
      forward.x,
      forward.z,
      CHECKPOINT_FRACTIONS.map((_, i) => checkpoints.isPassed(i)),
      ghostPose
    );

    if (lapTimer.isFinished() && !wasFinished) {
      bestLap = recordLapIfBest(window.localStorage, bestLap, elapsedMs, ghostRecorder.getSamples());
      timerDisplay.setBestLap(bestLap?.timeMs ?? null);
      resultsOverlay.showNameEntry(elapsedMs);
    }
    wasFinished = lapTimer.isFinished();

    composer.render();
  }
  requestAnimationFrame(animate);
}

main();
