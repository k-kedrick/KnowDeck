import { describe, expect, it } from 'vitest';
import { applyHistoricalDocumentImages, hasLocalizableDocumentImages } from './documentImages';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('applyHistoricalDocumentImages', () => {
  it('rewrites only the approved Feishu image endpoint', () => {
    const feishu = 'https://scnyv437r6d7.feishu.cn/space/api/box/stream/download/asynccode/?code=signed&scene_type=CCM';
    const doc = parse(`
      <img id="feishu" src="${feishu}" />
      <img id="local" src="/uploads/images/local.png" />
      <img id="external" src="https://images.example.com/a.png" />
    `);
    applyHistoricalDocumentImages(doc.body);

    const proxied = doc.querySelector<HTMLImageElement>('#feishu')?.getAttribute('src') || '';
    expect(proxied).toContain('/api/public/external-image?url=');
    expect(new URLSearchParams(proxied.split('?')[1]).get('url')).toBe(feishu);
    expect(doc.querySelector('#local')?.getAttribute('src')).toBe('/uploads/images/local.png');
    expect(doc.querySelector('#external')?.getAttribute('src')).toBe('https://images.example.com/a.png');
  });

  it('does not proxy lookalike hosts, insecure URLs, or other paths', () => {
    const doc = parse(`
      <img src="https://scnyv437r6d7.feishu.cn.evil.example/space/api/box/stream/download/asynccode/?code=x" />
      <img src="http://scnyv437r6d7.feishu.cn/space/api/box/stream/download/asynccode/?code=x" />
      <img src="https://scnyv437r6d7.feishu.cn/other/path?code=x" />
    `);
    applyHistoricalDocumentImages(doc.body);
    expect(Array.from(doc.querySelectorAll('img')).every((image) => !image.src.includes('/api/public/external-image'))).toBe(true);
  });
});

describe('hasLocalizableDocumentImages', () => {
  it('only selects external or data images for save-time localization', () => {
    expect(hasLocalizableDocumentImages('<p><img src="/uploads/local.png"></p>')).toBe(false);
    expect(hasLocalizableDocumentImages('![local](/uploads/local.png)')).toBe(false);
    expect(hasLocalizableDocumentImages('<img src="https://images.example.com/remote.png">')).toBe(true);
    expect(hasLocalizableDocumentImages('![paste](data:image/png;base64,AAAA)')).toBe(true);
  });
});
