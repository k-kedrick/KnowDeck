import React, { useState, useEffect } from 'react';
import type { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import type { BubbleMenuProps } from '@tiptap/react/menus';
import {
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  Trash2,
  Table as TableIcon,
  Columns3,
  Rows3,
  Merge,
  Split,
} from 'lucide-react';

interface TiptapTableMenuProps {
  editor: Editor;
}

const TABLE_MENU_OPTIONS: BubbleMenuProps['options'] = {
  placement: 'top',
  offset: 8,
};

const shouldShowTableMenu: NonNullable<BubbleMenuProps['shouldShow']> = ({ editor, state }) => {
  if (!editor.isEditable) return false;
  if (editor.isActive('image')) return false;
  if (!editor.isActive('table')) return false;

  const { selection } = state;
  const isCellSelection = selection.constructor?.name?.includes('CellSelection');
  if (!selection.empty && !isCellSelection) return false;
  return true;
};

export const TiptapTableMenu: React.FC<TiptapTableMenuProps> = ({ editor }) => {
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

  const buttonBase =
    'flex items-center gap-1 p-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none disabled:opacity-30 disabled:pointer-events-none';
  const buttonInactive =
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
  const buttonActive =
    'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-semibold';

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableBubbleMenu"
      shouldShow={shouldShowTableMenu}
      options={TABLE_MENU_OPTIONS}
      className="flex flex-wrap items-center gap-0.5 rounded-xl border border-slate-200/90 bg-white/95 p-1 shadow-2xl backdrop-blur-md dark:border-slate-700/90 dark:bg-slate-900/95 max-w-[calc(100vw-2rem)]"
      data-testid="tiptap-table-menu"
    >
      {/* Table Badge */}
      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60">
        <TableIcon size={12} />
        <span>表格</span>
      </div>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* Row Operations */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().addRowBefore().run()}
        disabled={!editor.can().addRowBefore()}
        className={`${buttonBase} ${buttonInactive}`}
        title="在上方插入行"
        data-testid="table-btn-add-row-before"
      >
        <ArrowUpToLine size={13} />
        <span className="text-[10px]">+行</span>
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().addRowAfter().run()}
        disabled={!editor.can().addRowAfter()}
        className={`${buttonBase} ${buttonInactive}`}
        title="在下方插入行"
        data-testid="table-btn-add-row-after"
      >
        <ArrowDownToLine size={13} />
        <span className="text-[10px]">+行</span>
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().deleteRow().run()}
        disabled={!editor.can().deleteRow()}
        className={`${buttonBase} text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40`}
        title="删除当前行"
        data-testid="table-btn-delete-row"
      >
        <Rows3 size={13} />
        <span className="text-[10px]">-行</span>
      </button>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* Column Operations */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().addColumnBefore().run()}
        disabled={!editor.can().addColumnBefore()}
        className={`${buttonBase} ${buttonInactive}`}
        title="在左侧插入列"
        data-testid="table-btn-add-col-before"
      >
        <ArrowLeftToLine size={13} />
        <span className="text-[10px]">+列</span>
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        disabled={!editor.can().addColumnAfter()}
        className={`${buttonBase} ${buttonInactive}`}
        title="在右侧插入列"
        data-testid="table-btn-add-col-after"
      >
        <ArrowRightToLine size={13} />
        <span className="text-[10px]">+列</span>
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().deleteColumn().run()}
        disabled={!editor.can().deleteColumn()}
        className={`${buttonBase} text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40`}
        title="删除当前列"
        data-testid="table-btn-delete-col"
      >
        <Columns3 size={13} />
        <span className="text-[10px]">-列</span>
      </button>

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* Toggle Header Row */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
        disabled={!editor.can().toggleHeaderRow()}
        className={`${buttonBase} ${buttonInactive}`}
        title="切换首行表头"
        data-testid="table-btn-toggle-header-row"
      >
        <span className="text-[11px] font-semibold px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
          表头
        </span>
      </button>

      {/* Merge / Split */}
      {editor.can().mergeCells() && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().mergeCells().run()}
          className={`${buttonBase} ${buttonActive}`}
          title="合并选中单元格"
          data-testid="table-btn-merge-cells"
        >
          <Merge size={13} />
          <span className="text-[10px]">合并</span>
        </button>
      )}

      {editor.can().splitCell() && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().splitCell().run()}
          className={`${buttonBase} ${buttonActive}`}
          title="拆分单元格"
          data-testid="table-btn-split-cell"
        >
          <Split size={13} />
          <span className="text-[10px]">拆分</span>
        </button>
      )}

      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* Delete Table */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().deleteTable().run()}
        disabled={!editor.can().deleteTable()}
        className={`${buttonBase} text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:text-rose-400 dark:hover:bg-rose-950/50`}
        title="删除整张表格"
        data-testid="table-btn-delete-table"
      >
        <Trash2 size={13} />
        <span className="text-[10px]">删表</span>
      </button>
    </BubbleMenu>
  );
};
