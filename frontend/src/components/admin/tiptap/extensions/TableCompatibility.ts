import { Extension } from '@tiptap/core';

const SAFE_TABLE_WIDTH_RE = /^(?:\d{1,4}px|\d{1,3}%|auto)$/i;

export const TableCompatibility = Extension.create({
  name: 'tableCompatibility',

  addGlobalAttributes() {
    return [{
      types: ['table'],
      attributes: {
        legacyClass: {
          default: null,
          parseHTML: (element: HTMLElement) => element.getAttribute('class') || null,
          renderHTML: (attributes: { legacyClass?: string | null }) => (
            attributes.legacyClass ? { class: attributes.legacyClass } : {}
          ),
        },
        tableWidth: {
          default: null,
          parseHTML: (element: HTMLElement) => {
            const value = element.style.width || element.getAttribute('width') || '';
            return SAFE_TABLE_WIDTH_RE.test(value) ? value : null;
          },
          renderHTML: (attributes: { tableWidth?: string | null }) => (
            attributes.tableWidth && SAFE_TABLE_WIDTH_RE.test(attributes.tableWidth)
              ? { style: `width: ${attributes.tableWidth}` }
              : {}
          ),
        },
      },
    }];
  },
});
