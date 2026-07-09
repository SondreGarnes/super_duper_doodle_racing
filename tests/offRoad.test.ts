import { describe, it, expect } from 'vitest';
import { isOffRoad, OFF_TRACK_DISTANCE } from '../src/game/offRoad';

describe('isOffRoad', () => {
  it('treats the road surface and kerbs as on-track', () => {
    expect(isOffRoad(0)).toBe(false);
    expect(isOffRoad(4)).toBe(false); // road edge
    expect(isOffRoad(4.9)).toBe(false); // riding the kerb
  });

  it('flags positions clearly on the grass', () => {
    expect(isOffRoad(OFF_TRACK_DISTANCE + 0.1)).toBe(true);
    expect(isOffRoad(15)).toBe(true);
  });

  it('is lenient exactly at the boundary', () => {
    expect(isOffRoad(OFF_TRACK_DISTANCE)).toBe(false);
  });
});
