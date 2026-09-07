import Image from '@tiptap/extension-image';

const SAFE_DIMENSION_RE = /^(?:\d{1,4}(?:px)?|\d{1,3}%|auto)$/i;
const SAFE_ALIGN_RE = /^(?:left|center|right)$/;

const readDimension = (element: HTMLElement, name: 'width' | 'height') => {
  const attribute = element.getAttribute(name)?.trim() || '';
  const styleValue = element.style[name]?.trim() || '';
  const value = attribute || styleValue;
  return SAFE_DIMENSION_RE.test(value) ? value : null;
};

export const ExtendedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => readDimension(element, 'width'),
        renderHTML: (attributes: { width?: string | number | null }) => {
          const value = String(attributes.width ?? '').trim();
          return SAFE_DIMENSION_RE.test(value) ? { width: value } : {};
        },
      },
      height: {
        default: null,
        parseHTML: (element: HTMLElement) => readDimension(element, 'height'),
        renderHTML: (attributes: { height?: string | number | null }) => {
          const value = String(attributes.height ?? '').trim();
          return SAFE_DIMENSION_RE.test(value) ? { height: value } : {};
        },
      },
      align: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const explicit = element.getAttribute('align')?.trim().toLowerCase() || '';
          if (SAFE_ALIGN_RE.test(explicit)) return explicit;
          if (element.style.marginLeft === 'auto' && element.style.marginRight === 'auto') return 'center';
          if (element.style.marginLeft === 'auto') return 'right';
          if (element.style.marginRight === 'auto') return 'left';
          return null;
        },
        renderHTML: (attributes: { align?: string | null }) => (
          attributes.align && SAFE_ALIGN_RE.test(attributes.align) ? { align: attributes.align } : {}
        ),
      },
    };
  },
}).configure({
  allowBase64: true,
  resize: false,
  HTMLAttributes: {
    referrerpolicy: 'no-referrer',
  },
});
