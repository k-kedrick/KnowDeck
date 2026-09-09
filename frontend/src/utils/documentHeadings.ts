const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';

const isUsableHeadingId = (id: string) => Boolean(id && !/[\s#]/u.test(id));

const headingSlug = (text: string) => text
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}_-]+/gu, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 72);

const uniqueHeadingId = (base: string, usedIds: Set<string>) => {
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
};

/** Add stable anchors directly to headings in a DOM container. */
export const applyDocumentHeadingIds = (root: ParentNode): void => {
  const headings = Array.from(root.querySelectorAll<HTMLElement>(HEADING_SELECTOR));
  const headingSet = new Set(headings);
  const usedIds = new Set<string>();

  root.querySelectorAll<HTMLElement>('[id]').forEach((element) => {
    if (!headingSet.has(element) && isUsableHeadingId(element.id)) usedIds.add(element.id);
  });

  headings.forEach((heading, index) => {
    const existingId = heading.id.trim();
    if (isUsableHeadingId(existingId) && !usedIds.has(existingId)) {
      usedIds.add(existingId);
      return;
    }

    const slug = headingSlug(heading.textContent?.trim() || '') || 'section';
    heading.id = uniqueHeadingId(`heading-${index}-${slug}`, usedIds);
  });
};

/** Add stable anchors before historical HTML is mounted by React. */
export const ensureDocumentHeadingIds = (html: string): string => {
  if (!html || typeof document === 'undefined') return html;

  const container = document.createElement('div');
  container.innerHTML = html;
  applyDocumentHeadingIds(container);
  return container.innerHTML;
};

export const findDocumentHeading = (root: ParentNode, id: string): HTMLElement | null => (
  Array.from(root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)).find((heading) => heading.id === id) || null
);

export interface ScrollDocumentHeadingOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  highlight?: boolean;
}

/** Scroll and briefly mark the current heading, resolving it again after React updates. */
export const scrollToDocumentHeading = (
  root: ParentNode,
  id: string,
  options: ScrollDocumentHeadingOptions = {},
): boolean => {
  const target = findDocumentHeading(root, id);
  if (!target) return false;

  target.scrollIntoView({
    behavior: options.behavior || 'smooth',
    block: options.block || 'start',
  });

  if (options.highlight !== false) {
    setTimeout(() => {
      const currentTarget = findDocumentHeading(root, id);
      if (!currentTarget) return;
      currentTarget.classList.add('ring-2', 'ring-blue-500', 'rounded-lg', 'transition-all');
      setTimeout(() => {
        currentTarget.classList.remove('ring-2', 'ring-blue-500', 'rounded-lg');
      }, 1500);
    }, 0);
  }

  return true;
};

export const decodeHeadingHash = (hash: string): string => {
  const value = hash.replace(/^#/, '');
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
