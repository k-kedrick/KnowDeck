import { Extension } from '@tiptap/core';

const SAFE_LINE_HEIGHT_RE = /^(?:[1-2](?:\.[0-9])?|3(?:\.0)?|[1-3])$/;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockLineHeight: {
      setLineHeight: (lineHeight: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

export const BlockLineHeight = Extension.create({
  name: 'blockLineHeight',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const value = element.style.lineHeight?.trim() || '';
              return SAFE_LINE_HEIGHT_RE.test(value) ? value : null;
            },
            renderHTML: (attributes: { lineHeight?: string | null }) => {
              const value = attributes.lineHeight?.trim() || '';
              if (!SAFE_LINE_HEIGHT_RE.test(value)) return {};
              return { style: `line-height: ${value}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (lineHeight: string) =>
        ({ commands, state }) => {
          if (!lineHeight || lineHeight === 'default') {
            const type = state.selection.$from.parent.type.name;
            return type === 'heading' || type === 'paragraph'
              ? commands.resetAttributes(type, 'lineHeight')
              : false;
          }
          if (!SAFE_LINE_HEIGHT_RE.test(lineHeight)) return false;
          const type = state.selection.$from.parent.type.name;
          return type === 'heading' || type === 'paragraph'
            ? commands.updateAttributes(type, { lineHeight })
            : false;
        },
      unsetLineHeight:
        () =>
        ({ commands, state }) => {
          const type = state.selection.$from.parent.type.name;
          return type === 'heading' || type === 'paragraph'
            ? commands.resetAttributes(type, 'lineHeight')
            : false;
        },
    };
  },
});
