import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const documentFixture = {
  id: 9,
  title: '线上文档',
  slug: 'online-document',
  content: '# 线上正文',
  excerpt: '线上描述',
  cover: '',
  status: 'published' as const,
  category_id: 1,
  author_id: 1,
  sort_order: 0,
  is_pinned: false,
  views: 10,
  tags: ['GPT'],
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-02T00:00:00Z',
};

const apiMocks = vi.hoisted(() => ({
  getAdminCategories: vi.fn(),
  getAdminTags: vi.fn(),
  getAdminDocument: vi.fn(),
  updateDocument: vi.fn(),
  createTag: vi.fn(),
}));

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, ...apiMocks } };
});

vi.mock('../../components/admin/DocumentVisualEditor', () => ({
  DocumentVisualEditor: ({ markdownContent, onChange }: { markdownContent: string; onChange: (value: string) => void }) => (
    <div data-testid="editor-content">
      {markdownContent}
      <button type="button" onClick={() => onChange(`${markdownContent}\n正文修改`)}>模拟正文编辑</button>
    </div>
  ),
}));

vi.mock('../../components/admin/AdminDocTreeSidebar', () => ({
  AdminDocTreeSidebar: () => <div>目录占位</div>,
}));

import { AdminDocumentEditor } from './AdminDocumentEditor';

describe('AdminDocumentEditor compact properties', () => {
  beforeEach(() => {
    localStorage.clear();
    apiMocks.getAdminCategories.mockReset().mockResolvedValue([
      { id: 1, name: '指南', slug: 'guide', description: '', icon: '', parent_id: 0, sort_order: 0, created_at: '', updated_at: '' },
      { id: 2, name: '参考', slug: 'reference', description: '', icon: '', parent_id: 0, sort_order: 1, created_at: '', updated_at: '' },
    ]);
    apiMocks.getAdminTags.mockReset().mockResolvedValue([
      { id: 1, name: 'GPT', slug: 'gpt', doc_count: 1 },
      { id: 2, name: 'React', slug: 'react', doc_count: 1 },
    ]);
    apiMocks.getAdminDocument.mockReset().mockResolvedValue(documentFixture);
    apiMocks.updateDocument.mockReset().mockResolvedValue({ ...documentFixture, updated_at: '2026-09-02T01:00:00Z' });
    apiMocks.createTag.mockReset();
  });

  afterEach(cleanup);

  it('keeps one set of controlled fields, preserves values across close, and saves the unchanged payload shape', async () => {
    render(
      <MemoryRouter initialEntries={['/wang/documents/9']}>
        <Routes><Route path="/wang/documents/:id" element={<AdminDocumentEditor />} /></Routes>
      </MemoryRouter>,
    );

    const title = await screen.findByRole('textbox', { name: '文档标题' });
    const trigger = screen.getByRole('button', { name: '属性' });
    expect((title as HTMLInputElement).value).toBe('线上文档');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('textbox', { name: 'URL Slug' })).toBeNull();

    fireEvent.click(trigger);
    const slug = screen.getByRole('textbox', { name: 'URL Slug' });
    fireEvent.change(slug, { target: { value: 'updated-slug' } });
    fireEvent.change(screen.getByRole('combobox', { name: '所属分类' }), { target: { value: '2' } });
    fireEvent.focus(screen.getByRole('combobox', { name: '' }));
    fireEvent.click(await screen.findByRole('option', { name: /#React/ }));
    fireEvent.change(screen.getByRole('textbox', { name: /内容描述/ }), { target: { value: '更新后的描述' } });

    fireEvent.click(document.querySelector<HTMLButtonElement>('.admin-editor-properties-panel button[aria-label="关闭文档属性"]')!);
    expect(screen.queryByRole('textbox', { name: 'URL Slug' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    fireEvent.click(trigger);
    expect((screen.getByRole('textbox', { name: 'URL Slug' }) as HTMLInputElement).value).toBe('updated-slug');
    expect((screen.getByRole('combobox', { name: '所属分类' }) as HTMLSelectElement).value).toBe('2');
    expect((screen.getByRole('textbox', { name: /内容描述/ }) as HTMLTextAreaElement).value).toBe('更新后的描述');
    expect(screen.getAllByRole('textbox', { name: '文档标题' })).toHaveLength(1);
    expect(screen.getAllByRole('textbox', { name: 'URL Slug' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '模拟正文编辑' }));
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(apiMocks.updateDocument).toHaveBeenCalledTimes(1);
      expect(apiMocks.updateDocument).toHaveBeenCalledWith(9, expect.objectContaining({
        title: '线上文档',
        slug: 'updated-slug',
        category_id: 2,
        tags: ['GPT', 'React'],
        excerpt: '更新后的描述',
        status: 'published',
        content: '# 线上正文\n正文修改',
      }));
    });
  });
});
