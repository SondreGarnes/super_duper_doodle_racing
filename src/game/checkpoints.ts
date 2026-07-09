// Checkpoints are placed at fixed progress fractions around the track and must be
// passed in order. A checkpoint counts as passed when the car's track progress is
// within the capture window of its fraction and all earlier checkpoints are passed.
const CAPTURE_WINDOW = 0.04;

export class CheckpointTracker {
  private passed: boolean[];

  constructor(private fractions: number[]) {
    this.passed = fractions.map(() => false);
  }

  update(progress: number): void {
    const next = this.passed.indexOf(false);
    if (next === -1) return;
    if (Math.abs(progress - this.fractions[next]) <= CAPTURE_WINDOW) {
      this.passed[next] = true;
    }
  }

  passedCount(): number {
    return this.passed.filter(Boolean).length;
  }

  total(): number {
    return this.fractions.length;
  }

  allPassed(): boolean {
    return this.passed.every(Boolean);
  }

  isPassed(index: number): boolean {
    return this.passed[index];
  }

  reset(): void {
    this.passed = this.fractions.map(() => false);
  }
}
