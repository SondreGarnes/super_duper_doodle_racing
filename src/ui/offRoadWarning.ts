// Pulsing top-center warning while the car is on the grass, so the sudden loss
// of speed reads as a penalty instead of a physics bug.
export class OffRoadWarning {
  private element: HTMLDivElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.textContent = 'OFF TRACK';
    this.element.style.cssText =
      'position:fixed;top:18px;left:50%;transform:translateX(-50%);' +
      'font-family:"Segoe UI",system-ui,sans-serif;font-size:22px;font-weight:800;' +
      'letter-spacing:3px;color:#f87171;text-shadow:0 2px 10px rgba(0,0,0,0.7);' +
      'padding:6px 18px;background:rgba(80,10,10,0.45);border:1px solid rgba(248,113,113,0.5);' +
      'border-radius:10px;pointer-events:none;display:none;';
    document.body.appendChild(this.element);
  }

  update(offRoad: boolean): void {
    if (!offRoad) {
      this.element.style.display = 'none';
      return;
    }
    this.element.style.display = 'block';
    this.element.style.opacity = String(0.65 + 0.35 * Math.sin(performance.now() / 120));
  }
}
