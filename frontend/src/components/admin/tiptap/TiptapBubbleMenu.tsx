import React, { useState, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import type { BubbleMenuProps } from '@tiptap/react/menus';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code as CodeIcon,
  ChevronDown,
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
} from 'lucide-react';
import {
  FONT_FAMILIES,
  FONT_SIZES,
  TEXT_COLORS,
  HIGHLIGHT_COLORS,
  LINE_HEIGHTS,
} from './typographyConstants';

interface TiptapBubbleMenuProps {
  editor: Editor;
}

const TEXT_MENU_OPTIONS: BubbleMenuProps['options'] = {
  placement: 'top',
  offset: 8,
};

const shouldShowTextMenu: NonNullable<BubbleMenuProps['shouldShow']> = ({ editor, state, from, to }) => {
  if (!editor.isEditable) return false;
  const { selection } = state;
  if (!selection || selection.empty) return false;
  if (
    editor.isActive('image') ||
    editor.isActive('video') ||
    editor.isActive('iframe')
  ) {
    return false;
  }
  if (selection.constructor?.name?.includes('CellSelection')) {
    return false;
  }
  return from !== to;
};

export const TiptapBubbleMenu: React.FC<TiptapBubbleMenuProps> = ({ editor }) => {
  const [activeMenu, setActiveMenu] = useState<
    'block' | 'font' | 'size' | 'lineHeight' | 'align' | 'color' | null
  >(null);
  const [, setUpdateTick] = useState(0);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Sync state on editor transactions
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
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const toggleMenu = (menu: 'block' | 'font' | 'size' | 'lineHeight' | 'align' | 'color') => {
    setActiveMenu((prev) => (prev === menu ? null : menu));
  };

  // Block Type
  const getBlockTypeInfo = () => {
    if (editor.isActive('heading', { level: 1 })) return { label: 'H1', icon: Heading1 };
    if (editor.isActive('heading', { level: 2 })) return { label: 'H2', icon: Heading2 };
    if (editor.isActive('heading', { level: 3 })) return { label: 'H3', icon: Heading3 };
    return { label: '正文', icon: Pilcrow };
  };

  // Current Font Family
  const textStyleAttrs = editor.getAttributes('textStyle');
  const currentFontCss = textStyleAttrs.fontFamily || '';
  const currentFontOption = FONT_FAMILIES.find((f) => f.css === currentFontCss) || FONT_FAMILIES[0];

  // Current Font Size
  const currentFontSize = textStyleAttrs.fontSize || '15px';

  // Current Line Height
  const blockAttrs = editor.getAttributes('paragraph').lineHeight
    ? editor.getAttributes('paragraph')
    : editor.getAttributes('heading');
  const currentLineHeight = blockAttrs.lineHeight || '默认';

  // Current Highlight & Color
  const highlightAttrs = editor.getAttributes('highlight');
  const currentHighlight = highlightAttrs.color || 'transparent';
  const currentTextColor = textStyleAttrs.color || '#1e293b';

  const buttonBase =
    'flex items-center justify-center p-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none';
  const buttonInactive =
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
  const buttonActive =
    'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-semibold';

  const dropdownContainer =
    'absolute left-0 top-full mt-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900 z-50 animate-in fade-in zoom-in-95 duration-100';

  const currentBlock = getBlockTypeInfo();
  const CurrentBlockIcon = currentBlock.icon;

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={shouldShowTextMenu}
      options={TEXT_MENU_OPTIONS}
      className="flex flex-wrap items-center gap-0.5 rounded-xl border border-slate-200/90 bg-white/95 p-1 shadow-2xl backdrop-blur-md dark:border-slate-700/90 dark:bg-slate-900/95 max-w-[calc(100vw-2rem)]"
      data-testid="tiptap-bubble-menu"
      ref={menuContainerRef}
    >
      {/* 1. Block Type Dropdown */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('block')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
            editor.isActive('heading') ? buttonActive : buttonInactive
          }`}
          title="切换段落与标题"
          data-testid="bubble-block-selector"
        >
          <CurrentBlockIcon size={14} />
          <span>{currentBlock.label}</span>
          <ChevronDown size={12} className={`transition-transform ${activeMenu === 'block' ? 'rotate-180' : ''}`} />
        </button>

        {activeMenu === 'block' && (
          <div className={`${dropdownContainer} w-32`} onMouseDown={(e) => e.preventDefault()}>
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left ${
                editor.isActive('paragraph') ? buttonActive : buttonInactive
              }`}
              onClick={() => {
                editor.chain().focus().setParagraph().run();
                setActiveMenu(null);
              }}
            >
              <Pilcrow size={13} />
              <span>正文</span>
            </button>
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left ${
                editor.isActive('heading', { level: 1 }) ? buttonActive : buttonInactive
              }`}
              onClick={() => {
                editor.chain().focus().toggleHeading({ level: 1 }).run();
                setActiveMenu(null);
              }}
            >
              <Heading1 size={13} />
              <span>标题 1 (H1)</span>
            </button>
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left ${
                editor.isActive('heading', { level: 2 }) ? buttonActive : buttonInactive
              }`}
              onClick={() => {
                editor.chain().focus().toggleHeading({ level: 2 }).run();
                setActiveMenu(null);
              }}
            >
              <Heading2 size={13} />
              <span>标题 2 (H2)</span>
            </button>
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left ${
                editor.isActive('heading', { level: 3 }) ? buttonActive : buttonInactive
              }`}
              onClick={() => {
                editor.chain().focus().toggleHeading({ level: 3 }).run();
                setActiveMenu(null);
              }}
            >
              <Heading3 size={13} />
              <span>标题 3 (H3)</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Font Family Dropdown */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('font')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
            currentFontOption.value !== 'default' ? buttonActive : buttonInactive
          }`}
          title="选择正文字体 (Font Family)"
          data-testid="bubble-font-family-selector"
        >
          <span className="max-w-[70px] truncate">{currentFontOption.label}</span>
          <ChevronDown size={12} className={`transition-transform ${activeMenu === 'font' ? 'rotate-180' : ''}`} />
        </button>

        {activeMenu === 'font' && (
          <div className={`${dropdownContainer} w-44 max-h-60 overflow-y-auto`} onMouseDown={(e) => e.preventDefault()}>
            {FONT_FAMILIES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left ${
                  currentFontOption.value === item.value ? buttonActive : buttonInactive
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

      {/* 3. Font Size Dropdown */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('size')}
          className={`flex items-center gap-1 px-1.5 py-1 rounded-lg text-xs font-medium ${
            currentFontSize !== '15px' && currentFontSize !== 'default' ? buttonActive : buttonInactive
          }`}
          title="字号大小"
          data-testid="bubble-font-size-selector"
        >
          <span>{currentFontSize}</span>
          <ChevronDown size={12} className={`transition-transform ${activeMenu === 'size' ? 'rotate-180' : ''}`} />
        </button>

        {activeMenu === 'size' && (
          <div className={`${dropdownContainer} w-36 max-h-60 overflow-y-auto`} onMouseDown={(e) => e.preventDefault()}>
            {FONT_SIZES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left ${
                  currentFontSize === item.value ? buttonActive : buttonInactive
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

      {/* 4. Line Height Dropdown */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('lineHeight')}
          className={`flex items-center gap-1 px-1.5 py-1 rounded-lg text-xs font-medium ${
            currentLineHeight !== '默认' ? buttonActive : buttonInactive
          }`}
          title="段落行距"
          data-testid="bubble-line-height-selector"
        >
          <span>{currentLineHeight === '默认' ? '行距' : `${currentLineHeight}x`}</span>
          <ChevronDown size={12} className={`transition-transform ${activeMenu === 'lineHeight' ? 'rotate-180' : ''}`} />
        </button>

        {activeMenu === 'lineHeight' && (
          <div className={`${dropdownContainer} w-32 max-h-60 overflow-y-auto`} onMouseDown={(e) => e.preventDefault()}>
            {LINE_HEIGHTS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left ${
                  (item.value === 'default' && currentLineHeight === '默认') || currentLineHeight === item.value
                    ? buttonActive
                    : buttonInactive
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

      {/* 5. Alignment Dropdown */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('align')}
          className={`flex items-center gap-0.5 p-1.5 rounded-lg text-xs font-medium ${
            editor.isActive({ textAlign: 'center' }) ||
            editor.isActive({ textAlign: 'right' }) ||
            editor.isActive({ textAlign: 'justify' })
              ? buttonActive
              : buttonInactive
          }`}
          title="文本对齐"
          data-testid="bubble-align-selector"
        >
          {editor.isActive({ textAlign: 'center' }) ? (
            <AlignCenter size={14} />
          ) : editor.isActive({ textAlign: 'right' }) ? (
            <AlignRight size={14} />
          ) : editor.isActive({ textAlign: 'justify' }) ? (
            <AlignJustify size={14} />
          ) : (
            <AlignLeft size={14} />
          )}
          <ChevronDown size={10} />
        </button>

        {activeMenu === 'align' && (
          <div className={`${dropdownContainer} w-28`} onMouseDown={(e) => e.preventDefault()}>
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left ${
                editor.isActive({ textAlign: 'left' }) ? buttonActive : buttonInactive
              }`}
              onClick={() => {
                editor.chain().focus().setTextAlign('left').run();
                setActiveMenu(null);
              }}
            >
              <AlignLeft size={13} />
              <span>左对齐</span>
            </button>
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left ${
                editor.isActive({ textAlign: 'center' }) ? buttonActive : buttonInactive
              }`}
              onClick={() => {
                editor.chain().focus().setTextAlign('center').run();
                setActiveMenu(null);
              }}
            >
              <AlignCenter size={13} />
              <span>居中对齐</span>
            </button>
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left ${
                editor.isActive({ textAlign: 'right' }) ? buttonActive : buttonInactive
              }`}
              onClick={() => {
                editor.chain().focus().setTextAlign('right').run();
                setActiveMenu(null);
              }}
            >
              <AlignRight size={13} />
              <span>右对齐</span>
            </button>
            <button
              type="button"
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left ${
                editor.isActive({ textAlign: 'justify' }) ? buttonActive : buttonInactive
              }`}
              onClick={() => {
                editor.chain().focus().setTextAlign('justify').run();
                setActiveMenu(null);
              }}
            >
              <AlignJustify size={13} />
              <span>两端对齐</span>
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* 6. Inline Formatting */}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`${buttonBase} ${editor.isActive('bold') ? buttonActive : buttonInactive}`}
        title="加粗 (Ctrl+B)"
        data-testid="bubble-btn-bold"
      >
        <Bold size={14} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`${buttonBase} ${editor.isActive('italic') ? buttonActive : buttonInactive}`}
        title="斜体 (Ctrl+I)"
        data-testid="bubble-btn-italic"
      >
        <Italic size={14} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`${buttonBase} ${editor.isActive('underline') ? buttonActive : buttonInactive}`}
        title="下划线 (Ctrl+U)"
        data-testid="bubble-btn-underline"
      >
        <UnderlineIcon size={14} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`${buttonBase} ${editor.isActive('strike') ? buttonActive : buttonInactive}`}
        title="删除线"
        data-testid="bubble-btn-strike"
      >
        <Strikethrough size={14} />
      </button>

      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={`${buttonBase} ${editor.isActive('code') ? buttonActive : buttonInactive}`}
        title="行内代码"
        data-testid="bubble-btn-code"
      >
        <CodeIcon size={14} />
      </button>

      {/* Divider */}
      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

      {/* 7. Text Color & Highlight Palette */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => toggleMenu('color')}
          className={`flex items-center gap-1 p-1.5 rounded-lg text-xs font-medium ${
            currentTextColor !== '#1e293b' || currentHighlight !== 'transparent'
              ? buttonActive
              : buttonInactive
          }`}
          title="文本颜色与荧光高亮笔"
          data-testid="bubble-color-palette-btn"
        >
          <Palette size={14} />
          <ChevronDown size={10} />
        </button>

        {activeMenu === 'color' && (
          <div
            className={`${dropdownContainer} w-48 p-2.5 space-y-2.5`}
            onMouseDown={(e) => e.preventDefault()}
            data-testid="bubble-color-palette-popover"
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

      {/* 8. Clear Formatting */}
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
        data-testid="bubble-btn-clear-formatting"
      >
        <RemoveFormatting size={14} />
      </button>
    </BubbleMenu>
  );
};
