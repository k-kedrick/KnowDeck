import {
  combineTransactionSteps,
  findChildrenInRange,
  getChangedRanges,
  getMarksBetween,
  markPasteRule,
} from '@tiptap/core';
import Link from '@tiptap/extension-link';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { find, tokenize } from 'linkifyjs';
import { isSafeHttpUrl, splitUrlAndTrailingText } from '../../../../utils/documentLinks';

const UNICODE_WHITESPACE_PATTERN = '[\0- \xA0 ᠎ -\u2029 　]';
const UNICODE_WHITESPACE_REGEX = new RegExp(UNICODE_WHITESPACE_PATTERN);
const UNICODE_WHITESPACE_REGEX_END = new RegExp(`${UNICODE_WHITESPACE_PATTERN}$`);

function isValidLinkStructure(tokens: { isLink: boolean; value: string }[]): boolean {
  if (tokens.length === 1) return tokens[0].isLink;
  if (tokens.length === 3 && tokens[1].isLink) {
    return ['()', '[]'].includes(tokens[0].value + tokens[2].value);
  }
  return false;
}

/**
 * Enhanced DocumentLink extension:
 * 1. inclusive: false guarantees that text typed at the end or boundary of a link
 *    does NOT inherit the link mark.
 * 2. CJK & punctuation-safe autolink ensures that URLs ending before Chinese characters,
 *    Chinese punctuation, or prose punctuation are properly delimited.
 * 3. CJK-safe paste rule prevents pasted plain text URLs from absorbing trailing CJK.
 * 4. Stored marks boundary guard unsets link mark on Space, Enter, or paragraph boundary.
 */
export const DocumentLink = Link.extend({
  inclusive: false,

  addPasteRules() {
    return [
      markPasteRule({
        find: (text) => {
          const foundLinks: { text: string; data: { href: string }; index: number }[] = [];
          if (!text) return foundLinks;

          find(text)
            .filter((item) => item.isLink)
            .forEach((item) => {
              const split = splitUrlAndTrailingText(item.value);
              if (split && split.url && isSafeHttpUrl(split.url)) {
                foundLinks.push({
                  text: split.url,
                  data: { href: split.url },
                  index: item.start,
                });
              }
            });

          return foundLinks;
        },
        type: this.type,
        getAttributes: (match) => ({
          href: match.data?.href,
          target: '_blank',
          rel: 'noopener noreferrer',
        }),
      }),
    ];
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() || [];
    // Filter out the built-in autolink plugin so we can replace it with our CJK-safe autolink
    const filteredPlugins = parentPlugins.filter(
      (p) => (p as any).key !== 'autolink$',
    );

    const linkType = this.type;
    const defaultProtocol = this.options.defaultProtocol || 'https';

    const safeAutolinkPlugin = new Plugin({
      key: new PluginKey('safeAutolink'),
      appendTransaction: (transactions, oldState, newState) => {
        const docChanges = transactions.some((t) => t.docChanged) && !oldState.doc.eq(newState.doc);
        const preventAutolink = transactions.some((t) => t.getMeta('preventAutolink'));
        if (!docChanges || preventAutolink) return;

        const { tr } = newState;
        const transform = combineTransactionSteps(oldState.doc, [...transactions]);

        getChangedRanges(transform).forEach(({ newRange }) => {
          const nodesInChangedRanges = findChildrenInRange(newState.doc, newRange, (n) => n.isTextblock);
          let textBlock: { pos: number; node: any } | undefined;
          let textBeforeWhitespace: string | undefined;

          if (nodesInChangedRanges.length > 1) {
            textBlock = nodesInChangedRanges[0];
            textBeforeWhitespace = newState.doc.textBetween(textBlock.pos, textBlock.pos + textBlock.node.nodeSize, undefined, ' ');
          } else if (nodesInChangedRanges.length) {
            const endText = newState.doc.textBetween(newRange.from, newRange.to, ' ', ' ');
            if (!UNICODE_WHITESPACE_REGEX_END.test(endText)) return;
            textBlock = nodesInChangedRanges[0];
            textBeforeWhitespace = newState.doc.textBetween(textBlock.pos, newRange.to, undefined, ' ');
          }

          if (textBlock && textBeforeWhitespace) {
            const wordsBeforeWhitespace = textBeforeWhitespace.split(UNICODE_WHITESPACE_REGEX).filter(Boolean);
            if (wordsBeforeWhitespace.length <= 0) return;

            const lastWordBeforeSpace = wordsBeforeWhitespace[wordsBeforeWhitespace.length - 1];
            if (!lastWordBeforeSpace) return;

            const lastWordAndBlockOffset = textBlock.pos + textBeforeWhitespace.lastIndexOf(lastWordBeforeSpace);
            const tokens = tokenize(lastWordBeforeSpace).map((t) => t.toObject(defaultProtocol));
            if (!isValidLinkStructure(tokens)) return;

            tokens
              .filter((item) => item.isLink)
              .forEach((item) => {
                const split = splitUrlAndTrailingText(item.value);
                if (!split || !split.url || !isSafeHttpUrl(split.url)) return;

                const from = lastWordAndBlockOffset + item.start + 1;
                const to = from + split.url.length;

                if (newState.schema.marks.code && newState.doc.rangeHasMark(from, to, newState.schema.marks.code)) {
                  return;
                }

                if (getMarksBetween(from, to, newState.doc).some((m) => m.mark.type === linkType)) {
                  return;
                }

                tr.addMark(from, to, linkType.create({
                  href: split.url,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                }));
              });
          }
        });

        if (!tr.steps.length) return;
        return tr;
      },
    });

    const boundaryGuardPlugin = new Plugin({
      key: new PluginKey('linkBoundaryGuard'),
      appendTransaction: (_transactions, _oldState, newState) => {
        if (!newState.storedMarks?.some((m) => m.type === linkType)) {
          return;
        }

        const { $from, empty } = newState.selection;
        if (!empty) return;

        // If cursor is at an empty block, or at the boundary where character before/after doesn't have link,
        // clear the link from storedMarks so typing does not inherit the link mark.
        const marksAtPos = $from.marks();
        const hasLinkAtPos = marksAtPos.some((m) => m.type === linkType);
        const atBlockEnd = $from.parentOffset === $from.parent.content.size;

        if (!hasLinkAtPos || atBlockEnd) {
          const filtered = (newState.storedMarks || []).filter((m) => m.type !== linkType);
          return newState.tr.setStoredMarks(filtered);
        }
      },
    });

    return [...filteredPlugins, safeAutolinkPlugin, boundaryGuardPlugin];
  },
});
