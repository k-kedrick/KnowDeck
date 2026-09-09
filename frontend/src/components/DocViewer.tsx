import React, { useState } from 'react';
import { Link, useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { DocDetailData } from '../api';
import type { PublicOutletContext } from './publicLayoutContext';
import { formatDateTime } from '../utils/format';
import { isHtmlDocumentContent, rehypeHardenDocument, sanitizeDocumentHtml, sanitizeUrlAndText } from '../utils/htmlToMarkdown';
import { enhanceDocumentHtmlLinks } from '../utils/documentLinks';
import { proxyHistoricalDocumentImages } from '../utils/documentImages';
import {
  decodeHeadingHash,
  ensureDocumentHeadingIds,
  findDocumentHeading,
  scrollToDocumentHeading,
} from '../utils/documentHeadings';
import {
  Eye,
  Copy,
  Check,
  List,
  ListTree,
  Lock,
  X,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeft,
} from 'lucide-react';
import { ReadingProgressBar } from './ReadingProgressBar';
import { ImageLightbox } from './ImageLightbox';
import { ModalPortal } from './ModalPortal';

type MarkdownMathPlugins = typeof import('./markdownMath');

interface DocViewerProps {
  data: DocDetailData | null;
  loading: boolean;
  error?: DocumentLoadError;
}

export type DocumentLoadError = 'not-found' | 'network' | null;

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface HeadingScope {
  documentId: number | undefined;
  slug: string | undefined;
  content: string | undefined;
  title: string | undefined;
  rendered: boolean;
  markdownReady: boolean;
}

const EMPTY_TOC_ITEMS: TocItem[] = [];

interface TocNavProps {
  items: TocItem[];
  activeId: string;
  onSelect: (event: React.MouseEvent, id: string) => void;
  filterText?: string;
}

const TocNav = ({ items, activeId, onSelect, filterText = '' }: TocNavProps) => {
  const baseLevel = items.length > 0 ? Math.min(...items.map((item) => item.level)) : 1;
  const filteredItems = filterText.trim()
    ? items.filter((item) => item.text.toLowerCase().includes(filterText.trim().toLowerCase()))
    : items;

  if (filteredItems.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
        暂无目录
      </div>
    );
  }

  return (
    <nav aria-label="本页目录" className="space-y-0.5 py-1 text-xs select-none">
      {filteredItems.map((item) => {
        const depth = Math.max(0, item.level - baseLevel);
        const isActive = activeId === item.id;

        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            data-toc-id={item.id}
            onClick={(event) => onSelect(event, item.id)}
            style={{
              paddingLeft: depth === 0 ? '6px' : `${6 + depth * 14}px`,
            }}
            data-level={item.level}
            title={item.text}
            aria-current={isActive ? 'location' : undefined}
            className={`group relative flex h-[28px] w-full min-w-0 max-w-full items-center overflow-hidden px-1.5 text-left whitespace-nowrap transition-colors ${
              depth === 0
                ? 'mt-2.5 first:mt-0 font-medium text-[13px] text-slate-800 dark:text-slate-100'
                : depth === 1
                ? 'mt-1.5 font-medium text-[13px] text-slate-700 dark:text-slate-200'
                : 'mt-0.5 text-[12.5px] text-slate-500 dark:text-slate-400'
            } ${
              isActive
                ? '!text-[#3370ff] dark:!text-blue-400 !font-semibold'
                : 'hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <span className="block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {item.text}
            </span>
          </a>
        );
      })}
    </nav>
  );
};

const documentSanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'iframe', 'video', 'source', 'mark', 'u', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] || []), 'className', 'id', 'style', 'align'],
    a: [...(defaultSchema.attributes?.a || []), 'href', 'target', 'rel'],
    img: [...(defaultSchema.attributes?.img || []), 'src', 'alt', 'width', 'height', 'referrerPolicy'],
    video: ['src', 'controls', 'width', 'height', 'preload', 'poster'],
    source: ['src', 'type'],
    iframe: ['src', 'title', 'width', 'height', 'loading', 'sandbox', 'allow', 'allowFullScreen', 'referrerPolicy'],
    td: ['colSpan', 'rowSpan', 'align'],
    th: ['colSpan', 'rowSpan', 'align'],
    code: [...(defaultSchema.attributes?.code || []), ['className', /^language-./, 'math-inline', 'math-display']],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto', 'tel'],
    src: ['http', 'https', 'data', 'blob'],
  },
};

const fingerprintCode = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const containsMarkdownMath = (content: string) => /(^|[^\\])\$\$?[\s\S]*?\$\$?/.test(content);

export const DocViewer: React.FC<DocViewerProps> = ({ data, loading, error = null }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const outletContext = useOutletContext<PublicOutletContext | null>();
  const setOutletTocItems = outletContext?.setTocItems;
  const setOutletDocTitle = outletContext?.setCurrentDocTitle;
  const setOutletActiveHeadingId = outletContext?.setActiveHeadingId;
  const [copiedCodeIds, setCopiedCodeIds] = useState<Set<string>>(() => new Set());
  const [tocSnapshot, setTocSnapshot] = useState<{ scope: HeadingScope; items: TocItem[] } | null>(null);
  const [activeHeading, setActiveHeading] = useState<{ scope: HeadingScope; id: string } | null>(null);
  const [mathPlugins, setMathPlugins] = useState<MarkdownMathPlugins | null>(null);
  const [mathLoadFailed, setMathLoadFailed] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ src: string; alt: string } | null>(null);
  const [isTocCollapsed, setIsTocCollapsed] = useState(() => {
    try {
      return localStorage.getItem('doc_toc_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const articleRef = React.useRef<HTMLElement>(null);
  const copyTimersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleToggleToc = (collapsed: boolean) => {
    setIsTocCollapsed(collapsed);
    try {
      localStorage.setItem('doc_toc_collapsed', collapsed ? 'true' : 'false');
    } catch {
      // ignore
    }
  };

  const doc = data?.document;
  const docTitle = doc?.title;
  const locked = data?.locked === true;

  const rawContent = doc?.content || doc?.excerpt || '';
  const isHtmlContent = React.useMemo(() => isHtmlDocumentContent(rawContent), [rawContent]);
  const needsMath = React.useMemo(() => !isHtmlContent && containsMarkdownMath(rawContent), [isHtmlContent, rawContent]);
  const markdownReady = !needsMath || mathPlugins !== null || mathLoadFailed;
  const documentId = doc?.id;
  const documentSlug = doc?.slug;
  const documentContent = doc?.content;
  const rendered = Boolean(doc) && !loading && !error && !locked;
  // Bind DOM-derived state and asynchronous callbacks to the current document render.
  const headingScope = React.useMemo<HeadingScope>(() => ({
    documentId, slug: documentSlug, content: documentContent, title: docTitle, rendered, markdownReady,
  }), [documentId, documentSlug, documentContent, docTitle, rendered, markdownReady]);
  const tocItems = tocSnapshot?.scope === headingScope ? tocSnapshot.items : EMPTY_TOC_ITEMS;
  const tocReady = rendered && markdownReady && (!documentContent || tocSnapshot?.scope === headingScope);
  const setActiveHeadingId = React.useCallback((id: string) => {
    setActiveHeading((current) => current?.scope === headingScope && current.id === id
      ? current : { scope: headingScope, id });
  }, [headingScope]);
  const processedContent = React.useMemo(() => {
    const raw = doc?.content || doc?.excerpt || '';
    if (!raw) return '';
    if (isHtmlContent) {
      const safeHtml = sanitizeDocumentHtml(raw)
        .replace(/<img\b/gi, '<img loading="lazy" decoding="async"');
      return ensureDocumentHeadingIds(enhanceDocumentHtmlLinks(proxyHistoricalDocumentImages(safeHtml)));
    }
    return raw.replace(/[!！]\s*\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" referrerpolicy="no-referrer" class="max-w-full h-auto rounded-xl my-4" />');
  }, [doc?.content, doc?.excerpt, isHtmlContent]);

  React.useEffect(() => {
    const timers = copyTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  React.useEffect(() => {
    if (!isTocOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsTocOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isTocOpen]);

  React.useEffect(() => {
    if (!needsMath) return;
    let active = true;
    import('./markdownMath').then((plugins) => {
      if (active) setMathPlugins(plugins);
    }).catch(() => {
      if (active) setMathLoadFailed(true);
    });
    return () => { active = false; };
  }, [needsMath]);

  React.useEffect(() => {
    if (!headingScope.rendered || !headingScope.content || !headingScope.markdownReady) return;

    const timer = setTimeout(() => {
      if (articleRef.current) {
        const headings = articleRef.current.querySelectorAll('h1, h2, h3, h4, h5');
        const items: TocItem[] = [];

        headings.forEach((h, index) => {
          const text = (h.textContent || '').trim();
          if (!text) return;

          if (!h.id) {
            h.id = `heading-${index}-${encodeURIComponent(text.slice(0, 16))}`;
          }

          const level = parseInt(h.tagName.substring(1), 10);
          if (h.id !== 'doc-title') items.push({ id: h.id, text, level });
        });

        setTocSnapshot({ scope: headingScope, items });
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [headingScope]);

  React.useEffect(() => {
    setOutletTocItems?.(tocItems);
  }, [tocItems, setOutletTocItems]);

  React.useEffect(() => {
    setOutletDocTitle?.(rendered ? docTitle || '' : '');
  }, [docTitle, rendered, setOutletDocTitle]);

  const allTocItems = React.useMemo(() => {
    if (!rendered) return EMPTY_TOC_ITEMS;
    if (!docTitle) return tocItems;
    if (tocItems.length > 0 && tocItems[0].text.trim() === docTitle.trim()) {
      return tocItems;
    }
    return [{ id: 'doc-title', text: docTitle, level: 1 }, ...tocItems];
  }, [docTitle, tocItems, rendered]);

  // doc-title remains the default position even when its duplicate TOC row is omitted.
  const activeHeadingId = !rendered ? '' : activeHeading?.scope === headingScope
    ? activeHeading.id : docTitle ? 'doc-title' : allTocItems[0]?.id || '';

  React.useEffect(() => {
    setOutletActiveHeadingId?.(activeHeadingId);
  }, [activeHeadingId, setOutletActiveHeadingId]);

  React.useEffect(() => {
    if (!activeHeadingId) return;
    try {
      const activeEl = document.querySelector(`[data-toc-id="${CSS.escape(activeHeadingId)}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    } catch {
      // ignore
    }
  }, [activeHeadingId]);

  React.useEffect(() => {
    if (!allTocItems.length) return;
    if (typeof IntersectionObserver === 'undefined') return;

    let observing = true;
    const observer = new IntersectionObserver((entries) => {
      if (!observing) return;
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]?.target.id) {
        setActiveHeadingId(visible[0].target.id);
      }
    }, { rootMargin: '-80px 0px -70% 0px', threshold: [0, 1] });

    allTocItems.forEach((item) => {
      const heading = document.getElementById(item.id);
      if (heading) observer.observe(heading);
    });
    return () => {
      observing = false;
      observer.disconnect();
    };
  }, [allTocItems, setActiveHeadingId]);

  React.useEffect(() => {
    if (!tocReady || !allTocItems.length || !articleRef.current) return;

    let animationFrame = 0;
    const restoreHashPosition = (behavior: ScrollBehavior) => {
      cancelAnimationFrame(animationFrame);
      const id = decodeHeadingHash(window.location.hash);
      if (!id) return;
      if (id === 'doc-title') {
        window.scrollTo({ top: 0, behavior });
        setActiveHeadingId('doc-title');
        return;
      }
      if (!articleRef.current || !findDocumentHeading(articleRef.current, id)) return;
      animationFrame = requestAnimationFrame(() => {
        if (!articleRef.current || decodeHeadingHash(window.location.hash) !== id) return;
        scrollToDocumentHeading(articleRef.current, id, { behavior, block: 'start' });
        setActiveHeadingId(id);
      });
    };
    const handleHistoryNavigation = () => restoreHashPosition('smooth');

    restoreHashPosition('auto');
    window.addEventListener('hashchange', handleHistoryNavigation);
    window.addEventListener('popstate', handleHistoryNavigation);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('hashchange', handleHistoryNavigation);
      window.removeEventListener('popstate', handleHistoryNavigation);
    };
  }, [allTocItems, tocReady, setActiveHeadingId]);

  const copyCode = async (codeText: string, codeId: string) => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopiedCodeIds((current) => new Set(current).add(codeId));

      const existingTimer = copyTimersRef.current.get(codeId);
      if (existingTimer) clearTimeout(existingTimer);
      copyTimersRef.current.set(codeId, setTimeout(() => {
        setCopiedCodeIds((current) => {
          const next = new Set(current);
          next.delete(codeId);
          return next;
        });
        copyTimersRef.current.delete(codeId);
      }, 2000));
    } catch {
      // Keep default state
    }
  };

  const handleTocClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    if (id === 'doc-title') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setActiveHeadingId('doc-title');
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}#doc-title`);
      return;
    }
    if (!articleRef.current || !findDocumentHeading(articleRef.current, id)) {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveHeadingId(id);
        window.history.pushState(null, '', `${window.location.pathname}${window.location.search}#${encodeURIComponent(id)}`);
      }
      return;
    }
    scrollToDocumentHeading(articleRef.current, id, { behavior: 'smooth', block: 'start' });
    setActiveHeadingId(id);
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}#${encodeURIComponent(id)}`);
  };

  const handleArticleLinkClick = (event: React.MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    const href = target?.getAttribute('href') || '';
    const isInternalRoute = href.startsWith('/')
      && !href.startsWith('//')
      && !/^\/(?:api|uploads)(?:\/|$)/.test(href);
    if (!isInternalRoute) return;

    event.preventDefault();
    navigate(href);
  };

  const handleArticleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      const image = event.target instanceof Element ? event.target.closest<HTMLImageElement>('img[src]') : null;
      if (image && articleRef.current?.contains(image)) {
        const src = image.currentSrc || image.src;
        if (src) {
          event.preventDefault();
          setImagePreview({ src, alt: image.alt || '文章图片' });
          return;
        }
      }
    }
    handleArticleLinkClick(event);
  };

  if (loading) {
    return (
      <div className="layout-reading mx-auto w-full animate-pulse space-y-6 px-4 py-8 sm:px-8">
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-3/4" />
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
        <div className="space-y-3 pt-6">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full" />
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-4/6" />
        </div>
      </div>
    );
  }

  if (error) {
    const isNotFound = error === 'not-found';
    return (
      <div className="flex w-full min-h-[60vh] flex-1 flex-col items-center justify-center p-8 text-center text-slate-400">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <List className="w-7 h-7 text-slate-500 dark:text-slate-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
          {isNotFound ? '文章不存在' : '文章加载失败'}
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {isNotFound ? '该文章可能已被删除、下线或地址有误。' : '网络或服务暂时不可用，请稍后重试。'}
        </p>
        <Link to="/blog" className="mt-4 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
          返回文章列表
        </Link>
      </div>
    );
  }

  if (!data || !data.document || !doc) {
    return (
      <div className="flex w-full min-h-[60vh] flex-1 flex-col items-center justify-center p-8 text-center text-slate-400">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-400">
          <List className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
          请选择左侧目录中的文档
        </h3>
        <p className="text-xs text-slate-500 mt-1">从左侧知识库目录中点击任意文档即可阅读</p>
      </div>
    );
  }

  if (locked) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return (
      <main
        data-testid="document-locked"
        className="flex w-full min-h-[75vh] flex-1 items-center justify-center px-4 py-12"
      >
        <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 sm:p-10 text-center">
          {/* Decorative background glow */}
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-600/15" />

          {/* Lock Icon Emblem */}
          <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/30 dark:shadow-blue-500/20">
            <Lock className="h-9 w-9" />
          </div>

          {/* Badge */}
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-300">
            <span>🔒</span>
            <span>成员专享内容</span>
          </div>

          {/* Document Title */}
          <h1 className="mb-3 text-xl font-bold leading-snug tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            {doc.title}
          </h1>

          {/* Prompt Description */}
          <p className="mx-auto mb-8 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            此文章仅对登录用户开放。请登录后继续阅读完整文章与知识库大纲。
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to={`/login?returnTo=${returnTo}`}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30 active:scale-[0.98]"
            >
              登录后查看
            </Link>
            <Link
              to={`/register?returnTo=${returnTo}`}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50/80 px-6 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              没有账号？注册
            </Link>
          </div>

          {/* Back link */}
          <div className="mt-8 border-t border-slate-100 pt-5 dark:border-slate-800">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回首页浏览其他公开文章
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const codeOccurrences = new Map<string, number>();

  return (
    <div className="relative w-full min-h-full flex-1 flex justify-center">
      <ReadingProgressBar />
      {/* Mobile TOC Drawer Trigger */}
      {allTocItems.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setIsTocOpen(true)}
            className="fixed bottom-5 right-5 z-30 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3.5 text-xs font-semibold text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-200 xl:hidden"
          >
            <ListTree className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            目录
          </button>
          {isTocOpen && (
            <ModalPortal>
            <div className="fixed inset-0 z-[9999] xl:hidden">
              <button type="button" aria-label="关闭目录" onClick={() => setIsTocOpen(false)} className="absolute inset-0 bg-black/40" />
              <aside aria-label="目录" className="absolute left-0 top-0 flex h-full w-[min(20rem,85vw)] flex-col bg-white dark:bg-slate-900 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3.5">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">目录</p>
                  <button type="button" onClick={() => setIsTocOpen(false)} aria-label="关闭目录" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3" onClick={() => setIsTocOpen(false)}>
                  <TocNav items={allTocItems} activeId={activeHeadingId} onSelect={handleTocClick} />
                </div>
              </aside>
            </div>
            </ModalPortal>
          )}
        </>
      )}

      {/* Desktop TOC fills the free gutter up to the reading canvas; long labels ellipsize at that edge. */}
      {allTocItems.length > 0 && !isTocCollapsed && (
        <aside
          data-testid="desktop-toc"
          aria-label="本文目录"
          className="document-reading-toc fixed top-20 h-[calc(100vh-6rem)] min-w-0 flex-col overflow-hidden z-20 select-none"
        >
          <div className="flex items-center justify-start mb-2 px-1 shrink-0">
            <button
              type="button"
              onClick={() => handleToggleToc(true)}
              title="收起目录"
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 toc-scrollbar">
            <TocNav items={allTocItems} activeId={activeHeadingId} onSelect={handleTocClick} />
          </div>
        </aside>
      )}

      {/* Expand TOC Button (Shown when collapsed) */}
      {allTocItems.length > 0 && isTocCollapsed && (
        <button
          type="button"
          onClick={() => handleToggleToc(false)}
          title="展开目录"
          className="hidden xl:flex fixed left-8 top-20 z-30 items-center justify-center w-7 h-7 rounded bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600 hover:border-blue-400 shadow-sm transition-all backdrop-blur-sm"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      )}

      {/* Main Reading Canvas: Strictly centered horizontally across all states */}
      <div className="w-full flex justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <main className="w-full max-w-[860px] bg-transparent transition-colors">
          {/* Document Header Metadata */}
          <header className="mb-6">
          {/* Document Title */}
          <h1 id="doc-title" className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-[2.25rem] leading-tight">
            {doc.title}
          </h1>

          {/* Metadata Row */}
          <div className="mt-3 mb-6 flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
            {doc.views > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span>{doc.views}</span>
              </span>
            )}
            <span>编辑于：{formatDateTime(doc.updated_at || doc.created_at)}</span>
          </div>
        </header>

        {/* Document Body */}
        <article ref={articleRef} className="document-body markdown-body [&_img]:cursor-zoom-in" onClick={handleArticleClick}>
          {isHtmlContent ? (
            <div dangerouslySetInnerHTML={{ __html: processedContent }} />
          ) : needsMath && !markdownReady ? (
            <div className="min-h-96 animate-pulse space-y-3 py-2" aria-label="文章公式渲染加载中">
              <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="mt-8 h-20 w-full rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, ...(mathPlugins ? [mathPlugins.remarkMath] : []), remarkBreaks]}
              rehypePlugins={[rehypeRaw, rehypeHardenDocument, [rehypeSanitize, documentSanitizeSchema], ...(mathPlugins ? [mathPlugins.rehypeKatex] : []), rehypeSlug]}
              components={{
                img({ src, alt, ...props }) {
                  return (
                    <img
                      src={src}
                      alt={alt || '图片'}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      className="my-5 h-auto max-w-full cursor-zoom-in rounded-lg border border-slate-200/70 dark:border-slate-800"
                      {...props}
                    />
                  );
                },
                a({ href, children, ...props }) {
                  const childStr = String(children);
                  const { url: cleanUrl, textAfterUrl, label } = sanitizeUrlAndText(href || '#', childStr);
                  const isAnchor = cleanUrl.startsWith('#');
                  const isInternal = (cleanUrl.startsWith('/') && !cleanUrl.startsWith('//'))
                    || (!isAnchor && !/^[a-z][a-z\d+.-]*:/i.test(cleanUrl));
                  const isBackendResource = /^\/(?:api|uploads)(?:\/|$)/.test(cleanUrl);
                  const hasRichChild = React.Children.toArray(children).some((child) => React.isValidElement(child));
                  if (isInternal && !isBackendResource) return <Link to={cleanUrl} className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-4 dark:text-blue-400">{children}</Link>;
                  if (hasRichChild) return <a href={cleanUrl} target={isAnchor || isBackendResource ? undefined : '_blank'} rel={isAnchor || isBackendResource ? undefined : 'noopener noreferrer'} {...props}>{children}</a>;
                  return (
                    <>
                      <a
                        href={cleanUrl}
                        target={isAnchor || isBackendResource ? undefined : '_blank'}
                        rel={isAnchor || isBackendResource ? undefined : 'noopener noreferrer'}
                        className="text-blue-600 dark:text-blue-400 underline font-medium hover:text-blue-700"
                        {...props}
                      >
                        {label}
                      </a>
                      {textAfterUrl}
                    </>
                  );
                },
                h1({ children, ...props }) {
                  return <h2 {...props}>{children}</h2>;
                },
                h2({ children, ...props }) {
                  return <h3 {...props}>{children}</h3>;
                },
                h3({ children, ...props }) {
                  return <h4 {...props}>{children}</h4>;
                },
                h4({ children, ...props }) {
                  return <h5 {...props}>{children}</h5>;
                },
                table({ children, ...props }) {
                  return <div className="table-scroll" tabIndex={0}><table {...props}>{children}</table></div>;
                },
                pre({ children }) {
                  return <>{children}</>;
                },
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');

                  if (match) {
                    const fingerprint = `${match[1]}-${fingerprintCode(codeString)}`;
                    const occurrence = codeOccurrences.get(fingerprint) || 0;
                    codeOccurrences.set(fingerprint, occurrence + 1);
                    const codeId = `${fingerprint}-${occurrence}`;
                    const isCopied = copiedCodeIds.has(codeId);
                    return (
                      <div className="code-block group relative my-5 min-w-0 overflow-hidden rounded-lg border border-slate-800 bg-[#090d16]">
                        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3.5 py-1.5 text-xs font-mono text-slate-400">
                          <span>{match[1]}</span>
                          <button
                            type="button"
                            onClick={() => copyCode(codeString, codeId)}
                            aria-label={`复制 ${match[1]} 代码`}
                            className="flex items-center space-x-1 rounded px-1.5 py-0.5 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{isCopied ? '已复制' : '复制代码'}</span>
                          </button>
                        </div>
                        <pre className="!m-0 !rounded-none">
                          <code>{children}</code>
                        </pre>
                      </div>
                    );
                  }

                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {processedContent}
            </ReactMarkdown>
          )}
        </article>
        {data.neighbor && (data.neighbor.prev || data.neighbor.next) && (
          <nav aria-label="文章导航" className="mt-10 grid grid-cols-1 gap-3 border-t border-slate-200 pt-5 text-sm dark:border-slate-800 sm:grid-cols-2">
            {data.neighbor.prev ? (
              <Link
                to={`/docs/${encodeURIComponent(data.neighbor.prev.slug)}`}
                className="rounded-xl border border-slate-200 px-4 py-3 text-slate-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:text-blue-400"
              >
                <span className="block text-xs text-slate-400">上一篇</span>
                <span className="mt-1 block font-medium">{data.neighbor.prev.title}</span>
              </Link>
            ) : <span />}
            {data.neighbor.next && (
              <Link
                to={`/docs/${encodeURIComponent(data.neighbor.next.slug)}`}
                className="rounded-xl border border-slate-200 px-4 py-3 text-right text-slate-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:text-blue-400"
              >
                <span className="block text-xs text-slate-400">下一篇</span>
                <span className="mt-1 block font-medium">{data.neighbor.next.title}</span>
              </Link>
            )}
          </nav>
        )}
      </main>
    </div>
    {imagePreview && (
      <ImageLightbox
        src={imagePreview.src}
        alt={imagePreview.alt}
        onClose={() => setImagePreview(null)}
      />
    )}
  </div>
  );
};
