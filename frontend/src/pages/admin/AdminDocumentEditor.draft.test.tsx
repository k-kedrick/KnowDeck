import { forwardRef, useImperativeHandle } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { getDraftKey, readLocalDraft } from '../../hooks/useDocumentDraft';

const publishedDocument = {
  id: 9,
  title: '线上文档',
  slug: 'online-document',
  content: '# 线上正文',
  excerpt: '线上描述',
  cover: '',
  status: 'published' as const,
  category_id: 0,
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
}));

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, ...apiMocks } };
});

vi.mock('../../components/admin/tiptap/TiptapEditor', () => ({
  TiptapEditor: forwardRef(({ content, onChange }: { content: string; onChange: (value: string) => void }, ref) => {
    useImperativeHandle(ref, () => ({ getContentForSave: () => content, markSaved: () => undefined }));
    return <div data-testid="editor-content">{content}<button type="button" onClick={() => onChange(`${content}\n本地修改`)}>模拟编辑</button></div>;
  }),
}));

vi.mock('../../components/admin/AdminDocTreeSidebar', () => ({
  AdminDocTreeSidebar: () => <div>目录占位</div>,
}));

vi.mock('../../components/admin/TagCombobox', () => ({
  TagCombobox: () => <div>标签占位</div>,
}));

import { AdminDocumentEditor } from './AdminDocumentEditor';

describe('AdminDocumentEditor published draft behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    apiMocks.getAdminCategories.mockReset().mockResolvedValue([]);
    apiMocks.getAdminTags.mockReset().mockResolvedValue([]);
    apiMocks.getAdminDocument.mockReset().mockResolvedValue(publishedDocument);
    apiMocks.updateDocument.mockReset().mockResolvedValue({
      ...publishedDocument,
      updated_at: '2026-09-02T01:00:00Z',
    });
  });

  afterEach(cleanup);

  it('stores published edits locally without taking the article offline', async () => {
    render(
      <MemoryRouter initialEntries={['/wang/documents/9']}>
        <Routes><Route path="/wang/documents/:id" element={<AdminDocumentEditor />} /></Routes>
      </MemoryRouter>,
    );

    const storeButton = await screen.findByRole('button', { name: '暂存本地' });
    fireEvent.click(await screen.findByRole('button', { name: '模拟编辑' }));
    fireEvent.click(storeButton);

    await waitFor(() => expect(readLocalDraft(getDraftKey(9))?.status).toBe('published'));
    expect(apiMocks.updateDocument).not.toHaveBeenCalled();
    expect(screen.getByText(/线上版本保持不变/)).toBeTruthy();
  });

  it('does not create a local draft when nothing changed', async () => {
    render(
      <MemoryRouter initialEntries={['/wang/documents/9']}>
        <Routes><Route path="/wang/documents/:id" element={<AdminDocumentEditor />} /></Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '暂存本地' }));
    expect(localStorage.getItem(getDraftKey(9))).toBeNull();
    expect(screen.getByText(/当前没有未提交修改/)).toBeTruthy();
  });

  it('updates the server and clears the matching local draft when publishing', async () => {
    render(
      <MemoryRouter initialEntries={['/wang/documents/9']}>
        <Routes><Route path="/wang/documents/:id" element={<AdminDocumentEditor />} /></Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: '暂存本地' });
    fireEvent.click(await screen.findByRole('button', { name: '模拟编辑' }));
    fireEvent.click(screen.getByRole('button', { name: '暂存本地' }));
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => expect(apiMocks.updateDocument).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ status: 'published' }),
    ));
    await waitFor(() => expect(localStorage.getItem(getDraftKey(9))).toBeNull());
  });

  it('shows a visible error when browser draft storage fails', async () => {
    render(
      <MemoryRouter initialEntries={['/wang/documents/9']}>
        <Routes><Route path="/wang/documents/:id" element={<AdminDocumentEditor />} /></Routes>
      </MemoryRouter>,
    );

    const storeButton = await screen.findByRole('button', { name: '暂存本地' });
    fireEvent.click(await screen.findByRole('button', { name: '模拟编辑' }));
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(this: Storage, key, value) {
      if (key === getDraftKey(9)) throw new DOMException('quota exceeded', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    });
    fireEvent.click(storeButton);

    expect(await screen.findByText(/本地草稿暂存失败/)).toBeTruthy();
    expect(apiMocks.updateDocument).not.toHaveBeenCalled();
  });
});
