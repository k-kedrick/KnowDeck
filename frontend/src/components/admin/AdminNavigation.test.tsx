import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';

const apiMocks = vi.hoisted(() => ({
  getAdminCategories: vi.fn().mockResolvedValue([]),
  getAdminTags: vi.fn().mockResolvedValue([
    { id: 1, name: 'GPT', slug: 'gpt', doc_count: 1 },
  ]),
  getAdminDocuments: vi.fn().mockResolvedValue({
    total: 1,
    page: 1,
    page_size: 10,
    list: [{
      id: 22,
      title: '测试文档',
      slug: 'test-document',
      excerpt: '',
      cover: '',
      status: 'published',
      category_id: 0,
      author_id: 1,
      sort_order: 0,
      is_pinned: false,
      views: 0,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    }],
  }),
}));

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, ...apiMocks } };
});

import { AdminLayout } from './AdminLayout';
import { AdminDocumentList } from '../../pages/admin/AdminDocumentList';
import { getDraftKey, writeLocalDraft } from '../../hooks/useDocumentDraft';

const AuthOutlet = () => <Outlet context={{ user: { username: 'wang', nickname: '管理员' } }} />;

describe('admin document navigation', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('keeps creation out of the global module navigation', () => {
    render(
      <MemoryRouter initialEntries={['/admin/documents']}>
        <Routes>
          <Route element={<AuthOutlet />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="documents" element={<div>文档列表内容</div>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '文档管理' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: '草稿中心' })).toBeNull();
    expect(screen.queryByRole('link', { name: '新建文档' })).toBeNull();
  });

  it('keeps create and edit actions in document management', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/documents']}>
        <Routes>
          <Route path="/admin/documents" element={<AdminDocumentList />} />
          <Route path="/admin/documents/new" element={<div>新建页面</div>} />
          <Route path="/admin/documents/:id" element={<div>编辑页面</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: '新建文档' })).toBeTruthy();
    expect(screen.queryByText('新建 Markdown 文档')).toBeNull();

    fireEvent.click(await screen.findByRole('button', { name: '编辑' }));
    await waitFor(() => expect(screen.getByText('编辑页面')).toBeTruthy());
  });

  it('passes a tag URL filter to the document query', async () => {
    apiMocks.getAdminDocuments.mockClear();
    render(
      <MemoryRouter initialEntries={['/admin/documents?tag=gpt']}>
        <Routes>
          <Route path="/admin/documents" element={<AdminDocumentList />} />
        </Routes>
      </MemoryRouter>,
    );

    expect((await screen.findByRole('combobox', { name: '按标签筛选' }) as HTMLSelectElement).value).toBe('gpt');
    await waitFor(() => expect(apiMocks.getAdminDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ tag: 'gpt' }),
    ));
  });

  it('shows an unfinished new document directly in document management', async () => {
    const localDraftId = '12345678-local-draft';
    writeLocalDraft(getDraftKey('new', localDraftId), {
      version: 2,
      localDraftId,
      id: 'new',
      title: '退出后保留的文档',
      slug: '',
      content: '尚未保存到服务器的正文',
      excerpt: '',
      cover: '',
      status: 'draft',
      categoryId: 0,
      isPinned: false,
      tags: [],
      updatedAt: Date.now(),
    });

    render(
      <MemoryRouter initialEntries={['/admin/documents']}>
        <Routes>
          <Route path="/admin/documents" element={<AdminDocumentList />} />
          <Route path="/admin/documents/new" element={<div>继续本地草稿</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('退出后保留的文档')).toBeTruthy();
    expect(screen.getByText('本地草稿')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
    await waitFor(() => expect(screen.getByText('继续本地草稿')).toBeTruthy());
  });
});
