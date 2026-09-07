import { afterEach, describe, expect, it } from 'vitest';
import { applySEO, textDescription } from './seo';

const clearManagedSEO = () => {
  document.head.querySelectorAll('[data-seo-managed="true"], [data-seo], #seo-structured-data').forEach((element) => element.remove());
  document.title = '';
};

afterEach(clearManagedSEO);

describe('SEO metadata utilities', () => {
  it('applies canonical, social, article and structured metadata', () => {
    window.history.replaceState(null, '', '/docs/seo-article');
    applySEO({
      title: 'SEO article - Knowledge Base',
      description: 'A safely generated article description.',
      canonicalPath: '/docs/seo-article',
      siteName: 'Knowledge Base',
      type: 'article',
      image: '/uploads/cover.jpg',
      article: {
        publishedTime: '2026-08-01T12:00:00Z',
        modifiedTime: '2026-08-02T12:00:00Z',
        section: 'Engineering',
        tags: ['React', 'SEO'],
      },
      structuredData: { '@context': 'https://schema.org', '@type': 'TechArticle', headline: '<safe>' },
    });

    expect(document.title).toBe('SEO article - Knowledge Base');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(`${window.location.origin}/docs/seo-article`);
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe('A safely generated article description.');
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:type"]')?.content).toBe('article');
    expect(document.querySelector<HTMLMetaElement>('meta[name="twitter:card"]')?.content).toBe('summary_large_image');
    expect(document.querySelectorAll('meta[property="article:tag"]')).toHaveLength(2);
    expect(document.getElementById('seo-structured-data')?.textContent).toContain('\\u003csafe>');
  });

  it('removes stale article-only metadata and canonical from noindex error pages', () => {
    const serverTag = document.createElement('meta');
    serverTag.setAttribute('property', 'article:tag');
    serverTag.setAttribute('data-seo', 'article:tag');
    serverTag.content = 'stale';
    document.head.appendChild(serverTag);

    applySEO({
      title: 'Not found',
      description: 'The page does not exist.',
      canonicalPath: null,
      siteName: 'Knowledge Base',
      robots: 'noindex,nofollow',
    });

    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('meta[property="article:tag"]')).toBeNull();
    expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex,nofollow');
  });

  it('creates a concise plain-text description from Markdown content', () => {
    const content = '# Heading\n\n[Useful link](https://example.com) and `inline` text.\n\n```ts\nconst hidden = true\n```';
    expect(textDescription('', content)).toBe('Heading Useful link and inline text.');
    expect(textDescription('<strong>Summary</strong> with `formatting`', '')).toBe('Summary with formatting');
    expect(textDescription('123456', '', 5)).toBe('1234…');
  });
});
