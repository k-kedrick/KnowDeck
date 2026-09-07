import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './index';

describe('api', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('updates document status through narrow PATCH endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          id: 1,
          title: 'Doc',
          slug: 'doc',
          excerpt: 'Excerpt',
          cover: '',
          status: 'published',
          category_id: 0,
          author_id: 1,
          sort_order: 0,
          is_pinned: false,
          views: 0,
          created_at: '2026-08-30T00:00:00Z',
          updated_at: '2026-08-30T00:00:00Z',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.updateDocumentStatus(1, 'published');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/documents/1/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'published' }),
      }),
    );
    expect(fetchMock.mock.calls[0][1].body).not.toContain('content');
  });

  it('normalizes empty category responses to arrays', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: null,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.getAdminCategories()).resolves.toEqual([]);
    await expect(api.getKnowledgeTree()).resolves.toEqual([]);
  });
});
