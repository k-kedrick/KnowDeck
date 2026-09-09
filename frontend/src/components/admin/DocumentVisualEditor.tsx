import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  CheckSquare,
  Image as ImageIcon,
  Sparkles,
  AlertTriangle,
  Info,
  Type,
  FileCode,
  ChevronDown,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Plus,
  Trash2,
  Video,
} from 'lucide-react';
import { api } from '../../api';
import type { Media } from '../../api';
import {
  markdownToEditorHtml,
  mediaUrlToDocumentHtml,
  normalizePastedDocumentHtml,
  sanitizeDocumentHtml,
} from '../../utils/htmlToMarkdown';
import { FONT_FAMILIES, FONT_SIZES } from './tiptap/typographyConstants';

const BODY_FONT_SIZES = FONT_SIZES.filter(({ value }) => Number.parseInt(value, 10) <= 18);
const HEADING_FONT_SIZES: Record<string, string> = { H1: '32px', H2: '24px', H3: '20px', H4: '18px' };

interface DocumentVisualEditorProps {
  markdownContent: string;
  onChange: (newMarkdown: string) => void;
  onUploadFile: (file: File) => Promise<Media>;
  uploading?: boolean;
  documentId?: number;
  docTitle?: string;
}

export const DocumentVisualEditor: React.FC<DocumentVisualEditorProps> = ({
  markdownContent,
  onChange,
  onUploadFile,
  uploading = false,
  documentId,
  docTitle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const isEditingRef = useRef<boolean>(false);

  // Floating Selection Bubble State
  const [bubblePos, setBubblePos] = useState<{ top: number; left: number; placement: 'above' | 'below' } | null>(null);
  const [showColorMenu, setShowColorMenu] = useState<boolean>(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState<boolean>(false);
  const [showAlignMenu, setShowAlignMenu] = useState<boolean>(false);
  const [showPlusMenu, setShowPlusMenu] = useState<boolean>(false);
  const [topActiveMenu, setTopActiveMenu] = useState<'heading' | 'fontfamily' | 'fontsize' | 'lineheight' | null>(null);

  // Mutable DOM identity stays in a ref; only overlay geometry drives React rendering.
  const selectedImgRef = useRef<HTMLImageElement | null>(null);
  const imageDragCleanupRef = useRef<(() => void) | null>(null);
  const [imgOverlayBox, setImgOverlayBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // Video DOM identity is imperative; the overlay snapshot controls visible UI.
  const selectedVideoRef = useRef<HTMLVideoElement | null>(null);
  const [videoOverlayBox, setVideoOverlayBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // Last known caret range inside the canvas (ensures insertions occur where user cursor was, not jumping to the top)
  const lastCaretRangeRef = useRef<Range | null>(null);

  const saveCaretRange = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && canvasRef.current) {
      const range = sel.getRangeAt(0);
      if (canvasRef.current.contains(range.commonAncestorContainer)) {
        lastCaretRangeRef.current = range.cloneRange();
      }
    }
  }, []);

  // Current selected block type label & inline typography states
  const [currentBlockType, setCurrentBlockType] = useState<string>('正文');
  const [currentFontFamily, setCurrentFontFamily] = useState<string>('默认字体');
  const [showFontMenu, setShowFontMenu] = useState<boolean>(false);
  const [currentFontSize, setCurrentFontSize] = useState<string>('15px');
  const [showFontSizeMenu, setShowFontSizeMenu] = useState<boolean>(false);
  const [currentLineHeight, setCurrentLineHeight] = useState<string>('默认');
  const [showLineHeightMenu, setShowLineHeightMenu] = useState<boolean>(false);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    align: 'left' as 'left' | 'center' | 'right',
  });

  // Sync Markdown prop to innerHTML when not actively editing
  useEffect(() => {
    if (canvasRef.current && !isEditingRef.current) {
      const html = markdownToEditorHtml(markdownContent);
      if (canvasRef.current.innerHTML !== html) {
        canvasRef.current.innerHTML = html;
      }
    }
  }, [markdownContent]);

  // Recalculate Image Resizer Overlay position
  const updateImgOverlay = useCallback(() => {
    const selectedImg = selectedImgRef.current;
    if (!selectedImg || !containerRef.current || !canvasRef.current || !canvasRef.current.contains(selectedImg)) {
      setImgOverlayBox(null);
      return;
    }

    const rect = selectedImg.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    setImgOverlayBox({
      top: rect.top - containerRect.top,
      left: rect.left - containerRect.left,
      width: rect.width,
      height: rect.height,
    });
  }, []);

  const selectImage = useCallback((img: HTMLImageElement | null) => {
    selectedImgRef.current = img;
    updateImgOverlay();
  }, [updateImgOverlay]);

  useEffect(() => {
    updateImgOverlay();
    window.addEventListener('resize', updateImgOverlay);
    return () => {
      window.removeEventListener('resize', updateImgOverlay);
      imageDragCleanupRef.current?.();
      selectedImgRef.current = null;
    };
  }, [updateImgOverlay]);

  // Recalculate Video Resizer / Action Overlay position
  const updateVideoOverlay = useCallback((targetVid?: HTMLVideoElement | null) => {
    const vid = targetVid !== undefined ? targetVid : selectedVideoRef.current;
    if (!vid || !containerRef.current || !canvasRef.current || !canvasRef.current.contains(vid)) {
      setVideoOverlayBox(null);
      return;
    }

    const rect = vid.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    setVideoOverlayBox({
      top: rect.top - containerRect.top,
      left: rect.left - containerRect.left,
      width: rect.width,
      height: rect.height,
    });
  }, []);

  const selectVideo = useCallback((vid: HTMLVideoElement | null) => {
    selectedVideoRef.current = vid;
    updateVideoOverlay(vid);
  }, [updateVideoOverlay]);

  useEffect(() => {
    updateVideoOverlay();
    const handleResize = () => updateVideoOverlay();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      selectedVideoRef.current = null;
    };
  }, [updateVideoOverlay]);

  // Sync innerHTML to Markdown
  const handleContentChange = useCallback(() => {
    if (!canvasRef.current) return;
    isEditingRef.current = true;
    const currentHtml = canvasRef.current.innerHTML;
    onChange(sanitizeDocumentHtml(currentHtml));
    setTimeout(() => {
      isEditingRef.current = false;
    }, 100);
  }, [onChange]);

  // Delete Video Action
  const deleteSelectedVideo = useCallback(() => {
    const vid = selectedVideoRef.current;
    if (!vid) return;
    selectVideo(null);
    const next = vid.nextElementSibling;
    vid.remove();
    if (next && next.tagName === 'P' && (next.innerHTML === '<br>' || !next.textContent?.trim())) {
      next.remove();
    }
    handleContentChange();
    if (canvasRef.current) canvasRef.current.focus();
  }, [selectVideo, handleContentChange]);

  // Delete Image Action
  const deleteSelectedImage = useCallback(() => {
    const img = selectedImgRef.current;
    if (!img) return;
    selectImage(null);
    img.remove();
    handleContentChange();
    if (canvasRef.current) canvasRef.current.focus();
  }, [selectImage, handleContentChange]);

  // Global Delete / Backspace key handler for selected video or image
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedVideoRef.current) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          e.stopPropagation();
          deleteSelectedVideo();
        }
      } else if (selectedImgRef.current) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          e.stopPropagation();
          deleteSelectedImage();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [deleteSelectedVideo, deleteSelectedImage]);

  // Canvas Click Handler (Select image, select video, or clear selection)
  const handleCanvasClick = (e: React.MouseEvent) => {
    saveCaretRange();
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      selectImage(target as HTMLImageElement);
      selectVideo(null);
      setBubblePos(null);
    } else if (target.tagName === 'VIDEO' || target.closest('video')) {
      const vid = (target.tagName === 'VIDEO' ? target : target.closest('video')) as HTMLVideoElement;
      selectVideo(vid);
      selectImage(null);
      setBubblePos(null);
    } else {
      selectImage(null);
      selectVideo(null);
    }
  };

  // Auto-attach direct click listeners to all video elements inside canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    const videos = canvasRef.current.querySelectorAll('video');
    const cleanups = Array.from(videos, (v) => {
      const handleClick = (e: MouseEvent) => {
        e.stopPropagation();
        selectVideo(v);
        selectImage(null);
        setBubblePos(null);
      };
      v.onclick = handleClick;
      return () => {
        if (v.onclick === handleClick) v.onclick = null;
      };
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [markdownContent, selectVideo, selectImage]);

  // Handle Selection Change for Floating Text Context Toolbar & Top Toolbar Sync
  const updateSelectionBubble = useCallback(() => {
    if (selectedImgRef.current) {
      setBubblePos(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || !canvasRef.current || !containerRef.current || selection.rangeCount === 0) {
      setBubblePos(null);
      setShowColorMenu(false);
      setShowHeadingMenu(false);
      setShowFontMenu(false);
      setShowFontSizeMenu(false);
      setShowLineHeightMenu(false);
      setShowAlignMenu(false);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!canvasRef.current.contains(range.commonAncestorContainer)) {
      setBubblePos(null);
      return;
    }

    // Detect block type (H1, H2, H3, P)
    const anchor = selection.anchorNode;
    const anchorElement = anchor?.nodeType === Node.ELEMENT_NODE
      ? anchor as HTMLElement
      : anchor?.parentElement;
    const block = anchorElement?.closest('h1, h2, h3, h4, p, blockquote, div');
    if (block) {
      const tag = block.tagName.toUpperCase();
      if (tag === 'H1') setCurrentBlockType('H1');
      else if (tag === 'H2') setCurrentBlockType('H2');
      else if (tag === 'H3') setCurrentBlockType('H3');
      else if (tag === 'H4') setCurrentBlockType('H4');
      else setCurrentBlockType('正文');
    }

    const queryCommandState = (command: string) => {
      try {
        return typeof document.queryCommandState === 'function' && document.queryCommandState(command);
      } catch {
        return false;
      }
    };
    const blockAlignment = (block as HTMLElement | null)?.style.textAlign;
    setActiveFormats({
      bold: queryCommandState('bold'),
      italic: queryCommandState('italic'),
      underline: queryCommandState('underline'),
      strike: queryCommandState('strikeThrough'),
      align: blockAlignment === 'center' || queryCommandState('justifyCenter')
        ? 'center'
        : blockAlignment === 'right' || queryCommandState('justifyRight')
          ? 'right'
          : 'left',
    });

    // Detect inline font family on selection
    const fontSpanEl = anchorElement?.closest('span[style*="font-family"]') as HTMLElement | null;
    if (fontSpanEl && fontSpanEl.style.fontFamily) {
      const ff = fontSpanEl.style.fontFamily.toLowerCase();
      if (ff.includes('songti') || ff.includes('simsun') || ff.includes('stsong')) {
        setCurrentFontFamily('宋体 (典雅)');
      } else if (ff.includes('kaiti') || ff.includes('stkaiti') || ff.includes('biaukai')) {
        setCurrentFontFamily('楷体 (手书)');
      } else if (ff.includes('fangsong') || ff.includes('stfangsong')) {
        setCurrentFontFamily('仿宋 (公文)');
      } else if (ff.includes('monospace') || ff.includes('consolas') || ff.includes('sfmono') || ff.includes('menlo')) {
        setCurrentFontFamily('等宽代码');
      } else if (ff.includes('pingfang') || ff.includes('yahei') || ff.includes('source han sans')) {
        setCurrentFontFamily('黑体 (现代)');
      } else {
        setCurrentFontFamily('自定义');
      }
    } else {
      setCurrentFontFamily('默认字体');
    }

    // Detect inline font size on selection or enclosing block
    const spanEl = anchorElement?.closest('span[style*="font-size"]') as HTMLElement | null;
    if (spanEl && spanEl.style.fontSize) {
      setCurrentFontSize(spanEl.style.fontSize);
    } else if (block && (block as HTMLElement).style.fontSize) {
      setCurrentFontSize((block as HTMLElement).style.fontSize);
    } else {
      setCurrentFontSize('15px');
    }

    // Detect block line height on selection
    const lhBlock = anchorElement?.closest('p, h1, h2, h3, h4, h5, h6, blockquote, li, td, div:not(.callout)') as HTMLElement | null;
    if (lhBlock && lhBlock.style.lineHeight) {
      setCurrentLineHeight(lhBlock.style.lineHeight);
    } else {
      setCurrentLineHeight('默认');
    }

    // 🌟 Floating Bubble is only shown when there is an active text selection
    if (selection.isCollapsed) {
      setBubblePos(null);
      setShowColorMenu(false);
      setShowHeadingMenu(false);
      setShowFontMenu(false);
      setShowFontSizeMenu(false);
      setShowLineHeightMenu(false);
      setShowAlignMenu(false);
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      setBubblePos(null);
      return;
    }

    const toolbarWidth = 560;
    const toolbarHeight = 44;
    const viewportPadding = 16;
    const selectionGap = 12;
    const topAbove = rect.top - containerRect.top - toolbarHeight - selectionGap;
    const topBelow = rect.bottom - containerRect.top + selectionGap;
    const placement = topAbove >= viewportPadding ? 'above' : 'below';
    const top = placement === 'above' ? topAbove : topBelow;
    const maxLeft = Math.max(viewportPadding, containerRect.width - toolbarWidth - viewportPadding);
    const desiredLeft = rect.left - containerRect.left + rect.width / 2 - toolbarWidth / 2;
    const left = Math.min(maxLeft, Math.max(viewportPadding, desiredLeft));

    setBubblePos({ top, left, placement });
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      setTimeout(updateSelectionBubble, 30);
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [updateSelectionBubble]);

  // Exec formatting command on selection
  const execFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    handleContentChange();
    if (canvasRef.current) canvasRef.current.focus();
    updateSelectionBubble();
  };

  // Format Block Line Height (Only modifies Block containers, preserves inline formatting, text-align, headings)
  const applyLineHeight = (lineHeight: string) => {
    if (!canvasRef.current) return;
    const selection = window.getSelection();

    const targetBlocks: HTMLElement[] = [];

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);

      // Check if common ancestor is a block element inside canvas
      let ancestor = (range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer) as HTMLElement | null;

      const singleBlock = ancestor?.closest('p, h1, h2, h3, h4, h5, h6, blockquote, li, td, div:not(.callout)') as HTMLElement | null;

      if (singleBlock && canvasRef.current.contains(singleBlock)) {
        targetBlocks.push(singleBlock);
      } else {
        // Multi-block range: collect all intersecting blocks inside canvas
        const allBlocks = canvasRef.current.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, li, td, div:not(.callout)');
        allBlocks.forEach((blockNode) => {
          const el = blockNode as HTMLElement;
          if (selection.containsNode(el, true)) {
            targetBlocks.push(el);
          }
        });
      }
    }

    if (targetBlocks.length === 0 && canvasRef.current) {
      const activeEl = document.activeElement as HTMLElement | null;
      const block = activeEl?.closest('p, h1, h2, h3, h4, h5, h6, blockquote, li, td, div:not(.callout)') as HTMLElement | null;
      if (block && canvasRef.current.contains(block)) {
        targetBlocks.push(block);
      }
    }

    targetBlocks.forEach((block) => {
      if (lineHeight === 'default') {
        block.style.lineHeight = '';
        if (!block.getAttribute('style')?.trim()) {
          block.removeAttribute('style');
        }
      } else {
        block.style.lineHeight = lineHeight;
      }
    });

    setCurrentLineHeight(lineHeight === 'default' ? '默认' : lineHeight);
    setShowLineHeightMenu(false);
    handleContentChange();
    if (canvasRef.current) canvasRef.current.focus();
    updateSelectionBubble();
  };

  // Format Inline Font Family with anti-nesting and single-layer flattening
  const applyFontFamily = (fontValue: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setShowFontMenu(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    if (!selectedText.trim()) {
      setShowFontMenu(false);
      return;
    }

    const fontItem = FONT_FAMILIES.find((f) => f.value === fontValue || f.label === fontValue);
    const targetCss = fontItem ? fontItem.css : '';

    // 1. Check if common ancestor is already a SPAN with font-family
    let parentSpan = (range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : range.commonAncestorContainer) as HTMLElement | null;
    parentSpan = parentSpan?.closest('span') || null;

    if (
      parentSpan &&
      canvasRef.current?.contains(parentSpan) &&
      parentSpan.textContent?.trim() === selectedText.trim()
    ) {
      // Direct exact match: update or clear font-family on this span directly
      if (!targetCss || fontValue === 'default') {
        parentSpan.style.fontFamily = '';
        if (!parentSpan.getAttribute('style')?.trim()) {
          const parent = parentSpan.parentNode;
          while (parentSpan.firstChild) {
            parent?.insertBefore(parentSpan.firstChild, parentSpan);
          }
          parentSpan.remove();
        }
      } else {
        parentSpan.style.fontFamily = targetCss;
      }
    } else {
      // 2. Wrap range contents, flattening child font-family to avoid nesting leaks
      const fragment = range.extractContents();
      const childSpans = fragment.querySelectorAll('span, font');
      childSpans.forEach((child) => {
        const childEl = child as HTMLElement;
        childEl.style.fontFamily = '';
        if (!childEl.getAttribute('style')?.trim()) {
          const parent = childEl.parentNode;
          while (childEl.firstChild) {
            parent?.insertBefore(childEl.firstChild, childEl);
          }
          childEl.remove();
        }
      });

      if (!targetCss || fontValue === 'default') {
        range.insertNode(fragment);
      } else {
        const newSpan = document.createElement('span');
        newSpan.style.fontFamily = targetCss;
        newSpan.appendChild(fragment);
        range.insertNode(newSpan);

        // Reselect contents
        const newRange = document.createRange();
        newRange.selectNodeContents(newSpan);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    }

    setCurrentFontFamily(fontItem ? fontItem.label : '默认字体');
    setShowFontMenu(false);
    handleContentChange();
    if (canvasRef.current) canvasRef.current.focus();
    updateSelectionBubble();
  };

  // Format Inline / Block Font Size with anti-nesting and preservation of enclosing block structure
  const applyFontSize = (fontSize: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setShowFontSizeMenu(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const anchorElement = selection.anchorNode?.nodeType === Node.TEXT_NODE
      ? selection.anchorNode.parentElement
      : selection.anchorNode as HTMLElement | null;
    const heading = anchorElement?.closest('h1, h2, h3, h4');
    if (heading && canvasRef.current?.contains(heading)) {
      setShowFontSizeMenu(false);
      return;
    }

    // 🌟 支持光标未划选文字时，直接修改当前光标所在行的字号
    if (selection.isCollapsed) {
      const anchor = selection.anchorNode;
      let block = (anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor) as HTMLElement | null;
      block = block?.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote, div') || null;
      if (block && canvasRef.current?.contains(block)) {
        block.style.fontSize = fontSize === 'default' ? '' : fontSize;
        setCurrentFontSize(fontSize === 'default' ? '15px' : fontSize);
        setShowFontSizeMenu(false);
        handleContentChange();
        if (canvasRef.current) canvasRef.current.focus();
        return;
      }
    }

    const selectedText = range.toString();
    if (!selectedText.trim()) {
      setShowFontSizeMenu(false);
      return;
    }

    // 1. Check if common ancestor is already a SPAN with font-size
    let parentSpan = (range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : range.commonAncestorContainer) as HTMLElement | null;
    parentSpan = parentSpan?.closest('span') || null;

    if (
      parentSpan &&
      canvasRef.current?.contains(parentSpan) &&
      parentSpan.textContent?.trim() === selectedText.trim()
    ) {
      // Direct exact match: update or clear font-size on this span directly
      if (fontSize === '15px' || fontSize === 'default') {
        parentSpan.style.fontSize = '';
        if (!parentSpan.getAttribute('style')?.trim()) {
          const parent = parentSpan.parentNode;
          while (parentSpan.firstChild) {
            parent?.insertBefore(parentSpan.firstChild, parentSpan);
          }
          parentSpan.remove();
        }
      } else {
        parentSpan.style.fontSize = fontSize;
      }
    } else {
      // 2. Wrap range contents, flattening any child font-sizes to avoid nesting leaks
      const fragment = range.extractContents();
      const childSpans = fragment.querySelectorAll('span, font');
      childSpans.forEach((child) => {
        const childEl = child as HTMLElement;
        childEl.style.fontSize = '';
        if (!childEl.getAttribute('style')?.trim()) {
          const parent = childEl.parentNode;
          while (childEl.firstChild) {
            parent?.insertBefore(childEl.firstChild, childEl);
          }
          childEl.remove();
        }
      });

      if (fontSize === '15px' || fontSize === 'default') {
        range.insertNode(fragment);
      } else {
        const newSpan = document.createElement('span');
        newSpan.style.fontSize = fontSize;
        newSpan.appendChild(fragment);
        range.insertNode(newSpan);

        // Reselect contents
        const newRange = document.createRange();
        newRange.selectNodeContents(newSpan);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    }

    setCurrentFontSize(fontSize === 'default' ? '15px' : fontSize);
    setShowFontSizeMenu(false);
    handleContentChange();
    if (canvasRef.current) canvasRef.current.focus();
    updateSelectionBubble();
  };

  // Format Heading Block with instant DOM class assignment
  const applyHeadingBlock = (tag: 'H1' | 'H2' | 'H3' | 'H4' | 'P') => {
    try {
      document.execCommand('formatBlock', false, `<${tag.toLowerCase()}>`);
    } catch {
      document.execCommand('formatBlock', false, tag);
    }

    // Block type owns its typography; remove stale manual sizing left by earlier formatting.
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const anchorNode = selection.anchorNode;
      const anchorElement = anchorNode?.nodeType === Node.ELEMENT_NODE
        ? anchorNode as HTMLElement
        : anchorNode?.parentElement;
      const blockEl = anchorElement?.closest('p, div, h1, h2, h3, h4') as HTMLElement | null;
      if (blockEl) {
        [blockEl, ...blockEl.querySelectorAll<HTMLElement>('[style]')].forEach((el) => {
          el.style.removeProperty('font-size');
          el.style.removeProperty('line-height');
          if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
        });
      }
    }

    handleContentChange();
    if (canvasRef.current) canvasRef.current.focus();
    updateSelectionBubble();
  };

  // Format Text Color
  const applyTextColor = (color: string) => {
    document.execCommand('foreColor', false, color);
    setShowColorMenu(false);
    handleContentChange();
  };

  // Format Background Highlight Color
  const applyHighlightColor = (bgColor: string) => {
    document.execCommand('hiliteColor', false, bgColor);
    setShowColorMenu(false);
    handleContentChange();
  };

  // Image Resizer Actions
  const setImageWidthPreset = (widthPercent: string) => {
    const selectedImg = selectedImgRef.current;
    if (!selectedImg) return;
    if (widthPercent === 'auto') {
      selectedImg.style.width = 'auto';
    } else {
      selectedImg.style.width = widthPercent;
    }
    selectedImg.style.height = 'auto';
    updateImgOverlay();
    handleContentChange();
  };

  const setImageAlign = (align: 'left' | 'center' | 'right') => {
    const selectedImg = selectedImgRef.current;
    if (!selectedImg) return;
    selectedImg.style.display = 'block';
    if (align === 'center') {
      selectedImg.style.marginLeft = 'auto';
      selectedImg.style.marginRight = 'auto';
      selectedImg.style.float = 'none';
    } else if (align === 'left') {
      selectedImg.style.marginLeft = '0';
      selectedImg.style.marginRight = 'auto';
      selectedImg.style.float = 'none';
    } else if (align === 'right') {
      selectedImg.style.marginLeft = 'auto';
      selectedImg.style.marginRight = '0';
      selectedImg.style.float = 'none';
    }
    updateImgOverlay();
    handleContentChange();
  };

  // Image Corner Mouse Drag Resizing
  const handleDragResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const selectedImg = selectedImgRef.current;
    if (!selectedImg) return;

    imageDragCleanupRef.current?.();

    const startX = e.clientX;
    const startWidth = selectedImg.offsetWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(100, startWidth + deltaX);
      selectedImg.style.width = `${newWidth}px`;
      selectedImg.style.height = 'auto';
      updateImgOverlay();
    };

    const handleMouseUp = () => {
      imageDragCleanupRef.current?.();
      handleContentChange();
    };

    imageDragCleanupRef.current = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      imageDragCleanupRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Video Resizer / Alignment Actions
  const setVideoWidthPreset = (widthPercent: string) => {
    const selectedVideo = selectedVideoRef.current;
    if (!selectedVideo) return;
    selectedVideo.style.width = widthPercent;
    selectedVideo.style.maxWidth = '100%';
    updateVideoOverlay();
    handleContentChange();
  };

  const setVideoAlign = (align: 'left' | 'center' | 'right') => {
    const selectedVideo = selectedVideoRef.current;
    if (!selectedVideo) return;
    selectedVideo.style.display = 'block';
    if (align === 'center') {
      selectedVideo.style.marginLeft = 'auto';
      selectedVideo.style.marginRight = 'auto';
    } else if (align === 'left') {
      selectedVideo.style.marginLeft = '0';
      selectedVideo.style.marginRight = 'auto';
    } else if (align === 'right') {
      selectedVideo.style.marginLeft = 'auto';
      selectedVideo.style.marginRight = '0';
    }
    updateVideoOverlay();
    handleContentChange();
  };

  // Insert visual HTML block with caret restoration (guarantees inserting at user cursor, NEVER jumping to top)
  const insertBlockHtml = (htmlSnippet: string, targetRange?: Range | null) => {
    if (!canvasRef.current) return;

    // Use explicit targetRange, or the last tracked caret position before blur
    let rangeToUse = targetRange || lastCaretRangeRef.current;

    // Check if range is still valid inside canvas
    if (rangeToUse && !canvasRef.current.contains(rangeToUse.commonAncestorContainer)) {
      rangeToUse = null;
    }

    const selection = window.getSelection();

    // If no valid range exists, append at the end of the document, NEVER jumping to top!
    if (!rangeToUse) {
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      canvasRef.current.appendChild(p);
      rangeToUse = document.createRange();
      rangeToUse.selectNodeContents(p);
      rangeToUse.collapse(false);
    }

    if (selection && rangeToUse) {
      selection.removeAllRanges();
      selection.addRange(rangeToUse);

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlSnippet;
      const frag = document.createDocumentFragment();
      let node: Node | null;
      let lastNode: Node | null = null;
      while ((node = tempDiv.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      rangeToUse.deleteContents();
      rangeToUse.insertNode(frag);
      if (lastNode) {
        rangeToUse.setStartAfter(lastNode);
        rangeToUse.collapse(true);
        selection.removeAllRanges();
        selection.addRange(rangeToUse);
        lastCaretRangeRef.current = rangeToUse.cloneRange();
      }
    } else {
      canvasRef.current.innerHTML += htmlSnippet;
    }

    handleContentChange();
    setShowPlusMenu(false);
  };

  const escapeHtmlAttr = (value: string) => (
    value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  );

  const escapeHtmlText = (value: string) => (
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  );

  const buildMediaHtml = (media: Media): string => {
    const url = escapeHtmlAttr(media.url);
    const name = escapeHtmlAttr(media.original_name || '媒体文件');
    const label = escapeHtmlText(media.original_name || '媒体文件');

    if (media.media_type === 'image') {
      return `<img src="${url}" alt="${name}" referrerpolicy="no-referrer" class="max-w-full rounded-xl my-4 shadow-sm" /><p><br></p>`;
    }
    if (media.media_type === 'video') {
      return `<video src="${url}" controls class="w-full rounded-xl my-4 shadow-sm border border-slate-200/60 dark:border-slate-800" style="width: 100%; max-width: 100%;"></video><p><br></p>`;
    }
    return `<p><a href="${url}" target="_blank" rel="noopener noreferrer">📎 ${label}</a></p><p><br></p>`;
  };

  const uploadAndInsertMedia = async (file: File, targetRange?: Range | null) => {
    const media = await onUploadFile(file);
    insertBlockHtml(buildMediaHtml(media), targetRange);
  };

  // Insert Callout Block
  const insertCallout = (type: 'note' | 'tip' | 'warning') => {
    let title = '提示 NOTE';
    let bgClass = 'bg-blue-50/70 border-blue-500 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-500';
    if (type === 'tip') {
      title = '技巧 TIP';
      bgClass = 'bg-emerald-50/70 border-emerald-500 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-500';
    } else if (type === 'warning') {
      title = '警告 WARNING';
      bgClass = 'bg-amber-50/70 border-amber-500 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500';
    }

    const html = `<div class="callout callout-${type} p-4 my-4 rounded-xl border-l-4 ${bgClass} font-sans leading-relaxed text-sm"><strong>[${title}]</strong> 在此输入提示说明内容...</div><p><br></p>`;
    insertBlockHtml(html);
  };

  // Insert Code Block
  const insertCodeBlock = () => {
    const html = `<pre class="p-4 my-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs leading-relaxed overflow-x-auto"><code>// 在此输入代码...</code></pre><p><br></p>`;
    insertBlockHtml(html);
  };

  // Handle Clipboard Paste Event (Support direct media files and rich HTML copied from Feishu)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const clipboard = e.clipboardData;
    if (!clipboard) return;

    const selection = window.getSelection();
    const targetRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    const file = Array.from(clipboard.files || []).find((candidate) => (
      candidate.type.startsWith('image/') || candidate.type.startsWith('video/')
    ));

    if (file) {
      e.preventDefault();
      try {
        await uploadAndInsertMedia(file, targetRange);
      } catch {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64Url = event.target?.result as string;
            if (base64Url) {
              insertBlockHtml(`<img src="${base64Url}" class="max-w-full rounded-xl my-4 shadow-sm" /><p><br></p>`, targetRange);
            }
          };
          reader.readAsDataURL(file);
        }
      }
      return;
    }

    const items = clipboard.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
          e.preventDefault();
          const itemFile = item.getAsFile();
          if (itemFile) {
            try {
              await uploadAndInsertMedia(itemFile, targetRange);
            } catch {
              if (item.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  const base64Url = event.target?.result as string;
                  if (base64Url) {
                    insertBlockHtml(`<img src="${base64Url}" class="max-w-full rounded-xl my-4 shadow-sm" /><p><br></p>`, targetRange);
                  }
                };
                reader.readAsDataURL(itemFile);
              }
            }
          }
          return;
        }
      }
    }

    const pastedHtml = clipboard.getData('text/html');
    if (pastedHtml && /<(?:img|video|source|table|p|div|h[1-6]|span|br)\b|background(?:-image)?\s*:/i.test(pastedHtml)) {
      const normalizedHtml = normalizePastedDocumentHtml(pastedHtml);
      if (normalizedHtml) {
        e.preventDefault();
        insertBlockHtml(normalizedHtml, targetRange);

        // 🌟 自动异步转存粘贴内容中的外链/临时图片到资源库专属文件夹
        if (/<img\b[^>]*?\bsrc=["'](?:https?:\/\/|data:image\/)/i.test(normalizedHtml)) {
          api.localizeDocumentImages(normalizedHtml, documentId || 0, docTitle || '')
            .then((res: { content: string; localized_count: number }) => {
              if (res && res.content && canvasRef.current && res.localized_count > 0) {
                const currentHtml = canvasRef.current.innerHTML;
                let updated = currentHtml;
                const imgRegex = /(?:<img\b[^>]*?\bsrc=["']([^"']+)["'])/gi;
                const origMatches: string[] = Array.from(normalizedHtml.matchAll(imgRegex), (m: RegExpMatchArray) => m[1]);
                const newMatches: string[] = Array.from(res.content.matchAll(imgRegex), (m: RegExpMatchArray) => m[1]);
                for (let k = 0; k < origMatches.length; k++) {
                  if (origMatches[k] && newMatches[k] && origMatches[k] !== newMatches[k]) {
                    updated = updated.split(origMatches[k]).join(newMatches[k]);
                  }
                }
                if (updated !== currentHtml) {
                  canvasRef.current.innerHTML = updated;
                  handleContentChange();
                }
              }
            })
            .catch((err: any) => console.warn('自动转存粘贴图片失败:', err));
        }
        return;
      }
    }

    const text = clipboard.getData('text/plain')?.trim();
    if (text) {
      const mediaHtml = mediaUrlToDocumentHtml(text);
      if (mediaHtml) {
        e.preventDefault();
        insertBlockHtml(mediaHtml, targetRange);
      }
    }
  };

  // Handle Drag & Drop Upload
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      try {
        await uploadAndInsertMedia(file);
      } catch {
        // Upload errors are surfaced by the parent editor.
      }
    }
  };

  const headingFontSize = HEADING_FONT_SIZES[currentBlockType];
  const formatButtonClass = (active: boolean) => `rounded-lg p-1 transition ${
    active
      ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:ring-blue-700'
      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

  return (
    <div ref={containerRef} className="relative flex flex-col space-y-3 w-full">
      {/* 划词浮动工具条 */}
      {bubblePos && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          style={{ top: `${bubblePos.top}px`, left: `${bubblePos.left}px` }}
          className="absolute z-50 flex max-w-[calc(100vw-2rem)] items-center gap-1 rounded-xl border border-slate-200/90 bg-white/95 p-1.5 text-xs text-slate-700 shadow-xl shadow-slate-900/10 backdrop-blur-lg transition-all dark:border-slate-700/80 dark:bg-slate-900/95 dark:text-slate-200"
        >
          {/* Heading Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowHeadingMenu(!showHeadingMenu)}
              className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center space-x-1 font-semibold text-slate-700 dark:text-slate-200 text-[11px]"
            >
              <span>{currentBlockType}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showHeadingMenu && (
              <div className={`absolute left-0 ${(bubblePos.placement === 'above' && bubblePos.top >= 220) ? 'bottom-full mb-2' : 'top-full mt-2'} z-[60] w-44 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-1.5 text-xs shadow-2xl shadow-slate-900/30`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyHeadingBlock('H1');
                    setCurrentBlockType('H1');
                    setShowHeadingMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-extrabold text-slate-900 transition dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Heading1 className="w-3.5 h-3.5 text-purple-400" />
                  <span className="flex-1">一级标题</span>
                  <span className="text-[10px] font-semibold text-slate-400">H1 · 32px</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyHeadingBlock('H2');
                    setCurrentBlockType('H2');
                    setShowHeadingMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-bold text-slate-900 transition dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Heading2 className="w-3.5 h-3.5 text-blue-400" />
                  <span className="flex-1">二级标题</span>
                  <span className="text-[10px] font-semibold text-slate-400">H2 · 24px</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyHeadingBlock('H3');
                    setCurrentBlockType('H3');
                    setShowHeadingMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-semibold text-slate-900 transition dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Heading3 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="flex-1">三级标题</span>
                  <span className="text-[10px] font-semibold text-slate-400">H3 · 20px</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyHeadingBlock('H4');
                    setCurrentBlockType('H4');
                    setShowHeadingMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Heading4 className="h-3.5 w-3.5 text-cyan-500" />
                  <span className="flex-1">四级标题</span>
                  <span className="text-[10px] font-semibold text-slate-400">H4 · 18px</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyHeadingBlock('P');
                    setCurrentBlockType('正文');
                    setShowHeadingMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Type className="w-3.5 h-3.5 text-slate-400" />
                  <span className="flex-1">正文文本</span>
                  <span className="text-[10px] font-semibold text-slate-400">P · 16px</span>
                </button>
              </div>
            )}
          </div>

          {/* 🌟 字体选择下拉菜单 (Font Family Dropdown) */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowFontMenu(!showFontMenu);
                setShowHeadingMenu(false);
                setShowFontSizeMenu(false);
                setShowLineHeightMenu(false);
                setShowAlignMenu(false);
                setShowColorMenu(false);
              }}
              className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center space-x-1 font-semibold text-slate-700 dark:text-slate-200 text-[11px] transition"
              title="选择正文字体 (Font Family)"
            >
              <span className="max-w-[75px] truncate">{currentFontFamily}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showFontMenu && (
              <div className={`absolute left-0 ${(bubblePos.placement === 'above' && bubblePos.top >= 220) ? 'bottom-full mb-2' : 'top-full mt-2'} z-[60] max-h-64 w-44 overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-1 text-xs shadow-2xl shadow-slate-900/30`}>
                {FONT_FAMILIES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyFontFamily(item.value)}
                    className={`w-full px-2.5 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center justify-between transition ${
                      currentFontFamily === item.label ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 dark:text-slate-300'
                    }`}
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
              onClick={() => {
                if (headingFontSize) return;
                setShowFontSizeMenu(!showFontSizeMenu);
                setShowFontMenu(false);
                setShowHeadingMenu(false);
                setShowLineHeightMenu(false);
                setShowAlignMenu(false);
                setShowColorMenu(false);
              }}
              disabled={Boolean(headingFontSize)}
              className="flex items-center space-x-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800"
              title={headingFontSize ? '标题字号由标题级别统一控制' : '调整正文字号'}
            >
              <span>{headingFontSize ?? currentFontSize}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showFontSizeMenu && !headingFontSize && (
              <div className={`absolute left-0 ${(bubblePos.placement === 'above' && bubblePos.top >= 220) ? 'bottom-full mb-2' : 'top-full mt-2'} z-[60] max-h-60 w-36 overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-1 text-xs shadow-2xl shadow-slate-900/30`}>
                {BODY_FONT_SIZES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => applyFontSize(item.value)}
                    className={`w-full px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center justify-between transition ${
                      currentFontSize === item.value ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 dark:text-slate-300'
                    }`}
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
              onClick={() => {
                setShowLineHeightMenu(!showLineHeightMenu);
                setShowFontMenu(false);
                setShowFontSizeMenu(false);
                setShowHeadingMenu(false);
                setShowAlignMenu(false);
                setShowColorMenu(false);
              }}
              className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center space-x-1 font-semibold text-slate-700 dark:text-slate-200 text-[11px]"
              title="段落行距"
            >
              <span>{currentLineHeight === '默认' ? '行距' : `${currentLineHeight}x`}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showLineHeightMenu && (
              <div className={`absolute left-0 ${(bubblePos.placement === 'above' && bubblePos.top >= 220) ? 'bottom-full mb-2' : 'top-full mt-2'} z-[60] max-h-60 w-32 overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-1 text-xs shadow-2xl shadow-slate-900/30`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyLineHeight('default')}
                  className={`w-full px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center justify-between transition ${
                    currentLineHeight === '默认' ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>默认 (1.75)</span>
                </button>
                {[
                  '1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9',
                  '2.0', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '2.9', '3.0'
                ].map((lh) => (
                  <button
                    key={lh}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyLineHeight(lh)}
                    className={`w-full px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center justify-between transition ${
                      currentLineHeight === lh ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{lh} 倍行距</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Alignment & List Menu */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowAlignMenu(!showAlignMenu);
                setShowFontMenu(false);
                setShowFontSizeMenu(false);
                setShowHeadingMenu(false);
                setShowLineHeightMenu(false);
                setShowColorMenu(false);
              }}
              className={formatButtonClass(activeFormats.align !== 'left')}
              title="对齐与列表"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            {showAlignMenu && (
              <div className={`absolute left-0 ${(bubblePos.placement === 'above' && bubblePos.top >= 220) ? 'bottom-full mb-2' : 'top-full mt-2'} z-[60] w-32 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-1 text-xs shadow-2xl shadow-slate-900/30`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    execFormat('justifyLeft');
                    setShowAlignMenu(false);
                  }}
                  className={`flex w-full items-center space-x-2 rounded px-2 py-1 text-left transition ${activeFormats.align === 'left' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span>左对齐</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    execFormat('justifyCenter');
                    setShowAlignMenu(false);
                  }}
                  className={`flex w-full items-center space-x-2 rounded px-2 py-1 text-left transition ${activeFormats.align === 'center' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                  <span>居中对齐</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    execFormat('justifyRight');
                    setShowAlignMenu(false);
                  }}
                  className={`flex w-full items-center space-x-2 rounded px-2 py-1 text-left transition ${activeFormats.align === 'right' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
                >
                  <AlignRight className="w-3.5 h-3.5" />
                  <span>右对齐</span>
                </button>
                <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    execFormat('insertUnorderedList');
                    setShowAlignMenu(false);
                  }}
                  className="w-full px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-200 flex items-center space-x-2"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>无序列表</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    execFormat('insertOrderedList');
                    setShowAlignMenu(false);
                  }}
                  className="w-full px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-700 dark:text-slate-200 flex items-center space-x-2"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>有序列表</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* Text Style Quick Action Icons */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('bold')}
            className={`${formatButtonClass(activeFormats.bold)} font-bold`}
            title="加粗 (Bold)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('italic')}
            className={`${formatButtonClass(activeFormats.italic)} italic`}
            title="斜体 (Italic)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('underline')}
            className={`${formatButtonClass(activeFormats.underline)} underline`}
            title="下划线 (Underline)"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('strikeThrough')}
            className={formatButtonClass(activeFormats.strike)}
            title="删除线 (Strikethrough)"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

          {/* 🌟 Text Color & Background Highlight Picker Dropdown */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowColorMenu(!showColorMenu);
                setShowFontMenu(false);
                setShowFontSizeMenu(false);
                setShowHeadingMenu(false);
                setShowLineHeightMenu(false);
                setShowAlignMenu(false);
              }}
              className="px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center space-x-1 text-emerald-400 font-bold"
              title="文本颜色与荧光高亮笔 (Color & Highlight)"
            >
              <Palette className="w-3.5 h-3.5" />
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showColorMenu && (
              <div className={`absolute left-0 ${(bubblePos.placement === 'above' && bubblePos.top >= 220) ? 'bottom-full mb-2' : 'top-full mt-2'} z-[60] w-48 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-3 text-xs shadow-2xl shadow-slate-900/30`}>
                {/* 文字前景色 */}
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 mb-1.5 uppercase">文字颜色</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => applyTextColor('#1e293b')}
                      className="w-5 h-5 rounded-full bg-slate-900 border border-slate-600 hover:scale-110 transition"
                      title="默认黑/灰"
                    />
                    <button
                      type="button"
                      onClick={() => applyTextColor('#ef4444')}
                      className="w-5 h-5 rounded-full bg-red-500 hover:scale-110 transition"
                      title="红色"
                    />
                    <button
                      type="button"
                      onClick={() => applyTextColor('#10b981')}
                      className="w-5 h-5 rounded-full bg-emerald-500 hover:scale-110 transition"
                      title="绿色"
                    />
                    <button
                      type="button"
                      onClick={() => applyTextColor('#3b82f6')}
                      className="w-5 h-5 rounded-full bg-blue-500 hover:scale-110 transition"
                      title="蓝色"
                    />
                    <button
                      type="button"
                      onClick={() => applyTextColor('#8b5cf6')}
                      className="w-5 h-5 rounded-full bg-purple-500 hover:scale-110 transition"
                      title="紫色"
                    />
                    <button
                      type="button"
                      onClick={() => applyTextColor('#f59e0b')}
                      className="w-5 h-5 rounded-full bg-amber-500 hover:scale-110 transition"
                      title="橙黄"
                    />
                  </div>
                </div>

                {/* 背景高亮笔 */}
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 mb-1.5 uppercase">荧光高亮背景笔</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => applyHighlightColor('transparent')}
                      className="px-1.5 py-0.5 rounded border border-slate-600 text-[10px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      无背景
                    </button>
                    <button
                      type="button"
                      onClick={() => applyHighlightColor('#fef08a')}
                      className="w-5 h-5 rounded bg-yellow-200 hover:scale-110 transition border border-yellow-300"
                      title="黄色高亮"
                    />
                    <button
                      type="button"
                      onClick={() => applyHighlightColor('#dcfce7')}
                      className="w-5 h-5 rounded bg-emerald-100 hover:scale-110 transition border border-emerald-300"
                      title="绿色高亮"
                    />
                    <button
                      type="button"
                      onClick={() => applyHighlightColor('#dbeafe')}
                      className="w-5 h-5 rounded bg-blue-100 hover:scale-110 transition border border-blue-300"
                      title="蓝色高亮"
                    />
                    <button
                      type="button"
                      onClick={() => applyHighlightColor('#fce7f3')}
                      className="w-5 h-5 rounded bg-pink-100 hover:scale-110 transition border border-pink-300"
                      title="粉红高亮"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* 🌟 图片悬浮尺寸调节控制条 (Visual Floating Image Resizer Action Bar) */}
      {imgOverlayBox && (
        <div
          style={{
            top: `${Math.max(10, imgOverlayBox.top - 48)}px`,
            left: `${Math.max(20, imgOverlayBox.left + imgOverlayBox.width / 2 - 160)}px`,
          }}
          className="absolute z-50 flex items-center gap-1.5 rounded-2xl border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-xs text-white shadow-floating backdrop-blur-lg"
        >
          <span className="text-[10px] text-slate-400 font-semibold uppercase mr-1">图片尺寸</span>
          <button
            type="button"
            onClick={() => setImageWidthPreset('25%')}
            className="px-2 py-0.5 bg-slate-800 hover:bg-blue-600 rounded text-[11px] font-semibold transition"
          >
            25%
          </button>
          <button
            type="button"
            onClick={() => setImageWidthPreset('50%')}
            className="px-2 py-0.5 bg-slate-800 hover:bg-blue-600 rounded text-[11px] font-semibold transition"
          >
            50%
          </button>
          <button
            type="button"
            onClick={() => setImageWidthPreset('75%')}
            className="px-2 py-0.5 bg-slate-800 hover:bg-blue-600 rounded text-[11px] font-semibold transition"
          >
            75%
          </button>
          <button
            type="button"
            onClick={() => setImageWidthPreset('100%')}
            className="px-2 py-0.5 bg-slate-800 hover:bg-blue-600 rounded text-[11px] font-semibold transition"
          >
            100%
          </button>
          <button
            type="button"
            onClick={() => setImageWidthPreset('auto')}
            className="px-2 py-0.5 bg-slate-800 hover:bg-blue-600 rounded text-[11px] font-semibold transition"
          >
            原图
          </button>

          <div className="h-3.5 w-px bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={() => setImageAlign('left')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300"
            title="居左对齐"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setImageAlign('center')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300"
            title="居中对齐"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setImageAlign('right')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300"
            title="居右对齐"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={deleteSelectedImage}
            className="p-1 hover:bg-red-950/60 text-red-400 rounded transition"
            title="删除图片"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 🌟 图片选中蓝框与右下角拖拽 Handle 覆盖层 */}
      {imgOverlayBox && (
        <div
          style={{
            top: `${imgOverlayBox.top}px`,
            left: `${imgOverlayBox.left}px`,
            width: `${imgOverlayBox.width}px`,
            height: `${imgOverlayBox.height}px`,
          }}
          className="absolute z-40 border-2 border-blue-500 rounded-xl pointer-events-none transition-all shadow-md"
        >
          {/* 右下角拖拽 Handle */}
          <div
            onMouseDown={handleDragResizeStart}
            className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-600 border-2 border-white rounded-full cursor-se-resize pointer-events-auto shadow-lg hover:scale-125 transition-transform"
            title="按住拖拽调整图片宽度"
          />
        </div>
      )}

      {/* 🌟 视频悬浮控制条 (Visual Floating Video Resizer & Action Bar) */}
      {videoOverlayBox && (
        <div
          style={{
            top: `${Math.max(10, videoOverlayBox.top - 48)}px`,
            left: `${Math.max(20, videoOverlayBox.left + videoOverlayBox.width / 2 - 180)}px`,
          }}
          className="absolute z-50 flex items-center gap-1.5 rounded-2xl border border-slate-700/80 bg-slate-900/95 px-3 py-1.5 text-xs text-white shadow-floating backdrop-blur-lg animate-in fade-in zoom-in-95 duration-150"
        >
          <span className="text-[10px] text-blue-400 font-bold uppercase flex items-center space-x-1 mr-1">
            <Video className="w-3.5 h-3.5" />
            <span>视频组件</span>
          </span>
          <div className="h-3.5 w-px bg-slate-700 mx-1" />
          <button
            type="button"
            onClick={() => setVideoWidthPreset('100%')}
            className="px-2 py-0.5 bg-slate-800 hover:bg-blue-600 rounded text-[11px] font-semibold transition"
          >
            100%
          </button>
          <button
            type="button"
            onClick={() => setVideoWidthPreset('75%')}
            className="px-2 py-0.5 bg-slate-800 hover:bg-blue-600 rounded text-[11px] font-semibold transition"
          >
            75%
          </button>
          <button
            type="button"
            onClick={() => setVideoWidthPreset('50%')}
            className="px-2 py-0.5 bg-slate-800 hover:bg-blue-600 rounded text-[11px] font-semibold transition"
          >
            50%
          </button>

          <div className="h-3.5 w-px bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={() => setVideoAlign('left')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300"
            title="居左对齐"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setVideoAlign('center')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300"
            title="居中对齐"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setVideoAlign('right')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300"
            title="居右对齐"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>

          <div className="h-3.5 w-px bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={deleteSelectedVideo}
            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
            title="删除视频 (按键盘 Delete / Backspace 键亦可删除)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>删除视频</span>
          </button>
        </div>
      )}

      {/* 🌟 视频选中蓝框覆盖层与快捷右上角删除按钮 */}
      {videoOverlayBox && (
        <div
          style={{
            top: `${videoOverlayBox.top}px`,
            left: `${videoOverlayBox.left}px`,
            width: `${videoOverlayBox.width}px`,
            height: `${videoOverlayBox.height}px`,
          }}
          className="absolute z-40 border-2 border-blue-500 rounded-xl pointer-events-none transition-all shadow-md"
        >
          {/* 右上角快捷删除按钮 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteSelectedVideo();
            }}
            className="pointer-events-auto absolute -top-3 -right-3 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-bold shadow-xl flex items-center space-x-1 transition hover:scale-110"
            title="删除此视频 (按 Delete 键亦可)"
          >
            <Trash2 className="w-3 h-3" />
            <span>删除</span>
          </button>
        </div>
      )}

      {/* 文档画布常驻快捷排版顶栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-300 shadow-xs">
        {/* 左侧：常用格式快捷工具组（无需划词，直接作用于当前光标行或选区） */}
        <div className="flex items-center flex-wrap gap-1">
          {/* 标题级别切换下拉菜单 */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setTopActiveMenu(topActiveMenu === 'heading' ? null : 'heading');
              }}
              className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center space-x-1 font-semibold text-slate-700 dark:text-slate-200 text-xs transition"
              title="切换当前行标题格式 (光标停留即可生效)"
            >
              <span>{currentBlockType}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {topActiveMenu === 'heading' && (
              <div className="absolute left-0 top-full mt-1.5 z-40 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 text-xs shadow-xl">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyHeadingBlock('H1');
                    setCurrentBlockType('H1');
                    setTopActiveMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-extrabold text-slate-900 dark:text-white transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Heading1 className="w-3.5 h-3.5 text-purple-500" />
                  <span className="flex-1">一级标题</span>
                  <span className="text-[10px] font-semibold text-slate-400">32px</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyHeadingBlock('H2');
                    setCurrentBlockType('H2');
                    setTopActiveMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-bold text-slate-900 dark:text-white transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Heading2 className="w-3.5 h-3.5 text-blue-500" />
                  <span className="flex-1">二级标题</span>
                  <span className="text-[10px] font-semibold text-slate-400">24px</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyHeadingBlock('H3');
                    setCurrentBlockType('H3');
                    setTopActiveMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-semibold text-slate-900 dark:text-white transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Heading3 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="flex-1">三级标题</span>
                  <span className="text-[10px] font-semibold text-slate-400">20px</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyHeadingBlock('H4');
                    setCurrentBlockType('H4');
                    setTopActiveMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Heading4 className="h-3.5 w-3.5 text-cyan-500" />
                  <span className="flex-1">四级标题</span>
                  <span className="text-[10px] font-semibold text-slate-400">18px</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyHeadingBlock('P');
                    setCurrentBlockType('正文');
                    setTopActiveMenu(null);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Type className="w-3.5 h-3.5 text-slate-400" />
                  <span className="flex-1">正文文本</span>
                  <span className="text-[10px] font-semibold text-slate-400">16px</span>
                </button>
              </div>
            )}
          </div>

          {/* 字体选择器 */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setTopActiveMenu(topActiveMenu === 'fontfamily' ? null : 'fontfamily')}
              className="flex items-center space-x-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              title="设置选区字体"
            >
              <span className="max-w-24 truncate">{currentFontFamily}</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>
            {topActiveMenu === 'fontfamily' && (
              <div className="absolute left-0 top-full z-40 mt-1.5 max-h-64 w-44 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900">
                {FONT_FAMILIES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      applyFontFamily(item.value);
                      setTopActiveMenu(null);
                    }}
                    className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left transition ${
                      currentFontFamily === item.label
                        ? 'bg-blue-600 font-bold text-white'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span style={item.css ? { fontFamily: item.css } : undefined}>{item.label}</span>
                    <span className="text-[10px] font-normal text-slate-400">{item.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 字号大小下拉菜单 */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (headingFontSize) return;
                setTopActiveMenu(topActiveMenu === 'fontsize' ? null : 'fontsize');
              }}
              disabled={Boolean(headingFontSize)}
              className="flex items-center space-x-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-slate-800"
              title={headingFontSize ? '标题字号由标题级别统一控制' : '设置当前行/选区字号'}
            >
              <span>{headingFontSize ?? currentFontSize}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {topActiveMenu === 'fontsize' && !headingFontSize && (
              <div className="absolute left-0 top-full mt-1.5 z-40 max-h-60 w-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 text-xs shadow-xl">
                {BODY_FONT_SIZES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      applyFontSize(item.value);
                      setTopActiveMenu(null);
                    }}
                    className={`w-full px-2.5 py-1 text-left rounded flex items-center justify-between transition ${
                      currentFontSize === item.value ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 行距选择器 */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setTopActiveMenu(topActiveMenu === 'lineheight' ? null : 'lineheight');
              }}
              className="px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center space-x-1 font-semibold text-slate-700 dark:text-slate-200 text-xs transition"
              title="段落行距"
            >
              <span>{currentLineHeight === '默认' ? '行距' : `${currentLineHeight}x`}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {topActiveMenu === 'lineheight' && (
              <div className="absolute left-0 top-full mt-1.5 z-40 max-h-60 w-32 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 text-xs shadow-xl">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyLineHeight('default');
                    setTopActiveMenu(null);
                  }}
                  className={`w-full px-2 py-1 text-left rounded flex items-center justify-between transition ${
                    currentLineHeight === '默认' ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>默认 (1.75)</span>
                </button>
                {['1.0', '1.2', '1.4', '1.5', '1.6', '1.8', '2.0'].map((lh) => (
                  <button
                    key={lh}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      applyLineHeight(lh);
                      setTopActiveMenu(null);
                    }}
                    className={`w-full px-2 py-1 text-left rounded flex items-center justify-between transition ${
                      currentLineHeight === lh ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{lh} 倍行距</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* 粗斜下划删除与对齐快捷按钮 */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('bold')}
            className={formatButtonClass(activeFormats.bold)}
            title="加粗 (Ctrl+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('italic')}
            className={formatButtonClass(activeFormats.italic)}
            title="斜体 (Ctrl+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('underline')}
            className={formatButtonClass(activeFormats.underline)}
            title="下划线 (Ctrl+U)"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('strikeThrough')}
            className={formatButtonClass(activeFormats.strike)}
            title="删除线"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('justifyLeft')}
            className={formatButtonClass(activeFormats.align === 'left')}
            title="文本左对齐"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('justifyCenter')}
            className={formatButtonClass(activeFormats.align === 'center')}
            title="文本居中"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => execFormat('justifyRight')}
            className={formatButtonClass(activeFormats.align === 'right')}
            title="文本右对齐"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Inserter Menu Dropdown */}
        <div className="relative flex items-center space-x-2">
          {uploading && <span className="text-[11px] text-blue-500 font-semibold animate-pulse">上传媒体中...</span>}
          <button
            type="button"
            onMouseDown={() => saveCaretRange()}
            onClick={() => {
              saveCaretRange();
              setShowPlusMenu(!showPlusMenu);
            }}
            className="px-3 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 rounded-xl font-bold transition flex items-center space-x-1 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>插入块</span>
          </button>

          {showPlusMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-1.5 z-50 text-xs space-y-1">
              <button
                type="button"
                onClick={() => insertCallout('note')}
                className="w-full px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-left flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-medium"
              >
                <Info className="w-4 h-4 text-blue-500" />
                <span>提示框 NOTE</span>
              </button>
              <button
                type="button"
                onClick={() => insertCallout('tip')}
                className="w-full px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-left flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-medium"
              >
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>技巧框 TIP</span>
              </button>
              <button
                type="button"
                onClick={() => insertCallout('warning')}
                className="w-full px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-left flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-medium"
              >
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>警告框 WARNING</span>
              </button>
              <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
              <button
                type="button"
                onClick={insertCodeBlock}
                className="w-full px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-left flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-medium"
              >
                <FileCode className="w-4 h-4 text-purple-500" />
                <span>代码块</span>
              </button>

              <label
                onMouseDown={() => saveCaretRange()}
                className="w-full px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-left flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-medium cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-emerald-500" />
                <span>上传图片/视频</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,video/*,.pdf,.zip"
                  onChange={async (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      try {
                        await uploadAndInsertMedia(e.target.files[0], lastCaretRangeRef.current);
                      } catch {
                        // Upload errors are surfaced by the parent editor.
                      }
                      setShowPlusMenu(false);
                    }
                  }}
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* 云端文档纸张画布 */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="w-full max-w-4xl mx-auto bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 rounded-3xl shadow-xl p-8 md:p-14 min-h-[680px] transition-all overflow-x-hidden"
      >
        <div
          ref={canvasRef}
          contentEditable={true}
          suppressContentEditableWarning={true}
          onClick={handleCanvasClick}
          onPaste={handlePaste}
          onInput={() => {
            saveCaretRange();
            handleContentChange();
          }}
          onBlur={() => {
            saveCaretRange();
            handleContentChange();
          }}
          onKeyUp={() => {
            saveCaretRange();
            handleContentChange();
          }}
          onMouseUp={saveCaretRange}
          className="document-body markdown-body max-w-none focus:outline-none min-h-[600px] text-sm md:text-base leading-relaxed tracking-normal font-sans text-slate-800 dark:text-slate-200 selection:bg-blue-200/70 dark:selection:bg-blue-900/60 overflow-hidden"
        />
      </div>
    </div>
  );
};
