import { useEffect, useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { processDocumentHtml } from '../../../utils/documentHtml';
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

export function TiptapReadonlyDocument({ content, onReady }: TiptapReadonlyDocumentProps) {
  const preparedContent = useMemo(
    () => processDocumentHtml(prepareContentForEditor(content)),
    [content],
  );
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
