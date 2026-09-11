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

const LOCALIZABLE_IMAGE_RE = /(?:<img\b[^>]*\bsrc\s*=\s*["']|!\[[^\]]*\]\()\s*(?:https?:\/\/|data:image\/)/i;

export function hasLocalizableDocumentImages(content: string): boolean {
  return LOCALIZABLE_IMAGE_RE.test(content);
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
