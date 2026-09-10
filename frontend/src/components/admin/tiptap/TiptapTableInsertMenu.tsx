import React, { useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Table as TableIcon } from 'lucide-react';

interface TiptapTableInsertMenuProps {
  editor: Editor;
  isOpen: boolean;
  onClose: () => void;
}

const MAX_ROWS = 8;
const MAX_COLS = 8;

export const TiptapTableInsertMenu: React.FC<TiptapTableInsertMenuProps> = ({
  editor,
  isOpen,
  onClose,
}) => {
  const [hoverRows, setHoverRows] = useState(0);
  const [hoverCols, setHoverCols] = useState(0);

  if (!isOpen) return null;

  const handleCellClick = (rows: number, cols: number) => {
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run();
    onClose();
  };

  return (
    <div
      className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-100"
      onMouseDown={(e) => e.preventDefault()}
      data-testid="tiptap-table-insert-menu"
    >
      <div className="flex items-center justify-between mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-1.5">
          <TableIcon size={14} className="text-blue-500" />
          <span>插入表格</span>
        </div>
        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded">
          {hoverRows > 0 ? `${hoverRows} 行 × ${hoverCols} 列` : '移动鼠标选择'}
        </span>
      </div>

      {/* 8x8 Grid */}
      <div
        className="grid grid-cols-8 gap-1 p-1.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800"
        onMouseLeave={() => {
          setHoverRows(0);
          setHoverCols(0);
        }}
      >
        {Array.from({ length: MAX_ROWS }).map((_, rowIndex) => {
          const rowNum = rowIndex + 1;
          return Array.from({ length: MAX_COLS }).map((__, colIndex) => {
            const colNum = colIndex + 1;
            const isHighlighted = rowNum <= hoverRows && colNum <= hoverCols;

            return (
              <button
                key={`${rowNum}-${colNum}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => {
                  setHoverRows(rowNum);
                  setHoverCols(colNum);
                }}
                onClick={() => handleCellClick(rowNum, colNum)}
                className={`h-6 w-6 rounded transition-all duration-75 ${
                  isHighlighted
                    ? 'scale-105 border border-blue-600 bg-blue-500'
                    : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-blue-400'
                }`}
                title={`${rowNum} 行 × ${colNum} 列`}
                data-testid={`grid-cell-${rowNum}-${colNum}`}
              />
            );
          });
        })}
      </div>
    </div>
  );
};
