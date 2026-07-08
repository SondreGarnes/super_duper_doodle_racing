import { describe, it, expect } from 'vitest';
import { formatTime } from '../src/ui/timerDisplay';

describe('formatTime', () => {
  it('formats zero as 00:00.000', () => {
    expect(formatTime(0)).toBe('00:00.000');
  });

  it('formats sub-minute times with padded milliseconds', () => {
    expect(formatTime(1234)).toBe('00:01.234');
  });

  it('formats minutes correctly', () => {
    expect(formatTime(61234)).toBe('01:01.234');
  });

  it('clamps negative input to zero', () => {
    expect(formatTime(-500)).toBe('00:00.000');
  });
});
