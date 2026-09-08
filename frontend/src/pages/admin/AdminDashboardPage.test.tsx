import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboardPage } from './AdminDashboardPage';

const apiMocks = vi.hoisted(() => ({
  getSiteInfo: vi.fn().mockResolvedValue({
    site_name: '测试知识库',
    site_subtitle: '副标题',
    doc_count: 12,
    category_count: 4,
    tag_count: 8,
  }),
  getAdminDocuments: vi.fn().mockImplementation((params) => {
    if (params?.status === 'published') {
      return Promise.resolve({ total: 10, page: 1, page_size: 1, list: [] });
    }
    if (params?.status === 'draft') {
      return Promise.resolve({ total: 2, page: 1, page_size: 1, list: [] });
    }
    return Promise.resolve({
      total: 12,
      page: 1,
      page_size: 6,
      list: [
        {
          id: 101,
          title: '近期编辑文章测试',
          slug: 'recent-test',
          status: 'published',
          access_level: 'public',
          category_id: 1,
          category_name: '后端技术',
          updated_at: '2026-09-08T12:00:00Z',
        },
      ],
    });
  }),
  getAdminMedia: vi.fn().mockResolvedValue({ total: 15, page: 1, page_size: 1, list: [] }),
  listAdminUsers: vi.fn().mockResolvedValue({ total: 3, page: 1, page_size: 1, items: [] }),
  listAdminInvites: vi.fn().mockResolvedValue({
    items: [
      { id: 1, status: 'active', max_uses: 5, used_count: 1 },
      { id: 2, status: 'disabled', max_uses: 1, used_count: 1 },
    ],
  }),
}));

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, ...apiMocks } };
});

describe('AdminDashboardPage', () => {
  afterEach(cleanup);

  it('renders dashboard metrics, recent documents and quick shortcuts', async () => {
    render(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('控制台概览')).toBeTruthy();
    expect(screen.getByText('欢迎回到管理中心')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('近期编辑文章测试')).toBeTruthy();
    });

    expect(screen.getByText('12')).toBeTruthy(); // total docs
    expect(screen.getByText(/已发布:/)).toBeTruthy();
    expect(screen.getByText(/草稿:/)).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy(); // categories
    expect(screen.getByText('15')).toBeTruthy(); // media
    expect(screen.getByText('3')).toBeTruthy(); // users
    expect(screen.getByText('后端技术')).toBeTruthy();

    expect(screen.getByText('撰写新文档')).toBeTruthy();
    expect(screen.getAllByText('媒体资源库').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('用户与邀请码').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('系统全局配置')).toBeTruthy();
    expect(screen.getByText('SQLite (WAL 模式)')).toBeTruthy();
  });
});
