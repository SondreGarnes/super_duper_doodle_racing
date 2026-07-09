import { describe, it, expect } from 'vitest';
import { GhostRecorder, ghostPoseAt, GhostSample } from '../src/game/ghost';
import { loadBestLap, recordLapIfBest } from '../src/game/bestLap';
import { StorageLike } from '../src/game/leaderboard';

function sample(t: number, x: number): GhostSample {
  return { t, x, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
}

function makeStorage(initial: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

describe('GhostRecorder', () => {
  it('throttles samples to the recording interval', () => {
    const recorder = new GhostRecorder();
    recorder.record(sample(0, 0));
    recorder.record(sample(50, 1)); // too soon, dropped
    recorder.record(sample(120, 2));
    recorder.record(sample(130, 3)); // too soon, dropped
    recorder.record(sample(240, 4));
    expect(recorder.getSamples().map((s) => s.t)).toEqual([0, 120, 240]);
  });

  it('ignores non-increasing timestamps', () => {
    const recorder = new GhostRecorder();
    recorder.record(sample(200, 0));
    recorder.record(sample(100, 1));
    expect(recorder.getSamples()).toHaveLength(1);
  });

  it('reset clears samples', () => {
    const recorder = new GhostRecorder();
    recorder.record(sample(0, 0));
    recorder.reset();
    expect(recorder.getSamples()).toHaveLength(0);
  });
});

describe('ghostPoseAt', () => {
  const samples = [sample(0, 0), sample(1000, 10), sample(2000, 40)];

  it('returns null with no samples', () => {
    expect(ghostPoseAt([], 500)).toBeNull();
  });

  it('clamps before the first and after the last sample', () => {
    expect(ghostPoseAt(samples, -50)!.x).toBe(0);
    expect(ghostPoseAt(samples, 99999)!.x).toBe(40);
  });

  it('interpolates linearly between samples', () => {
    expect(ghostPoseAt(samples, 500)!.x).toBeCloseTo(5);
    expect(ghostPoseAt(samples, 1500)!.x).toBeCloseTo(25);
  });

  it('keeps quaternions normalized while blending', () => {
    const rotated: GhostSample[] = [
      { t: 0, x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
      { t: 1000, x: 0, y: 0, z: 0, qx: 0, qy: 0.7071, qz: 0, qw: 0.7071 },
    ];
    const pose = ghostPoseAt(rotated, 500)!;
    const len = Math.hypot(pose.qx, pose.qy, pose.qz, pose.qw);
    expect(len).toBeCloseTo(1, 5);
  });
});

describe('best lap persistence', () => {
  it('returns null on empty or corrupt storage', () => {
    expect(loadBestLap(makeStorage())).toBeNull();
    expect(loadBestLap(makeStorage({ 'racing-best-lap': 'garbage{' }))).toBeNull();
    expect(loadBestLap(makeStorage({ 'racing-best-lap': '{"timeMs":-5,"samples":[]}' }))).toBeNull();
  });

  it('saves a first lap and round-trips it', () => {
    const storage = makeStorage();
    const best = recordLapIfBest(storage, null, 60000, [sample(0, 0)]);
    expect(best!.timeMs).toBe(60000);
    expect(loadBestLap(storage)!.timeMs).toBe(60000);
  });

  it('only replaces the best when the new lap is faster', () => {
    const storage = makeStorage();
    const first = recordLapIfBest(storage, null, 60000, [sample(0, 0)]);
    const afterSlower = recordLapIfBest(storage, first, 70000, [sample(0, 1)]);
    expect(afterSlower!.timeMs).toBe(60000);
    const afterFaster = recordLapIfBest(storage, afterSlower, 50000, [sample(0, 2)]);
    expect(afterFaster!.timeMs).toBe(50000);
    expect(loadBestLap(storage)!.timeMs).toBe(50000);
  });
});
