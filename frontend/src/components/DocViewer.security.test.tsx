import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DocViewer } from './DocViewer';
import type { DocDetailData } from '../api';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

function documentData(content: string): DocDetailData {
  return {
    document: {
      id: 1,
      title: 'Security test',
      slug: 'security-test',
      content,
      excerpt: '',
      cover: '',
      status: 'published',
      category_id: 1,
      author_id: 1,
      sort_order: 0,
      is_pinned: false,
      views: 0,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  };
}

const renderViewer = (content: string) => render(
  <MemoryRouter>
    <DocViewer data={documentData(content)} loading={false} />
  </MemoryRouter>,
);

describe('DocViewer Markdown security pipeline', () => {
  it('auto-links safe bare URLs in historical HTML without touching code or image sources', () => {
    const source = `<div>
      <p>Gemini: https://gemini.google.com/app</p>
      <p>Security: https://myaccount.google.com/security</p>
      <code>https://code.example.com</code>
      <img src="https://images.example.com/a.png?x=1&amp;y=2" alt="Historical" />
      <p>javascript:alert(1) data:text/html,bad file:///tmp/a</p>
    </div>`;
    const { container } = renderViewer(source);

    const gemini = screen.getByRole('link', { name: 'https://gemini.google.com/app' });
    expect(gemini.getAttribute('target')).toBe('_blank');
    expect(gemini.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByRole('link', { name: 'https://myaccount.google.com/security' })).not.toBeNull();
    expect(container.querySelector('code a')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://images.example.com/a.png?x=1&y=2');
    expect(container.querySelectorAll('article a')).toHaveLength(2);
  });

  it('routes only approved historical Feishu images through the same-origin proxy', () => {
    const feishu = 'https://scnyv437r6d7.feishu.cn/space/api/box/stream/download/asynccode/?code=signed&scene_type=CCM';
    const { container } = renderViewer(`<div>
      <img id="feishu" src="${feishu.replaceAll('&', '&amp;')}" alt="Feishu" />
      <img id="local" src="/uploads/images/local.png" alt="Local" />
    </div>`);
    const proxied = container.querySelector<HTMLImageElement>('img[alt="Feishu"]')?.getAttribute('src') || '';

    expect(proxied).toContain('/api/public/external-image?url=');
    expect(new URLSearchParams(proxied.split('?')[1]).get('url')).toBe(feishu);
    expect(container.querySelector('img[alt="Local"]')?.getAttribute('src')).toBe('/uploads/images/local.png');
  });

  it('keeps historical HTML internal and hash links in the current tab', () => {
    const { container } = renderViewer('<div><a href="/docs/internal">Internal</a><a href="#part">Hash</a></div>');
    const internal = screen.getByRole('link', { name: 'Internal' });
    const hash = screen.getByRole('link', { name: 'Hash' });

    expect(internal.hasAttribute('target')).toBe(false);
    expect(hash.hasAttribute('target')).toBe(false);
    expect(fireEvent.click(internal)).toBe(false);
    expect(container.querySelector('article')).not.toBeNull();
  });

  it('keeps copied state stable and isolated for duplicate code blocks', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const content = `\`\`\`ts
const same = true
\`\`\`

\`\`\`ts
const same = true
\`\`\``;

    renderViewer(content);

    const copyButtons = screen.getAllByRole('button', { name: '复制 ts 代码' });
    fireEvent.click(copyButtons[0]);
    await waitFor(() => expect(screen.getAllByText('已复制')).toHaveLength(1));
    expect(screen.getAllByText('复制代码')).toHaveLength(1);

    fireEvent.click(screen.getAllByRole('button', { name: '复制 ts 代码' })[1]);
    await waitFor(() => expect(screen.getAllByText('已复制')).toHaveLength(2));
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it('sanitizes raw HTML embedded in Markdown before it reaches the DOM', () => {
    const content = `# Safe heading

<script>window.__xss = true</script>
<img src="javascript:alert(1)" onerror="alert(1)" />
<a href="javascript:alert(1)">unsafe link</a>
<iframe src="data:text/html;base64,PHNjcmlwdD4="></iframe>
<p style="color: #ef4444; background: url(javascript:alert(1))" onclick="alert(1)">safe text</p>`;

    const { container } = renderViewer(content);

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('[onerror], [onclick]')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('article a')?.getAttribute('href')).toBe('#');
    expect(container.textContent).toContain('Safe heading');
    expect(container.textContent).toContain('safe text');
    expect(container.innerHTML).not.toContain('url(');
  });

  it('preserves supported Markdown, rich media, tables, code, and lazily loaded KaTeX', async () => {
    const content = `# Document

| A | B |
| - | - |
| 1 | 2 |

\`\`\`ts
const safe = true
\`\`\`

$E = mc^2$

<video src="/uploads/videos/demo.mp4" controls></video>
<iframe src="https://video.example.com/embed/1" title="Video"></iframe>`;

    const { container } = renderViewer(content);

    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull(), { timeout: 3000 });
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Document' }).length).toBeGreaterThan(0));
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.querySelector('article h2')?.textContent).toBe('Document');
    expect(container.querySelector('pre code')?.textContent).toContain('const safe');
    expect(container.querySelector('video')?.getAttribute('src')).toBe('/uploads/videos/demo.mp4');
    expect(container.querySelector('iframe')?.getAttribute('sandbox')).toContain('allow-scripts');
  });

  it('renders a borderless fluid desktop table of contents with ellipsized labels', async () => {
    renderViewer(`# 一级目录标题

## 二级目录标题

### 三级目录标题`);

    const desktopToc = await screen.findByTestId('desktop-toc');
    await waitFor(() => expect(desktopToc.querySelectorAll('nav a')).toHaveLength(4));
    const allLinks = Array.from(desktopToc.querySelectorAll<HTMLAnchorElement>('nav a'));
    const links = allLinks.slice(1);

    expect(links).toHaveLength(3);
    expect(links.map((link) => link.dataset.level)).toEqual(['2', '3', '4']);
    expect(links.map((link) => link.style.paddingLeft)).toEqual(['20px', '34px', '48px']);
    expect(allLinks[0].getAttribute('aria-current')).toBe('location');
    expect(allLinks[0].className).not.toContain('bg-[#3370ff]');
    expect(desktopToc.className).toContain('document-reading-toc');
    expect(links[0].className).toContain('overflow-hidden');
    expect(links[0].querySelector('span:last-child')?.className).toContain('text-ellipsis');
  });

  it('scrolls to a heading and activates it when the public table of contents is clicked', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });

    const { container } = renderViewer('<div><h1>第一个标题</h1><h2>第二个标题</h2></div>');
    const desktopToc = await screen.findByTestId('desktop-toc');
    await waitFor(() => expect(desktopToc.querySelectorAll('nav a')).toHaveLength(3));
    const links = Array.from(desktopToc.querySelectorAll<HTMLAnchorElement>('nav a'));
    const targetId = links[1].getAttribute('href')?.slice(1) || '';

    fireEvent.click(links[1]);

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(links[1].getAttribute('aria-current')).toBe('location');
    await waitFor(() => expect(container.querySelector(`#${targetId}`)?.classList.contains('ring-2')).toBe(true));
    expect(decodeURIComponent(window.location.hash.slice(1))).toBe(targetId);
  });

  it('restores a stable historical HTML heading from the URL hash', async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    window.history.replaceState(null, '', '/docs/example#heading-1-%E9%87%8D%E5%A4%8D%E6%A0%87%E9%A2%98');

    renderViewer('<div><h1 id="kept-heading">已有标题</h1><h2>重复标题</h2><h2>重复标题</h2></div>');

    const desktopToc = await screen.findByTestId('desktop-toc');
    await waitFor(() => expect(desktopToc.querySelectorAll('nav a')).toHaveLength(4));
    const hrefs = Array.from(desktopToc.querySelectorAll<HTMLAnchorElement>('nav a')).map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['#doc-title', '#kept-heading', '#heading-1-重复标题', '#heading-2-重复标题']);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' }));
  });

  it('renders previous and next documents as crawlable links', () => {
    const data = documentData('# Current article');
    data.neighbor = {
      prev: { id: 2, title: 'Previous article', slug: 'previous article', excerpt: '', cover: '', views: 0, updated_at: '2026-01-01T00:00:00Z' },
      next: { id: 3, title: 'Next article', slug: 'next-article', excerpt: '', cover: '', views: 0, updated_at: '2026-01-01T00:00:00Z' },
    };

    render(<MemoryRouter><DocViewer data={data} loading={false} /></MemoryRouter>);

    expect(screen.getByRole('link', { name: /上一篇.*Previous article/ }).getAttribute('href')).toBe('/docs/previous%20article');
    expect(screen.getByRole('link', { name: /下一篇.*Next article/ }).getAttribute('href')).toBe('/docs/next-article');
  });

  it('keeps backend downloads and uploaded resources as native links', () => {
    const content = `[Download](/api/public/media/download/7)

[Uploaded file](/uploads/files/manual.pdf)

[Article](/docs/internal-article)`;

    renderViewer(content);

    const downloadLink = screen.getByRole('link', { name: 'Download' });
    const articleLink = screen.getByRole('link', { name: 'Article' });
    expect(downloadLink.getAttribute('href')).toBe('/api/public/media/download/7');
    expect(screen.getByRole('link', { name: 'Uploaded file' }).getAttribute('href')).toBe('/uploads/files/manual.pdf');
    expect(articleLink.getAttribute('href')).toBe('/docs/internal-article');
    expect(fireEvent.click(downloadLink)).toBe(true);
    expect(fireEvent.click(articleLink)).toBe(false);
  });
});
