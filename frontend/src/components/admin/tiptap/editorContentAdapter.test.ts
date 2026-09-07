import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { createEditorExtensions } from './extensions';
import {
  detectContentFormat,
  EditorContentSession,
  prepareContentForEditor,
  serializeEditorContent,
} from './editorContentAdapter';

const sha256 = async (value: string) => Array.from(
  new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
  (byte) => byte.toString(16).padStart(2, '0'),
).join('');

describe('editorContentAdapter', () => {
  it('detects empty, Markdown, HTML and mixed source formats', () => {
    expect(detectContentFormat('')).toBe('empty');
    expect(detectContentFormat('# Markdown')).toBe('markdown');
    expect(detectContentFormat('<p>HTML</p>')).toBe('html');
    expect(detectContentFormat('# Markdown\n\n<div>HTML</div>')).toBe('mixed');
  });

  it('reuses the existing Markdown and HTML sanitizer input paths', () => {
    expect(prepareContentForEditor('# Title')).toContain('<h1>Title</h1>');
    const safe = prepareContentForEditor('<p>Safe</p><script>alert(1)</script>');
    expect(safe).toContain('<p>Safe</p>');
    expect(safe).not.toContain('<script>');
  });

  it('submits the exact original source when no user document change occurred', async () => {
    const original = '# Exact legacy source\n\n<div data-custom="keep-me">Mixed</div>\n';
    const session = new EditorContentSession(original);
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: prepareContentForEditor(original),
    });

    const submitted = session.resolveSaveContent(editor);
    expect(submitted).toBe(original);
    expect(await sha256(submitted)).toBe(await sha256(original));
    editor.destroy();
  });

  it('serializes and sanitizes only after a real document change is marked', () => {
    const original = '<p>hello</p>';
    const session = new EditorContentSession(original);
    const editor = new Editor({ extensions: createEditorExtensions(), content: original });
    editor.commands.setTextSelection(6);
    editor.commands.insertContent(' world');
    session.markUserDocumentChange(true);

    const submitted = session.resolveSaveContent(editor);
    expect(submitted).not.toBe(original);
    expect(submitted).toContain('hello world');
    expect(submitted).toBe(serializeEditorContent(editor));
    editor.destroy();
  });
});
