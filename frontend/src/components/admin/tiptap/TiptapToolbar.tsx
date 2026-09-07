import React, { useState, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/core';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code as CodeIcon,
  Undo2,
  Redo2,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  RemoveFormatting,
  ChevronDown,
  Image as ImageIcon,
  Table as TableIcon,
  Loader2,
} from 'lucide-react';
import type { Media } from '../../../api';
import {
  FONT_FAMILIES,
  FONT_SIZES,
  TEXT_COLORS,
  HIGHLIGHT_COLORS,
  LINE_HEIGHTS,
} from './typographyConstants';
import {
  addUploadAnchor,
  getUploadAnchorPosition,
  removeUploadAnchorMeta,
} from './extensions/UploadAnchorPlugin';
import { TiptapTableInsertMenu } from './TiptapTableInsertMenu';
import { uploadMediaFile, type UploadHandler } from './uploadEditorMedia';

interface TiptapToolbarProps {
  editor: Editor;
  onUploadFile?: UploadHandler;
  uploading?: boolean;
}

export const TiptapToolbar: React.FC<TiptapToolbarProps> = ({
  editor,
  onUploadFile,
  uploading: externalUploading = false,
}) => {
  const [activeMenu, setActiveMenu] = useState<
    'font' | 'size' | 'lineHeight' | 'color' | 'table' | null
  >(null);
  const [isUploading, setIsUploading] = useState(false);
  const [, setUpdateTick] = useState(0);
  const toolbarContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadIdRef = useRef<string | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setUpdateTick((tick) => tick + 1);
    };

    editor.on('transaction', handleUpdate);
    editor.on('selectionUpdate', handleUpdate);

    return () => {
      editor.off('transaction', handleUpdate);
      editor.off('selectionUpdate', handleUpdate);
    };
  }, [editor]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (toolbarContainerRef.current && !toolbarContainerRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const toggleMenu = (menu: 'font' | 'size' | 'lineHeight' | 'color' | 'table') => {
    setActiveMenu((prev) => (prev === menu ? null : menu));
  };

  const handleOpenFileInput = () => {
    if (!editor || editor.isDestroyed || !editor.view) return;
    const uploadId = `toolbar_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
    pendingUploadIdRef.current = uploadId;
    editor.view.dispatch(addUploadAnchor(editor.state.tr, uploadId, editor.state.selection.from));
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const uploadId = pendingUploadIdRef.current;
    if (!file) {
      if (uploadId && editor && !editor.isDestroyed && editor.view) {
        editor.view.dispatch(removeUploadAnchorMeta(editor.state.tr, uploadId));
      }
      return;
    }

    // Reset input value to allow selecting same file again
    event.target.value = '';

    setIsUploading(true);
    try {
      const media: Media = await uploadMediaFile(file, onUploadFile);
      if (!editor || editor.isDestroyed || !editor.view) return;

      const currentPos = uploadId
        ? getUploadAnchorPosition(editor.state, uploadId) ?? editor.state.selection.from
        : editor.state.selection.from;
      const targetPos = Math.min(Math.max(0, currentPos), editor.state.doc.content.size);

      let mediaNode = null;
      if (media.media_type === 'image') {
        mediaNode = editor.schema.nodes.image?.create({
          src: media.url,
          alt: media.original_name || file.name,
        });
      } else if (media.media_type === 'video') {
        mediaNode = editor.schema.nodes.video?.create({
          src: media.url,
          controls: true,
        });
      } else {
        mediaNode = editor.schema.nodes.attachment?.create({
          href: media.url,
          label: media.original_name || file.name,
        });
      }

      if (mediaNode) {
        let tr = editor.state.tr;
        if (uploadId) {
          tr = removeUploadAnchorMeta(tr, uploadId);
        }
        tr.insert(targetPos, mediaNode);
        editor.view.dispatch(tr);
      }
    } catch (err) {
      console.error('Media upload failed:', err);
      if (uploadId && editor && !editor.isDestroyed && editor.view) {
        editor.view.dispatch(removeUploadAnchorMeta(editor.state.tr, uploadId));
      }
    } finally {
      setIsUploading(false);
      pendingUploadIdRef.current = null;
    }
  };

  // Typography states
  const textStyleAttrs = editor.getAttributes('textStyle');
  const currentFontCss = textStyleAttrs.fontFamily || '';
  const currentFontOption = FONT_FAMILIES.find((f) => f.css === currentFontCss) || FONT_FAMILIES[0];
  const currentFontSize = textStyleAttrs.fontSize || '15px';

  const blockAttrs = editor.getAttributes('paragraph').lineHeight
    ? editor.getAttributes('paragraph')
    : editor.getAttributes('heading');
  const currentLineHeight = blockAttrs.lineHeight || '默认';

  const highlightAttrs = editor.getAttributes('highlight');
  const currentHighlight = highlightAttrs.color || 'transparent';
  const currentTextColor = textStyleAttrs.color || '#1e293b';

  const buttonBase =
    'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none disabled:opacity-30 disabled:pointer-events-none';
  const buttonInactive =
    'text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white';
  const buttonActive =
    'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/60 dark:border-blue-700 dark:text-blue-300 font-semibold';

  const dropdownContainer =
    'absolute left-0 top-full mt-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900 z-50 animate-in fade-in zoom-in-95 duration-100';

  const uploadingEffective = isUploading || externalUploading;

  return (
    <div
      ref={toolbarContainerRef}
      className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-2 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50"
      data-testid="tiptap-toolbar"
    >
      <div className="flex items-center gap-1 rounded-md bg-indigo-100/80 px-2 py-1 text-[11px] font-semibold text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80">
        <span>TipTap E5</span>
      </div>

      <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

      {/* Block Types */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={`${buttonBase} ${editor.isActive('paragraph') ? buttonActive : buttonInactive}`}
        title="正文段落"
        data-testid="toolbar-btn-paragraph"
      >
        <Pilcrow size={13} />
        <span>正文</span>
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`${buttonBase} ${editor.isActive('heading', { level: 1 }) ? buttonActive : buttonInactive}`}
        title="标题 1 (H1)"
        data-testid="toolbar-btn-h1"
      >
        <Heading1 size={13} />
        <span>H1</span>
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`${buttonBase} ${editor.isActive('heading', { level: 2 }) ? buttonActive : buttonInactive}`}
        title="标题 2 (H2)"
        data-testid="toolbar-btn-h2"
      >
        <Heading2 size={13} />
        <span>H2</span>
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`${buttonBase} ${editor.isActive('heading', { level: 3 }) ? buttonActive : buttonInactive}`}
        title="标题 3 (H3)"
        data-testid="toolbar-btn-h3"
      >
        <Heading3 size={13} />
        <span>H3</span>
      </button>

      <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

      {/* Font Family Dropdown */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('font')}
          className={`${buttonBase} ${currentFontOption.value !== 'default' ? buttonActive : buttonInactive}`}
          title="选择正文字体 (Font Family)"
          data-testid="toolbar-font-family-btn"
        >
          <span className="max-w-[70px] truncate">{currentFontOption.label}</span>
          <ChevronDown size={11} className={`transition-transform ${activeMenu === 'font' ? 'rotate-180' : ''}`} />
        </button>

        {activeMenu === 'font' && (
          <div className={`${dropdownContainer} w-44 max-h-60 overflow-y-auto`} onMouseDown={(e) => e.preventDefault()}>
            {FONT_FAMILIES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left ${
                  currentFontOption.value === item.value ? 'bg-blue-100 text-blue-700 font-bold dark:bg-blue-900/50 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                onClick={() => {
                  if (item.value === 'default') {
                    editor.chain().focus().unsetFontFamily().run();
                  } else {
                    editor.chain().focus().setFontFamily(item.css).run();
                  }
                  setActiveMenu(null);
                }}
              >
                <span style={item.css ? { fontFamily: item.css } : undefined}>{item.label}</span>
                <span className="text-[10px] text-slate-400 font-normal">{item.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Font Size Dropdown */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('size')}
          className={`${buttonBase} ${currentFontSize !== '15px' && currentFontSize !== 'default' ? buttonActive : buttonInactive}`}
          title="字号大小"
          data-testid="toolbar-font-size-btn"
        >
          <span>{currentFontSize}</span>
          <ChevronDown size={11} className={`transition-transform ${activeMenu === 'size' ? 'rotate-180' : ''}`} />
        </button>

        {activeMenu === 'size' && (
          <div className={`${dropdownContainer} w-36 max-h-60 overflow-y-auto`} onMouseDown={(e) => e.preventDefault()}>
            {FONT_SIZES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left ${
                  currentFontSize === item.value ? 'bg-blue-100 text-blue-700 font-bold dark:bg-blue-900/50 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                onClick={() => {
                  if (item.value === '15px' || item.value === 'default') {
                    editor.chain().focus().unsetFontSize().run();
                  } else {
                    editor.chain().focus().setFontSize(item.value).run();
                  }
                  setActiveMenu(null);
                }}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Line Height Dropdown */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('lineHeight')}
          className={`${buttonBase} ${currentLineHeight !== '默认' ? buttonActive : buttonInactive}`}
          title="段落行距"
          data-testid="toolbar-line-height-btn"
        >
          <span>{currentLineHeight === '默认' ? '行距' : `${currentLineHeight}x`}</span>
          <ChevronDown size={11} className={`transition-transform ${activeMenu === 'lineHeight' ? 'rotate-180' : ''}`} />
        </button>

        {activeMenu === 'lineHeight' && (
          <div className={`${dropdownContainer} w-32 max-h-60 overflow-y-auto`} onMouseDown={(e) => e.preventDefault()}>
            {LINE_HEIGHTS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left ${
                  (item.value === 'default' && currentLineHeight === '默认') || currentLineHeight === item.value
                    ? 'bg-blue-100 text-blue-700 font-bold dark:bg-blue-900/50 dark:text-blue-300'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                onClick={() => {
                  if (item.value === 'default') {
                    editor.chain().focus().unsetLineHeight().run();
                  } else {
                    editor.chain().focus().setLineHeight(item.value).run();
                  }
                  setActiveMenu(null);
                }}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

      {/* Alignment Buttons */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={`${buttonBase} ${editor.isActive({ textAlign: 'left' }) ? buttonActive : buttonInactive}`}
        title="左对齐"
        data-testid="toolbar-btn-align-left"
      >
        <AlignLeft size={13} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={`${buttonBase} ${editor.isActive({ textAlign: 'center' }) ? buttonActive : buttonInactive}`}
        title="居中对齐"
        data-testid="toolbar-btn-align-center"
      >
        <AlignCenter size={13} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={`${buttonBase} ${editor.isActive({ textAlign: 'right' }) ? buttonActive : buttonInactive}`}
        title="右对齐"
        data-testid="toolbar-btn-align-right"
      >
        <AlignRight size={13} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        className={`${buttonBase} ${editor.isActive({ textAlign: 'justify' }) ? buttonActive : buttonInactive}`}
        title="两端对齐"
        data-testid="toolbar-btn-align-justify"
      >
        <AlignJustify size={13} />
      </button>

      <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

      {/* Inline Formatting */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`${buttonBase} ${editor.isActive('bold') ? buttonActive : buttonInactive}`}
        title="加粗 (Ctrl+B)"
        data-testid="toolbar-btn-bold"
      >
        <Bold size={13} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`${buttonBase} ${editor.isActive('italic') ? buttonActive : buttonInactive}`}
        title="斜体 (Ctrl+I)"
        data-testid="toolbar-btn-italic"
      >
        <Italic size={13} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`${buttonBase} ${editor.isActive('underline') ? buttonActive : buttonInactive}`}
        title="下划线 (Ctrl+U)"
        data-testid="toolbar-btn-underline"
      >
        <UnderlineIcon size={13} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`${buttonBase} ${editor.isActive('strike') ? buttonActive : buttonInactive}`}
        title="删除线"
        data-testid="toolbar-btn-strike"
      >
        <Strikethrough size={13} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={`${buttonBase} ${editor.isActive('code') ? buttonActive : buttonInactive}`}
        title="行内代码"
        data-testid="toolbar-btn-code"
      >
        <CodeIcon size={13} />
      </button>

      {/* Color Palette Popover */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('color')}
          className={`${buttonBase} ${
            currentTextColor !== '#1e293b' || currentHighlight !== 'transparent'
              ? buttonActive
              : buttonInactive
          }`}
          title="文本颜色与荧光高亮笔"
          data-testid="toolbar-btn-color-palette"
        >
          <Palette size={13} />
        </button>

        {activeMenu === 'color' && (
          <div
            className={`${dropdownContainer} w-48 p-2.5 space-y-2.5`}
            onMouseDown={(e) => e.preventDefault()}
            data-testid="toolbar-color-palette-popover"
          >
            {/* 文字颜色 */}
            <div>
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider">
                文字颜色
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    onClick={() => {
                      if (c.isDefault) {
                        editor.chain().focus().unsetColor().run();
                      } else {
                        editor.chain().focus().setColor(c.value).run();
                      }
                      setActiveMenu(null);
                    }}
                    className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${
                      currentTextColor === c.value
                        ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900 scale-105'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>

            {/* 荧光高亮笔 */}
            <div>
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider">
                荧光高亮背景
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {HIGHLIGHT_COLORS.map((h) =>
                  h.isDefault ? (
                    <button
                      key={h.value}
                      type="button"
                      onClick={() => {
                        editor.chain().focus().unsetHighlight().run();
                        setActiveMenu(null);
                      }}
                      className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-[10px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      无背景
                    </button>
                  ) : (
                    <button
                      key={h.value}
                      type="button"
                      title={h.label}
                      onClick={() => {
                        editor.chain().focus().setHighlight({ color: h.value }).run();
                        setActiveMenu(null);
                      }}
                      className={`w-5 h-5 rounded border transition-transform hover:scale-110 ${
                        currentHighlight === h.value
                          ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-900 scale-105'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                      style={{ backgroundColor: h.value }}
                    />
                  ),
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clear Formatting */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          editor
            .chain()
            .focus()
            .unsetAllMarks()
            .unsetFontFamily()
            .unsetFontSize()
            .unsetColor()
            .unsetHighlight()
            .run();
          setActiveMenu(null);
        }}
        className={`${buttonBase} ${buttonInactive}`}
        title="清除格式"
        data-testid="toolbar-btn-clear-formatting"
      >
        <RemoveFormatting size={13} />
      </button>

      <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

      {/* Table 8x8 Insertion Selector Button */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('table')}
          className={`${buttonBase} ${activeMenu === 'table' ? buttonActive : buttonInactive}`}
          title="插入表格 (8x8 可视化选择器)"
          data-testid="toolbar-btn-insert-table"
        >
          <TableIcon size={13} />
          <span>表格</span>
          <ChevronDown size={11} className={`transition-transform ${activeMenu === 'table' ? 'rotate-180' : ''}`} />
        </button>

        <TiptapTableInsertMenu
          editor={editor}
          isOpen={activeMenu === 'table'}
          onClose={() => setActiveMenu(null)}
        />
      </div>

      {/* Media Upload Button */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*,video/*,.pdf,.zip,.doc,.docx,.xlsx"
        className="hidden"
        data-testid="toolbar-media-file-input"
      />

      <button
        type="button"
        disabled={uploadingEffective}
        onClick={handleOpenFileInput}
        className={`${buttonBase} ${uploadingEffective ? 'opacity-50 cursor-wait' : buttonInactive}`}
        title="上传图片或媒体文件"
        data-testid="toolbar-btn-upload-media"
      >
        {uploadingEffective ? (
          <Loader2 size={13} className="animate-spin text-blue-500" />
        ) : (
          <ImageIcon size={13} />
        )}
        <span>{uploadingEffective ? '上传中...' : '插入媒体'}</span>
      </button>

      <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-0.5" />

      {/* History (Undo / Redo) */}
      <button
        type="button"
        disabled={!editor.can().undo()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.commands.undo()}
        className={`${buttonBase} ${buttonInactive}`}
        title="撤销 (Ctrl+Z)"
        data-testid="toolbar-btn-undo"
      >
        <Undo2 size={13} />
        <span>撤销</span>
      </button>

      <button
        type="button"
        disabled={!editor.can().redo()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.commands.redo()}
        className={`${buttonBase} ${buttonInactive}`}
        title="重做 (Ctrl+Shift+Z)"
        data-testid="toolbar-btn-redo"
      >
        <Redo2 size={13} />
        <span>重做</span>
      </button>
    </div>
  );
};
