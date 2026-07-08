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

  constructor() {
    this.element = document.createElement('div');
    this.element.style.position = 'fixed';
    this.element.style.top = '16px';
    this.element.style.left = '16px';
    this.element.style.padding = '8px 14px';
    this.element.style.fontFamily = 'monospace';
    this.element.style.fontSize = '24px';
    this.element.style.color = '#ffffff';
    this.element.style.background = 'rgba(0, 0, 0, 0.4)';
    this.element.style.borderRadius = '6px';
    this.element.style.pointerEvents = 'none';
    document.body.appendChild(this.element);
  }

  update(elapsedMs: number, isFinished: boolean): void {
    const timeText = formatTime(elapsedMs);
    const hint = isFinished
      ? '<div style="font-size:14px;margin-top:4px;">Press R to reset</div>'
      : '';
    this.element.style.color = isFinished ? '#4ade80' : '#ffffff';
    this.element.innerHTML = `${timeText}${hint}`;
  }
}
