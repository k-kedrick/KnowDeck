const AUTO_LINK_RE = /https?:\/\/[^\s<>"'\u3000-\u303f\uff00-\uffef\u4e00-\u9fff]+/gi;
const TRAILING_PUNCTUATION_RE = /[.,;:!?)}\]]+$/;
const SKIP_AUTO_LINK_TAGS = new Set(['A', 'CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA', 'KBD', 'SAMP']);

const isSafeHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const normalizeExistingAnchor = (anchor: HTMLAnchorElement) => {
  const href = anchor.getAttribute('href')?.trim() || '';
  if (!href) return;

  if (/^https?:\/\//i.test(href) && isSafeHttpUrl(href)) {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
    return;
  }

  if (href.startsWith('#') || (href.startsWith('/') && !href.startsWith('//'))) {
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
  }
};

/**
 * Directly enhances links on a DOM node (normalizing anchors and auto-linking text nodes).
 */
export function applyDocumentHtmlLinks(root: ParentNode, doc?: Document): void {
  const ownerDoc = doc || (root instanceof Document ? root : root.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  if (!ownerDoc) return;

  root.querySelectorAll<HTMLAnchorElement>('a').forEach(normalizeExistingAnchor);

  const walker = ownerDoc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    const parent = current.parentElement;
    if (parent && !SKIP_AUTO_LINK_TAGS.has(parent.tagName) && /https?:\/\//i.test(current.nodeValue || '')) {
      textNodes.push(current as Text);
    }
    current = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const value = textNode.nodeValue || '';
    const fragment = ownerDoc.createDocumentFragment();
    let cursor = 0;
    let linked = false;

    AUTO_LINK_RE.lastIndex = 0;
    for (const match of value.matchAll(AUTO_LINK_RE)) {
      const start = match.index ?? 0;
      const rawMatch = match[0];
      const safeUrl = rawMatch.replace(TRAILING_PUNCTUATION_RE, '');
      if (!safeUrl || !isSafeHttpUrl(safeUrl)) continue;

      fragment.append(value.slice(cursor, start));
      const anchor = ownerDoc.createElement('a');
      anchor.href = safeUrl;
      anchor.textContent = safeUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      fragment.append(anchor);
      fragment.append(rawMatch.slice(safeUrl.length));
      cursor = start + rawMatch.length;
      linked = true;
    }

    if (!linked) return;
    fragment.append(value.slice(cursor));
    textNode.replaceWith(fragment);
  });
}

/**
 * Adds safe links to bare HTTP(S) URLs in sanitized HTML text nodes.
 * It never applies regex replacement to raw markup or attributes.
 */
export function enhanceDocumentHtmlLinks(sanitizedHtml: string): string {
  if (!sanitizedHtml.trim() || typeof document === 'undefined') return sanitizedHtml;

  const doc = new DOMParser().parseFromString(sanitizedHtml, 'text/html');
  applyDocumentHtmlLinks(doc.body, doc);
  return doc.body.innerHTML;
}
