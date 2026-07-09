// Ghost lap recording and playback. Samples are plain objects (no three.js types)
// so the logic stays pure and testable; the renderer applies them to a mesh.

export interface GhostSample {
  t: number; // elapsed lap time, ms
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

export interface GhostPose {
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

const SAMPLE_INTERVAL_MS = 100;

export class GhostRecorder {
  private samples: GhostSample[] = [];

  record(sample: GhostSample): void {
    const last = this.samples[this.samples.length - 1];
    if (last && sample.t - last.t < SAMPLE_INTERVAL_MS) return;
    if (last && sample.t <= last.t) return;
    this.samples.push(sample);
  }

  getSamples(): GhostSample[] {
    return this.samples;
  }

  reset(): void {
    this.samples = [];
  }
}

// Interpolates a pose along recorded samples. Quaternions are nlerped, which is
// plenty for a 10 Hz ghost trail.
export function ghostPoseAt(samples: GhostSample[], elapsedMs: number): GhostPose | null {
  if (samples.length === 0) return null;
  if (elapsedMs <= samples[0].t) return toPose(samples[0]);
  const last = samples[samples.length - 1];
  if (elapsedMs >= last.t) return toPose(last);

  let hi = 1;
  while (samples[hi].t < elapsedMs) hi++;
  const a = samples[hi - 1];
  const b = samples[hi];
  const f = (elapsedMs - a.t) / (b.t - a.t);

  // Take the shorter quaternion arc before blending.
  const dot = a.qx * b.qx + a.qy * b.qy + a.qz * b.qz + a.qw * b.qw;
  const sign = dot < 0 ? -1 : 1;
  let qx = a.qx + (b.qx * sign - a.qx) * f;
  let qy = a.qy + (b.qy * sign - a.qy) * f;
  let qz = a.qz + (b.qz * sign - a.qz) * f;
  let qw = a.qw + (b.qw * sign - a.qw) * f;
  const len = Math.hypot(qx, qy, qz, qw) || 1;
  qx /= len;
  qy /= len;
  qz /= len;
  qw /= len;

  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    z: a.z + (b.z - a.z) * f,
    qx,
    qy,
    qz,
    qw,
  };
}

function toPose(s: GhostSample): GhostPose {
  return { x: s.x, y: s.y, z: s.z, qx: s.qx, qy: s.qy, qz: s.qz, qw: s.qw };
}
