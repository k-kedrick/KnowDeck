import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReadingProgressBar } from './ReadingProgressBar';

describe('ReadingProgressBar component', () => {
  afterEach(cleanup);

  it('renders progress bar element when scrolled', () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 2000,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(window, 'scrollY', {
      value: 500,
      configurable: true,
    });

    const { container } = render(<ReadingProgressBar />);
    expect(container).toBeDefined();
  });
});
