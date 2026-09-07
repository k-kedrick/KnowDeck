import { describe, expect, it } from 'vitest';
import { decodeHeadingHash, ensureDocumentHeadingIds, findDocumentHeading } from './documentHeadings';

describe('document heading anchors', () => {
  it('keeps usable IDs and gives historical HTML headings stable unique IDs', () => {
    const html = ensureDocumentHeadingIds(`
      <div id="occupied"></div>
      <h2 id="kept">已有 ID</h2>
      <h3>中文 标题</h3>
      <h3>中文 标题</h3>
      <h4 id="kept">重复 ID</h4>
    `);
    const container = document.createElement('div');
    container.innerHTML = html;
    const headings = Array.from(container.querySelectorAll<HTMLElement>('h2, h3, h4'));

    expect(headings.map((heading) => heading.id)).toEqual([
      'kept',
      'heading-1-中文-标题',
      'heading-2-中文-标题',
      'heading-3-重复-id',
    ]);
    expect(ensureDocumentHeadingIds(html)).toBe(html);
    expect(findDocumentHeading(container, 'heading-2-中文-标题')?.textContent).toBe('中文 标题');
  });

  it('decodes encoded and malformed URL hashes safely', () => {
    expect(decodeHeadingHash('#heading-1-%E4%B8%AD%E6%96%87')).toBe('heading-1-中文');
    expect(decodeHeadingHash('#bad-%E0%A4%A')).toBe('bad-%E0%A4%A');
    expect(decodeHeadingHash('')).toBe('');
  });
});
