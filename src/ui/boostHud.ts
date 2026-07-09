// Bottom-center drift charge bar with Mario Kart-style tier colors, swapping to a
// pulsing BOOST! banner while the boost is active.
const TIER_COLORS = ['#9ca3af', '#38bdf8', '#fb923c', '#c084fc'];
const TIER_LABELS = ['', 'MINI TURBO', 'SUPER TURBO', 'ULTRA TURBO'];

export class BoostHud {
  private container: HTMLDivElement;
  private label: HTMLDivElement;
  private barOuter: HTMLDivElement;
  private barFill: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.cssText =
      'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);text-align:center;' +
      'font-family:"Segoe UI",system-ui,sans-serif;pointer-events:none;display:none;';

    this.label = document.createElement('div');
    this.label.style.cssText =
      'font-size:20px;font-weight:800;letter-spacing:2px;color:#fff;' +
      'text-shadow:0 2px 8px rgba(0,0,0,0.6);margin-bottom:6px;';

    this.barOuter = document.createElement('div');
    this.barOuter.style.cssText =
      'width:220px;height:12px;border-radius:6px;background:rgba(0,0,0,0.45);' +
      'border:1px solid rgba(255,255,255,0.35);overflow:hidden;';

    this.barFill = document.createElement('div');
    this.barFill.style.cssText = 'height:100%;width:0%;border-radius:6px;transition:width 60ms linear;';

    this.barOuter.appendChild(this.barFill);
    this.container.append(this.label, this.barOuter);
    document.body.appendChild(this.container);
  }

  update(drifting: boolean, chargeTier: number, chargeProgress: number, boosting: boolean): void {
    if (boosting) {
      this.container.style.display = 'block';
      this.barOuter.style.display = 'none';
      this.label.textContent = 'BOOST!';
      const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 60);
      this.label.style.color = '#fb923c';
      this.label.style.opacity = String(pulse);
      return;
    }

    if (!drifting) {
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'block';
    this.barOuter.style.display = 'block';
    this.label.style.opacity = '1';
    this.label.style.color = TIER_COLORS[chargeTier];
    this.label.textContent = TIER_LABELS[chargeTier];
    const fillColor = TIER_COLORS[Math.min(chargeTier + 1, TIER_COLORS.length - 1)];
    this.barFill.style.background = fillColor;
    this.barFill.style.width = `${Math.round(chargeProgress * 100)}%`;
  }
}
