import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, FolderTree, Search, Sparkles, Tags } from 'lucide-react';
import { Link, Navigate, useLocation, useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import type { DocumentListItem, Tag } from '../../api';
import { ArticleCard } from '../../components/ArticleCard';
import { SEOHead } from '../../components/SEOHead';
import type { PublicOutletContext } from '../../components/publicLayoutContext';
import { getSiteUrl } from '../../utils/seo';
import { Button } from '../../components/ui/Button';

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

export const HomePage = () => {
  const { siteInfo, tree, openSearch } = useOutletContext<PublicOutletContext>();
  const location = useLocation();
  const [recentDocuments, setRecentDocuments] = useState<DocumentListItem[]>(() => getCachedRecentDocuments());
  const [recentLoading, setRecentLoading] = useState(() => getCachedRecentDocuments().length === 0);
  const [tags, setTags] = useState<Tag[]>(() => getCachedTags());
  const legacySlug = new URLSearchParams(location.search).get('doc');

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

  if (legacySlug) return <Navigate to={`/docs/${encodeURIComponent(legacySlug)}`} replace />;

  const siteName = siteInfo?.site_name || '知识库';
  const description = siteInfo?.site_subtitle || '';

  return (
    <main className="relative page-gutter page-section w-full min-w-0">
      {/* Soft Atmospheric Light Mesh */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[520px] w-full -translate-x-1/2 max-w-7xl bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/15 via-indigo-500/10 to-transparent blur-3xl dark:from-blue-600/20 dark:via-indigo-600/10" aria-hidden="true" />

      <SEOHead
        title={siteName}
        description={description}
        canonicalPath="/"
        siteName={siteName}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: siteName,
          description,
          url: `${getSiteUrl()}/`,
        }}
      />

      <div className="layout-shell">
        {/* Integrated Hero Section */}
        <section className="grid gap-8 border-b border-slate-200/80 pb-10 sm:pb-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14 dark:border-slate-800/80">
          <div className="max-w-4xl flex flex-col justify-center">
            <div className="mb-4 inline-flex items-center gap-2 self-start rounded-full border border-blue-200/90 bg-gradient-to-r from-blue-50/90 to-indigo-50/90 px-3.5 py-1 text-xs font-semibold text-blue-700 shadow-xs backdrop-blur-md dark:border-blue-900/60 dark:from-blue-950/60 dark:to-indigo-950/60 dark:text-blue-300">
              <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>技术博客 · 知识库</span>
            </div>

            <h1 className="type-display tracking-tight text-slate-900 dark:text-white">
              <span className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-800 bg-clip-text text-transparent dark:from-white dark:via-blue-100 dark:to-slate-200">
                {siteName}
              </span>
            </h1>

            {description ? (
              <p className="type-body-lg mt-3.5 max-w-2xl text-slate-600 dark:text-slate-300">
                {description}
              </p>
            ) : null}

            {(siteInfo?.doc_count || siteInfo?.category_count || siteInfo?.tag_count) ? (
              <div className="mt-7 flex flex-wrap items-center gap-2.5 text-xs">
                <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2 font-medium text-slate-700 shadow-sm backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-200">
                  <BookOpen className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span><strong className="font-bold text-slate-900 dark:text-white">{siteInfo?.doc_count || 0}</strong> 篇文章</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2 font-medium text-slate-700 shadow-sm backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-200">
                  <FolderTree className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span><strong className="font-bold text-slate-900 dark:text-white">{siteInfo?.category_count || 0}</strong> 个分类</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2 font-medium text-slate-700 shadow-sm backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/80 dark:text-slate-200">
                  <Tags className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  <span><strong className="font-bold text-slate-900 dark:text-white">{siteInfo?.tag_count || 0}</strong> 个标签</span>
                </span>
              </div>
            ) : null}
          </div>

          {/* Quick Explore Action Card */}
          <div className="glass-card flex flex-col justify-center rounded-3xl p-6 sm:p-7 shadow-lg shadow-blue-500/5 relative overflow-hidden">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">开始探索</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              按目录与分类探索全部内容，或按下快捷键直接进行全文检索。
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                to="/blog"
                className="inline-flex items-center justify-between rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-500/30 active:scale-[0.98]"
              >
                <span>浏览全部文章</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Button
                variant="secondary"
                onClick={openSearch}
                className="justify-between rounded-xl border border-slate-200/80 bg-white/90 px-5 py-2.5 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <span>搜索知识库</span>
                <Search className="h-4 w-4 text-slate-400" />
              </Button>
            </div>
          </div>
        </section>

        {/* Content Stream & Sidebar Grid */}
        <div className="grid gap-10 pt-10 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* Main Feed: Recent Articles */}
          <section className="min-w-0" aria-label="最新文章">
            <div className="mb-5 flex items-center justify-between border-b border-slate-200/80 pb-3.5 dark:border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                  <BookOpen className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">最近更新</h2>
              </div>
              <Link
                to="/blog"
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
              >
                查看全部 <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div>
              {recentLoading ? (
                <div className="space-y-4 py-1" aria-label="最近更新加载中">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 sm:p-6 animate-pulse space-y-3 dark:border-slate-800/80 dark:bg-slate-900/80">
                      <div className="h-4 w-1/4 rounded-md bg-slate-100 dark:bg-slate-800" />
                      <div className="h-6 w-3/4 rounded-md bg-slate-100 dark:bg-slate-800" />
                      <div className="h-4 w-full rounded-md bg-slate-100 dark:bg-slate-800" />
                    </div>
                  ))}
                </div>
              ) : recentDocuments.length ? (
                <div className="space-y-4">
                  {recentDocuments.map((document) => (
                    <ArticleCard key={document.id} document={document} compact />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-sm text-slate-400 dark:border-slate-800">
                  暂无公开文章。
                </div>
              )}
            </div>
          </section>

          {/* Right Sidebar: Categories & Tags */}
          <aside className="space-y-6">
            {/* Category Navigation */}
            <div className="glass-card rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3.5 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    分类目录
                  </h2>
                </div>
                <Link to="/blog" className="text-xs font-medium text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  全部
                </Link>
              </div>

              <div className="space-y-1.5">
                {tree.length ? (
                  tree.map((category) => (
                    <Link
                      key={category.id}
                      to={`/blog?category=${category.id}`}
                      className="group flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-blue-950/50 dark:hover:text-blue-300"
                    >
                      <span className="truncate group-hover:translate-x-0.5 transition-transform">
                        {category.name}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-600 dark:text-slate-600 dark:group-hover:text-blue-400 transition-colors" />
                    </Link>
                  ))
                ) : (
                  <p className="py-4 text-center text-xs text-slate-400">暂无分类</p>
                )}
              </div>
            </div>

            {/* Tags Cloud */}
            {!!tags.length && (
              <div className="glass-card rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3.5 dark:border-slate-800">
                  <Tags className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    热门标签
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.slice(0, 16).map((item) => (
                    <Link
                      key={item.id}
                      to={`/blog?tag=${encodeURIComponent(item.slug)}`}
                      className="rounded-lg border border-slate-200/60 bg-slate-50/80 px-2.5 py-1 text-xs font-medium text-slate-600 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:border-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                    >
                      #{item.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
};
