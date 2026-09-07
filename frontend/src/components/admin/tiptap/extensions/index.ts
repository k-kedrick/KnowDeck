import type { Extensions } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import Strike from '@tiptap/extension-strike';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { TableKit } from '@tiptap/extension-table';
import StarterKit from '@tiptap/starter-kit';
import { BlockLineHeight } from './BlockLineHeight';
import { CalloutNode } from './CalloutNode';
import { ExtendedImage } from './ExtendedImage';
import { AttachmentNode, IframeNode, VideoNode } from './MediaNodes';
import { TableCompatibility } from './TableCompatibility';
import { UploadAnchorExtension } from './UploadAnchorPlugin';

// The legacy renderer and sanitizer use the semantic <del> tag. TipTap's
// default strike extension emits <s>, which the existing security allow-list
// intentionally strips. Keep the stored HTML compatible without widening it.
const LegacyStrike = Strike.extend({
  renderHTML({ HTMLAttributes }) {
    return ['del', HTMLAttributes, 0];
  },
});

export function createEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      strike: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
      },
    }),
    TextStyleKit.configure({ lineHeight: false }),
    Highlight.configure({ multicolor: true }),
    LegacyStrike,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
      alignments: ['left', 'center', 'right', 'justify'],
    }),
    BlockLineHeight,
    ExtendedImage,
    VideoNode,
    AttachmentNode,
    IframeNode,
    CalloutNode,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({
      table: { resizable: true },
    }),
    TableCompatibility,
    UploadAnchorExtension,
  ];
}
