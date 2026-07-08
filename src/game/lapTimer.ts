const FINISH_PROGRESS_THRESHOLD = 0.97;
const START_PROGRESS_THRESHOLD = 0.03;
const MIN_PROGRESS_BEFORE_FINISH = 0.6;

export class LapTimer {
  private startTimeMs: number | null = null;
  private finishTimeMs: number | null = null;
  private maxProgressSeen = 0;

  start(nowMs: number): void {
    if (this.startTimeMs !== null || this.finishTimeMs !== null) return;
    this.startTimeMs = nowMs;
  }

  update(nowMs: number, progress: number): void {
    if (this.startTimeMs === null || this.finishTimeMs !== null) return;

    if (progress > this.maxProgressSeen) {
      this.maxProgressSeen = progress;
    }

    const hasReachedNearEnd = this.maxProgressSeen >= FINISH_PROGRESS_THRESHOLD;
    const hasWrappedToStart = progress <= START_PROGRESS_THRESHOLD;
    const coveredEnoughDistance = this.maxProgressSeen >= MIN_PROGRESS_BEFORE_FINISH;

    if (hasReachedNearEnd && hasWrappedToStart && coveredEnoughDistance) {
      this.finishTimeMs = nowMs;
    }
  }

  reset(): void {
    this.startTimeMs = null;
    this.finishTimeMs = null;
    this.maxProgressSeen = 0;
  }

  isRunning(): boolean {
    return this.startTimeMs !== null && this.finishTimeMs === null;
  }

  isFinished(): boolean {
    return this.finishTimeMs !== null;
  }

  getElapsedMs(nowMs: number): number {
    if (this.startTimeMs === null) return 0;
    const endTime = this.finishTimeMs ?? nowMs;
    return endTime - this.startTimeMs;
  }
}
