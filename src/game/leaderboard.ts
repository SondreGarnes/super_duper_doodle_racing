export interface ScoreEntry {
  name: string;
  timeMs: number;
  date: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'racing-leaderboard';
const MAX_ENTRIES = 10;
const MAX_NAME_LENGTH = 20;

export function sanitizeName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : 'Anonymous';
}

// Returns a new list with the entry inserted, sorted fastest-first, capped at the top 10.
export function addScore(entries: ScoreEntry[], entry: ScoreEntry): ScoreEntry[] {
  return [...entries, entry]
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, MAX_ENTRIES);
}

export function loadScores(storage: StorageLike): ScoreEntry[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ScoreEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof e.name === 'string' &&
        typeof e.timeMs === 'number' &&
        Number.isFinite(e.timeMs) &&
        e.timeMs > 0
    );
  } catch {
    return [];
  }
}

export function saveScores(storage: StorageLike, entries: ScoreEntry[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
