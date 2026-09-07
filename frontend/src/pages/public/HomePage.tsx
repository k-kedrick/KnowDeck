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
import { buttonClassName } from '../../components/ui/buttonStyles';

export const HomePage = () => {
  const { siteInfo, tree, openSearch } = useOutletContext<PublicOutletContext>();
  const location = useLocation();
  const [recentDocuments, setRecentDocuments] = useState<DocumentListItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [tags, setTags] = useState<Tag[]>([]);
  const legacySlug = new URLSearchParams(location.search).get('doc');

  useEffect(() => {
    const controller = new AbortController();
    api.getDocuments({ page: 1, page_size: 8 }, controller.signal).then((data) => {
      if (!controller.signal.aborted) setRecentDocuments(data.list || []);
    }).catch(() => undefined).finally(() => {
      if (!controller.signal.aborted) setRecentLoading(false);
    });

    api.getTags(controller.signal).then((data) => {
      if (!controller.signal.aborted) setTags(data || []);
    }).catch(() => undefined);

    return () => controller.abort();
  }, []);

  if (legacySlug) return <Navigate to={`/docs/${encodeURIComponent(legacySlug)}`} replace />;

  const siteName = siteInfo?.site_name || '知识库';
  const description = siteInfo?.site_subtitle || '沉淀技术实践、项目文档与长期可复用的工程知识。';

  return (
    <main className="relative page-gutter page-section w-full min-w-0">
      {/* Soft Ambient Light */}
      <div className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-96 w-full -translate-x-1/2 max-w-7xl bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/10 via-indigo-500/5 to-transparent blur-3xl dark:from-blue-600/15 dark:via-indigo-600/5" aria-hidden="true" />

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
        <section className="grid gap-7 border-b border-border-subtle pb-8 sm:pb-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <div className="max-w-4xl">
            <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-brand dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>技术博客 · 知识库</span>
            </div>
            <h1 className="type-display text-text-primary">
              {siteInfo?.site_name || '知识库'}
            </h1>
            <p className="type-body-lg mt-3 text-text-secondary">
              {siteInfo?.site_subtitle || '沉淀技术实践、项目文档与长期可复用的工程知识。'}
            </p>

            {(siteInfo?.doc_count || siteInfo?.category_count || siteInfo?.tag_count) ? (
              <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-1.5 font-medium text-text-secondary shadow-sm">
                  <strong className="font-bold text-text-primary">{siteInfo?.doc_count || 0}</strong> 篇文章
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-1.5 font-medium text-text-secondary shadow-sm">
                  <strong className="font-bold text-text-primary">{siteInfo?.category_count || 0}</strong> 个分类
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-1.5 font-medium text-text-secondary shadow-sm">
                  <strong className="font-bold text-text-primary">{siteInfo?.tag_count || 0}</strong> 个标签
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col justify-center rounded-2xl border border-border-subtle/80 bg-surface-elevated/70 p-6 backdrop-blur-sm shadow-sm lg:border-l lg:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">开始探索</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">按目录浏览全部内容，或直接搜索标题与正文。</p>
            <div className="mt-5 flex flex-wrap gap-3 lg:flex-col">
              <Link to="/blog" className={buttonClassName({ variant: 'primary', className: 'justify-between' })}>
                浏览全部文章 <ArrowRight className="h-4 w-4" />
              </Link>
              <Button variant="secondary" onClick={openSearch} className="justify-between">
                搜索知识库 <Search className="h-4 w-4 text-text-tertiary" />
              </Button>
            </div>
          </div>
        </section>

        {/* Content Stream & Sidebar Grid */}
        <div className="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Main Feed: Recent Articles */}
          <section className="min-w-0" aria-label="最新文章">
            <div className="mb-4 flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-brand" />
                <h2 className="text-lg font-bold tracking-tight text-text-primary">最近更新</h2>
              </div>
              <Link
                to="/blog"
                className="inline-flex items-center gap-1 text-xs font-medium text-text-tertiary hover:text-brand transition-colors"
              >
                查看全部 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div>
              {recentLoading ? (
                <div className="space-y-3 py-1" aria-label="最近更新加载中">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="rounded-xl border border-border-subtle bg-surface-elevated px-4 py-3 sm:px-5 sm:py-3.5 animate-pulse space-y-2.5">
                      <div className="h-3.5 w-1/4 rounded bg-surface-subtle" />
                      <div className="h-5 w-3/4 rounded bg-surface-subtle" />
                      <div className="h-3.5 w-full rounded bg-surface-subtle" />
                    </div>
                  ))}
                </div>
              ) : recentDocuments.length ? (
                <div className="space-y-3">
                  {recentDocuments.map((document) => (
                    <ArticleCard key={document.id} document={document} compact />
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-sm text-text-tertiary">
                  暂无公开文章。
                </div>
              )}
            </div>
          </section>

          {/* Right Sidebar: Categories & Tags */}
          <aside className="space-y-6">
            {/* Category Navigation */}
            <div className="rounded-2xl border border-border-subtle/80 bg-surface-elevated/70 p-5 backdrop-blur-sm shadow-sm">
              <div className="flex items-center justify-between border-b border-border-subtle pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-brand" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                    分类目录
                  </h2>
                </div>
                <Link to="/blog" className="text-xs text-text-tertiary hover:text-brand transition-colors">
                  全部
                </Link>
              </div>

              <div className="space-y-1">
                {tree.length ? (
                  tree.map((category) => (
                    <Link
                      key={category.id}
                      to={`/blog?category=${category.id}`}
                      className="group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary"
                    >
                      <span className="truncate font-medium group-hover:translate-x-0.5 transition-transform">
                        {category.name}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-text-tertiary group-hover:text-brand transition-colors" />
                    </Link>
                  ))
                ) : (
                  <p className="py-4 text-center text-xs text-text-tertiary">暂无分类</p>
                )}
              </div>
            </div>

            {/* Tags Cloud */}
            {!!tags.length && (
              <div className="rounded-2xl border border-border-subtle/80 bg-surface-elevated/70 p-5 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-2 border-b border-border-subtle pb-2.5 mb-3">
                  <Tags className="h-4 w-4 text-brand" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                    热门标签
                  </h2>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.slice(0, 16).map((item) => (
                    <Link
                      key={item.id}
                      to={`/blog?tag=${encodeURIComponent(item.slug)}`}
                      className="rounded-md bg-surface-subtle px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-brand/10 hover:text-brand"
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
