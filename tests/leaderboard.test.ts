import { describe, it, expect } from 'vitest';
import {
  addScore,
  loadScores,
  saveScores,
  sanitizeName,
  ScoreEntry,
  StorageLike,
} from '../src/game/leaderboard';

function makeStorage(initial: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

function entry(name: string, timeMs: number): ScoreEntry {
  return { name, timeMs, date: '2026-07-08' };
}

describe('sanitizeName', () => {
  it('trims whitespace and caps length at 20', () => {
    expect(sanitizeName('  Sondre  ')).toBe('Sondre');
    expect(sanitizeName('x'.repeat(30))).toBe('x'.repeat(20));
  });

  it('falls back to Anonymous for empty names', () => {
    expect(sanitizeName('   ')).toBe('Anonymous');
  });
});

describe('addScore', () => {
  it('sorts entries fastest-first', () => {
    const result = addScore([entry('Slow', 90000)], entry('Fast', 60000));
    expect(result.map((e) => e.name)).toEqual(['Fast', 'Slow']);
  });

  it('caps the list at 10 entries, dropping the slowest', () => {
    const entries = Array.from({ length: 10 }, (_, i) => entry(`P${i}`, (i + 1) * 1000));
    const result = addScore(entries, entry('New', 500));
    expect(result).toHaveLength(10);
    expect(result[0].name).toBe('New');
    expect(result.some((e) => e.name === 'P9')).toBe(false);
  });

  it('does not mutate the input list', () => {
    const entries = [entry('A', 1000)];
    addScore(entries, entry('B', 500));
    expect(entries).toHaveLength(1);
  });
});

describe('loadScores / saveScores', () => {
  it('round-trips scores through storage', () => {
    const storage = makeStorage();
    const entries = [entry('A', 60000), entry('B', 70000)];
    saveScores(storage, entries);
    expect(loadScores(storage)).toEqual(entries);
  });

  it('returns empty list when storage is empty', () => {
    expect(loadScores(makeStorage())).toEqual([]);
  });

  it('returns empty list for corrupt JSON', () => {
    const storage = makeStorage({ 'racing-leaderboard': '{not json' });
    expect(loadScores(storage)).toEqual([]);
  });

  it('filters out malformed entries', () => {
    const storage = makeStorage({
      'racing-leaderboard': JSON.stringify([
        { name: 'Good', timeMs: 60000, date: 'x' },
        { name: 'Bad' },
        { timeMs: -5, name: 'Negative', date: 'x' },
        'junk',
      ]),
    });
    expect(loadScores(storage)).toHaveLength(1);
  });
});
