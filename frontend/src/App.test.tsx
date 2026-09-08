import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  getSiteInfo: vi.fn(),
  getKnowledgeTree: vi.fn(),
  getDocumentBySlug: vi.fn(),
  getDocuments: vi.fn(),
  getTags: vi.fn(),
  search: vi.fn(),
}));

vi.mock('./api', async (importOriginal) => {
  const original = await importOriginal<typeof import('./api')>();
  return { ...original, api: { ...original.api, ...apiMocks } };
});

import { ApiError } from './api';
import { App } from './App';

const summary = (id: number, slug: string, title: string) => ({
  id,
  slug,
  title,
  excerpt: '',
  cover: '',
  views: 0,
  updated_at: '2026-01-01T00:00:00Z',
});

const detail = (id: number, slug: string, title: string) => ({
  document: {
    ...summary(id, slug, title),
    content: `# ${title}`,
    status: 'published' as const,
    category_id: 1,
    author_id: 1,
    sort_order: 0,
    is_pinned: false,
    created_at: '2026-01-01T00:00:00Z',
  },
});

const knowledgeTree = [{
  id: 1,
  name: '指南',
  slug: 'guide',
  icon: '',
  documents: [summary(1, 'a', '文章 A'), summary(2, 'b', '文章 B')],
}];

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

const expectDocumentTitle = async (title: string) => {
  await waitFor(() => expect(document.querySelector('main > header h1')?.textContent).toBe(title));
};

