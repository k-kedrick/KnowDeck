const TRAILING_PUNCTUATION_RE = /[.,;:!?]+$/;
const SKIP_AUTO_LINK_TAGS = new Set(['A', 'CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA', 'KBD', 'SAMP']);

// Matches URLs stopping at whitespace, HTML delimiters, or CJK characters & punctuation
const AUTO_LINK_RE = /https?:\/\/[^\s<>"'\r\n\t\u3000-\u303f\uff01-\uff5e\uffe0-\uffef\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+/gi;

export const isSafeHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

function countChar(str: string, char: string): number {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === char) count++;
  }
  return count;
}

/**
 * Splits a candidate string that begins with a URL into { url, trailing }.
 * Correctly terminates on whitespace, newlines, CJK characters, CJK punctuation,
 * and trailing ASCII prose punctuation (while respecting balanced parentheses).
 */
export function splitUrlAndTrailingText(input: string): { url: string; trailing: string } | null {
  if (!input || !input.trim()) return null;
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;

  // Split at the first whitespace, newline, or CJK character / CJK punctuation
  const cjkOrWhitespaceMatch = trimmed.match(/[\s\r\n\t\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\uff01-\uff5e\uffe0-\uffef]/);
  let candidate = trimmed;
  let trailing = '';
  if (cjkOrWhitespaceMatch && cjkOrWhitespaceMatch.index !== undefined) {
    candidate = trimmed.slice(0, cjkOrWhitespaceMatch.index);
    trailing = trimmed.slice(cjkOrWhitespaceMatch.index);
  }

  // Strip trailing ASCII prose punctuation, respecting balanced parentheses/brackets
  while (candidate.length > 0) {
    const lastChar = candidate[candidate.length - 1];
    if (TRAILING_PUNCTUATION_RE.test(lastChar)) {
      trailing = lastChar + trailing;
      candidate = candidate.slice(0, -1);
      continue;
    }
    if (lastChar === ')' || lastChar === ']') {
      const openChar = lastChar === ')' ? '(' : '[';
      const openCount = countChar(candidate, openChar);
      const closeCount = countChar(candidate, lastChar);
      if (closeCount > openCount) {
        trailing = lastChar + trailing;
        candidate = candidate.slice(0, -1);
        continue;
      }
    }
    break;
  }

  if (!candidate || !isSafeHttpUrl(candidate)) {
    return null;
  }

  return { url: candidate, trailing };
}

/**
 * Normalizes an individual anchor element:
 * 1. Preserves manual custom hyperlinks (<a href="https://example.com">自定义文字</a>).
 * 2. Delimits bare URLs that swallowed trailing CJK or punctuation, trimming the anchor
 *    and ejecting the trailing text outside the anchor as a sibling.
 * 3. Ejects <br> and any content following <br> outside the anchor.
 * 4. Ensures proper target="_blank" and rel="noopener noreferrer" for external HTTP(S) links.
 */
export const normalizeExistingAnchor = (anchor: HTMLAnchorElement, doc: Document) => {
  const rawHref = anchor.getAttribute('href')?.trim() || '';
  if (!rawHref) return;

  if (rawHref.startsWith('#') || (rawHref.startsWith('/') && !rawHref.startsWith('//'))) {
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
    return;
  }

  const textContent = (anchor.textContent || '').trim();
  const hrefSplit = splitUrlAndTrailingText(rawHref);
  const isHrefClean = Boolean(hrefSplit && hrefSplit.url === rawHref && !hrefSplit.trailing);

  // Manual custom hyperlink: href is a clean URL and text does not start with http(s)://
  if (isHrefClean && !/^https?:\/\//i.test(textContent)) {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
    return;
  }

  const cleanUrl = hrefSplit ? hrefSplit.url : (splitUrlAndTrailingText(textContent)?.url || '');
  if (!cleanUrl) return;

  anchor.setAttribute('href', cleanUrl);
  anchor.setAttribute('target', '_blank');
  anchor.setAttribute('rel', 'noopener noreferrer');

  // Eject <br> and any following nodes outside the anchor
  const br = anchor.querySelector('br');
  if (br && anchor.parentNode) {
    const parent = anchor.parentNode;
    const nextNode = anchor.nextSibling;
    let move = false;
    const toMove: Node[] = [];
    for (const child of Array.from(anchor.childNodes)) {
      if (child === br) move = true;
      if (move) toMove.push(child);
    }
    for (const node of toMove) {
      parent.insertBefore(node, nextNode);
    }
  }

  // If text inside anchor starts with cleanUrl and has trailing text, eject it
  let trailingText = hrefSplit?.trailing || '';
  const remainingText = (anchor.textContent || '').trim();
  if (remainingText.startsWith(cleanUrl) && remainingText.length > cleanUrl.length) {
    const extraText = remainingText.slice(cleanUrl.length);
    if (!trailingText) trailingText = extraText;

    const textNodes: Text[] = [];
    const walker = doc.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
    let n = walker.nextNode();
    while (n) {
      textNodes.push(n as Text);
      n = walker.nextNode();
    }

    let matched = 0;
    for (const tn of textNodes) {
      const val = tn.nodeValue || '';
      if (matched + val.length <= cleanUrl.length) {
        matched += val.length;
      } else if (matched < cleanUrl.length) {
        const keepLen = cleanUrl.length - matched;
        tn.nodeValue = val.slice(0, keepLen);
        matched = cleanUrl.length;
      } else {
        tn.remove();
      }
    }
  }

  if (trailingText) {
    // Only insert if trailingText is not already present immediately after the anchor
    const nextText = anchor.nextSibling?.nodeType === Node.TEXT_NODE ? (anchor.nextSibling.nodeValue || '') : '';
    if (!nextText.startsWith(trailingText)) {
      anchor.after(doc.createTextNode(trailingText));
    }
  }
};

/**
 * Normalizes all existing anchors within root.
 */
export function normalizeDocumentAnchors(root: ParentNode, doc?: Document): void {
  const ownerDoc = doc || (root instanceof Document ? root : root.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  if (!ownerDoc) return;

  root.querySelectorAll<HTMLAnchorElement>('a').forEach((anchor) => {
    normalizeExistingAnchor(anchor, ownerDoc);
  });
}

/**
 * Directly enhances links on a DOM node (normalizing anchors and auto-linking text nodes).
 */
export function applyDocumentHtmlLinks(root: ParentNode, doc?: Document): void {
  const ownerDoc = doc || (root instanceof Document ? root : root.ownerDocument) || (typeof document !== 'undefined' ? document : null);
  if (!ownerDoc) return;

  normalizeDocumentAnchors(root, ownerDoc);

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
      const split = splitUrlAndTrailingText(rawMatch);
      if (!split || !split.url) continue;

      const safeUrl = split.url;
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
 * Pure function to safely normalize document links in any HTML content string.
 */
export function normalizeDocumentLinks(content: string): string {
  if (!content || !content.trim() || typeof document === 'undefined') return content;
  const doc = new DOMParser().parseFromString(content, 'text/html');
  applyDocumentHtmlLinks(doc.body, doc);
  return doc.body.innerHTML;
}
