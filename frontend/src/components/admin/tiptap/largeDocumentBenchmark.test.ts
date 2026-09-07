import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createEditorExtensions } from './extensions';
import {
  EditorContentSession,
  prepareContentForEditor,
  serializeEditorContent,
} from './editorContentAdapter';

const benchmarkEnv = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env ?? {};

const benchmarkEnabled = Boolean(
  benchmarkEnv.E1_BENCHMARK_URL
  && benchmarkEnv.E1_BENCHMARK_USER
  && benchmarkEnv.E1_BENCHMARK_PASSWORD
  && benchmarkEnv.E1_BENCHMARK_DOC_ID,
);

const benchmarkIt = benchmarkEnabled ? it : it.skip;

describe('TipTap E1 real large-document read-only benchmark', () => {
  benchmarkIt('loads a temporary in-memory copy without writing to the API', async () => {
    const baseUrl = benchmarkEnv.E1_BENCHMARK_URL!;
    const loginResponse = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: benchmarkEnv.E1_BENCHMARK_USER,
        password: benchmarkEnv.E1_BENCHMARK_PASSWORD,
      }),
    });
    const login = await loginResponse.json();
    const documentResponse = await fetch(`${baseUrl}/api/admin/documents/${benchmarkEnv.E1_BENCHMARK_DOC_ID}`, {
      headers: { Authorization: `Bearer ${login.data.token}` },
    });
    const payload = await documentResponse.json();
    const content = String(payload.data.content || '');

    const prepareStart = performance.now();
    const prepared = prepareContentForEditor(content);
    const prepareMs = performance.now() - prepareStart;

    const element = document.createElement('div');
    const initializeStart = performance.now();
    const editor = new Editor({ element, extensions: createEditorExtensions(), content: prepared });
    const initializeMs = performance.now() - initializeStart;

    // Prove the production-sized source also takes the strict no-edit path.
    const session = new EditorContentSession(content);
    expect(session.resolveSaveContent(editor)).toBe(content);

    const inputStart = performance.now();
    editor.commands.insertContentAt(editor.state.doc.content.size, 'x');
    const firstInputMs = performance.now() - inputStart;

    const serializeStart = performance.now();
    const html = editor.getHTML();
    const serializeMs = performance.now() - serializeStart;

    const sanitizeStart = performance.now();
    const snapshot = serializeEditorContent(editor);
    const sanitizeMs = performance.now() - sanitizeStart;

    const draftStart = performance.now();
    localStorage.setItem('kb_e1_large_document_benchmark', JSON.stringify({ content: snapshot }));
    localStorage.removeItem('kb_e1_large_document_benchmark');
    const draftSnapshotMs = performance.now() - draftStart;

    const originalText = new DOMParser().parseFromString(prepared, 'text/html').body.textContent || '';
    const serializedText = new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
    const originalCompactText = originalText.replace(/\s+/g, '');
    const serializedCompactText = serializedText.replace(/\s+/g, '');

    const metrics = {
      characters: content.length,
      preparedCharacters: prepared.length,
      headings: (content.match(/<h[1-6]\b/gi) || []).length,
      images: (content.match(/<img\b/gi) || []).length,
      tables: (content.match(/<table\b/gi) || []).length,
      prepareMs,
      initializeMs,
      firstInputMs,
      serializeMs,
      sanitizeMs,
      draftSnapshotMs,
      serializedCharacters: html.length,
      snapshotCharacters: snapshot.length,
      serializedHeadings: (html.match(/<h[1-6]\b/gi) || []).length,
      serializedImages: (html.match(/<img\b/gi) || []).length,
      serializedTables: (html.match(/<table\b/gi) || []).length,
      originalTextCharacters: originalText.length,
      serializedTextCharacters: serializedText.length,
      originalCompactTextCharacters: originalCompactText.length,
      serializedCompactTextCharacters: serializedCompactText.length,
      serializedVideos: (html.match(/<video\b/gi) || []).length,
      serializedIframes: (html.match(/<iframe\b/gi) || []).length,
      serializedCallouts: (html.match(/class="[^"]*callout/gi) || []).length,
    };
    console.info('E1_LARGE_DOCUMENT_METRICS', JSON.stringify(metrics));

    expect(content.length).toBeGreaterThan(400_000);
    expect(firstInputMs).toBeLessThan(1_000);
    expect(serializeMs).toBeLessThan(1_000);
    expect(sanitizeMs).toBeLessThan(1_000);
    expect((html.match(/<h[1-6]\b/gi) || []).length).toBe((content.match(/<h[1-6]\b/gi) || []).length);
    expect((html.match(/<img\b/gi) || []).length).toBe((content.match(/<img\b/gi) || []).length);
    expect((html.match(/<table\b/gi) || []).length).toBe((content.match(/<table\b/gi) || []).length);
    expect(serializedCompactText).toBe(`${originalCompactText}x`);
    editor.destroy();
  }, 30_000);
});
