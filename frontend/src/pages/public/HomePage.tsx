import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { ArrowRight, BookOpen, CalendarDays, Clock3, Eye, FileText, FolderTree, LoaderCircle, Lock, Search, Tags, X } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import type { CategoryTreeNode, DocumentListItem, SearchResult, Tag } from '../../api';
import { useAuth } from '../../auth/useAuth';
import { SEOHead } from '../../components/SEOHead';
import type { PublicOutletContext } from '../../components/publicLayoutContext';
import { formatDateTime } from '../../utils/format';
import { searchSnippetToText } from '../../utils/searchSnippet';
import { getSiteUrl } from '../../utils/seo';

const getCachedTags = (): Tag[] => {
  try {
    const raw = localStorage.getItem('cached_site_tags');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getCachedRecentDocuments = (): DocumentListItem[] => {
  try {
    const raw = localStorage.getItem('cached_recent_docs');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const countCategoryDocuments = (category: CategoryTreeNode): number =>
  (category.documents?.length || 0)
  + (category.children || []).reduce((total, child) => total + countCategoryDocuments(child), 0);

export const HomePage = () => {
  const { siteInfo, tree } = useOutletContext<PublicOutletContext>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cachedDocuments] = useState(getCachedRecentDocuments);
  const [recentDocuments, setRecentDocuments] = useState<DocumentListItem[]>(cachedDocuments);
  const [recentLoading, setRecentLoading] = useState(cachedDocuments.length === 0);
  const [tags, setTags] = useState<Tag[]>(() => getCachedTags());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState(0);
  const legacySlug = new URLSearchParams(location.search).get('doc');

  // 标签降噪：优先展示有文章的标签并按关联量倒序；隐藏 0 计数字段，避免测试脏数据破坏首页
  const activeTags = useMemo(() => {
    const withDocs = tags.filter((tag) => (tag.doc_count || 0) > 0);
    if (withDocs.length > 0) {
      return [...withDocs].sort((a, b) => (b.doc_count || 0) - (a.doc_count || 0)).slice(0, 20);
    }
    return tags.slice(0, 10);
  }, [tags]);

  // 分类降噪展示
  const activeCategories = useMemo(() => {
    return tree.slice(0, 8);
  }, [tree]);

  useEffect(() => {
    const controller = new AbortController();
    api.getDocuments({ page: 1, page_size: 8 }, controller.signal).then((data) => {
      if (!controller.signal.aborted && data?.list) {
        setRecentDocuments(data.list);
        try {
          localStorage.setItem('cached_recent_docs', JSON.stringify(data.list));
        } catch {}
      }
    }).catch(() => undefined).finally(() => {
      if (!controller.signal.aborted) setRecentLoading(false);
    });

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
    const query = searchQuery.trim();
    if (!query) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await api.search(query, controller.signal);
        if (!controller.signal.aborted) {
          setSearchResults(data || []);
          setSelectedResult(0);
        }
      } catch {
        if (!controller.signal.aborted) setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearchLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, user?.id]);

  const updateSearchQuery = (query: string) => {
    setSearchQuery(query);
    setSelectedResult(0);
    if (!query.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && searchResults.length) {
      event.preventDefault();
      setSelectedResult((index) => (index + 1) % searchResults.length);
    } else if (event.key === 'ArrowUp' && searchResults.length) {
      event.preventDefault();
      setSelectedResult((index) => (index - 1 + searchResults.length) % searchResults.length);
    } else if (event.key === 'Enter' && searchResults[selectedResult]) {
      event.preventDefault();
      navigate(`/docs/${encodeURIComponent(searchResults[selectedResult].slug)}`);
    } else if (event.key === 'Escape') {
      updateSearchQuery('');
      event.currentTarget.blur();
    }
  };

  if (legacySlug) return <Navigate to={`/docs/${encodeURIComponent(legacySlug)}`} replace />;

  const siteName = siteInfo?.site_name || '知识库';
  const description = siteInfo?.site_subtitle || '简洁、清晰地查找和阅读知识内容。';

  return (
    <main className="relative w-full min-w-0 pb-14 sm:pb-20">
      <SEOHead
        title={siteName}
        description={description}
        canonicalPath="/"
        siteName={siteName}
        structuredData={{ '@context': 'https://schema.org', '@type': 'WebSite', name: siteName, description, url: `${getSiteUrl()}/` }}
      />

      {/* Search is the portal's primary action instead of another duplicate article-list link. */}
      <section className="border-b border-border-subtle bg-surface/70">
        <div className="layout-list max-w-5xl mx-auto page-gutter py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/50 dark:text-blue-300">
              <BookOpen className="h-3.5 w-3.5" />
              <span>知识门户</span>
            </div>
            <h1 className="type-display text-text-primary">{siteName}</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-text-secondary sm:text-base">{description}</p>

            <div className="relative mx-auto mt-8 w-full max-w-2xl text-left">
              <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-border-default bg-surface px-4 shadow-sm transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/15 focus-within:shadow-md dark:focus-within:border-blue-600 sm:px-5">
                <Search className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                <input
                  id="home-search-input"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => updateSearchQuery(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="搜索文档、标题和标签…"
                  aria-label="搜索文档、标题和标签"
                  autoComplete="off"
                  className="min-w-0 flex-1 appearance-none bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary [&::-webkit-search-cancel-button]:appearance-none sm:text-base"
                />
                {searchLoading ? (
                  <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-blue-600" aria-label="搜索中" />
                ) : searchQuery ? (
                  <button type="button" onClick={() => updateSearchQuery('')} aria-label="清空搜索" className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-subtle hover:text-text-primary">
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <kbd className="hidden rounded-md border border-border-subtle bg-surface-subtle px-2 py-1 font-mono text-xs text-text-tertiary sm:inline-flex">Ctrl K</kbd>
                )}
              </div>

              {searchQuery.trim() && (
                <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 max-h-80 overflow-y-auto rounded-2xl border border-border-subtle bg-surface-elevated p-2 shadow-dropdown" aria-label="首页搜索结果" aria-live="polite">
                  {!searchLoading && searchResults.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-text-tertiary">未找到与“{searchQuery.trim()}”相关的文档</p>
                  ) : searchResults.map((result, index) => (
                    <Link
                      key={result.id}
                      to={`/docs/${encodeURIComponent(result.slug)}`}
                      onMouseEnter={() => setSelectedResult(index)}
                      className={`block rounded-xl px-3 py-3 transition-colors ${selectedResult === index ? 'bg-surface-subtle' : 'hover:bg-surface-subtle'}`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <strong className="truncate text-sm font-semibold text-text-primary">{result.title}</strong>
                        {result.category_name && <small className="shrink-0 text-xs text-text-tertiary">{result.category_name}</small>}
                      </span>
                      {result.snippet && <span className="mt-1 block line-clamp-2 text-xs leading-5 text-text-secondary">{searchSnippetToText(result.snippet)}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <nav aria-label="首页快捷入口" className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 lg:grid-cols-4">
            <a href="#categories" className="group flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-xs dark:hover:border-blue-800 dark:hover:bg-blue-950/30">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"><FolderTree className="h-4 w-4" /></span>
              <span className="min-w-0"><strong className="block text-sm text-text-primary">分类浏览</strong><small className="block truncate text-xs text-text-tertiary">{siteInfo?.category_count || tree.length} 个分类</small></span>
            </a>
            <Link to="/blog" className="group flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-xs dark:hover:border-indigo-800 dark:hover:bg-indigo-950/30">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"><FileText className="h-4 w-4" /></span>
              <span className="min-w-0"><strong className="block text-sm text-text-primary">全部文章</strong><small className="block truncate text-xs text-text-tertiary">{siteInfo?.doc_count || recentDocuments.length} 篇内容</small></span>
            </Link>
            <a href="#recent" className="group flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-xs dark:hover:border-emerald-800 dark:hover:bg-emerald-950/30">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"><Clock3 className="h-4 w-4" /></span>
              <span className="min-w-0"><strong className="block text-sm text-text-primary">最近更新</strong><small className="block truncate text-xs text-text-tertiary">查看最新内容</small></span>
            </a>
            <a href="#tags" className="group flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-purple-300 hover:bg-purple-50/50 hover:shadow-xs dark:hover:border-purple-800 dark:hover:bg-purple-950/30">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400"><Tags className="h-4 w-4" /></span>
              <span className="min-w-0"><strong className="block text-sm text-text-primary">标签索引</strong><small className="block truncate text-xs text-text-tertiary">{siteInfo?.tag_count || tags.length} 个标签</small></span>
            </a>
          </nav>
        </div>
      </section>

      <div className="layout-list max-w-5xl mx-auto page-gutter pt-8 sm:pt-12">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18.5rem] xl:grid-cols-[minmax(0,1fr)_19.5rem]">
          <section id="recent" className="scroll-mt-24 min-w-0" aria-labelledby="recent-heading">
            <div className="flex items-center justify-between border-b border-border-subtle pb-4">
              <div>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">内容动态</p>
                <h2 id="recent-heading" className="mt-0.5 text-lg sm:text-xl font-bold tracking-tight text-text-primary">最近更新</h2>
              </div>
              <span className="text-xs text-text-tertiary">按最新编辑排序</span>
            </div>

            {recentLoading ? (
              <div className="mt-5 space-y-3.5" aria-label="最近更新加载中">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="animate-pulse rounded-2xl border border-border-subtle bg-surface p-5">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-16 rounded bg-surface-subtle" />
                      <div className="h-4 w-24 rounded bg-surface-subtle" />
                    </div>
                    <div className="mt-3 h-5 w-3/4 rounded bg-surface-subtle" />
                    <div className="mt-2.5 h-4 w-1/2 rounded bg-surface-subtle" />
                  </div>
                ))}
              </div>
            ) : recentDocuments.length ? (
              <div className="mt-5 space-y-3.5">
                {recentDocuments.map((document) => (
                  <Link
                    key={document.id}
                    to={`/docs/${encodeURIComponent(document.slug)}`}
                    className="group relative block rounded-2xl border border-border-subtle bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/30 hover:shadow-md hover:shadow-blue-500/5 dark:hover:border-blue-400/30 dark:hover:shadow-black/20 sm:p-5.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-tertiary">
                      <div className="flex items-center gap-2">
                        {document.category_name && (
                          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            {document.category_name}
                          </span>
                        )}
                        {document.access_level === 'authenticated' && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                            <Lock className="h-3 w-3" />
                            <span>登录可见</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDateTime(document.updated_at || document.created_at)}
                        </span>
                        {document.views > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            {document.views}
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="mt-2.5 text-base font-bold text-text-primary transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400 sm:text-lg">
                      {document.title}
                    </h3>

                    {document.excerpt ? (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-secondary sm:text-sm">
                        {document.excerpt}
                      </p>
                    ) : null}

                    <div className="mt-3.5 flex items-center justify-between border-t border-border-subtle/60 pt-3">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 transition-all group-hover:gap-1.5 dark:text-blue-400">
                        阅读全文
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-border-default py-14 text-center">
                <FileText className="mx-auto h-7 w-7 text-text-tertiary" />
                <p className="mt-3 text-sm text-text-secondary">暂无公开文章</p>
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section id="categories" className="scroll-mt-24 rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs" aria-labelledby="categories-heading">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <h2 id="categories-heading" className="flex items-center gap-2 text-sm font-bold text-text-primary">
                  <FolderTree className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  分类浏览
                </h2>
                <span className="text-xs text-text-tertiary">{siteInfo?.category_count || tree.length} 个分类</span>
              </div>
              <div className="mt-2 divide-y divide-border-subtle">
                {activeCategories.length ? activeCategories.map((category) => (
                  <Link
                    key={category.id}
                    to={`/blog?category=${category.id}`}
                    className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-surface-subtle"
                  >
                    <span className="min-w-0 truncate font-medium text-text-secondary group-hover:text-blue-600 dark:group-hover:text-blue-400">{category.name}</span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-text-tertiary">
                      <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] group-hover:bg-blue-50 group-hover:text-blue-600 dark:group-hover:bg-blue-950/50 dark:group-hover:text-blue-400">
                        {countCategoryDocuments(category)}
                      </span>
                      <ArrowRight className="h-3 w-3 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    </span>
                  </Link>
                )) : <p className="py-6 text-center text-xs text-text-tertiary">暂无分类</p>}
              </div>
            </section>

            <section id="tags" className="scroll-mt-24 rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs" aria-labelledby="tags-heading">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <h2 id="tags-heading" className="flex items-center gap-2 text-sm font-bold text-text-primary">
                  <Tags className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  热门标签
                </h2>
                <span className="text-xs text-text-tertiary">{activeTags.length} 个标签</span>
              </div>
              {activeTags.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {activeTags.map((tag) => (
                    <Link
                      key={tag.id}
                      to={`/blog?tag=${encodeURIComponent(tag.slug)}`}
                      className="group inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-subtle/50 px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-all hover:border-purple-300 hover:bg-purple-50/50 hover:text-purple-600 dark:hover:border-purple-800 dark:hover:bg-purple-950/30 dark:hover:text-purple-300"
                    >
                      <span>#{tag.name}</span>
                      {Boolean(tag.doc_count && tag.doc_count > 0) && (
                        <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-text-tertiary group-hover:text-purple-600 dark:group-hover:text-purple-300">
                          {tag.doc_count}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              ) : <p className="py-6 text-center text-xs text-text-tertiary">暂无标签</p>}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
};
