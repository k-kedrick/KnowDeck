import '@testing-library/jest-dom/vitest';
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import { createEditorExtensions } from './extensions';
import { TiptapToolbar } from './TiptapToolbar';
import { TiptapBubbleMenu } from './TiptapBubbleMenu';
import { prepareContentForEditor, serializeEditorContent } from './editorContentAdapter';

describe('TipTap E2 Core Toolbar & Selection Bubble Menu Parity', () => {
  const editors: Editor[] = [];

  const createTestEditor = (initialContent = '<p>Hello World</p>') => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: prepareContentForEditor(initialContent),
    });
    editors.push(editor);
    return editor;
  };

  afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
  });

  describe('1. Core Commands & Active States', () => {
    it('executes toggleBold and reflects editor.isActive("bold")', () => {
      const editor = createTestEditor('<p>Sample text</p>');
      editor.commands.selectAll();

      expect(editor.isActive('bold')).toBe(false);
      editor.commands.toggleBold();
      expect(editor.isActive('bold')).toBe(true);

      const html = serializeEditorContent(editor);
      expect(html).toContain('<strong>Sample text</strong>');

      editor.commands.toggleBold();
      expect(editor.isActive('bold')).toBe(false);
    });

    it('executes toggleItalic and reflects editor.isActive("italic")', () => {
      const editor = createTestEditor('<p>Sample text</p>');
      editor.commands.selectAll();

      editor.commands.toggleItalic();
      expect(editor.isActive('italic')).toBe(true);
      expect(serializeEditorContent(editor)).toContain('<em>Sample text</em>');

      editor.commands.toggleItalic();
      expect(editor.isActive('italic')).toBe(false);
    });

    it('executes toggleUnderline and reflects editor.isActive("underline")', () => {
      const editor = createTestEditor('<p>Sample text</p>');
      editor.commands.selectAll();

      editor.commands.toggleUnderline();
      expect(editor.isActive('underline')).toBe(true);
      expect(serializeEditorContent(editor)).toContain('<u>Sample text</u>');

      editor.commands.toggleUnderline();
      expect(editor.isActive('underline')).toBe(false);
    });

    it('executes toggleStrike and serializes as semantic <del> tag', () => {
      const editor = createTestEditor('<p>Sample text</p>');
      editor.commands.selectAll();

      editor.commands.toggleStrike();
      expect(editor.isActive('strike')).toBe(true);
      expect(serializeEditorContent(editor)).toContain('<del>Sample text</del>');

      editor.commands.toggleStrike();
      expect(editor.isActive('strike')).toBe(false);
    });

    it('executes toggleCode for inline code', () => {
      const editor = createTestEditor('<p>Sample code</p>');
      editor.commands.selectAll();

      editor.commands.toggleCode();
      expect(editor.isActive('code')).toBe(true);
      expect(serializeEditorContent(editor)).toContain('<code>Sample code</code>');

      editor.commands.toggleCode();
      expect(editor.isActive('code')).toBe(false);
    });

    it('toggles headings H1, H2, H3 and switches back to paragraph', () => {
      const editor = createTestEditor('<p>Heading text</p>');
      editor.commands.focus('start');

      // H1
      editor.commands.toggleHeading({ level: 1 });
      expect(editor.isActive('heading', { level: 1 })).toBe(true);
      expect(serializeEditorContent(editor)).toContain('<h1>Heading text</h1>');

      // H2
      editor.commands.toggleHeading({ level: 2 });
      expect(editor.isActive('heading', { level: 2 })).toBe(true);
      expect(editor.isActive('heading', { level: 1 })).toBe(false);
      expect(serializeEditorContent(editor)).toContain('<h2>Heading text</h2>');

      // H3
      editor.commands.toggleHeading({ level: 3 });
      expect(editor.isActive('heading', { level: 3 })).toBe(true);
      expect(serializeEditorContent(editor)).toContain('<h3>Heading text</h3>');

      // Back to Paragraph
      editor.commands.setParagraph();
      expect(editor.isActive('paragraph')).toBe(true);
      expect(editor.isActive('heading')).toBe(false);
      expect(serializeEditorContent(editor)).toContain('<p>Heading text</p>');
    });
  });

  describe('2. Transaction-based Undo / Redo State Verification', () => {
    it('tracks sequential formatting transformations and performs deterministic undo and redo', () => {
      const editor = createTestEditor('<p>Original text</p>');
      editor.commands.focus('start');

      // Step 1: Turn into H2
      editor.commands.toggleHeading({ level: 2 });
      expect(serializeEditorContent(editor)).toContain('<h2>Original text</h2>');

      // Step 2: Apply bold to the text
      editor.commands.selectAll();
      editor.commands.toggleBold();
      expect(serializeEditorContent(editor)).toContain('<h2><strong>Original text</strong></h2>');

      // Step 3: Apply underline to the text
      editor.commands.toggleUnderline();
      expect(serializeEditorContent(editor)).toContain('<u>');

      // Step 4: Undo step 3 (remove underline)
      expect(editor.can().undo()).toBe(true);
      editor.commands.undo();
      expect(editor.isActive('underline')).toBe(false);
      expect(editor.isActive('bold')).toBe(true);
      expect(serializeEditorContent(editor)).toContain('<h2><strong>Original text</strong></h2>');

      // Step 5: Undo step 2 (remove bold)
      editor.commands.undo();
      expect(editor.isActive('bold')).toBe(false);
      expect(serializeEditorContent(editor)).toContain('<h2>Original text</h2>');

      // Step 6: Undo step 1 (revert to paragraph)
      editor.commands.undo();
      expect(editor.isActive('heading')).toBe(false);
      expect(editor.isActive('paragraph')).toBe(true);
      expect(serializeEditorContent(editor)).toContain('<p>Original text</p>');

      // Step 7: Redo step 1 (re-apply H2)
      expect(editor.can().redo()).toBe(true);
      editor.commands.redo();
      expect(serializeEditorContent(editor)).toContain('<h2>Original text</h2>');

      // Step 8: Redo step 2 (re-apply bold)
      editor.commands.redo();
      expect(editor.isActive('bold')).toBe(true);
      expect(serializeEditorContent(editor)).toContain('<h2><strong>Original text</strong></h2>');
    });

    it('handles mixed formatting across adjacent selections without mark corruption', () => {
      // Scenario: "Hello World" -> "Hello" bold, "World" italic, whole block H2
      const editor = createTestEditor('<p>Hello World</p>');

      // Select "Hello" (pos 1 to 6)
      editor.commands.setTextSelection({ from: 1, to: 6 });
      editor.commands.toggleBold();
      expect(editor.isActive('bold')).toBe(true);

      // Select "World" (pos 7 to 12)
      editor.commands.setTextSelection({ from: 7, to: 12 });
      editor.commands.toggleItalic();
      expect(editor.isActive('italic')).toBe(true);

      // Whole block to H2
      editor.commands.selectAll();
      editor.commands.toggleHeading({ level: 2 });

      const output = serializeEditorContent(editor);
      expect(output).toContain('<h2><strong>Hello</strong> <em>World</em></h2>');

      // Undo block change -> back to paragraph with individual marks preserved
      editor.commands.undo();
      const afterUndoBlock = serializeEditorContent(editor);
      expect(afterUndoBlock).toContain('<p><strong>Hello</strong> <em>World</em></p>');

      // Undo italic
      editor.commands.undo();
      expect(serializeEditorContent(editor)).toContain('<p><strong>Hello</strong> World</p>');

      // Undo bold
      editor.commands.undo();
      expect(serializeEditorContent(editor)).toContain('<p>Hello World</p>');
    });
  });

  describe('3. TiptapToolbar Component Rendering & Button Triggers', () => {
    it('renders all E2 toolbar buttons and dispatches commands on click', () => {
      const editor = createTestEditor('<p>Toolbar test</p>');
      editor.commands.focus('start');

      render(<TiptapToolbar editor={editor} />);

      expect(screen.getByTestId('toolbar-btn-paragraph')).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-btn-h1')).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-btn-h2')).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-btn-h3')).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-btn-bold')).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-btn-italic')).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-btn-underline')).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-btn-strike')).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-btn-code')).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-btn-undo')).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-btn-redo')).toBeInTheDocument();

      // Click H1
      act(() => {
        fireEvent.click(screen.getByTestId('toolbar-btn-h1'));
      });
      expect(editor.isActive('heading', { level: 1 })).toBe(true);

      // Click Undo
      act(() => {
        fireEvent.click(screen.getByTestId('toolbar-btn-undo'));
      });
      expect(editor.isActive('heading', { level: 1 })).toBe(false);
      expect(editor.isActive('paragraph')).toBe(true);

      // Select all and click Bold
      act(() => {
        editor.commands.selectAll();
        fireEvent.click(screen.getByTestId('toolbar-btn-bold'));
      });
      expect(editor.isActive('bold')).toBe(true);
    });
  });

  describe('4. TiptapBubbleMenu Integration', () => {
    it('mounts without throwing and binds to the editor instance', () => {
      const editor = createTestEditor('<p>Bubble menu test</p>');
      const { container } = render(<TiptapBubbleMenu editor={editor} />);
      expect(container).toBeDefined();
    });
  });
});
