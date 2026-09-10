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

  it('serializes public multi-tag filters as repeated tag parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, message: 'success', data: { list: [], total: 0, page: 1, page_size: 10 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.getDocuments({ tags: ['gemini', 'claude'], page: 1, page_size: 10 });

    expect(fetchMock).toHaveBeenCalledWith('/api/public/documents?tag=gemini&tag=claude&page=1&page_size=10', expect.any(Object));
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

  it('changes the current member password through the protected endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, message: 'success', data: { token: 'fresh-token', user: { id: 2, username: 'member' } } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('kb_token', 'old-token');

    await expect(api.memberChangePassword('current-password', 'new-password-123')).resolves.toEqual({
      token: 'fresh-token',
      user: { id: 2, username: 'member' },
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/password', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ current_password: 'current-password', new_password: 'new-password-123' }),
      headers: expect.objectContaining({ Authorization: 'Bearer old-token' }),
    }));
  });

  it('returns a readable message when a server route is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '404 page not found',
    }));

    await expect(api.memberChangePassword('current-password', 'new-password-123')).rejects.toMatchObject({
      status: 404,
      message: '请求的服务接口不存在',
    });
  });

  it('uses the existing client for invite list, create, and disable requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, message: 'success', data: { items: [] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.listAdminInvites();
    await api.createAdminInvite({ max_uses: 3 });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/admin/invites', expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/admin/invites', expect.objectContaining({ method: 'POST', body: JSON.stringify({ max_uses: 3 }) }));
  });

  it('reports chunked upload progress without serializing its callback', async () => {
    const chunkSize = 20 * 1024 * 1024;
    const media = { id: 1, original_name: 'large.mp4', media_type: 'video' };
    const fetchMock = vi.fn(async (url: string, _options?: RequestInit) => {
      if (url.endsWith('/upload-sessions')) {
        return { ok: true, json: async () => ({ code: 0, data: { upload_id: 'session', chunk_size: chunkSize, chunks: 2 } }) };
      }
      if (url.endsWith('/complete')) {
        return { ok: true, json: async () => ({ code: 0, data: media }) };
      }
      return { ok: true, text: async () => '' };
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(1000).mockReturnValueOnce(2000);
    const onProgress = vi.fn();
    const file = new File([new Uint8Array(chunkSize + 1)], 'large.mp4', { type: 'video/mp4' });

    await expect(api.uploadMedia(file, { document_id: 7, onProgress })).resolves.toEqual(media);

    expect(onProgress).toHaveBeenNthCalledWith(1, expect.objectContaining({ completedChunks: 0, chunks: 2, uploadedBytes: 0 }));
    expect(onProgress).toHaveBeenNthCalledWith(2, expect.objectContaining({ completedChunks: 1, chunks: 2, uploadedBytes: chunkSize }));
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ completedChunks: 2, uploadedBytes: file.size, remainingSeconds: 0 }));
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).not.toContain('onProgress');
  });
});
