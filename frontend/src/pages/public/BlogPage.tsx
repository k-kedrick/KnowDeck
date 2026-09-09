import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Filter, FolderTree, Tags, X } from 'lucide-react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import type { CategoryTreeNode, DocumentListItem, Tag } from '../../api';
import { ArticleCard } from '../../components/ArticleCard';
import { SEOHead } from '../../components/SEOHead';
import type { PublicOutletContext } from '../../components/publicLayoutContext';

const getCachedTags = (): Tag[] => {
  try {
    const raw = localStorage.getItem('cached_site_tags');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const findCategoryAncestors = (nodes: CategoryTreeNode[], targetID: number, ancestors: number[] = []): number[] => {
  for (const node of nodes) {
    if (node.id === targetID) return ancestors;
    const found = findCategoryAncestors(node.children || [], targetID, [...ancestors, node.id]);
    if (found.length || node.children?.some((child) => child.id === targetID)) return found;
  }
  return [];
};

type CategoryFilterTreeProps = {
  nodes: CategoryTreeNode[];
  activeCategory?: number;
  onSelect: (id?: string) => void;
  compact?: boolean;
};

const CategoryFilterTree = ({ nodes, activeCategory, onSelect, compact = false }: CategoryFilterTreeProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [tooltip, setTooltip] = useState<{ id: number; left: number; top: number } | null>(null);
  const activeAncestors = activeCategory ? new Set(findCategoryAncestors(nodes, activeCategory)) : new Set<number>();

  const moveTooltip = (node: CategoryTreeNode, event: ReactMouseEvent<HTMLDivElement>) => {
    if (!node.description?.trim()) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      id: node.id,
      left: event.clientX - rect.left + 14,
      top: event.clientY - rect.top,
    });
  };

  const toggle = (id: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderNode = (node: CategoryTreeNode, depth = 0) => {
    const hasChildren = !!node.children?.length;
    const expanded = expandedIds.has(node.id) || activeAncestors.has(node.id);
    const active = activeCategory === node.id;
    const rowPadding = `${compact ? 4 + depth * 12 : 4 + depth * 14}px`;
    const rowClass = compact
      ? `flex min-w-0 flex-1 items-center rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${active ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`
      : `flex min-w-0 flex-1 items-center rounded-xl px-3 py-2 text-left text-sm font-medium transition-all ${active ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs dark:bg-blue-950/60 dark:text-blue-300' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white'}`;

    return (
      <div key={node.id}>
        <div
          className="relative flex min-w-0 items-center gap-0.5"
          style={{ paddingLeft: rowPadding }}
          onMouseEnter={(event) => moveTooltip(node, event)}
          onMouseMove={(event) => moveTooltip(node, event)}
          onMouseLeave={() => setTooltip((current) => current?.id === node.id ? null : current)}
        >
          {hasChildren ? (
            <button
              type="button"
              aria-label={`${expanded ? '折叠' : '展开'}分类：${node.name}`}
              aria-expanded={expanded}
              onClick={() => toggle(node.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
            </button>
          ) : <span className="w-7 shrink-0" />}
          <button type="button" onClick={() => onSelect(String(node.id))} className={rowClass}>
            <span className="truncate">{node.name}</span>
          </button>
          {tooltip?.id === node.id && node.description?.trim() && (
            <div
              role="tooltip"
              style={{ left: tooltip.left, top: tooltip.top }}
              className="pointer-events-none absolute z-50 w-max max-w-60 -translate-y-1/2 rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-xs leading-5 text-slate-600 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {node.description.trim()}
            </div>
          )}
        </div>
        {hasChildren && expanded && <div>{node.children!.map((child) => renderNode(child, depth + 1))}</div>}
      </div>
    );
  };

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      {nodes.map((node) => renderNode(node))}
    </div>
  );
};

export const BlogPage = () => {
  const { tree, siteInfo } = useOutletContext<PublicOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [tags, setTags] = useState<Tag[]>(() => getCachedTags());
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const category = Number(searchParams.get('category')) || undefined;
  const selectedTags = [...new Set(searchParams.getAll('tag').map((value) => value.trim()).filter(Boolean))];
  const tagKey = selectedTags.join('\u0000');
  const selectedTagSet = new Set(selectedTags);
  const initialDesktopTags = tags.slice(0, 16);
  const desktopTags = [
    ...initialDesktopTags,
    ...tags.filter((item) => selectedTagSet.has(item.slug) && !initialDesktopTags.some((visible) => visible.id === item.id)),
  ];
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const siteName = siteInfo?.site_name || '知识库';

  const canonicalParams = new URLSearchParams();
  if (category) canonicalParams.set('category', String(category));
  selectedTags.forEach((tag) => canonicalParams.append('tag', tag));
  if (page > 1) canonicalParams.set('page', String(page));
  const canonicalQuery = canonicalParams.toString();
  const canonicalPath = `/blog${canonicalQuery ? `?${canonicalQuery}` : ''}`;
  const hasUnsupportedParams = [...searchParams.keys()].some((key) => !['category', 'tag', 'page'].includes(key));
  const filtered = !!category || selectedTags.length > 0 || hasUnsupportedParams;
  const pageLabel = page > 1 ? ` - 第 ${page} 页` : '';

  useEffect(() => {
    const controller = new AbortController();
    api.getTags(controller.signal).then((data) => {
      if (!controller.signal.aborted && data) {
        setTags(data);
        try {
          localStorage.setItem('cached_site_tags', JSON.stringify(data));
        } catch {}
      }
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(async () => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(false);
      try {
        const data = await api.getDocuments({ page, page_size: pageSize, category_id: category, tags: selectedTags }, controller.signal);
        if (controller.signal.aborted) return;
        setDocuments(data.list || []);
        setTotal(data.total || 0);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    });
    return () => controller.abort();
  }, [category, page, tagKey]);

  const updateFilter = (key: 'category' | 'page', value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const toggleTag = (slug: string) => {
    const nextTags = selectedTagSet.has(slug)
      ? selectedTags.filter((tag) => tag !== slug)
      : [...selectedTags, slug];
    const next = new URLSearchParams(searchParams);
    next.delete('tag');
    nextTags.forEach((tag) => next.append('tag', tag));
    next.delete('page');
    setSearchParams(next);
  };

  const clearTags = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('tag');
    next.delete('page');
    setSearchParams(next);
  };

  return (
    <main className="relative page-gutter page-section w-full min-w-0">
      {/* Soft Atmospheric Light Mesh */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[520px] w-full -translate-x-1/2 max-w-7xl bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/15 via-indigo-500/10 to-transparent blur-3xl dark:from-blue-600/20 dark:via-indigo-600/10" aria-hidden="true" />

      <SEOHead
        title={`文章${pageLabel} - ${siteName}`}
        description={`浏览 ${siteName} 的技术文章、项目说明与知识库文档${page > 1 ? `，当前为第 ${page} 页` : ''}。`}
        canonicalPath={canonicalPath}
        siteName={siteName}
        robots={filtered ? 'noindex,follow' : 'index,follow'}
      />

      <div className="layout-list">
        {/* Clean Page Header */}
        <header className="border-b border-slate-200/80 pb-6 sm:pb-8 dark:border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-200/90 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 px-3.5 py-1 text-xs font-semibold text-blue-700 shadow-xs backdrop-blur-md dark:border-blue-900/60 dark:from-blue-950/60 dark:to-indigo-950/60 dark:text-blue-300">
                <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>内容中心</span>
              </div>
              <h1 className="type-h1 tracking-tight text-slate-900 dark:text-white">
                文章与文档
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300">
                浏览全部技术文章、项目说明与知识库文档。
              </p>
            </div>

            {/* Active filter pill */}
            {(category || selectedTags.length > 0) && (
              <div className="flex items-center gap-2 self-start sm:self-end">
                <button
                  type="button"
                  onClick={() => setSearchParams({})}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200/80 bg-red-50/80 px-3.5 py-2 text-xs font-semibold text-red-600 shadow-xs transition-all hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50"
                >
                  <X className="h-3.5 w-3.5" />
                  清除筛选条件
                </button>
              </div>
            )}
          </div>
        </header>

        <details className="mt-5 rounded-2xl border border-slate-200/80 bg-white/90 p-1 lg:hidden dark:border-slate-800/80 dark:bg-slate-900/90 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white marker:hidden">
            <span className="inline-flex items-center gap-2">
              <Filter className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              筛选分类与标签
            </span>
            <span className="text-xs text-slate-400">展开</span>
          </summary>
          <div className="border-t border-slate-100 p-4 space-y-4 dark:border-slate-800">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">分类</p>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => updateFilter('category')}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                    !category
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  全部分类
                </button>
                <CategoryFilterTree nodes={tree} activeCategory={category} onSelect={(id) => updateFilter('category', id)} compact />
              </div>
            </div>

            {!!tags.length && (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span>标签{selectedTags.length ? ` · 已选 ${selectedTags.length} 个` : ''}</span>
                  {selectedTags.length > 0 && <button type="button" onClick={clearTags} className="normal-case tracking-normal text-blue-600 hover:text-blue-700 dark:text-blue-400">清除</button>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => toggleTag(item.slug)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                        selectedTagSet.has(item.slug)
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      #{item.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>

        {/* Content Stream & Sidebar Grid */}
        <div className="grid gap-10 pt-8 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
          {/* Left Sidebar Filter */}
          <aside className="relative z-20 hidden space-y-6 lg:block">
            <div className="glass-card rounded-2xl p-5 shadow-sm space-y-6">
              {/* Category Filter */}
              <div>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3.5 dark:border-slate-800">
                  <FolderTree className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    分类筛选
                  </h2>
                </div>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => updateFilter('category')}
                    className={`w-full rounded-xl px-3.5 py-2 text-left text-sm font-medium transition-all ${
                      !category
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white'
                    }`}
                  >
                    全部分类
                  </button>
                  <CategoryFilterTree nodes={tree} activeCategory={category} onSelect={(id) => updateFilter('category', id)} />
                </div>
              </div>

              {/* Tag Filter */}
              {!!tags.length && (
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3.5 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Tags className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        标签筛选{selectedTags.length ? ` · 已选 ${selectedTags.length} 个` : ''}
                      </h2>
                    </div>
                    {selectedTags.length > 0 && <button type="button" onClick={clearTags} className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400">清除</button>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {desktopTags.map((item) => {
                      const isActive = selectedTagSet.has(item.slug);
                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => toggleTag(item.slug)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-blue-600 text-white font-semibold shadow-xs'
                              : 'border border-slate-200/60 bg-slate-50/80 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-300'
                          }`}
                        >
                          #{item.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Right Content Stream */}
          <section aria-live="polite" className="min-w-0">
            {/* Stream Header */}
            <div className="mb-4 flex items-center justify-between border-b border-border-subtle pb-3 text-xs text-text-tertiary">
              <span className="font-semibold text-text-secondary">{loading ? '正在检索文章…' : `共找到 ${total} 篇文章`}</span>
              {(category || selectedTags.length > 0) && (
                <span className="inline-flex items-center gap-1 text-text-tertiary">
                  <Filter className="h-3.5 w-3.5 text-brand" /> {selectedTags.length ? `已选 ${selectedTags.length} 个标签` : '已启用筛选'}
                </span>
              )}
            </div>

            {/* List Content */}
            {loading ? (
              <div className="space-y-4 py-1" aria-label="文章列表加载中">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 sm:p-6 animate-pulse space-y-3 dark:border-slate-800/80 dark:bg-slate-900/80">
                    <div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-6 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="glass-card rounded-2xl p-12 text-center">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">文章列表加载失败</h2>
                <p className="mt-2 text-xs text-slate-500">请稍后刷新页面重试。</p>
              </div>
            ) : documents.length ? (
              <div className="space-y-4">
                {documents.map((document) => (
                  <ArticleCard key={document.id} document={document} />
                ))}
              </div>
            ) : (
              <div className="glass-card rounded-3xl p-16 text-center shadow-xs">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-4">
                  <FileText className="h-7 w-7" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  没有找到匹配的文章
                </h2>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  尝试清除当前分类或标签筛选条件。
                </p>
                {(category || selectedTags.length > 0) && (
                  <button
                    type="button"
                    onClick={() => setSearchParams({})}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-600 transition-all hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400 dark:hover:bg-blue-900/50"
                  >
                    重置所有筛选
                  </button>
                )}
              </div>
            )}

            {/* Pagination */}
            {!loading && !error && pageCount > 1 && (
              <nav
                aria-label="文章分页"
                className="mt-8 flex items-center justify-between border-t border-slate-200/80 pt-5 dark:border-slate-800"
              >
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => updateFilter('page', String(page - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一页
                </button>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  第 {page} 页 / 共 {pageCount} 页
                </span>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => updateFilter('page', String(page + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  下一页
                  <ChevronRight className="h-4 w-4" />
                </button>
              </nav>
            )}
          </section>
        </div>

        <Link to="/" className="sr-only">
          返回首页
        </Link>
      </div>
    </main>
  );
};
