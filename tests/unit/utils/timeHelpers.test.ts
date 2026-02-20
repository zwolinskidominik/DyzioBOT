import { formatClock } from '../../../src/utils/timeHelpers';

describe('formatClock', () => {
  it('formats seconds only', () => {
    expect(formatClock(45_000)).toBe('0:45');
  });

  it('formats minutes and seconds', () => {
    expect(formatClock(125_000)).toBe('2:05');
  });

  it('formats hours, minutes, seconds', () => {
    expect(formatClock(3_661_000)).toBe('1:01:01');
  });

  it('formats 0ms', () => {
    expect(formatClock(0)).toBe('0:00');
  });
});
