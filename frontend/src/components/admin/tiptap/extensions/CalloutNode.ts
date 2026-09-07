import { mergeAttributes, Node } from '@tiptap/core';

export type CalloutType = 'note' | 'tip' | 'warning';

const classNames: Record<CalloutType, string> = {
  note: 'callout callout-note p-4 my-4 rounded-xl border-l-4 bg-blue-50/70 border-blue-500 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-500 font-sans leading-relaxed text-sm',
  tip: 'callout callout-tip p-4 my-4 rounded-xl border-l-4 bg-emerald-50/70 border-emerald-500 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-500 font-sans leading-relaxed text-sm',
  warning: 'callout callout-warning p-4 my-4 rounded-xl border-l-4 bg-amber-50/70 border-amber-500 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500 font-sans leading-relaxed text-sm',
};

const readType = (element: HTMLElement): CalloutType => {
  const value = element.getAttribute('data-callout-type')?.toLowerCase() || '';
  if (value === 'tip' || element.classList.contains('callout-tip')) return 'tip';
  if (value === 'warning' || element.classList.contains('callout-warning')) return 'warning';
  return 'note';
};

export const CalloutNode = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'note',
        parseHTML: readType,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div.callout' }];
  },

  renderHTML({ HTMLAttributes }) {
    const type: CalloutType = HTMLAttributes.type === 'tip' || HTMLAttributes.type === 'warning'
      ? HTMLAttributes.type
      : 'note';
    return ['div', mergeAttributes({ class: classNames[type], 'data-callout-type': type }), 0];
  },
});
