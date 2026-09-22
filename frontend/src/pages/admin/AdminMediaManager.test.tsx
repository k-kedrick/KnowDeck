import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Media, MediaFolder } from '../../api';

const apiMocks = vi.hoisted(() => ({
  getMediaFolders: vi.fn(),
  getAdminMedia: vi.fn(),
  uploadMedia: vi.fn(),
  deleteMedia: vi.fn(),
  batchDeleteMedia: vi.fn(),
  batchMoveMedia: vi.fn(),
  moveMedia: vi.fn(),
  createMediaFolder: vi.fn(),
  deleteMediaFolder: vi.fn(),
  getMediaReferences: vi.fn(),
  rebuildMediaReferences: vi.fn(),
}));

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, ...apiMocks } };
});

import { AdminMediaManager } from './AdminMediaManager';

const mockFolders: MediaFolder[] = [
  { id: 1, name: '产品截图', document_id: 0, media_count: 5, created_at: '2026-09-01', updated_at: '2026-09-01' },
];

const mockMediaList: Media[] = [
  {
    id: 1,
    original_name: 'gemini_diagram.png',
    filename: 'uuid-diagram.png',
    path: 'images/uuid-diagram.png',
    url: '/uploads/images/uuid-diagram.png',
    media_type: 'image',
    mime_type: 'image/png',
    size: 1024 * 50,
    duration: 0,
    thumbnail: '',
    folder_id: 0,
    source: 'document/editor',
    reference_count: 1,
    references: [
      { id: 101, title: 'Gemini 使用教程', slug: 'gemini-tutorial', excerpt: '', cover: '', views: 0, updated_at: '2026-09-09' },
    ],
    created_at: '2026-09-09T10:00:00Z',
  },
  {
    id: 2,
    original_name: 'unused_logo.png',
    filename: 'uuid-logo.png',
    path: 'images/uuid-logo.png',
    url: '/uploads/images/uuid-logo.png',
    media_type: 'image',
    mime_type: 'image/png',
    size: 1024 * 15,
    duration: 0,
    thumbnail: '',
    folder_id: 0,
    source: 'manual upload',
    reference_count: 0,
    references: [],
    created_at: '2026-09-08T10:00:00Z',
  },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminMediaManager />
    </MemoryRouter>,
  );

