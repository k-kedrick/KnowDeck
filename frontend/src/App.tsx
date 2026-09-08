import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { ApiError, api } from './api';
import type { DocDetailData } from './api';
import { PublicLayout } from './components/PublicLayout';
import type { DocumentLoadError } from './components/DocViewer';
import { HomePage } from './pages/public/HomePage';
import { BlogPage } from './pages/public/BlogPage';
import { SEOHead } from './components/SEOHead';
import type { PublicOutletContext } from './components/publicLayoutContext';
import { getSiteUrl, textDescription, toAbsoluteUrl } from './utils/seo';

const DocViewer = lazy(() => import('./components/DocViewer').then((module) => ({ default: module.DocViewer })));
const AdminAuthGuard = lazy(() => import('./components/admin/AdminAuthGuard').then((module) => ({ default: module.AdminAuthGuard })));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout').then((module) => ({ default: module.AdminLayout })));
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage').then((module) => ({ default: module.AdminLoginPage })));
const AdminDocumentList = lazy(() => import('./pages/admin/AdminDocumentList').then((module) => ({ default: module.AdminDocumentList })));
const AdminDocumentEditor = lazy(() => import('./pages/admin/AdminDocumentEditor').then((module) => ({ default: module.AdminDocumentEditor })));
const AdminCategoryManager = lazy(() => import('./pages/admin/AdminCategoryManager').then((module) => ({ default: module.AdminCategoryManager })));
const AdminTagManager = lazy(() => import('./pages/admin/AdminTagManager').then((module) => ({ default: module.AdminTagManager })));
const AdminMediaManager = lazy(() => import('./pages/admin/AdminMediaManager').then((module) => ({ default: module.AdminMediaManager })));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage').then((module) => ({ default: module.AdminSettingsPage })));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })));

const RouteFallback = () => (
  <div className="flex min-h-[50vh] flex-1 items-center justify-center text-sm text-slate-500 dark:text-slate-400">加载中…</div>
);

const AdminDocumentEditorRoute = () => {
  const location = useLocation();
  return <AdminDocumentEditor key={`${location.pathname}${location.search}`} />;
};

const NotFoundPage = () => {
  const { siteInfo } = useOutletContext<PublicOutletContext>();
  const siteName = siteInfo?.site_name || '技术知识库';
  return <main className="flex min-h-[70vh] w-full flex-1 items-center justify-center px-6 py-16 text-center">
    <SEOHead title={`页面不存在 - ${siteName}`} description="你访问的页面不存在、已失效或已经移动。" canonicalPath={null} siteName={siteName} robots="noindex,nofollow" />
    <div className="max-w-md">
      <p className="text-sm font-semibold text-cloud-blue">404</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">页面不存在</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">你访问的地址不存在、已失效，或者内容已经移动。</p>
      <div className="mt-7 flex justify-center gap-3">
        <Link to="/" className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-slate-950">返回首页</Link>
        <Link to="/blog" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">浏览文章</Link>
      </div>
    </div>
  </main>;
};

export const DocumentPage = () => {
  const { siteInfo } = useOutletContext<PublicOutletContext>();
  const { user, loading: authLoading } = useAuth();
  const { slug = '' } = useParams<{ slug: string }>();
  const [docDetail, setDocDetail] = useState<DocDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<DocumentLoadError>(null);
  const requestSequence = useRef(0);
  const siteName = siteInfo?.site_name || '技术知识库';
  const document = docDetail?.document;
  const description = document ? textDescription(document.excerpt, document.content) : '';
  const canonicalPath = `/docs/${encodeURIComponent(slug)}`;

  useEffect(() => {
    if (authLoading) return;
    const sequence = ++requestSequence.current;
    const controller = new AbortController();

    queueMicrotask(async () => {
      if (controller.signal.aborted) return;
      setDocDetail(null);
      setError(null);
      setLoading(true);
      try {
        const data = await api.getDocumentBySlug(slug, controller.signal);
        if (sequence !== requestSequence.current || controller.signal.aborted) return;
        setDocDetail(data);
      } catch (requestError) {
        if (sequence !== requestSequence.current || controller.signal.aborted) return;
        setError(requestError instanceof ApiError && requestError.status === 404 ? 'not-found' : 'network');
      } finally {
        if (sequence === requestSequence.current && !controller.signal.aborted) setLoading(false);
      }
    });

    return () => controller.abort();
  }, [slug, user?.id, authLoading]);

  return (
    <Suspense fallback={<RouteFallback />}>
      {document && <SEOHead
        title={`${document.title} - ${siteName}`}
        description={description || document.title}
        canonicalPath={canonicalPath}
        siteName={siteName}
        type="article"
        image={document.cover || undefined}
        article={{
          publishedTime: document.published_at,
          modifiedTime: document.updated_at,
          section: document.category_name,
          tags: document.tags,
        }}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'TechArticle',
          headline: document.title,
          description: description || document.title,
          url: `${getSiteUrl()}${canonicalPath}`,
          mainEntityOfPage: `${getSiteUrl()}${canonicalPath}`,
          ...(document.published_at ? { datePublished: document.published_at } : {}),
          dateModified: document.updated_at,
          ...(document.author_name ? { author: { '@type': 'Person', name: document.author_name } } : {}),
          ...(document.tags?.length ? { keywords: document.tags } : {}),
          ...(document.cover ? { image: toAbsoluteUrl(document.cover) } : {}),
        }}
      />}
      {error && <SEOHead title={`${error === 'not-found' ? '文章不存在' : '文章加载失败'} - ${siteName}`} description={error === 'not-found' ? '该文章不存在、未发布或地址有误。' : '文章暂时无法加载。'} canonicalPath={null} siteName={siteName} robots="noindex,nofollow" />}
      <DocViewer
        key={slug}
        data={docDetail}
        loading={loading}
        error={error}
      />
    </Suspense>
  );
};

export const App: React.FC = () => (
  <AuthProvider><BrowserRouter>
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="blog" element={<BlogPage />} />
          <Route path="docs/:slug" element={<DocumentPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="/wang/login" element={<AdminLoginPage />} />
        <Route path="/wang" element={<AdminAuthGuard />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="/wang/documents" replace />} />
            <Route path="documents" element={<AdminDocumentList />} />
            <Route path="documents/new" element={<AdminDocumentEditorRoute />} />
            <Route path="documents/:id" element={<AdminDocumentEditorRoute />} />
            <Route path="categories" element={<AdminCategoryManager />} />
            <Route path="tags" element={<AdminTagManager />} />
            <Route path="media" element={<AdminMediaManager />} />
            <Route path="settings" element={<AdminSettingsPage />} />
			<Route path="users" element={<AdminUsersPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  </BrowserRouter></AuthProvider>
);

export default App;
