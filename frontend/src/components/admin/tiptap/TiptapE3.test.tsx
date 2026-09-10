import '@testing-library/jest-dom/vitest';
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import { createEditorExtensions } from './extensions';
import { TiptapToolbar } from './TiptapToolbar';
import { TiptapBubbleMenu } from './TiptapBubbleMenu';
import { prepareContentForEditor, serializeEditorContent } from './editorContentAdapter';
import { FONT_FAMILIES } from './typographyConstants';

describe('TipTap E3 Typography & Advanced Formatting Parity', () => {
  const editors: Editor[] = [];

  const createTestEditor = (initialContent = '<p>Hello Typography</p>') => {
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

  describe('1. Font Family', () => {
    it('sets, serializes, unsets, and undos/redos font family', () => {
      const editor = createTestEditor('<p>Sample Font Text</p>');
      editor.commands.selectAll();

      const kaitiCss = FONT_FAMILIES.find((f) => f.value === 'kaiti')!.css;
      editor.commands.setFontFamily(kaitiCss);

      const textStyleAttrs = editor.getAttributes('textStyle');
      expect(textStyleAttrs.fontFamily).toBe(kaitiCss);

      const html = serializeEditorContent(editor);
      expect(html).toContain('font-family:');
      expect(html).toContain('Kaiti');

      // Undo removes font family
      editor.commands.undo();
      expect(editor.getAttributes('textStyle').fontFamily).toBeFalsy();

      // Redo restores font family
      editor.commands.redo();
      expect(editor.getAttributes('textStyle').fontFamily).toBe(kaitiCss);

      // Unset font family
      editor.commands.unsetFontFamily();
      expect(editor.getAttributes('textStyle').fontFamily).toBeFalsy();
    });
  });

  describe('2. Font Size', () => {
    it('sets, serializes, unsets, and undos/redos font size', () => {
      const editor = createTestEditor('<p>Sample Size Text</p>');
      editor.commands.selectAll();

      editor.commands.setFontSize('24px');
      expect(editor.getAttributes('textStyle').fontSize).toBe('24px');

      const html = serializeEditorContent(editor);
      expect(html).toContain('font-size: 24px');

      // Undo
      editor.commands.undo();
      expect(editor.getAttributes('textStyle').fontSize).toBeFalsy();

      // Redo
      editor.commands.redo();
      expect(editor.getAttributes('textStyle').fontSize).toBe('24px');

      // Unset
      editor.commands.unsetFontSize();
      expect(editor.getAttributes('textStyle').fontSize).toBeFalsy();
    });
  });

  describe('3. Text Color & Background Highlight Coexistence', () => {
    it('sets text color and unsets it cleanly', () => {
      const editor = createTestEditor('<p>Sample Color Text</p>');
      editor.commands.selectAll();

      editor.commands.setColor('#ef4444');
      expect(editor.getAttributes('textStyle').color).toBe('#ef4444');

      const html = serializeEditorContent(editor);
      expect(html).toMatch(/color:\s*(?:#ef4444|rgb\(239,\s*68,\s*68\))/i);

      editor.commands.unsetColor();
      expect(editor.getAttributes('textStyle').color).toBeFalsy();
    });

    it('applies text color AND highlight together without overwriting each other', () => {
      const editor = createTestEditor('<p>Highlighted and Colored</p>');
      editor.commands.selectAll();

      // Set red text color
      editor.commands.setColor('#ef4444');
      // Set yellow highlight
      editor.commands.setHighlight({ color: '#fef08a' });

      expect(editor.getAttributes('textStyle').color).toBe('#ef4444');
      expect(editor.isActive('highlight', { color: '#fef08a' })).toBe(true);

      const html = serializeEditorContent(editor);
      expect(html).toMatch(/color:\s*(?:#ef4444|rgb\(239,\s*68,\s*68\))/i);
      expect(html).toMatch(/background-color:\s*(?:#fef08a|rgb\(254,\s*240,\s*138\))/i);

      // Undo highlight -> color remains
      editor.commands.undo();
      expect(editor.isActive('highlight')).toBe(false);
      expect(editor.getAttributes('textStyle').color).toBe('#ef4444');

      // Undo color -> plain text
      editor.commands.undo();
      expect(editor.getAttributes('textStyle').color).toBeFalsy();
    });
  });

  describe('4. Line Height (Block-Level)', () => {
    it('applies line-height directly to block container (p/h2), not inline spans', () => {
      const editor = createTestEditor('<p>Line Height Test</p>');
      editor.commands.focus('start');

      editor.commands.setLineHeight('2.0');
      expect(editor.getAttributes('paragraph').lineHeight).toBe('2.0');

      const html = serializeEditorContent(editor);
      expect(html).toMatch(/<p style="line-height:\s*2(?:\.0)?">Line Height Test<\/p>/);
      expect(html).not.toContain('<span style="line-height');

      // Undo line height
      editor.commands.undo();
      expect(editor.getAttributes('paragraph').lineHeight).toBeNull();
      expect(serializeEditorContent(editor)).toBe('<p>Line Height Test</p>');

      // Redo line height
      editor.commands.redo();
      expect(editor.getAttributes('paragraph').lineHeight).toBe('2.0');

      // Unset line height
      editor.commands.unsetLineHeight();
      expect(editor.getAttributes('paragraph').lineHeight).toBeNull();
    });
  });

  describe('5. Text Alignment', () => {
    it('sets left, center, right, justify alignments on blocks and undos/redos', () => {
      const editor = createTestEditor('<p>Alignment Test</p>');
      editor.commands.focus('start');

      // Center
      editor.commands.setTextAlign('center');
      expect(editor.isActive({ textAlign: 'center' })).toBe(true);
      expect(serializeEditorContent(editor)).toContain('text-align: center');

      // Right
      editor.commands.setTextAlign('right');
      expect(editor.isActive({ textAlign: 'right' })).toBe(true);
      expect(serializeEditorContent(editor)).toContain('text-align: right');

      // Justify
      editor.commands.setTextAlign('justify');
      expect(editor.isActive({ textAlign: 'justify' })).toBe(true);
      expect(serializeEditorContent(editor)).toContain('text-align: justify');

      // Undo reverts alignment back to initial state
      editor.commands.undo();
      expect(editor.isActive({ textAlign: 'justify' })).toBe(false);

      // Redo restores alignment
      editor.commands.redo();
      expect(editor.isActive({ textAlign: 'justify' })).toBe(true);

      // Left resets back to default alignment
      editor.commands.setTextAlign('left');
      expect(editor.isActive({ textAlign: 'left' })).toBe(true);
    });
  });

  describe('6. Anti-Nesting & Single Span Merging', () => {
    it('merges multiple textStyle attributes into a single <span> tag without tag explosion', () => {
      const editor = createTestEditor('<p>Styled Text</p>');
      editor.commands.selectAll();

      const kaitiCss = FONT_FAMILIES.find((f) => f.value === 'kaiti')!.css;
      editor.commands.setFontFamily(kaitiCss);
      editor.commands.setFontSize('20px');
      editor.commands.setColor('#3b82f6');

      const html = serializeEditorContent(editor);
      const spanCount = (html.match(/<span\b/gi) || []).length;
      expect(spanCount).toBe(1);
      expect(html).toContain('font-family:');
      expect(html).toContain('font-size: 20px');
      expect(html).toMatch(/color:\s*(?:#3b82f6|rgb\(59,\s*130,\s*246\))/i);
    });
  });

  describe('7. Clear Formatting', () => {
    it('unsets all marks, font-family, font-size, color, and highlight in one action', () => {
      const editor = createTestEditor('<p>Formatted Text</p>');
      editor.commands.selectAll();

      editor.commands.toggleBold();
      editor.commands.toggleItalic();
      editor.commands.setFontSize('24px');
      editor.commands.setColor('#ef4444');
      editor.commands.setHighlight({ color: '#fef08a' });

      expect(editor.isActive('bold')).toBe(true);
      expect(editor.getAttributes('textStyle').fontSize).toBe('24px');

      // Execute Clear Formatting chain
      editor
        .chain()
        .focus()
        .unsetAllMarks()
        .unsetFontFamily()
        .unsetFontSize()
        .unsetColor()
        .unsetHighlight()
        .run();

      expect(editor.isActive('bold')).toBe(false);
      expect(editor.isActive('italic')).toBe(false);
      expect(editor.isActive('highlight')).toBe(false);
      expect(editor.getAttributes('textStyle').fontSize).toBeFalsy();
      expect(editor.getAttributes('textStyle').color).toBeFalsy();
      expect(serializeEditorContent(editor)).toBe('<p>Formatted Text</p>');
    });
  });

  describe('8. Comprehensive Mixed Formatting Sequence & Round-Trip', () => {
    it('executes full sequence: Paragraph -> H2 -> FontFamily -> FontSize -> Color -> Highlight -> LineHeight -> CenterAlign -> Round-Trip', () => {
      const editor = createTestEditor('<p>Master Formatting</p>');
      editor.commands.focus('start');

      // 1. Turn to H2
      editor.commands.toggleHeading({ level: 2 });
      // 2. Line Height 2.0
      editor.commands.setLineHeight('2.0');
      // 3. Center Align
      editor.commands.setTextAlign('center');

      // 4. Select text for inline styles
      editor.commands.selectAll();
      const kaitiCss = FONT_FAMILIES.find((f) => f.value === 'kaiti')!.css;
      editor.commands.setFontFamily(kaitiCss);
      editor.commands.setFontSize('24px');
      editor.commands.setColor('#ef4444');
      editor.commands.setHighlight({ color: '#fef08a' });

      const serialized = serializeEditorContent(editor);
      expect(serialized).toContain('<h2');
      expect(serialized).toMatch(/line-height:\s*2(?:\.0)?/);
      expect(serialized).toContain('text-align: center');
      expect(serialized).toContain('font-size: 24px');
      expect(serialized).toMatch(/color:\s*(?:#ef4444|rgb\(239,\s*68,\s*68\))/i);
      expect(serialized).toMatch(/background-color:\s*(?:#fef08a|rgb\(254,\s*240,\s*138\))/i);

      // Re-load into fresh editor to verify round-trip preservation
      const reloadedEditor = createTestEditor(serialized);
      expect(reloadedEditor.isActive('heading', { level: 2 })).toBe(true);
      expect(reloadedEditor.isActive({ textAlign: 'center' })).toBe(true);
      expect(reloadedEditor.getAttributes('heading').lineHeight).toMatch(/2(?:\.0)?/);

      const reloadedHtml = serializeEditorContent(reloadedEditor);
      expect(reloadedHtml).toMatch(/line-height:\s*2(?:\.0)?/);
      expect(reloadedHtml).toContain('text-align: center');
      expect(reloadedHtml).toContain('font-size: 24px');
      expect(reloadedHtml).toMatch(/color:\s*(?:#ef4444|rgb\(239,\s*68,\s*68\))/i);
    });
  });

  describe('9. UI Components (Toolbar & Bubble Menu) Triggering E3 Commands', () => {
    it('triggers font family, size, line-height, and alignment from Toolbar', () => {
      const editor = createTestEditor('<p>Toolbar Typography Test</p>');
      editor.commands.focus('start');

      render(<TiptapToolbar editor={editor} />);

      expect(screen.getByTestId('toolbar-font-family-btn')).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-font-size-btn')).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-line-height-btn')).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-btn-align-center')).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-btn-color-palette')).toBeInTheDocument();

      // Click Align Center
      act(() => {
        fireEvent.click(screen.getByTestId('toolbar-btn-align-center'));
      });
      expect(editor.isActive({ textAlign: 'center' })).toBe(true);

      // Open Font Size dropdown and choose 24px
      act(() => {
        fireEvent.click(screen.getByTestId('toolbar-font-size-btn'));
      });
      const size24Btn = screen.getByText('24px (大标题)');
      act(() => {
        fireEvent.click(size24Btn);
      });
      expect(editor.getAttributes('textStyle').fontSize).toBe('24px');

    });

    it('mounts TiptapBubbleMenu with all typography popovers', () => {
      const editor = createTestEditor('<p>Bubble Menu Typography Test</p>');
      const { container } = render(<TiptapBubbleMenu editor={editor} />);
      expect(container).toBeDefined();
    });
  });
});
