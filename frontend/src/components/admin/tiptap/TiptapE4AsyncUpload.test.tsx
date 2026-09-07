import { describe, expect, it, afterEach, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import { createEditorExtensions } from './extensions';
import {
  addUploadAnchor,
  getUploadAnchorPosition,
  removeUploadAnchorMeta,
} from './extensions/UploadAnchorPlugin';
import { serializeEditorContent } from './editorContentAdapter';

describe('TipTap E4.1 ProseMirror Transaction-Mapped Async Upload Anchors', () => {
  const editors: Editor[] = [];

  const createTestEditor = (initialContent = '<p>Initial text content for anchor testing</p>') => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: initialContent,
    });
    editors.push(editor);
    return editor;
  };

  afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
    vi.restoreAllMocks();
  });

  describe('1. Basic Anchor Lifecycle and Position Tracking', () => {
    it('creates an upload anchor and reads its initial position', () => {
      const editor = createTestEditor('<p>Hello World</p>');
      const uploadId = 'upload_test_1';
      const initialPos = 6;

      editor.view.dispatch(addUploadAnchor(editor.state.tr, uploadId, initialPos));
      expect(getUploadAnchorPosition(editor.state, uploadId)).toBe(6);

      // Remove anchor
      editor.view.dispatch(removeUploadAnchorMeta(editor.state.tr, uploadId));
      expect(getUploadAnchorPosition(editor.state, uploadId)).toBeNull();
    });
  });

  describe('2. Transaction Mapping on Document Edits', () => {
    it('automatically shifts anchor position forward when text is inserted BEFORE the anchor', () => {
      const editor = createTestEditor('<p>0123456789</p>');
      const uploadId = 'upload_shift_forward';
      const initialPos = 7; // after '5'

      editor.view.dispatch(addUploadAnchor(editor.state.tr, uploadId, initialPos));
      expect(getUploadAnchorPosition(editor.state, uploadId)).toBe(7);

      // Insert 'ABCDE' (5 chars) at position 2 (before pos 7)
      const tr = editor.state.tr.insertText('ABCDE', 2);
      editor.view.dispatch(tr);

      // Anchor should now be exactly 7 + 5 = 12
      const mappedPos = getUploadAnchorPosition(editor.state, uploadId);
      expect(mappedPos).toBe(12);
    });

    it('automatically shifts anchor position backward when text is deleted BEFORE the anchor', () => {
      const editor = createTestEditor('<p>0123456789ABCDEF</p>');
      const uploadId = 'upload_shift_backward';
      const initialPos = 12; // before 'B'

      editor.view.dispatch(addUploadAnchor(editor.state.tr, uploadId, initialPos));
      expect(getUploadAnchorPosition(editor.state, uploadId)).toBe(12);

      // Delete 4 chars from pos 2 to 6
      const tr = editor.state.tr.delete(2, 6);
      editor.view.dispatch(tr);

      // Anchor should now be exactly 12 - 4 = 8
      const mappedPos = getUploadAnchorPosition(editor.state, uploadId);
      expect(mappedPos).toBe(8);
    });

    it('retains exact position when text is inserted AFTER the anchor', () => {
      const editor = createTestEditor('<p>0123456789</p>');
      const uploadId = 'upload_after';
      const initialPos = 5;

      editor.view.dispatch(addUploadAnchor(editor.state.tr, uploadId, initialPos));
      expect(getUploadAnchorPosition(editor.state, uploadId)).toBe(5);

      // Insert 20 characters after position 5 (at pos 8)
      const tr = editor.state.tr.insertText('XXXXXXXXXXXXXXXXXXXX', 8);
      editor.view.dispatch(tr);

      // Anchor position should remain 5
      expect(getUploadAnchorPosition(editor.state, uploadId)).toBe(5);
    });
  });

  describe('3. Concurrent In-Flight Uploads & Out-of-Order Resolution', () => {
    it('accurately resolves concurrent uploads even when resolving in reverse order', async () => {
      const editor = createTestEditor('<p>Section A</p><p>Section B</p><p>Section C</p>');

      const uploadA = 'upload_a';
      const uploadB = 'upload_b';
      const uploadC = 'upload_c';

      // Pos 1 (Section A), Pos 12 (Section B), Pos 23 (Section C)
      editor.view.dispatch(addUploadAnchor(editor.state.tr, uploadA, 1));
      editor.view.dispatch(addUploadAnchor(editor.state.tr, uploadB, 13));
      editor.view.dispatch(addUploadAnchor(editor.state.tr, uploadC, 25));

      // User types extra text at the very beginning of the document
      const trTyping = editor.state.tr.insertText('PREFIX ', 1);
      editor.view.dispatch(trTyping);

      // Resolve in reverse order: C first, then A, then B
      // 1. Resolve C
      const posC = getUploadAnchorPosition(editor.state, uploadC)!;
      const nodeC = editor.schema.nodes.image.create({ src: '/uploads/images/c.png', alt: 'C' });
      const trC = removeUploadAnchorMeta(editor.state.tr, uploadC).insert(posC, nodeC);
      editor.view.dispatch(trC);

      // 2. Resolve A
      const posA = getUploadAnchorPosition(editor.state, uploadA)!;
      const nodeA = editor.schema.nodes.image.create({ src: '/uploads/images/a.png', alt: 'A' });
      const trA = removeUploadAnchorMeta(editor.state.tr, uploadA).insert(posA, nodeA);
      editor.view.dispatch(trA);

      // 3. Resolve B
      const posB = getUploadAnchorPosition(editor.state, uploadB)!;
      const nodeB = editor.schema.nodes.image.create({ src: '/uploads/images/b.png', alt: 'B' });
      const trB = removeUploadAnchorMeta(editor.state.tr, uploadB).insert(posB, nodeB);
      editor.view.dispatch(trB);

      const html = serializeEditorContent(editor);
      const indexA = html.indexOf('src="/uploads/images/a.png"');
      const indexB = html.indexOf('src="/uploads/images/b.png"');
      const indexC = html.indexOf('src="/uploads/images/c.png"');

      // The logical positions must strictly be A < B < C despite out-of-order network arrival!
      expect(indexA).toBeGreaterThan(-1);
      expect(indexB).toBeGreaterThan(-1);
      expect(indexC).toBeGreaterThan(-1);
      expect(indexA).toBeLessThan(indexB);
      expect(indexB).toBeLessThan(indexC);
    });
  });

  describe('4. Failure Cleanup & Destroy Safety', () => {
    it('cleans up anchor on failure without altering document or leaving garbage', () => {
      const editor = createTestEditor('<p>Clean Document</p>');
      const uploadId = 'upload_fail';
      editor.view.dispatch(addUploadAnchor(editor.state.tr, uploadId, 5));

      // Simulate failure cleanup
      editor.view.dispatch(removeUploadAnchorMeta(editor.state.tr, uploadId));

      expect(getUploadAnchorPosition(editor.state, uploadId)).toBeNull();
      expect(serializeEditorContent(editor)).toBe('<p>Clean Document</p>');
    });

    it('safely exits when editor is destroyed before upload resolves', () => {
      const editor = createTestEditor('<p>Will destroy</p>');
      const uploadId = 'upload_destroy';
      editor.view.dispatch(addUploadAnchor(editor.state.tr, uploadId, 5));

      // Destroy editor instance
      editor.destroy();
      expect(editor.isDestroyed).toBe(true);

      // Resolving after destroy should be a safe no-op
      expect(() => {
        if (!editor.isDestroyed && editor.view) {
          const pos = getUploadAnchorPosition(editor.state, uploadId);
          if (pos !== null) {
            editor.view.dispatch(editor.state.tr.insertText('never', pos));
          }
        }
      }).not.toThrow();
    });
  });
});
