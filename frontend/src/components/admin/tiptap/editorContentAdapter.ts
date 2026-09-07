import type { Editor } from '@tiptap/core';
import {
  isHtmlDocumentContent,
  markdownToEditorHtml,
  sanitizeDocumentHtml,
} from '../../../utils/htmlToMarkdown';

export type EditorContentFormat = 'empty' | 'markdown' | 'html' | 'mixed';

const HTML_STRUCTURE_RE = /<(?:p|div|h[1-6]|blockquote|ul|ol|li|table|pre|hr|img|video|iframe|span|strong|em|a)\b/i;
const MARKDOWN_STRUCTURE_RE = /(^|\n)\s{0,3}(?:#{1,6}\s+|>\s+|[-+*]\s+|\d+\.\s+|```)|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*/m;

export function detectContentFormat(content: string): EditorContentFormat {
  const trimmed = content.trim();
  if (!trimmed) return 'empty';

  const hasHtml = HTML_STRUCTURE_RE.test(trimmed);
  const hasMarkdown = MARKDOWN_STRUCTURE_RE.test(trimmed);
  if (hasHtml && hasMarkdown) return 'mixed';
  if (isHtmlDocumentContent(trimmed) || hasHtml) return 'html';
  return 'markdown';
}

export function prepareContentForEditor(content: string): string {
  const format = detectContentFormat(content);
  if (format === 'empty') return '<p><br /></p>';
  if (format === 'html') return sanitizeDocumentHtml(content);

  // Keep the existing project parser as the single Markdown/mixed-content input
  // adapter. It also applies the established document sanitizer.
  return markdownToEditorHtml(content);
}

export function serializeEditorContent(editor: Pick<Editor, 'getHTML'>): string {
  return sanitizeDocumentHtml(editor.getHTML());
}

/**
 * Keeps the source string untouched until a real editor document change occurs.
 * This is deliberately independent of React so save behavior can be tested
 * without relying on asynchronous component state.
 */
export class EditorContentSession {
  private originalContent: string;
  private dirty = false;

  constructor(originalContent: string) {
    this.originalContent = originalContent;
  }

  isDirty(): boolean {
    return this.dirty;
  }

  markUserDocumentChange(docChanged: boolean): void {
    if (docChanged) this.dirty = true;
  }

  replaceFromExternalSource(content: string): void {
    this.originalContent = content;
    this.dirty = false;
  }

  markSaved(content: string): void {
    this.originalContent = content;
    this.dirty = false;
  }

  resolveSaveContent(editor: Pick<Editor, 'getHTML'>): string {
    return this.dirty ? serializeEditorContent(editor) : this.originalContent;
  }
}