describe('public document routing', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    localStorage.clear();
    apiMocks.getSiteInfo.mockReset().mockResolvedValue(null);
    apiMocks.getKnowledgeTree.mockReset().mockResolvedValue(knowledgeTree);
    apiMocks.getDocumentBySlug.mockReset().mockImplementation((slug: string) =>
      Promise.resolve(slug === 'a'
        ? { ...detail(1, 'a', '文章 A'), neighbor: { next: summary(2, 'b', '文章 B') } }
        : { ...detail(2, 'b', '文章 B'), neighbor: { prev: summary(1, 'a', '文章 A') } }),
    );
    apiMocks.search.mockReset().mockResolvedValue([]);
    apiMocks.getDocuments.mockReset().mockResolvedValue({ total: 2, page: 1, page_size: 10, list: [
      { ...summary(1, 'a', '文章 A'), status: 'published', category_id: 1, author_id: 1, sort_order: 0, is_pinned: false, created_at: '2026-01-01T00:00:00Z', category_name: '指南', tags: ['React'], reading_time: 3 },
      { ...summary(2, 'b', '文章 B'), status: 'published', category_id: 1, author_id: 1, sort_order: 0, is_pinned: false, created_at: '2026-01-01T00:00:00Z' },
    ] });
    apiMocks.getTags.mockReset().mockResolvedValue([{ id: 1, name: 'React', slug: 'react', doc_count: 1 }]);
  });

  afterEach(cleanup);

  it('loads a document only once for one route navigation, including StrictMode', async () => {
    window.history.replaceState(null, '', '/docs/a');
    render(<StrictMode><App /></StrictMode>);

    await expectDocumentTitle('文章 A');
    expect(apiMocks.getDocumentBySlug.mock.calls.filter(([slug]) => slug === 'a')).toHaveLength(1);

    fireEvent.click(await screen.findByRole('link', { name: /下一篇.*文章 B/ }));
    await expectDocumentTitle('文章 B');
    expect(apiMocks.getDocumentBySlug.mock.calls.filter(([slug]) => slug === 'b')).toHaveLength(1);
  });

  it('renders the homepage and article list with real document links', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: '知识库', level: 1 })).toBeTruthy();
    expect((await screen.findByRole('link', { name: /文章 A/ })).getAttribute('href')).toBe('/docs/a');
    expect(screen.getByRole('navigation', { name: '主导航' }).querySelectorAll('a')).toHaveLength(2);
    expect(screen.queryByRole('link', { name: '文档' })).toBeNull();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('dialog', { name: '搜索知识库' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });

    cleanup();
    window.history.replaceState(null, '', '/blog');
    render(<App />);
    expect(await screen.findByRole('heading', { name: '文章与文档' })).toBeTruthy();
    expect((await screen.findByRole('link', { name: /文章 A/ })).getAttribute('href')).toBe('/docs/a');
  });

  it('updates route-specific metadata from home to blog and article', async () => {
    apiMocks.getSiteInfo.mockResolvedValue({
      site_name: '测试知识库',
      site_subtitle: '真实的站点介绍',
      site_logo: '',
      footer_text: '',
      allow_download: true,
      doc_count: 2,
      category_count: 1,
      tag_count: 1,
    });
    apiMocks.getDocumentBySlug.mockResolvedValue({
      document: {
        ...detail(1, 'a', '文章 A').document,
        excerpt: '文章 A 的真实摘要',
        cover: '/uploads/article-a.jpg',
        category_name: '指南',
        author_name: '真实作者',
        tags: ['React'],
        published_at: '2026-01-01T00:00:00Z',
      },
    });

    render(<App />);
    await waitFor(() => expect(document.title).toBe('测试知识库'));
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe('真实的站点介绍');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href.endsWith('/')).toBe(true);

    fireEvent.click(screen.getAllByRole('link', { name: '文章' })[0]);
    await waitFor(() => expect(document.title).toBe('文章 - 测试知识库'));
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href.endsWith('/blog')).toBe(true);

    fireEvent.click((await screen.findAllByRole('link', { name: /文章 A/ }))[0]);
    await waitFor(() => expect(document.title).toBe('文章 A - 测试知识库'));
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe('文章 A 的真实摘要');
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:type"]')?.content).toBe('article');
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content).toBe('文章 A - 测试知识库');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href.endsWith('/docs/a')).toBe(true);
  });

  it('does not let an older request overwrite the latest document', async () => {
    const first = deferred<ReturnType<typeof detail>>();
    const second = deferred<ReturnType<typeof detail>>();
    apiMocks.getDocumentBySlug.mockImplementation((slug: string) =>
      slug === 'a'
        ? first.promise.then((res) => ({ ...res, neighbor: { next: summary(2, 'b', '文章 B') } }))
        : second.promise,
    );
    window.history.replaceState(null, '', '/docs/a');
    render(<App />);

    await act(async () => first.resolve(detail(1, 'a', '文章 A')));
    await waitFor(() => expect(apiMocks.getDocumentBySlug).toHaveBeenCalledWith('a', expect.any(AbortSignal)));
    fireEvent.click(await screen.findByRole('link', { name: /下一篇.*文章 B/ }));
    await waitFor(() => expect(apiMocks.getDocumentBySlug).toHaveBeenCalledWith('b', expect.any(AbortSignal)));

    await act(async () => second.resolve(detail(2, 'b', '文章 B')));
    await expectDocumentTitle('文章 B');

    await act(async () => first.resolve(detail(1, 'a', '文章 A')));
    await expectDocumentTitle('文章 B');
    expect(document.querySelector('main > header h1')?.textContent).not.toBe('文章 A');
  });

  it('distinguishes a missing document from a network error', async () => {
    window.history.replaceState(null, '', '/docs/missing');
    apiMocks.getDocumentBySlug.mockRejectedValueOnce(new ApiError('not found', 404));
    const { unmount } = render(<App />);
    expect(await screen.findByRole('heading', { name: '文章不存在' })).toBeTruthy();

    unmount();
    window.history.replaceState(null, '', '/docs/offline');
    apiMocks.getDocumentBySlug.mockRejectedValueOnce(new TypeError('Network error'));
    render(<App />);
    expect(await screen.findByRole('heading', { name: '文章加载失败' })).toBeTruthy();
  });

  it('shows a real client-side 404 for an unknown route', async () => {
    window.history.replaceState(null, '', '/unknown/path');
    render(<App />);
    expect(await screen.findByRole('heading', { name: '页面不存在' })).toBeTruthy();
    await waitFor(() => expect(document.title).toBe('页面不存在 - 技术知识库'));
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex,nofollow');
    expect(apiMocks.getDocumentBySlug).not.toHaveBeenCalled();
  });
});
