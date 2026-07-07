import RAPIER from '@dimforge/rapier3d-compat';

export class FixedTimestepAccumulator {
  private accumulated = 0;

  constructor(private readonly fixedStep: number) {}

  tick(deltaSeconds: number, stepFn: () => void): void {
    this.accumulated += deltaSeconds;
    while (this.accumulated + 1e-9 >= this.fixedStep) {
      stepFn();
      this.accumulated -= this.fixedStep;
    }
  }
}

export async function createPhysicsWorld(): Promise<RAPIER.World> {
  await RAPIER.init();
  const gravity = { x: 0.0, y: -9.81, z: 0.0 };
  return new RAPIER.World(gravity);
}
