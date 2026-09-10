import { useEffect, useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { processDocumentHtml } from '../../../utils/documentHtml';
import { isHtmlDocumentContent } from '../../../utils/htmlToMarkdown';
import { prepareContentForEditor } from './editorContentAdapter';
import { createEditorExtensions } from './extensions';

interface TiptapReadonlyDocumentProps {
  content: string;
  onReady?: (content: string) => void;
}

const normalizeReaderLinks = (root: HTMLElement) => {
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (href.startsWith('#') || href.startsWith('/')) {
      link.removeAttribute('target');
      link.removeAttribute('rel');
      return;
    }
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
};

// Markdown documents were historically addressed with GitHub-style heading
// fragments. Keep those public URLs stable while rich HTML retains its stored IDs.
const normalizeMarkdownHeadingIds = (root: HTMLElement) => {
  const usedIds = new Set<string>();
  root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6').forEach((heading) => {
    const base = (heading.textContent || '')
      .trim()
      .normalize('NFKC')
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'section';
    let id = base;
    let suffix = 1;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    heading.id = id;
  });
};

const prepareReaderContent = (content: string) => {
  const prepared = processDocumentHtml(prepareContentForEditor(content));
  if (isHtmlDocumentContent(content) || typeof document === 'undefined') return prepared;

  const doc = new DOMParser().parseFromString(prepared, 'text/html');
  normalizeMarkdownHeadingIds(doc.body);
  return doc.body.innerHTML;
};

export function TiptapReadonlyDocument({ content, onReady }: TiptapReadonlyDocumentProps) {
  const preparedContent = useMemo(() => prepareReaderContent(content), [content]);
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: createEditorExtensions(),
    content: preparedContent,
    editorProps: {
      attributes: {
        class: 'tiptap-poc-editor document-body markdown-body focus:outline-none',
        'data-testid': 'tiptap-reader-canvas',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(preparedContent, { emitUpdate: false });
    normalizeReaderLinks(editor.view.dom);
    onReady?.(content);
  }, [content, editor, onReady, preparedContent]);

  return editor ? <EditorContent editor={editor} /> : null;
}
