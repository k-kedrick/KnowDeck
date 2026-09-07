import { mergeAttributes, Node } from '@tiptap/core';

const ATTACHMENT_URL_RE = /\/(?:uploads\/files|api\/public\/media)\//i;
const SAFE_DIMENSION_RE = /^(?:\d{1,4}(?:px)?|\d{1,3}%|auto)$/i;

const safeDimension = (value: unknown): string | null => {
  const normalized = String(value ?? '').trim();
  return SAFE_DIMENSION_RE.test(normalized) ? normalized : null;
};

export const VideoNode = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
      poster: { default: null },
      preload: { default: null },
      width: { default: null },
      height: { default: null },
    };
  },

  parseHTML() {
    return [{
      tag: 'video',
      getAttrs: (node) => {
        const element = node as HTMLVideoElement;
        const source = element.getAttribute('src') || element.querySelector('source')?.getAttribute('src');
        if (!source) return false;
        return {
          src: source,
          controls: element.hasAttribute('controls'),
          poster: element.getAttribute('poster'),
          preload: element.getAttribute('preload'),
          width: safeDimension(element.getAttribute('width') || element.style.width),
          height: safeDimension(element.getAttribute('height') || element.style.height),
        };
      },
    }];
  },

  renderHTML({ HTMLAttributes }) {
    const attributes: Record<string, unknown> = {
      src: HTMLAttributes.src,
      controls: HTMLAttributes.controls ? 'controls' : null,
      poster: HTMLAttributes.poster,
      preload: HTMLAttributes.preload,
      width: safeDimension(HTMLAttributes.width),
      height: safeDimension(HTMLAttributes.height),
      class: 'w-full rounded-xl my-4',
    };
    return ['video', mergeAttributes(attributes)];
  },
});

export const AttachmentNode = Node.create({
  name: 'attachment',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      href: { default: null },
      label: { default: '附件' },
    };
  },

  parseHTML() {
    return [{
      // Restrict the selector before getAttrs runs. A generic `p` rule with a
      // high priority competes with the paragraph node and can be considered
      // twice while ProseMirror reparses a changed slice.
      tag: 'p.attachment, p[data-attachment], p:has(> a[href*="/uploads/files/"]), p:has(> a[href*="/api/public/media/"])',
      priority: 1100,
      getAttrs: (node) => {
        const element = node as HTMLParagraphElement;
        const anchor = element.children.length === 1 ? element.querySelector(':scope > a[href]') : null;
        const href = anchor?.getAttribute('href') || '';
        if (!ATTACHMENT_URL_RE.test(href)) return false;
        return {
          href,
          label: (anchor?.textContent || '附件').replace(/^\s*📎\s*/, '').trim() || '附件',
        };
      },
    }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'p',
      { class: 'attachment' },
      ['a', { href: HTMLAttributes.href, target: '_blank', rel: 'noopener noreferrer' }, `📎 ${HTMLAttributes.label || '附件'}`],
    ];
  },
});

export const IframeNode = Node.create({
  name: 'iframe',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: null },
      width: { default: null },
      height: { default: null },
      sandbox: { default: null },
      loading: { default: 'lazy' },
      referrerpolicy: { default: 'no-referrer' },
      allow: { default: null },
      allowfullscreen: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: 'iframe[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['iframe', mergeAttributes({
      ...HTMLAttributes,
      width: safeDimension(HTMLAttributes.width),
      height: safeDimension(HTMLAttributes.height),
      allowfullscreen: HTMLAttributes.allowfullscreen ? 'allowfullscreen' : null,
    })];
  },
});
