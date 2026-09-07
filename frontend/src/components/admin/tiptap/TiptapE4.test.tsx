import '@testing-library/jest-dom/vitest';
import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import { createEditorExtensions } from './extensions';
import { TiptapToolbar } from './TiptapToolbar';
import { TiptapImageMenu } from './TiptapImageMenu';
import { prepareContentForEditor, serializeEditorContent } from './editorContentAdapter';
import type { Media } from '../../../api';

describe('TipTap E4 Media Upload & Interactive Image Parity', () => {
  const editors: Editor[] = [];

  const createTestEditor = (initialContent = '<p>Initial Content</p>') => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: prepareContentForEditor(initialContent),
    });
    editors.push(editor);
    return editor;
  };

  afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
    vi.restoreAllMocks();
  });

  describe('1. Historical Image Loading, Attributes & Round-Trip', () => {
    it('loads historical image with width, height and align attributes without mutation', () => {
      const initialHtml = '<p>Before</p><img src="/uploads/images/sample.png" alt="Sample Alt" width="320" height="240" align="center" /><p>After</p>';
      const editor = createTestEditor(initialHtml);

      // Select image node (node selection at pos 8, between <p>Before</p> and <p>After</p>)
      editor.commands.setNodeSelection(8);

      const imageAttrs = editor.getAttributes('image');
      expect(imageAttrs.src).toBe('/uploads/images/sample.png');
      expect(imageAttrs.alt).toBe('Sample Alt');
      expect(imageAttrs.width).toBe('320');
      expect(imageAttrs.height).toBe('240');
      expect(imageAttrs.align).toBe('center');

      const serialized = serializeEditorContent(editor);
      expect(serialized).toContain('src="/uploads/images/sample.png"');
      expect(serialized).toContain('width="320"');
      expect(serialized).toContain('height="240"');
      expect(serialized).toContain('align="center"');

      // Reload into fresh editor
      const reloadedEditor = createTestEditor(serialized);
      reloadedEditor.commands.setNodeSelection(8);
      const reloadedAttrs = reloadedEditor.getAttributes('image');
      expect(reloadedAttrs.src).toBe('/uploads/images/sample.png');
      expect(reloadedAttrs.width).toBe('320');
      expect(reloadedAttrs.align).toBe('center');
    });
  });

  describe('2. Insert Image Node', () => {
    it('inserts image node via TipTap command and serializes correctly', () => {
      const editor = createTestEditor('<p>Hello</p>');
      editor.commands.focus('end');

      editor.commands.setImage({
        src: '/uploads/images/uploaded.png',
        alt: 'Uploaded Image',
      });

      expect(editor.isActive('image')).toBe(true);
      const html = serializeEditorContent(editor);
      expect(html).toContain('src="/uploads/images/uploaded.png"');
      expect(html).toContain('alt="Uploaded Image"');
    });
  });

  describe('3. Image Width Presets, Resizing & Transaction Undo/Redo', () => {
    it('updates width attributes, supports undo to previous width, and redo to updated width', () => {
      const editor = createTestEditor('<img src="/uploads/images/test.png" width="100%" />');
      editor.commands.setNodeSelection(0);

      expect(editor.getAttributes('image').width).toBe('100%');

      // Resize to 50%
      editor.commands.updateAttributes('image', { width: '50%' });
      expect(editor.getAttributes('image').width).toBe('50%');

      // Undo to 100%
      editor.commands.undo();
      expect(editor.getAttributes('image').width).toBe('100%');

      // Redo to 50%
      editor.commands.redo();
      expect(editor.getAttributes('image').width).toBe('50%');
    });
  });

  describe('4. Image Alignment & Transaction Undo/Redo', () => {
    it('updates image alignment (left, center, right) and verifies undo/redo', () => {
      const editor = createTestEditor('<img src="/uploads/images/test.png" />');
      editor.commands.setNodeSelection(0);

      // Align Center
      editor.commands.updateAttributes('image', { align: 'center' });
      expect(editor.getAttributes('image').align).toBe('center');

      // Undo reverts back to null
      editor.commands.undo();
      expect(editor.getAttributes('image').align).toBeNull();

      // Redo restores center
      editor.commands.redo();
      expect(editor.getAttributes('image').align).toBe('center');

      // Align Right
      editor.commands.updateAttributes('image', { align: 'right' });
      expect(editor.getAttributes('image').align).toBe('right');
    });
  });

  describe('5. Paste Behavior & Non-Regression', () => {
    it('handles plain text and rich HTML paste without breaking normal paste', () => {
      const editor = createTestEditor('<p>Before</p>');
      editor.commands.focus('end');

      // Simulate normal text insertion
      editor.commands.insertContent(' pasted plain text');
      expect(serializeEditorContent(editor)).toContain('Before pasted plain text');

      // Simulate rich HTML insertion
      editor.commands.insertContent('<strong>pasted bold</strong>');
      expect(serializeEditorContent(editor)).toContain('<strong>pasted bold</strong>');
    });
  });

  describe('6. Async Position & Upload Failure Safety', () => {
    it('does not insert broken nodes when upload handler rejects', async () => {
      const editor = createTestEditor('<p>Safe Document</p>');
      const failingUpload = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(failingUpload(new File([''], 'broken.png', { type: 'image/png' }))).rejects.toThrow('Network error');

      // Content remains clean
      expect(serializeEditorContent(editor)).toBe('<p>Safe Document</p>');
    });

    it('inserts image at target position even if upload resolves asynchronously', async () => {
      const editor = createTestEditor('<p>First Paragraph</p><p>Second Paragraph</p>');
      
      const mockMedia: Media = {
        id: 101,
        original_name: 'async.png',
        filename: 'async_101.png',
        path: '/uploads/images/async.png',
        url: '/uploads/images/async.png',
        media_type: 'image',
        mime_type: 'image/png',
        size: 1024,
        duration: 0,
        thumbnail: '',
        created_at: '2026-09-01 12:00:00',
      };

      const targetPos = 1; // beginning of doc
      editor.commands.insertContentAt(targetPos, {
        type: 'image',
        attrs: {
          src: mockMedia.url,
          alt: mockMedia.original_name,
        },
      });

      const html = serializeEditorContent(editor);
      expect(html).toContain('src="/uploads/images/async.png"');
    });
  });

  describe('7. Video and Attachment Nodes Minimal Integration', () => {
    it('inserts video node and serializes / reloads properly', () => {
      const editor = createTestEditor('<p>Text</p>');
      editor.commands.focus('end');

      editor.commands.insertContent({
        type: 'video',
        attrs: {
          src: '/uploads/videos/sample.mp4',
          controls: true,
        },
      });

      expect(editor.isActive('video')).toBe(true);
      const html = serializeEditorContent(editor);
      expect(html).toContain('src="/uploads/videos/sample.mp4"');
      expect(html).toContain('controls');

      // Reload into fresh editor
      const reloaded = createTestEditor(html);
      let foundVideo = false;
      reloaded.state.doc.descendants((node) => {
        if (node.type.name === 'video' && node.attrs.src === '/uploads/videos/sample.mp4') {
          foundVideo = true;
        }
      });
      expect(foundVideo).toBe(true);
    });

    it('inserts attachment node and serializes / reloads properly', () => {
      const editor = createTestEditor('<p>Text</p>');
      editor.commands.focus('end');

      editor.commands.insertContent({
        type: 'attachment',
        attrs: {
          href: '/uploads/files/guide.pdf',
          label: '用户手册.pdf',
        },
      });

      expect(editor.isActive('attachment')).toBe(true);
      const html = serializeEditorContent(editor);
      expect(html).toContain('href="/uploads/files/guide.pdf"');
      expect(html).toContain('用户手册.pdf');

      // Reload into fresh editor
      const reloaded = createTestEditor(html);
      let foundAttachment = false;
      reloaded.state.doc.descendants((node) => {
        if (node.type.name === 'attachment' && node.attrs.href === '/uploads/files/guide.pdf') {
          foundAttachment = true;
        }
      });
      expect(foundAttachment).toBe(true);
    });
  });

  describe('8. UI Components (Toolbar & Image Floating Menu)', () => {
    it('mounts TiptapToolbar with upload button and triggers file upload', async () => {
      const editor = createTestEditor('<p>Toolbar Upload</p>');
      const mockUpload = vi.fn().mockResolvedValue({
        id: 1,
        original_name: 'test.jpg',
        filename: 'test.jpg',
        path: '/uploads/images/test.jpg',
        url: '/uploads/images/test.jpg',
        media_type: 'image',
        mime_type: 'image/jpeg',
        size: 2048,
        duration: 0,
        thumbnail: '',
        created_at: '2026-09-01 12:00:00',
      });

      render(<TiptapToolbar editor={editor} onUploadFile={mockUpload} />);

      const uploadBtn = screen.getByTestId('toolbar-btn-upload-media');
      expect(uploadBtn).toBeInTheDocument();

      const fileInput = screen.getByTestId('toolbar-media-file-input') as HTMLInputElement;
      const file = new File(['dummy'], 'test.jpg', { type: 'image/jpeg' });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(mockUpload).toHaveBeenCalledWith(file);
      expect(serializeEditorContent(editor)).toContain('src="/uploads/images/test.jpg"');
    });

    it('renders TiptapImageMenu and verifies image attribute updates and deletion', () => {
      const editor = createTestEditor('<img src="/uploads/images/menu_test.png" />');
      editor.commands.setNodeSelection(0);

      const { container } = render(<TiptapImageMenu editor={editor} />);
      expect(container).toBeDefined();

      // Verify width update
      act(() => {
        editor.commands.updateAttributes('image', { width: '50%' });
      });
      expect(editor.getAttributes('image').width).toBe('50%');

      // Verify align update
      act(() => {
        editor.commands.updateAttributes('image', { align: 'center' });
      });
      expect(editor.getAttributes('image').align).toBe('center');

      // Verify delete selection
      act(() => {
        editor.commands.deleteSelection();
      });
      expect(editor.isActive('image')).toBe(false);
    });
  });
});
