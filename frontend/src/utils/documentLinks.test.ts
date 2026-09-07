import { describe, expect, it } from 'vitest';
import { enhanceDocumentHtmlLinks } from './documentLinks';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('enhanceDocumentHtmlLinks', () => {
  it('links bare HTTP(S) URLs only in text nodes', () => {
    const source = `
      <p>打开 https://gemini.google.com/app，然后访问 https://2fa.cn/验证码。</p>
      <pre>https://pre.example.com</pre>
      <code>https://code.example.com</code>
      <img src="https://images.example.com/a.png?x=1&amp;y=2" alt="fixture" />
    `;
    const doc = parse(enhanceDocumentHtmlLinks(source));

    expect(doc.querySelector('a[href="https://gemini.google.com/app"]')).not.toBeNull();
    expect(doc.querySelector('a[href="https://2fa.cn/"]')?.textContent).toBe('https://2fa.cn/');
    expect(doc.body.textContent).toContain('验证码。');
    expect(doc.querySelector('pre a, code a')).toBeNull();
    expect(doc.querySelector('img')?.getAttribute('src')).toBe('https://images.example.com/a.png?x=1&y=2');
  });

  it('does not link dangerous or non-HTTP schemes', () => {
    const doc = parse(enhanceDocumentHtmlLinks(`
      <p>javascript:alert(1) data:text/html,bad file:///tmp/a vbscript:bad</p>
    `));
    expect(doc.querySelector('a')).toBeNull();
  });

  it('preserves existing anchors and applies internal/external navigation semantics', () => {
    const doc = parse(enhanceDocumentHtmlLinks(`
      <a href="/docs/internal" target="_blank" rel="noopener noreferrer">Internal</a>
      <a href="#section" target="_blank">Hash</a>
      <a href="https://example.com/docs">External</a>
    `));
    const internal = doc.querySelector<HTMLAnchorElement>('a[href="/docs/internal"]');
    const hash = doc.querySelector<HTMLAnchorElement>('a[href="#section"]');
    const external = doc.querySelector<HTMLAnchorElement>('a[href="https://example.com/docs"]');

    expect(internal?.hasAttribute('target')).toBe(false);
    expect(hash?.hasAttribute('target')).toBe(false);
    expect(external?.target).toBe('_blank');
    expect(external?.rel).toBe('noopener noreferrer');
  });
});
