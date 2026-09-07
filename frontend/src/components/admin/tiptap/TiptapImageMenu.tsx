import React, { useState, useEffect } from 'react';
import type { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import type { BubbleMenuProps } from '@tiptap/react/menus';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';

interface TiptapImageMenuProps {
  editor: Editor;
}

const WIDTH_PRESETS = [
  { label: '25%', value: '25%' },
  { label: '50%', value: '50%' },
  { label: '75%', value: '75%' },
  { label: '100%', value: '100%' },
  { label: '自适应', value: 'auto' },
];

const IMAGE_MENU_OPTIONS: BubbleMenuProps['options'] = {
  placement: 'top',
  offset: 8,
};

const shouldShowImageMenu: NonNullable<BubbleMenuProps['shouldShow']> = ({ editor }) => {
  if (!editor.isEditable) return false;
  return editor.isActive('image');
};

export const TiptapImageMenu: React.FC<TiptapImageMenuProps> = ({ editor }) => {
  const [, setUpdateTick] = useState(0);

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

  const currentAttrs = editor.getAttributes('image');
  const currentWidth = currentAttrs.width || 'auto';
  const currentAlign = currentAttrs.align || null;

  const buttonBase =
    'flex items-center justify-center p-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none';
  const buttonInactive =
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
  const buttonActive =
    'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-semibold';

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="imageBubbleMenu"
      shouldShow={shouldShowImageMenu}
      options={IMAGE_MENU_OPTIONS}
      className="flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white/95 p-1.5 shadow-2xl backdrop-blur-md dark:border-slate-700/90 dark:bg-slate-900/95"
      data-testid="tiptap-image-menu"
    >
      <div className="flex items-center gap-1 px-1 text-slate-400 dark:text-slate-500">
        <ImageIcon size={14} />
      </div>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* Width Presets */}
      <div className="flex items-center gap-0.5">
        {WIDTH_PRESETS.map((preset) => {
          const isActive =
            (preset.value === 'auto' && (!currentAttrs.width || currentAttrs.width === 'auto')) ||
            currentWidth === preset.value;

          return (
            <button
              key={preset.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const targetWidth = preset.value === 'auto' ? null : preset.value;
                editor.chain().focus().updateAttributes('image', { width: targetWidth }).run();
              }}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                isActive ? buttonActive : buttonInactive
              }`}
              title={`调整图片宽度为 ${preset.label}`}
              data-testid={`image-btn-width-${preset.value}`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* Alignment */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const nextAlign = currentAlign === 'left' ? null : 'left';
          editor.chain().focus().updateAttributes('image', { align: nextAlign }).run();
        }}
        className={`${buttonBase} ${currentAlign === 'left' ? buttonActive : buttonInactive}`}
        title="左对齐"
        data-testid="image-btn-align-left"
      >
        <AlignLeft size={14} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const nextAlign = currentAlign === 'center' ? null : 'center';
          editor.chain().focus().updateAttributes('image', { align: nextAlign }).run();
        }}
        className={`${buttonBase} ${currentAlign === 'center' ? buttonActive : buttonInactive}`}
        title="居中对齐"
        data-testid="image-btn-align-center"
      >
        <AlignCenter size={14} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const nextAlign = currentAlign === 'right' ? null : 'right';
          editor.chain().focus().updateAttributes('image', { align: nextAlign }).run();
        }}
        className={`${buttonBase} ${currentAlign === 'right' ? buttonActive : buttonInactive}`}
        title="右对齐"
        data-testid="image-btn-align-right"
      >
        <AlignRight size={14} />
      </button>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* Delete Image */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          editor.chain().focus().deleteSelection().run();
        }}
        className={`${buttonBase} text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:text-rose-400 dark:hover:bg-rose-950/50`}
        title="删除图片"
        data-testid="image-btn-delete"
      >
        <Trash2 size={14} />
      </button>
    </BubbleMenu>
  );
};
