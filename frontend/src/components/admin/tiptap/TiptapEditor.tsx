import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { normalizePastedDocumentHtml, sanitizeDocumentHtml } from '../../../utils/htmlToMarkdown';
import {
  EditorContentSession,
  prepareContentForEditor,
  serializeEditorContent,
} from './editorContentAdapter';
import { createEditorExtensions } from './extensions';
import {
  addUploadAnchor,
  getUploadAnchorPosition,
  removeUploadAnchorMeta,
} from './extensions/UploadAnchorPlugin';
import { TiptapToolbar } from './TiptapToolbar';
import { TiptapBubbleMenu } from './TiptapBubbleMenu';
import { TiptapImageMenu } from './TiptapImageMenu';
import { TiptapTableMenu } from './TiptapTableMenu';
import { uploadMediaFile, type UploadHandler } from './uploadEditorMedia';

export interface TiptapEditorHandle {
  getContentForSave: () => string;
  getEditor: () => Editor | null;
  isDirty: () => boolean;
  markSaved: (content: string) => void;
}

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  onUploadFile?: UploadHandler;
  uploading?: boolean;
  uploadProgress?: string;
}

const SNAPSHOT_DEBOUNCE_MS = 320;

export const TiptapEditor = forwardRef<TiptapEditorHandle, TiptapEditorProps>(function TiptapEditor(
  { content, onChange, onUploadFile, uploading = false, uploadProgress },
  ref,
) {
  const sessionRef = useRef(new EditorContentSession(content));
  const onChangeRef = useRef(onChange);
  const onUploadFileRef = useRef(onUploadFile);
  const programmaticUpdateRef = useRef(false);
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmittedContentRef = useRef<string | null>(null);
  const lastExternalContentRef = useRef(content);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onUploadFileRef.current = onUploadFile;
  }, [onUploadFile]);

  const scheduleDraftSnapshot = useCallback((editor: Editor) => {
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      const snapshot = serializeEditorContent(editor);
      lastEmittedContentRef.current = snapshot;
      onChangeRef.current(snapshot);
    }, SNAPSHOT_DEBOUNCE_MS);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createEditorExtensions(),
    content: prepareContentForEditor(content),
    editorProps: {
      attributes: {
        class: 'tiptap-poc-editor document-body markdown-body min-h-[600px] focus:outline-none',
        'data-testid': 'tiptap-editor-canvas',
      },
      transformPastedHTML: (html) => sanitizeDocumentHtml(normalizePastedDocumentHtml(html)),
      handlePaste: (view, event) => {
        const files = event.clipboardData?.files;
        if (!files || files.length === 0) return false;

        const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
        if (imageFiles.length === 0) return false;

        event.preventDefault();
        const initialPos = view.state.selection.from;

        for (const file of imageFiles) {
          const uploadId = `paste_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
          view.dispatch(addUploadAnchor(view.state.tr, uploadId, initialPos));

          uploadMediaFile(file, onUploadFileRef.current)
            .then((media) => {
              if (!editorRef.current || editorRef.current.isDestroyed || !editorRef.current.view) return;
              const currentPos =
                getUploadAnchorPosition(editorRef.current.state, uploadId) ?? initialPos;
              const targetPos = Math.min(
                Math.max(0, currentPos),
                editorRef.current.state.doc.content.size,
              );

              const imageNode = editorRef.current.schema.nodes.image?.create({
                src: media.url,
                alt: media.original_name || file.name,
              });

              if (imageNode) {
                const tr = removeUploadAnchorMeta(editorRef.current.state.tr, uploadId);
                tr.insert(targetPos, imageNode);
                editorRef.current.view.dispatch(tr);
              }
            })
            .catch((err) => {
              console.error('Image paste upload failed:', err);
              if (editorRef.current && !editorRef.current.isDestroyed && editorRef.current.view) {
                editorRef.current.view.dispatch(
                  removeUploadAnchorMeta(editorRef.current.state.tr, uploadId),
                );
              }
            });
        }
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
        if (imageFiles.length === 0) return false;

        event.preventDefault();
        const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const initialPos = coordinates?.pos ?? view.state.selection.from;

        for (const file of imageFiles) {
          const uploadId = `drop_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
          view.dispatch(addUploadAnchor(view.state.tr, uploadId, initialPos));

          uploadMediaFile(file, onUploadFileRef.current)
            .then((media) => {
              if (!editorRef.current || editorRef.current.isDestroyed || !editorRef.current.view) return;
              const currentPos =
                getUploadAnchorPosition(editorRef.current.state, uploadId) ?? initialPos;
              const targetPos = Math.min(
                Math.max(0, currentPos),
                editorRef.current.state.doc.content.size,
              );

              const imageNode = editorRef.current.schema.nodes.image?.create({
                src: media.url,
                alt: media.original_name || file.name,
              });

              if (imageNode) {
                const tr = removeUploadAnchorMeta(editorRef.current.state.tr, uploadId);
                tr.insert(targetPos, imageNode);
                editorRef.current.view.dispatch(tr);
              }
            })
            .catch((err) => {
              console.error('Image drop upload failed:', err);
              if (editorRef.current && !editorRef.current.isDestroyed && editorRef.current.view) {
                editorRef.current.view.dispatch(
                  removeUploadAnchorMeta(editorRef.current.state.tr, uploadId),
                );
              }
            });
        }
        return true;
      },
    },
    onTransaction: ({ editor: currentEditor, transaction }) => {
      if (!transaction.docChanged || programmaticUpdateRef.current) return;
      sessionRef.current.markUserDocumentChange(true);
      scheduleDraftSnapshot(currentEditor);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => () => {
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
  }, []);

  useEffect(() => {
    if (!editor || content === lastExternalContentRef.current) return;

    if (content === lastEmittedContentRef.current) {
      lastEmittedContentRef.current = null;
      lastExternalContentRef.current = content;
      return;
    }

    programmaticUpdateRef.current = true;
    editor.commands.setContent(prepareContentForEditor(content), { emitUpdate: false });
    programmaticUpdateRef.current = false;
    sessionRef.current.replaceFromExternalSource(content);
    lastExternalContentRef.current = content;
  }, [content, editor]);

  useImperativeHandle(ref, () => ({
    getContentForSave: () => (editor ? sessionRef.current.resolveSaveContent(editor) : content),
    getEditor: () => editor,
    isDirty: () => sessionRef.current.isDirty(),
    markSaved: (savedContent: string) => {
      sessionRef.current.markSaved(savedContent);
      lastExternalContentRef.current = savedContent;
      lastEmittedContentRef.current = savedContent;
    },
  }), [content, editor]);

  if (!editor) {
    return (
      <div className="min-h-[680px] rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900">
        TipTap E4 初始化中...
      </div>
    );
  }

  return (
    <div className="space-y-3" data-editor-engine="tiptap">
      <TiptapToolbar
        editor={editor}
        onUploadFile={onUploadFile}
        uploading={uploading}
        uploadProgress={uploadProgress}
      />

      {/* Floating Text Selection Bubble Menu */}
      <TiptapBubbleMenu editor={editor} />

      {/* Floating Image Control Menu */}
      <TiptapImageMenu editor={editor} />

      {/* Floating Table Action Menu */}
      <TiptapTableMenu editor={editor} />

      <div className="mx-auto min-h-[680px] w-full max-w-4xl overflow-x-hidden rounded-3xl border border-slate-200/90 bg-white p-8 shadow-xl dark:border-slate-700/80 dark:bg-slate-900 md:p-14">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});
