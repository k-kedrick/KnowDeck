import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchModal } from './SearchModal';

const searchMock = vi.hoisted(() => vi.fn());

vi.mock('../api', () => ({
  api: {
    search: searchMock,
  },
}));

describe('SearchModal', () => {
  beforeEach(() => {
    searchMock.mockReset().mockResolvedValue([
      {
        id: 1,
        title: 'Result',
        slug: 'result',
        snippet: '<mark class="search-highlight">ok</mark><img src=x onerror=alert(1)>',
        category_name: 'Docs',
        category_slug: 'docs',
        updated_at: '2026-08-30T00:00:00Z',
      },
    ]);
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(<SearchModal isOpen onClose={onClose} onSelectDocument={vi.fn()} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('sanitizes rendered search snippets', async () => {
    const onSelectDocument = vi.fn();
    render(<SearchModal isOpen onClose={vi.fn()} onSelectDocument={onSelectDocument} />);

    fireEvent.change(screen.getByPlaceholderText('搜索知识库文档内容或关键字...'), {
      target: { value: 'ok' },
    });

    await waitFor(() => expect(screen.getByText('Result')).toBeTruthy());

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSelectDocument).toHaveBeenCalledWith('result');

    const modal = screen.getByText('Result').closest('.group') as HTMLElement;
    expect(modal.innerHTML).toContain('<mark class="search-highlight">ok</mark>');
    expect(modal.innerHTML).not.toContain('onerror');
    expect(modal.innerHTML).not.toContain('<img');
  });

  it('aborts the previous in-flight search when the query changes', async () => {
    searchMock.mockImplementation((_query: string, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }));
    render(<SearchModal isOpen onClose={vi.fn()} onSelectDocument={vi.fn()} />);
    const input = screen.getByPlaceholderText('搜索知识库文档内容或关键字...');

    fireEvent.change(input, { target: { value: 'first' } });
    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1));
    const firstSignal = searchMock.mock.calls[0][1] as AbortSignal;

    fireEvent.change(input, { target: { value: 'second' } });
    expect(firstSignal.aborted).toBe(true);
  });
});
