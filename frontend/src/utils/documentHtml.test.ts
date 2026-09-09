import { describe, expect, it } from 'vitest';
import { processDocumentHtml } from './documentHtml';

describe('processDocumentHtml single-pass pipeline', () => {
  it('handles empty or whitespace strings', () => {
    expect(processDocumentHtml('')).toBe('');
    expect(processDocumentHtml('   ')).toBe('   ');
  });

  it('performs image proxying, lazy loading, link enhancing, and heading ID generation in one pass', () => {
    const feishu = 'https://scnyv437r6d7.feishu.cn/space/api/box/stream/download/asynccode/?code=signed&scene_type=CCM';
    const inputHtml = `
      <h1>Main Introduction</h1>
      <p>Visit our website: https://example.com/guide for details.</p>
      <img id="feishu-img" src="${feishu}" alt="Feishu" />
      <img id="local-img" src="/uploads/pic.png" alt="Local" />
      <h2>Secondary Section</h2>
      <p>More text</p>
    `;

    const result = processDocumentHtml(inputHtml);

    const doc = new DOMParser().parseFromString(result, 'text/html');

    // 1. Headings have generated IDs
    const h1 = doc.querySelector('h1');
    const h2 = doc.querySelector('h2');
    expect(h1?.id).toBe('heading-0-main-introduction');
    expect(h2?.id).toBe('heading-1-secondary-section');

    // 2. Bare URL was linked
    const link = doc.querySelector('a[href="https://example.com/guide"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');

    // 3. Feishu image proxied and lazy loaded
    const feishuImg = doc.querySelector<HTMLImageElement>('#feishu-img');
    expect(feishuImg?.getAttribute('src')).toContain('/api/public/external-image?url=');
    expect(feishuImg?.getAttribute('loading')).toBe('lazy');
    expect(feishuImg?.getAttribute('decoding')).toBe('async');

    // 4. Local image not proxied, but lazy loaded
    const localImg = doc.querySelector<HTMLImageElement>('#local-img');
    expect(localImg?.getAttribute('src')).toBe('/uploads/pic.png');
    expect(localImg?.getAttribute('loading')).toBe('lazy');
    expect(localImg?.getAttribute('decoding')).toBe('async');
  });
});
