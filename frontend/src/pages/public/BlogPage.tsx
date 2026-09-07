import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Filter, FolderTree, Tags, X } from 'lucide-react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import type { CategoryTreeNode, DocumentListItem, Tag } from '../../api';
import { ArticleCard } from '../../components/ArticleCard';
import { SEOHead } from '../../components/SEOHead';
import type { PublicOutletContext } from '../../components/publicLayoutContext';

type CategoryOption = CategoryTreeNode & { depth: number };

const flattenCategories = (nodes: CategoryTreeNode[], depth = 0): CategoryOption[] =>
  nodes.flatMap((node) => [{ ...node, depth }, ...flattenCategories(node.children || [], depth + 1)]);

export const BlogPage = () => {
  const { tree, siteInfo } = useOutletContext<PublicOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const categories = useMemo(() => flattenCategories(tree), [tree]);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const category = Number(searchParams.get('category')) || undefined;
  const tag = searchParams.get('tag') || undefined;
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const siteName = siteInfo?.site_name || '知识库';

  const canonicalParams = new URLSearchParams();
  if (category) canonicalParams.set('category', String(category));
  if (tag) canonicalParams.set('tag', tag);
  if (page > 1) canonicalParams.set('page', String(page));
  const canonicalQuery = canonicalParams.toString();
  const canonicalPath = `/blog${canonicalQuery ? `?${canonicalQuery}` : ''}`;
  const hasUnsupportedParams = [...searchParams.keys()].some((key) => !['category', 'tag', 'page'].includes(key));
  const filtered = !!category || !!tag || hasUnsupportedParams;
  const pageLabel = page > 1 ? ` - 第 ${page} 页` : '';

  useEffect(() => {
    const controller = new AbortController();
    api.getTags(controller.signal).then((data) => setTags(data || [])).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(async () => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(false);
      try {
        const data = await api.getDocuments({ page, page_size: pageSize, category_id: category, tag }, controller.signal);
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
  }, [category, page, tag]);

  const updateFilter = (key: 'category' | 'tag' | 'page', value?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  return (
    <main className="relative page-gutter page-section w-full min-w-0">
      {/* Soft Ambient Light */}
      <div className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-96 w-full -translate-x-1/2 max-w-7xl bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-indigo-500/5 to-transparent blur-3xl dark:from-blue-600/15 dark:via-indigo-600/5" aria-hidden="true" />

      <SEOHead
        title={`文章${pageLabel} - ${siteName}`}
        description={`浏览 ${siteName} 的技术文章、项目说明与知识库文档${page > 1 ? `，当前为第 ${page} 页` : ''}。`}
        canonicalPath={canonicalPath}
        siteName={siteName}
        robots={filtered ? 'noindex,follow' : 'index,follow'}
      />

      <div className="layout-list">
        {/* Clean Page Header */}
        <header className="border-b border-border-subtle pb-6 sm:pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-brand dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-400">
                <FileText className="h-3.5 w-3.5" />
                <span>内容中心</span>
              </div>
              <h1 className="type-h1 text-text-primary">
                文章与文档
              </h1>
              <p className="mt-2 text-sm sm:text-base text-text-secondary">
                浏览全部技术文章、项目说明与知识库文档。
              </p>
            </div>

            {/* Active filter pill */}
            {(category || tag) && (
              <div className="flex items-center gap-2 self-start sm:self-end">
                <button
                  type="button"
                  onClick={() => setSearchParams({})}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" />
                  清除筛选条件
                </button>
              </div>
            )}
          </div>
        </header>

        <details className="mt-5 rounded-2xl border border-border-default bg-surface lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-text-primary marker:hidden">
            <span className="inline-flex items-center gap-2">
              <Filter className="h-4 w-4 text-brand" />
              筛选分类与标签
            </span>
            <span className="text-xs text-text-tertiary">展开</span>
          </summary>
          <div className="border-t border-border-subtle p-4 space-y-4">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-tertiary">分类</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => updateFilter('category')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    !category
                      ? 'bg-brand text-white'
                      : 'bg-surface-subtle text-text-secondary hover:bg-surface-subtle/80'
                  }`}
                >
                  全部
                </button>
                {categories.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => updateFilter('category', String(item.id))}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      category === item.id
                        ? 'bg-brand text-white'
                        : 'bg-surface-subtle text-text-secondary hover:bg-surface-subtle/80'
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>

            {!!tags.length && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-tertiary">标签</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => updateFilter('tag', tag === item.slug ? undefined : item.slug)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                        tag === item.slug
                          ? 'bg-brand text-white'
                          : 'bg-surface-subtle text-text-secondary hover:bg-surface-subtle/80'
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
        <div className="grid gap-10 pt-8 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
          {/* Left Sidebar Filter */}
          <aside className="hidden space-y-6 lg:block">
            <div className="rounded-2xl border border-border-subtle/80 bg-surface-elevated/70 p-5 backdrop-blur-sm shadow-sm space-y-6">
              {/* Category Filter */}
              <div>
                <div className="flex items-center gap-2 border-b border-border-subtle pb-2.5 mb-3">
                  <FolderTree className="h-4 w-4 text-brand" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                    分类筛选
                  </h2>
                </div>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => updateFilter('category')}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      !category
                        ? 'bg-brand/10 text-brand font-semibold'
                        : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'
                    }`}
                  >
                    全部分类
                  </button>
                  {categories.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => updateFilter('category', String(item.id))}
                      style={{ paddingLeft: `${12 + item.depth * 14}px` }}
                      className={`w-full truncate rounded-lg pr-3 py-2 text-left text-sm transition-colors ${
                        category === item.id
                          ? 'bg-brand/10 text-brand font-semibold'
                          : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'
                      }`}
                    >
                      {item.depth > 0 ? '— ' : ''}{item.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tag Filter */}
              {!!tags.length && (
                <div>
                  <div className="flex items-center gap-2 border-b border-border-subtle pb-2.5 mb-3">
                    <Tags className="h-4 w-4 text-brand" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                      标签筛选
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.slice(0, 16).map((item) => {
                      const isActive = tag === item.slug;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => updateFilter('tag', isActive ? undefined : item.slug)}
                          className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                            isActive
                              ? 'bg-brand text-white font-medium shadow-sm'
                              : 'bg-surface-subtle text-text-secondary hover:bg-brand/10 hover:text-brand'
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
              {(category || tag) && (
                <span className="inline-flex items-center gap-1 text-text-tertiary">
                  <Filter className="h-3.5 w-3.5 text-brand" /> 已启用筛选
                </span>
              )}
            </div>

            {/* List Content */}
            {loading ? (
              <div className="space-y-3 py-1" aria-label="文章列表加载中">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="rounded-xl border border-border-subtle bg-surface-elevated px-4 py-3 sm:px-5 sm:py-3.5 animate-pulse space-y-2.5">
                    <div className="h-3.5 w-32 rounded bg-surface-subtle" />
                    <div className="h-5 w-2/3 rounded bg-surface-subtle" />
                    <div className="h-3.5 w-full rounded bg-surface-subtle" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="py-16 text-center">
                <h2 className="text-base font-semibold text-text-primary">文章列表加载失败</h2>
                <p className="mt-2 text-xs text-text-tertiary">请稍后刷新页面重试。</p>
              </div>
            ) : documents.length ? (
              <div className="space-y-3">
                {documents.map((document) => (
                  <ArticleCard key={document.id} document={document} />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <FileText className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                <h2 className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  没有找到匹配的文章
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  尝试清除当前分类或标签筛选条件。
                </p>
                {(category || tag) && (
                  <button
                    type="button"
                    onClick={() => setSearchParams({})}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
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
