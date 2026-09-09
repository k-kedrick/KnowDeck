import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  getAdminTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}));

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, ...apiMocks } };
});

import { AdminTagManager } from './AdminTagManager';

const longTag = {
  id: 1,
  name: '这是一个需要完整显示的超长技术标签名称',
  slug: 'this-is-a-very-long-tag-slug-that-must-remain-visible',
  doc_count: 7,
  created_at: '2026-09-02T00:00:00Z',
};

const renderPage = () => render(
  <MemoryRouter>
    <AdminTagManager />
  </MemoryRouter>,
);

describe('AdminTagManager', () => {
  beforeEach(() => {
    apiMocks.getAdminTags.mockReset().mockResolvedValue([
      longTag,
      { id: 2, name: 'React', slug: 'react', doc_count: 0, created_at: '2026-09-03T00:00:00Z' },
    ]);
    apiMocks.createTag.mockReset().mockResolvedValue(null);
    apiMocks.updateTag.mockReset().mockResolvedValue(null);
    apiMocks.deleteTag.mockReset().mockResolvedValue(null);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() });
  });

  afterEach(cleanup);

  it('renders complete tag metadata in the compact list and preserves document navigation', async () => {
    renderPage();

    expect(await screen.findByText(`#${longTag.name}`)).toBeTruthy();
    expect(screen.getByText(`/${longTag.slug}`)).toBeTruthy();
    expect(screen.getAllByText('URL Slug').length).toBeGreaterThan(0);
    expect(screen.getByText('创建时间')).toBeTruthy();
    expect(screen.getByRole('link', { name: '7 篇' }).getAttribute('href')).toBe('/wang/documents?tag=this-is-a-very-long-tag-slug-that-must-remain-visible');
  });

  it('keeps search, copy, edit and delete interactions working', async () => {
    renderPage();
    await screen.findByText('#React');

    fireEvent.change(screen.getByLabelText('搜索标签'), { target: { value: 'very-long' } });
    expect(screen.getByText(`#${longTag.name}`)).toBeTruthy();
    expect(screen.queryByText('#React')).toBeNull();

    fireEvent.click(screen.getByTitle('复制 Slug'));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(longTag.slug));

    fireEvent.click(screen.getByRole('button', { name: `编辑标签 ${longTag.name}` }));
    expect((document.getElementById('tag-name') as HTMLInputElement).value).toBe(longTag.name);

    fireEvent.click(screen.getByRole('button', { name: `删除标签 ${longTag.name}` }));
    expect(screen.getByRole('dialog', { name: '确认删除标签' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
    await waitFor(() => expect(apiMocks.deleteTag).toHaveBeenCalledWith(longTag.id, true));
  });
});
