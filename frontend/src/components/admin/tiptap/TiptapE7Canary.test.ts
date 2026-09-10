import { describe, expect, it, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { createEditorExtensions } from './extensions';
import {
  EditorContentSession,
  prepareContentForEditor,
  serializeEditorContent,
} from './editorContentAdapter';
import {
  markdownToEditorHtml,
  htmlToMarkdown,
} from '../../../utils/htmlToMarkdown';

describe('TipTap E7 Hidden Canary & HTML Compatibility Validation', () => {
  const editors: Editor[] = [];

  const createTipTap = (content: string) => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: prepareContentForEditor(content),
    });
    editors.push(editor);
    return editor;
  };

  afterEach(() => {
    editors.splice(0).forEach((e) => e.destroy());
  });

  describe('1. TipTap No-Edit Passthrough Integrity', () => {
    it('guarantees byte-for-byte fidelity when opened and saved without edits', () => {
      const originalHtml = `
# Canary Title
<div class="callout callout-note"><p>Important Canary Note</p></div>
<p style="text-align: center;"><span style="color: #2563eb; font-size: 18px;">Canary Text</span></p>
<table class="feishu-rich-table" style="width: 80%;">
  <thead><tr><th colspan="2">Merged Header</th></tr></thead>
  <tbody><tr><td rowspan="2">Span Cell</td><td>Normal Cell</td></tr></tbody>
</table>
      `.trim();

      const session = new EditorContentSession(originalHtml);
      const editor = createTipTap(originalHtml);

      expect(session.isDirty()).toBe(false);

      const saved = session.resolveSaveContent(editor);
      expect(saved).toBe(originalHtml);
      expect(saved.length).toBe(originalHtml.length);
    });
  });

  describe('2. HTML adapter roundtrip', () => {
    it('preserves content through HTML conversion and reopening in TipTap', () => {
      // Step 1: User creates rich content in TipTap
      const tipTapEditor = createTipTap('<p>Start</p>');
      tipTapEditor.commands.setContent(`
<h2>TipTap Section Header</h2>
<p style="text-align: center; line-height: 1.8;">
  <span style="color: rgb(37, 99, 235); font-size: 18px;"><strong>Styled Bold Blue Text</strong></span>
</p>
<p><img src="/uploads/images/canary.png" width="50%" align="center" alt="Canary" /></p>
      `);

      const tipTapSaved = serializeEditorContent(tipTapEditor);
      expect(tipTapSaved).toContain('TipTap Section Header');
      expect(tipTapSaved).toContain('color: rgb(37, 99, 235)');
      expect(tipTapSaved).toContain('src="/uploads/images/canary.png"');

      // Step 2: convert the saved document to its HTML representation.
      const convertedHtml = markdownToEditorHtml(tipTapSaved);
      expect(convertedHtml).toContain('TipTap Section Header');
      expect(convertedHtml).toContain('color: rgb(37, 99, 235)');
      expect(convertedHtml).toContain('/uploads/images/canary.png');

      // Step 3: an HTML document is modified and serialized.
      const modifiedHtml = convertedHtml + '<p>Added by HTML conversion</p>';
      const convertedSaved = htmlToMarkdown(modifiedHtml);
      expect(convertedSaved).toContain('TipTap Section Header');
      expect(convertedSaved).toContain('Added by HTML conversion');

      // Step 4: TipTap reopens the converted document.
      const tipTapReopened = createTipTap(convertedSaved);
      const reSerialized = serializeEditorContent(tipTapReopened);

      expect(reSerialized).toContain('TipTap Section Header');
      expect(reSerialized).toContain('color: rgb(37, 99, 235)');
      expect(reSerialized).toContain('src="/uploads/images/canary.png"');
      expect(reSerialized).toContain('Added by HTML conversion');
    });
  });

  describe('3. Table preservation across HTML conversion', () => {
    it('preserves TipTap complex tables with colspan, rowspan, and custom styles through HTML conversion', () => {
      // Step 1: Create table with colspan, rowspan, and feishu classes in TipTap
      const initialTableDoc = `
<table class="feishu-rich-table" style="width: 85%;">
  <thead>
    <tr>
      <th colspan="2">Dual Header Cell</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td rowspan="2">Vertical Spanned Cell</td>
      <td>Row 1 Data</td>
      <td>Active</td>
    </tr>
    <tr>
      <td>Row 2 Data</td>
      <td>Pending</td>
    </tr>
  </tbody>
</table>
<p>Unrelated Paragraph Text</p>
      `.trim();

      const tipTap1 = createTipTap(initialTableDoc);
      const tipTapOutput = serializeEditorContent(tipTap1);

      expect(tipTapOutput).toContain('colspan="2"');
      expect(tipTapOutput).toContain('rowspan="2"');
      expect(tipTapOutput).toContain('Dual Header Cell');
      expect(tipTapOutput).toContain('Vertical Spanned Cell');

      // Step 2: convert the table document to HTML.
      const convertedHtml = markdownToEditorHtml(tipTapOutput);
      expect(convertedHtml).toContain('colspan="2"');
      expect(convertedHtml).toContain('rowspan="2"');

      // Step 3: modify an unrelated HTML paragraph.
      const modifiedHtml = convertedHtml.replace(
        'Unrelated Paragraph Text',
        'Modified Paragraph By HTML conversion',
      );
      const convertedSaved = htmlToMarkdown(modifiedHtml);

      // Step 4: TipTap re-opens
      const tipTap2 = createTipTap(convertedSaved);
      const finalOutput = serializeEditorContent(tipTap2);

      // Crucial assertions: Zero structural loss on table!
      expect(finalOutput).toContain('colspan="2"');
      expect(finalOutput).toContain('rowspan="2"');
      expect(finalOutput).toContain('Dual Header Cell');
      expect(finalOutput).toContain('Vertical Spanned Cell');
      expect(finalOutput).toContain('Row 1 Data');
      expect(finalOutput).toContain('Row 2 Data');
      expect(finalOutput).toContain('Modified Paragraph By HTML conversion');
    });
  });

  describe('4. Rollback Feasibility (Feature Flag Switch)', () => {
    it('confirms both engines can independently consume the unified Hybrid Markdown/HTML persistence contract', () => {
      const contractContent = `
# Unified Contract Document
<p style="text-align: right;"><span style="color: #10b981;">Green Right Text</span></p>
<table class="feishu-rich-table">
  <thead><tr><th>Column A</th><th>Column B</th></tr></thead>
  <tbody><tr><td>100</td><td>200</td></tr></tbody>
</table>
      `.trim();

      const convertedHtml = markdownToEditorHtml(contractContent);
      const convertedResaved = htmlToMarkdown(convertedHtml);
      expect(convertedResaved).toContain('Unified Contract Document');
      expect(convertedResaved).toContain('Column A');

      // TipTap path
      const tipTapEditor = createTipTap(contractContent);
      const tipTapResaved = serializeEditorContent(tipTapEditor);
      expect(tipTapResaved).toContain('Unified Contract Document');
      expect(tipTapResaved).toContain('Column A');

      expect(typeof convertedResaved).toBe('string');
      expect(typeof tipTapResaved).toBe('string');
    });
  });
});
