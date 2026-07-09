import * as THREE from 'three';

// Top-right minimap: the track outline with the start line, checkpoint dots that
// flip green as they're passed, the car as a heading triangle, and the ghost as a
// faint dot. World X/Z maps to canvas X/Y with a uniform fit.

const SIZE = 168;
const PADDING = 14;

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private trackPoints: { x: number; y: number }[] = [];
  private checkpointDots: { x: number; y: number }[] = [];
  private startDot: { x: number; y: number };
  private toMap: (p: { x: number; z: number }) => { x: number; y: number };

  constructor(curve: THREE.CatmullRomCurve3, checkpointFractions: number[]) {
    this.canvas = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = SIZE * dpr;
    this.canvas.height = SIZE * dpr;
    this.canvas.style.cssText = `position:fixed;top:16px;right:18px;width:${SIZE}px;height:${SIZE}px;pointer-events:none;`;
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);

    const samples: THREE.Vector3[] = [];
    for (let i = 0; i <= 160; i++) {
      samples.push(curve.getPointAt(i / 160));
    }
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const p of samples) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const scale = (SIZE - PADDING * 2) / Math.max(maxX - minX, maxZ - minZ);
    const offsetX = (SIZE - (maxX - minX) * scale) / 2;
    const offsetY = (SIZE - (maxZ - minZ) * scale) / 2;
    this.toMap = (p) => ({
      x: offsetX + (p.x - minX) * scale,
      y: offsetY + (p.z - minZ) * scale,
    });

    this.trackPoints = samples.map((p) => this.toMap(p));
    this.checkpointDots = checkpointFractions.map((t) => this.toMap(curve.getPointAt(t)));
    this.startDot = this.toMap(curve.getPointAt(0));
  }

  update(
    carPos: THREE.Vector3,
    forwardX: number,
    forwardZ: number,
    checkpointPassed: boolean[],
    ghostPos: { x: number; z: number } | null
  ): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Backing card
    ctx.beginPath();
    ctx.roundRect(0, 0, SIZE, SIZE, 12);
    ctx.fillStyle = 'rgba(12, 15, 24, 0.55)';
    ctx.fill();

    // Track ribbon
    ctx.beginPath();
    this.trackPoints.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.stroke();

    // Start line
    ctx.beginPath();
    ctx.arc(this.startDot.x, this.startDot.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#111';
    ctx.stroke();

    // Checkpoints
    this.checkpointDots.forEach((dot, i) => {
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = checkpointPassed[i] ? '#4ade80' : '#38bdf8';
      ctx.fill();
    });

    // Ghost
    if (ghostPos) {
      const g = this.toMap(ghostPos);
      ctx.beginPath();
      ctx.arc(g.x, g.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();
    }

    // Car: triangle pointing along its heading. Canvas rotation θ maps the
    // triangle's up vector (0,-1) to (sinθ,-cosθ); solve against (fwdX, fwdZ).
    const car = this.toMap(carPos);
    const mapAngle = Math.atan2(forwardX, -forwardZ);
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(mapAngle);
    ctx.beginPath();
    ctx.moveTo(0, -6.5);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fillStyle = '#e8593f';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
  }
}
