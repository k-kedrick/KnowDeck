const FEISHU_IMAGE_HOST = 'scnyv437r6d7.feishu.cn';
const FEISHU_IMAGE_PATH = '/space/api/box/stream/download/asynccode/';

const shouldProxyImage = (rawSrc: string): boolean => {
  try {
    const url = new URL(rawSrc);
    return url.protocol === 'https:'
      && url.hostname === FEISHU_IMAGE_HOST
      && url.pathname === FEISHU_IMAGE_PATH
      && Boolean(url.searchParams.get('code'));
  } catch {
    return false;
  }
};

export interface HistoricalDocumentImageOptions {
  lazyLoad?: boolean;
}

/**
 * Directly rewrites historical images on a DOM node and optionally applies
 * lazy loading attributes.
 */
export function applyHistoricalDocumentImages(
  root: ParentNode,
  options?: HistoricalDocumentImageOptions,
): void {
  root.querySelectorAll<HTMLImageElement>('img[src]').forEach((image) => {
    const src = image.getAttribute('src') || '';
    if (shouldProxyImage(src)) {
      image.setAttribute('src', `/api/public/external-image?url=${encodeURIComponent(src)}`);
    }
    if (options?.lazyLoad) {
      if (!image.hasAttribute('loading')) image.setAttribute('loading', 'lazy');
      if (!image.hasAttribute('decoding')) image.setAttribute('decoding', 'async');
    }
  });
}

/**
 * Rewrites only the known historical Feishu image endpoint to the restricted
 * same-origin backend proxy. Other external and local image URLs stay intact.
 */
export function proxyHistoricalDocumentImages(sanitizedHtml: string): string {
  if (!sanitizedHtml.trim() || typeof document === 'undefined') return sanitizedHtml;

  const doc = new DOMParser().parseFromString(sanitizedHtml, 'text/html');
  applyHistoricalDocumentImages(doc.body);
  return doc.body.innerHTML;
}
