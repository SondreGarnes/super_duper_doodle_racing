export function formatTime(ms: number): string {
  const totalMs = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  const pad = (n: number, len: number) => n.toString().padStart(len, '0');
  return `${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(millis, 3)}`;
}

export class TimerDisplay {
  private element: HTMLDivElement;
  private bestLapMs: number | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.style.position = 'fixed';
    this.element.style.top = '16px';
    this.element.style.left = '16px';
    this.element.style.padding = '10px 16px';
    this.element.style.fontFamily = 'monospace';
    this.element.style.fontSize = '26px';
    this.element.style.color = '#ffffff';
    this.element.style.background = 'rgba(12, 15, 24, 0.6)';
    this.element.style.border = '1px solid rgba(255,255,255,0.15)';
    this.element.style.borderRadius = '10px';
    this.element.style.pointerEvents = 'none';
    document.body.appendChild(this.element);
  }

  setBestLap(bestLapMs: number | null): void {
    this.bestLapMs = bestLapMs;
  }

  update(
    elapsedMs: number,
    isFinished: boolean,
    checkpoints?: { passed: number; total: number }
  ): void {
    const timeText = formatTime(elapsedMs);
    const bestText =
      this.bestLapMs !== null
        ? `<div style="font-size:13px;margin-top:4px;color:#facc15;">Best ${formatTime(this.bestLapMs)}</div>`
        : '';
    const checkpointText =
      checkpoints && !isFinished
        ? `<div style="font-size:13px;margin-top:4px;color:#38bdf8;">Checkpoints ${checkpoints.passed}/${checkpoints.total}</div>`
        : '';
    const hint = isFinished
      ? '<div style="font-size:13px;margin-top:4px;">Press R to reset</div>'
      : '';
    this.element.style.color = isFinished ? '#4ade80' : '#ffffff';
    this.element.innerHTML = `${timeText}${bestText}${checkpointText}${hint}`;
  }
}

// One-line control legend, bottom-left, out of the way of the gauges.
export function createControlsHint(): void {
  const hint = document.createElement('div');
  hint.textContent = 'W/S drive · A/D steer · Space drift · release for boost · R reset · L leaderboard · M sound';
  hint.style.cssText =
    'position:fixed;bottom:14px;left:16px;font-family:"Segoe UI",system-ui,sans-serif;' +
    'font-size:12px;color:rgba(255,255,255,0.75);background:rgba(12,15,24,0.5);' +
    'padding:6px 12px;border-radius:8px;pointer-events:none;';
  document.body.appendChild(hint);
}
