import { describe, expect, it } from 'vitest';
import { resolveInitialTheme } from './theme';

describe('resolveInitialTheme', () => {
  it('keeps a saved light theme when the system prefers dark', () => {
    expect(resolveInitialTheme({ getStoredTheme: () => 'light', prefersDark: () => true })).toBe('light');
  });

  it('keeps a saved dark theme when the system prefers light', () => {
    expect(resolveInitialTheme({ getStoredTheme: () => 'dark', prefersDark: () => false })).toBe('dark');
  });

  it('uses the system preference only when there is no saved theme', () => {
    expect(resolveInitialTheme({ getStoredTheme: () => null, prefersDark: () => true })).toBe('dark');
    expect(resolveInitialTheme({ getStoredTheme: () => null, prefersDark: () => false })).toBe('light');
  });
});
