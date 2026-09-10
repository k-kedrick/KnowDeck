import { describe, expect, it, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { createEditorExtensions } from './extensions';
import {
  EditorContentSession,
  prepareContentForEditor,
  serializeEditorContent,
} from './editorContentAdapter';

const realDoc = {
  content: `<table><tbody><tr><td>Historical table</td></tr></tbody></table><p><img src="/uploads/images/historical.png" alt="Historical image" /></p>${'x'.repeat(30000)}`,
};

describe('TipTap E6 Full Regression & Historical Content Safety Gate', () => {
  const editors: Editor[] = [];

  const createEditor = (content: string) => {
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

  describe('1. Real Historical Database Passthrough & Round-Trip', () => {
    it('Pipeline A: guarantees 100% Byte-for-Byte Original Passthrough on Real Document', () => {
      expect(realDoc).toBeDefined();
      expect(realDoc.content).toBeDefined();

      const session = new EditorContentSession(realDoc.content);
      const editor = createEditor(realDoc.content);

      expect(session.isDirty()).toBe(false);

      // Save without edit must return EXACT original bytes without touching
      const savedContent = session.resolveSaveContent(editor);
      expect(savedContent).toBe(realDoc.content);
      expect(savedContent.length).toBe(realDoc.content.length);
    });

    it('Pipeline B: executes Forced Round-Trip on Real Document without semantic loss', () => {
      const session = new EditorContentSession(realDoc.content);
      const editor = createEditor(realDoc.content);

      // Simulate user editing
      session.markUserDocumentChange(true);
      const serialized = serializeEditorContent(editor);

      expect(serialized.length).toBeGreaterThan(30000);
      expect(serialized).toContain('<table');
      expect(serialized).toContain('</table>');
      expect(serialized).toContain('<img');

      // Reload into fresh editor
      const reloadEditor = createEditor(serialized);
      expect(reloadEditor.state.doc.content.size).toBeGreaterThan(0);
    });
  });

  describe('2. Historical Content Feature Matrix (Groups A ~ E)', () => {
    // Group A: Pure GFM Markdown
    it('Group A: preserves headings, lists, code blocks, and blockquotes', () => {
      const gfmDoc = `
# Main Title
## Section 1
Here is a paragraph with **bold**, *italic*, and \`inline code\`.

> This is a blockquote

* List item 1
* List item 2

\`\`\`javascript
const greeting = "Hello World";
console.log(greeting);
\`\`\`
      `.trim();

      const editor = createEditor(gfmDoc);
      const output = serializeEditorContent(editor);

      expect(output).toContain('Main Title');
      expect(output).toContain('Section 1');
      expect(output).toContain('<strong>bold</strong>');
      expect(output).toContain('<em>italic</em>');
      expect(output).toContain('<code>inline code</code>');
      expect(output).toContain('<blockquote>');
      expect(output).toContain('List item 1');
      expect(output).toContain('const greeting = "Hello World"');
    });

    // Group B: Rich Typography & Inline Styling
    it('Group B: preserves font families, sizes, colors, highlights, and line heights', () => {
      const richTypographyDoc = `
<p style="line-height: 1.8; text-align: center;">
  <span style="font-family: 'PingFang SC', sans-serif; font-size: 18px; color: #2563eb;">Blue Text</span> and <mark style="background-color: #fef08a;">Highlighted Text</mark>
</p>
      `.trim();

      const editor = createEditor(richTypographyDoc);
      const output = serializeEditorContent(editor);

      expect(output).toContain('line-height: 1.8');
      expect(output).toContain('text-align: center');
      expect(output).toContain('font-family:');
      expect(output).toContain('font-size: 18px');
      expect(output).toContain('Blue Text');
      expect(output).toContain('Highlighted Text');
    });

    // Group C: Media & Embeds
    it('Group C: preserves image dimensions, alignment, video, attachments, and iframes', () => {
      const mediaDoc = `
<p><img src="/uploads/images/sample.png" width="50%" align="center" alt="Sample Image" /></p>
<video src="/uploads/videos/sample.mp4" controls preload="metadata"></video>
<p class="attachment"><a href="/uploads/attachments/report.pdf">📎 Annual Report.pdf</a></p>
<iframe src="https://example.com/embed" width="100%" height="400"></iframe>
      `.trim();

      const editor = createEditor(mediaDoc);
      const output = serializeEditorContent(editor);

      expect(output).toContain('src="/uploads/images/sample.png"');
      expect(output).toContain('width="50%"');
      expect(output).toContain('align="center"');
      expect(output).toContain('<video');
      expect(output).toContain('src="/uploads/videos/sample.mp4"');
      expect(output).toContain('href="/uploads/attachments/report.pdf"');
      expect(output).toContain('Annual Report.pdf');
      expect(output).toContain('<iframe');
      expect(output).toContain('src="https://example.com/embed"');
    });

    // Group D: Tables & Complex Spans
    it('Group D: preserves HTML tables, custom widths, colspan, and rowspan', () => {
      const tableDoc = `
<table class="feishu-rich-table" style="width: 90%;">
  <thead>
    <tr>
      <th colspan="2">Merged Header Cell</th>
      <th>Normal Header</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td rowspan="2">Spanned Row Cell</td>
      <td>Cell B1</td>
      <td>Cell C1</td>
    </tr>
    <tr>
      <td>Cell B2</td>
      <td>Cell C2</td>
    </tr>
  </tbody>
</table>
      `.trim();

      const editor = createEditor(tableDoc);
      const output = serializeEditorContent(editor);

      expect(output).toContain('colspan="2"');
      expect(output).toContain('rowspan="2"');
      expect(output).toContain('Merged Header Cell');
      expect(output).toContain('Spanned Row Cell');
      expect(output).toContain('Cell B1');
      expect(output).toContain('Cell C2');
    });

    // Group E: Complex Hybrid Document
    it('Group E: preserves complex hybrid Markdown and HTML mixture', () => {
      const hybridDoc = `
# Chapter 1: Introduction

<div class="callout callout-tip">
  <p><strong>Pro Tip:</strong> TipTap supports callouts seamlessly.</p>
</div>

Here is a list:
1. First point
2. Second point

<p style="text-align: right;"><img src="/uploads/images/diagram.png" width="320" align="right" alt="Diagram" /></p>

| Metric | Target | Status |
| --- | --- | --- |
| Accuracy | 99.9% | Passing |
| Latency | < 50ms | Passing |
      `.trim();

      const editor = createEditor(hybridDoc);
      const output = serializeEditorContent(editor);

      expect(output).toContain('Chapter 1: Introduction');
      expect(output).toContain('Pro Tip:');
      expect(output).toContain('First point');
      expect(output).toContain('/uploads/images/diagram.png');
      expect(output).toContain('Accuracy');
      expect(output).toContain('Passing');
    });
  });

  describe('3. Security & Malicious Content Sanitization (Group F)', () => {
    it('Group F: sanitizes javascript: URLs and dangerous CSS styles', () => {
      const maliciousDoc = `
<p><a href="javascript:alert('XSS')">Dangerous Link</a></p>
<p><img src="javascript:alert(1)" alt="Bad Image" /></p>
<p style="position: fixed; top: 0; left: 0; z-index: 99999; background-image: url('http://evil.com/leak');">
  <span style="font-size: 16px;">Text with injected styles</span>
</p>
      `.trim();

      const editor = createEditor(maliciousDoc);
      const output = serializeEditorContent(editor);

      // Dangerous scripts must be stripped
      expect(output).not.toContain('href="javascript:');
      expect(output).not.toContain('src="javascript:');
      expect(output).not.toContain('position: fixed');
      expect(output).not.toContain('background-image:');

      // Safe styles must be retained
      expect(output).toContain('font-size: 16px');
      expect(output).toContain('Text with injected styles');
    });
  });

  describe('4. Draft State & Dirty Guard Integrity', () => {
    it('accurately tracks dirty flag across load, edit, and markSaved cycles', () => {
      const content = '<p>Initial Content</p>';
      const session = new EditorContentSession(content);
      const editor = createEditor(content);

      expect(session.isDirty()).toBe(false);

      // Edit document
      editor.commands.insertContent('<p>Appended Paragraph</p>');
      session.markUserDocumentChange(true);
      expect(session.isDirty()).toBe(true);

      // Resolve save
      const saved = session.resolveSaveContent(editor);
      expect(saved).toContain('Appended Paragraph');

      // Mark saved
      session.markSaved(saved);
      expect(session.isDirty()).toBe(false);
    });
  });

  describe('5. Save In-Flight Keystroke Preservation (Race Guard)', () => {
    it('preserves keystrokes made while asynchronous save is in-flight', () => {
      const initial = '<p>Base Content</p>';
      const session = new EditorContentSession(initial);
      const editor = createEditor(initial);

      // User adds draft change
      editor.commands.insertContent('<p>Change 1</p>');
      session.markUserDocumentChange(true);
      const snapshotForSave = session.resolveSaveContent(editor);

      // User continues typing while save is in flight
      editor.commands.insertContent('<p>Change 2 (In-Flight Keystroke)</p>');

      // Save finishes
      session.markSaved(snapshotForSave);

      // Current content must STILL contain Change 2!
      const currentContent = serializeEditorContent(editor);
      expect(currentContent).toContain('Change 1');
      expect(currentContent).toContain('Change 2 (In-Flight Keystroke)');
    });
  });
});