describe('AdminMediaManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getMediaFolders.mockResolvedValue({
      folders: mockFolders,
      total_media: 2,
      unclassified_media: 2,
      used_media: 1,
      unused_media: 1,
    });
    apiMocks.getAdminMedia.mockResolvedValue({
      list: mockMediaList,
      total: 2,
      page: 1,
      page_size: 24,
    });
    apiMocks.batchDeleteMedia.mockResolvedValue({
      deleted_count: 1,
      blocked_count: 1,
      blocked: [
        {
          id: 1,
          original_name: 'gemini_diagram.png',
          filename: 'uuid-diagram.png',
          references: [{ id: 101, title: 'Gemini 使用教程', slug: 'gemini-tutorial' }],
        },
      ],
    });
    apiMocks.rebuildMediaReferences.mockResolvedValue({
      documents_scanned: 5,
    });

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(cleanup);

  it('renders smart views, folders, statistics and media cards', async () => {
    renderPage();

    // Verify smart views
    expect(await screen.findAllByText('全部资源')).toBeTruthy();
    expect(screen.getAllByText('未整理').length).toBeGreaterThan(0);
    expect(screen.getAllByText('未使用资源').length).toBeGreaterThan(0);

    // Verify custom folders; document references remain available from each card.
    expect(screen.getByText('产品截图')).toBeTruthy();

    // Verify bottom statistics
    expect(screen.getByText('已使用')).toBeTruthy();
    expect(screen.getAllByText('未使用').length).toBeGreaterThan(0);

    // Verify media cards
    expect(screen.getByText('gemini_diagram.png')).toBeTruthy();
    expect(screen.getByText('unused_logo.png')).toBeTruthy();
    expect(screen.getByText('已使用 · 1 篇文档')).toBeTruthy();
  });

  it('filters media when switching to unused smart view', async () => {
    renderPage();

    expect(await screen.findAllByText('未使用资源')).toBeTruthy();

    const unusedButtons = screen.getAllByRole('button', { name: /未使用资源/ });
    fireEvent.click(unusedButtons[0]);

    await waitFor(() => {
      expect(apiMocks.getAdminMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          page_size: 40,
          unused: true,
        }),
        expect.any(AbortSignal),
      );
    });
  });

  it('only requests search results on submit and restores the unfiltered list on clear', async () => {
    renderPage();
    await screen.findByText('gemini_diagram.png');
    expect(apiMocks.getAdminMedia).toHaveBeenCalledTimes(1);

    const search = screen.getByPlaceholderText('搜索资源名称、原始文件名、关联文档...');
    fireEvent.change(search, { target: { value: 'logo' } });
    fireEvent.change(search, { target: { value: 'logo-final' } });
    expect(apiMocks.getAdminMedia).toHaveBeenCalledTimes(1);

    fireEvent.submit(search.closest('form')!);
    await waitFor(() => {
      expect(apiMocks.getAdminMedia).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: 'logo-final', page: 1 }),
        expect.any(AbortSignal),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '清空搜索' }));
    await waitFor(() => {
      expect(apiMocks.getAdminMedia).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: undefined, page: 1 }),
        expect.any(AbortSignal),
      );
    });
  });

  it('keeps the current cards visible while a successful delete refresh is pending', async () => {
    let resolveRefresh!: (value: { list: Media[]; total: number; page: number; page_size: number }) => void;
    apiMocks.getAdminMedia
      .mockResolvedValueOnce({ list: mockMediaList, total: 2, page: 1, page_size: 40 })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    apiMocks.deleteMedia.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('unused_logo.png');

    fireEvent.click(screen.getAllByRole('button', { name: '删除资源' })[1]);
    fireEvent.click(await screen.findByRole('button', { name: '确认彻底删除' }));
    await waitFor(() => expect(apiMocks.getAdminMedia).toHaveBeenCalledTimes(2));

    expect(screen.getByText('unused_logo.png')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('正在刷新资源列表');
    resolveRefresh({ list: [mockMediaList[0]], total: 1, page: 1, page_size: 40 });
    await waitFor(() => expect(screen.queryByText('unused_logo.png')).toBeNull());
  });

  it('keeps cards available when a delete mutation fails', async () => {
    apiMocks.deleteMedia.mockRejectedValue(new Error('删除失败'));
    renderPage();
    await screen.findByText('unused_logo.png');

    fireEvent.click(screen.getAllByRole('button', { name: '删除资源' })[1]);
    fireEvent.click(await screen.findByRole('button', { name: '确认彻底删除' }));

    expect(await screen.findByText('删除失败')).toBeTruthy();
    expect(screen.getByText('unused_logo.png')).toBeTruthy();
    expect(apiMocks.getAdminMedia).toHaveBeenCalledTimes(1);
  });

  it('uses a fresh loading state for pagination and folder dataset changes', async () => {
    let resolvePageTwo!: (value: { list: Media[]; total: number; page: number; page_size: number }) => void;
    const pageTwoMedia = { ...mockMediaList[1], id: 3, original_name: 'page_two.png' };
    apiMocks.getAdminMedia
      .mockResolvedValueOnce({ list: mockMediaList, total: 80, page: 1, page_size: 40 })
      .mockImplementationOnce(() => new Promise((resolve) => { resolvePageTwo = resolve; }))
      .mockResolvedValueOnce({ list: [mockMediaList[1]], total: 1, page: 1, page_size: 40 });
    renderPage();
    await screen.findByText('gemini_diagram.png');

    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(apiMocks.getAdminMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }), expect.any(AbortSignal),
    ));
    expect(screen.queryByText('gemini_diagram.png')).toBeNull();
    resolvePageTwo({ list: [pageTwoMedia], total: 80, page: 2, page_size: 40 });
    await screen.findByText('page_two.png');

    fireEvent.click(screen.getByRole('button', { name: '产品截图' }));
    await waitFor(() => expect(apiMocks.getAdminMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({ folder_id: 1, page: 1 }), expect.any(AbortSignal),
    ));
    expect(screen.queryByText('page_two.png')).toBeNull();
  });

  it('does not let a late folder request overwrite the selected folder', async () => {
    let resolveAll!: (value: { list: Media[]; total: number; page: number; page_size: number }) => void;
    let resolveFolder!: (value: { list: Media[]; total: number; page: number; page_size: number }) => void;
    apiMocks.getAdminMedia
      .mockImplementationOnce(() => new Promise((resolve) => { resolveAll = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFolder = resolve; }));
    renderPage();
    await waitFor(() => expect(apiMocks.getAdminMedia).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole('button', { name: '产品截图' }));
    await waitFor(() => expect(apiMocks.getAdminMedia).toHaveBeenCalledTimes(2));
    resolveFolder({ list: [mockMediaList[1]], total: 1, page: 1, page_size: 40 });
    expect(await screen.findByText('unused_logo.png')).toBeTruthy();

    resolveAll({ list: [mockMediaList[0]], total: 1, page: 1, page_size: 40 });
    await Promise.resolve();
    expect(screen.queryByText('gemini_diagram.png')).toBeNull();
  });
  it('does not let an aborted media request overwrite the latest view', async () => {
    let resolveFirst!: (value: { list: Media[]; total: number; page: number; page_size: number }) => void;
    let resolveSecond!: (value: { list: Media[]; total: number; page: number; page_size: number }) => void;
    apiMocks.getAdminMedia
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    renderPage();
    await waitFor(() => expect(apiMocks.getAdminMedia).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getAllByRole('button', { name: /未使用资源/ })[0]);
    await waitFor(() => expect(apiMocks.getAdminMedia).toHaveBeenCalledTimes(2));
    resolveSecond({ list: [mockMediaList[1]], total: 1, page: 1, page_size: 40 });
    expect(await screen.findByText('unused_logo.png')).toBeTruthy();

    resolveFirst({ list: [mockMediaList[0]], total: 1, page: 1, page_size: 40 });
    await Promise.resolve();
    expect(screen.queryByText('gemini_diagram.png')).toBeNull();
  });

  it('blocks direct single deletion of referenced media', async () => {
    renderPage();

    expect(await screen.findByText('gemini_diagram.png')).toBeTruthy();

    const deleteBtn = screen.getAllByRole('button', { name: /删除资源/ })[0];
    fireEvent.click(deleteBtn);

    // Modal should block deletion because reference_count > 0
    expect(await screen.findByText(/系统已拦截删除/)).toBeTruthy();
    expect(screen.getAllByText('Gemini 使用教程').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /查看文档/ })).toBeTruthy();
  });

  it('activates batch toolbar on card selection and supports safe batch delete', async () => {
    renderPage();

    expect(await screen.findByText('gemini_diagram.png')).toBeTruthy();

    // Click checkbox for the first card
    const selectCheckboxes = screen.getAllByRole('button', { name: '勾选资源' });
    fireEvent.click(selectCheckboxes[0]);

    // Floating batch toolbar should appear with '全选当前页'
    const selectAllBtn = await screen.findByRole('button', { name: /全选当前页/ });
    expect(selectAllBtn).toBeTruthy();

    // Now click '全选当前页' in the batch toolbar
    fireEvent.click(selectAllBtn);

    // Batch toolbar should update to 2 items
    const batchDeleteBtn = await screen.findByRole('button', { name: /批量删除 \(2\)/ });
    expect(batchDeleteBtn).toBeTruthy();

    // Click batch delete in the floating bar
    fireEvent.click(batchDeleteBtn);

    // Batch delete confirmation modal should show
    expect(await screen.findByText('批量安全删除资源确认')).toBeTruthy();
    expect(screen.getByText('✅ 可安全删除')).toBeTruthy();
    expect(screen.getByText('🛡️ 受保护跳过')).toBeTruthy();

    // Confirm batch delete
    const confirmBtn = screen.getByRole('button', { name: /安全删除/ });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiMocks.batchDeleteMedia).toHaveBeenCalledWith([1, 2]);
    });
  });

  it('triggers rebuild references maintenance action', async () => {
    renderPage();

    const rebuildBtn = await screen.findByRole('button', { name: /重新扫描引用关系/ });
    fireEvent.click(rebuildBtn);

    await waitFor(() => {
      expect(apiMocks.rebuildMediaReferences).toHaveBeenCalled();
    });
  });
});
