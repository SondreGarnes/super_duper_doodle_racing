export class InputState {
  throttle = 0;
  brake = 0;
  steer = 0;
  handbrake = false;

  private keys = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  update(): void {
    const forward = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const backward = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');

    this.throttle = forward ? 1 : 0;
    this.brake = backward ? 1 : 0;
    this.steer = (left ? 1 : 0) - (right ? 1 : 0);
    this.handbrake = this.keys.has('Space');
  }
}
