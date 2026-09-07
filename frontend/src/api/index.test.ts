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

  it('uses the authenticated admin-user mutation endpoints with narrow payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, message: 'success', data: { id: 7 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.updateAdminUserRole(7, 'admin');
    await api.updateAdminUserStatus(7, 'disabled');
    await api.resetAdminUserPassword(7, 'password-1234');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/admin/users/7/role', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ role: 'admin' }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/admin/users/7/status', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'disabled' }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/admin/users/7/reset-password', expect.objectContaining({ method: 'POST', body: JSON.stringify({ password: 'password-1234' }) }));
  });

  it('uses the existing client for invite list, create, and disable requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, message: 'success', data: { items: [] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.listAdminInvites();
    await api.createAdminInvite({ max_uses: 3 });
    await api.disableAdminInvite(9);

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/admin/invites', expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/admin/invites', expect.objectContaining({ method: 'POST', body: JSON.stringify({ max_uses: 3 }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/admin/invites/9/status', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'disabled' }) }));
  });
});
