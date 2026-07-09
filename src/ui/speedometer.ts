// Analog speedometer, bottom-right: 270° sweep dial in km/h with a redline,
// digital readout, and an orange glow while boosting. Styled after an old
// Volvo cluster: dark face, thin white ticks, warm needle.

const MAX_KMH = 170;
const REDLINE_KMH = 120;
const START_ANGLE = Math.PI * 0.75;
const SWEEP = Math.PI * 1.5;
const SIZE = 170;

export class Speedometer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private displayedKmh = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = SIZE * dpr;
    this.canvas.height = SIZE * dpr;
    this.canvas.style.cssText = `position:fixed;right:18px;bottom:18px;width:${SIZE}px;height:${SIZE}px;pointer-events:none;`;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
  }

  update(speedMs: number, boosting: boolean, dt: number): void {
    const targetKmh = Math.min(Math.abs(speedMs) * 3.6, MAX_KMH);
    // Needle inertia: ease toward the real speed like a mechanical gauge.
    this.displayedKmh += (targetKmh - this.displayedKmh) * Math.min(dt * 10, 1);

    const ctx = this.ctx;
    const c = SIZE / 2;
    const radius = c - 6;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Face
    ctx.beginPath();
    ctx.arc(c, c, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12, 15, 24, 0.82)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = boosting ? '#fb923c' : 'rgba(255,255,255,0.35)';
    ctx.stroke();

    // Redline arc
    ctx.beginPath();
    ctx.arc(
      c,
      c,
      radius - 10,
      START_ANGLE + (REDLINE_KMH / MAX_KMH) * SWEEP,
      START_ANGLE + SWEEP
    );
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(220, 60, 50, 0.85)';
    ctx.stroke();

    // Ticks and labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let kmh = 0; kmh <= MAX_KMH; kmh += 10) {
      const angle = START_ANGLE + (kmh / MAX_KMH) * SWEEP;
      const major = kmh % 20 === 0;
      const outer = radius - 8;
      const inner = outer - (major ? 10 : 5);
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(angle) * outer, c + Math.sin(angle) * outer);
      ctx.lineTo(c + Math.cos(angle) * inner, c + Math.sin(angle) * inner);
      ctx.lineWidth = major ? 2 : 1;
      ctx.strokeStyle = kmh >= REDLINE_KMH ? 'rgba(240,110,100,0.9)' : 'rgba(255,255,255,0.75)';
      ctx.stroke();

      if (kmh % 40 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(
          String(kmh),
          c + Math.cos(angle) * (inner - 12),
          c + Math.sin(angle) * (inner - 12)
        );
      }
    }

    // Needle
    const needleAngle = START_ANGLE + (this.displayedKmh / MAX_KMH) * SWEEP;
    ctx.beginPath();
    ctx.moveTo(c - Math.cos(needleAngle) * 12, c - Math.sin(needleAngle) * 12);
    ctx.lineTo(c + Math.cos(needleAngle) * (radius - 20), c + Math.sin(needleAngle) * (radius - 20));
    ctx.lineWidth = 3;
    ctx.strokeStyle = boosting ? '#fb923c' : '#e8593f';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#d8dbe2';
    ctx.fill();

    // Digital readout
    ctx.fillStyle = boosting ? '#fb923c' : '#ffffff';
    ctx.font = '700 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(String(Math.round(this.displayedKmh)), c, c + 38);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('km/h', c, c + 56);
  }
}
