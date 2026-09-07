import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime } from './format';

describe('format utilities', () => {
  it('handles empty or invalid date gracefully', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('invalid-date')).toBe('');

    expect(formatDateTime('')).toBe('');
    expect(formatDateTime(undefined)).toBe('');
    expect(formatDateTime('invalid-date')).toBe('');
  });

  it('formats date and time accurately with padded hours and minutes', () => {
    const testDate = new Date(2026, 8, 2, 9, 5); // 2026-09-02 09:05
    const isoString = testDate.toISOString();

    const formattedTime = formatDateTime(isoString);
    expect(formattedTime).toBe('2026年9月2日 09:05');
  });

  it('formats afternoon hours correctly in 24h format', () => {
    const testDate = new Date(2026, 8, 2, 16, 30); // 2026-09-02 16:30
    const isoString = testDate.toISOString();

    const formattedTime = formatDateTime(isoString);
    expect(formattedTime).toBe('2026年9月2日 16:30');
  });
});
