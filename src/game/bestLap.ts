import { GhostSample } from './ghost';
import { StorageLike } from './leaderboard';

export interface BestLap {
  timeMs: number;
  samples: GhostSample[];
}

const STORAGE_KEY = 'racing-best-lap';

export function loadBestLap(storage: StorageLike): BestLap | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.timeMs !== 'number' ||
      !Number.isFinite(parsed.timeMs) ||
      parsed.timeMs <= 0 ||
      !Array.isArray(parsed.samples)
    ) {
      return null;
    }
    return parsed as BestLap;
  } catch {
    return null;
  }
}

// Saves and returns the new best if the lap beats (or first sets) the record;
// otherwise returns the existing best unchanged.
export function recordLapIfBest(
  storage: StorageLike,
  current: BestLap | null,
  timeMs: number,
  samples: GhostSample[]
): BestLap | null {
  if (current && current.timeMs <= timeMs) return current;
  const best: BestLap = { timeMs, samples };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(best));
  } catch {
    // Storage full or unavailable: keep the record in memory for this session.
  }
  return best;
}
