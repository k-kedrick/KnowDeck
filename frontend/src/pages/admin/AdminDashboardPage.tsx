import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  FolderTree,
  Image as ImageIcon,
  Users,
  Settings,
  PlusCircle,
  ArrowRight,
  ExternalLink,
  Clock,
  Lock,
  Sparkles,
  Database,
  ShieldCheck,
  CheckCircle2,
  FileEdit,
} from 'lucide-react';
import { api } from '../../api';
import type { DocumentListItem, SiteInfo } from '../../api';
import { formatDateTime } from '../../utils/format';

export const AdminDashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [recentDocs, setRecentDocs] = useState<DocumentListItem[]>([]);
  const [publishedCount, setPublishedCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [mediaCount, setMediaCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [activeInviteCount, setActiveInviteCount] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [
          siteInfoRes,
          recentDocsRes,
          publishedDocsRes,
          draftDocsRes,
          mediaRes,
          usersRes,
          invitesRes,
        ] = await Promise.allSettled([
          api.getSiteInfo(controller.signal),
          api.getAdminDocuments({ page: 1, page_size: 6 }),
          api.getAdminDocuments({ status: 'published', page: 1, page_size: 1 }),
          api.getAdminDocuments({ status: 'draft', page: 1, page_size: 1 }),
          api.getAdminMedia({ page: 1, page_size: 1 }),
          api.listAdminUsers({ page: 1, page_size: 1 }),
          api.listAdminInvites(),
        ]);

        if (!active) return;

        if (siteInfoRes.status === 'fulfilled') {
          setSiteInfo(siteInfoRes.value);
        }
        if (recentDocsRes.status === 'fulfilled') {
          setRecentDocs(recentDocsRes.value.list || []);
        }
        if (publishedDocsRes.status === 'fulfilled') {
          setPublishedCount(publishedDocsRes.value.total || 0);
        }
        if (draftDocsRes.status === 'fulfilled') {
          setDraftCount(draftDocsRes.value.total || 0);
        }
        if (mediaRes.status === 'fulfilled') {
          setMediaCount(mediaRes.value.total || 0);
        }
        if (usersRes.status === 'fulfilled') {
          setUserCount(usersRes.value.total || 0);
        }
        if (invitesRes.status === 'fulfilled') {
          const activeInvites = (invitesRes.value.items || []).filter(
            (inv) => inv.status === 'active'
          );
          setActiveInviteCount(activeInvites.length);
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDashboardData();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const todayStr = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());

  const totalDocs = publishedCount + draftCount;

  return (
    <div className="space-y-5 py-1">
      {/* Top Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-border-subtle/80 bg-gradient-to-br from-surface-elevated/95 via-surface-elevated/90 to-brand/5 p-6 backdrop-blur-xl shadow-xs sm:p-8">
        {/* Ambient Decorative Glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute right-1/4 -bottom-12 h-36 w-36 rounded-full bg-indigo-500/10 blur-2xl" aria-hidden="true" />

        <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand shadow-xs">
              <Sparkles className="h-3.5 w-3.5" />
              <span>控制台概览</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              欢迎回到管理中心
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-text-tertiary">
              今天是 <span className="font-medium text-text-secondary">{todayStr}</span> · 系统运行健康，所有服务处于最佳状态。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/wang/documents/new"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-hover px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/20 transition-all hover:shadow-lg hover:shadow-brand/30 active:scale-[0.98]"
            >
              <PlusCircle className="h-4 w-4" />
              <span>新建文档</span>
            </Link>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-default/80 bg-surface/80 px-4 py-2.5 text-sm font-semibold text-text-secondary backdrop-blur-sm transition-all hover:border-brand/30 hover:bg-surface hover:text-text-primary active:scale-[0.98]"
            >
              <span>访问前台</span>
              <ExternalLink className="h-4 w-4 text-text-tertiary" />
            </a>
          </div>
        </div>
      </section>

      {/* Metric Cards Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Document Stats */}
        <div className="group relative overflow-hidden rounded-2xl border border-border-subtle/80 bg-surface-elevated/90 p-5 shadow-xs backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">文档总数</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/10 border border-blue-500/20 text-brand shadow-xs shadow-blue-500/10 transition-transform group-hover:scale-105">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-text-primary">
              {loading ? '…' : totalDocs}
            </span>
            <span className="text-xs text-text-tertiary font-medium">篇</span>
          </div>
          <div className="mt-3.5 flex items-center justify-between border-t border-border-subtle/80 pt-3 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
              已发布: <strong className="font-semibold text-text-primary">{publishedCount}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 shadow-xs shadow-amber-500/50" />
              草稿: <strong className="font-semibold text-text-primary">{draftCount}</strong>
            </span>
          </div>
        </div>

        {/* Category & Tag Stats */}
        <div className="group relative overflow-hidden rounded-2xl border border-border-subtle/80 bg-surface-elevated/90 p-5 shadow-xs backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">分类与标签</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-xs shadow-emerald-500/10 transition-transform group-hover:scale-105">
              <FolderTree className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-text-primary">
              {loading ? '…' : siteInfo?.category_count ?? 0}
            </span>
            <span className="text-xs text-text-tertiary font-medium">个分类</span>
          </div>
          <div className="mt-3.5 flex items-center justify-between border-t border-border-subtle/80 pt-3 text-xs text-text-secondary">
            <span>标签总数</span>
            <span className="font-semibold text-text-primary">
              {siteInfo?.tag_count ?? 0} 个
            </span>
          </div>
        </div>

        {/* Media Stats */}
        <div className="group relative overflow-hidden rounded-2xl border border-border-subtle/80 bg-surface-elevated/90 p-5 shadow-xs backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-500/40 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">媒体资源库</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/15 to-pink-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 shadow-xs shadow-purple-500/10 transition-transform group-hover:scale-105">
              <ImageIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-text-primary">
              {loading ? '…' : mediaCount}
            </span>
            <span className="text-xs text-text-tertiary font-medium">个文件</span>
          </div>
          <div className="mt-3.5 flex items-center justify-between border-t border-border-subtle/80 pt-3 text-xs text-text-secondary">
            <span>本地静态存储</span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              正常
            </span>
          </div>
        </div>

        {/* Users & Invites Stats */}
        <div className="group relative overflow-hidden rounded-2xl border border-border-subtle/80 bg-surface-elevated/90 p-5 shadow-xs backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/40 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">用户与邀请</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-xs shadow-amber-500/10 transition-transform group-hover:scale-105">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-text-primary">
              {loading ? '…' : userCount}
            </span>
            <span className="text-xs text-text-tertiary font-medium">位注册用户</span>
          </div>
          <div className="mt-3.5 flex items-center justify-between border-t border-border-subtle/80 pt-3 text-xs text-text-secondary">
            <span>可用邀请码</span>
            <span className="font-semibold text-brand">
              {activeInviteCount} 个
            </span>
          </div>
        </div>
      </section>

      {/* Main Content: Recent Documents & Quick Operations / System Info */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left 2 Cols: Recent Documents */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-text-primary">
                近期编辑与更新
              </h2>
              <p className="text-xs text-text-tertiary">
                快速查看并继续编辑最近调整的文档内容
              </p>
            </div>
            <Link
              to="/wang/documents"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand transition-colors hover:text-brand-hover"
            >
              <span>查看全部文档</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border-subtle/80 bg-surface-elevated/90 backdrop-blur-md shadow-xs">
            {loading ? (
              <div className="flex min-h-[220px] items-center justify-center text-sm text-text-tertiary">
                加载近期文档中…
              </div>
            ) : recentDocs.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center p-6 text-center text-sm text-text-tertiary">
                <FileText className="mb-2 h-8 w-8 text-text-tertiary/40" />
                <p>暂无文档记录</p>
                <Link
                  to="/wang/documents/new"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-brand/20 transition-all hover:bg-brand-hover"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  撰写第一篇文档
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border-subtle/70">
                {recentDocs.map((doc) => {
                  const isPublished = doc.status === 'published';
                  const isAuthOnly = doc.access_level === 'authenticated';

                  return (
                    <div
                      key={doc.id}
                      className="group flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-surface-subtle/60 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isPublished
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {isPublished ? '已发布' : '草稿'}
                          </span>

                          {isAuthOnly && (
                            <span
                              title="仅登录用户可访问"
                              className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-medium text-text-secondary"
                            >
                              <Lock className="h-3 w-3" />
                              <span>登录可见</span>
                            </span>
                          )}

                          {doc.category_name && (
                            <span className="truncate text-xs font-medium text-text-tertiary">
                              {doc.category_name}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-1.5 truncate text-sm font-semibold text-text-primary group-hover:text-brand transition-colors">
                          <Link to={`/wang/documents/${doc.id}`}>
                            {doc.title}
                          </Link>
                        </h3>

                        <div className="mt-1 flex items-center gap-3 text-xs text-text-tertiary">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(doc.updated_at || doc.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Link
                          to={`/wang/documents/${doc.id}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border-default/80 bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary shadow-xs transition-all hover:border-brand/40 hover:bg-brand/5 hover:text-brand"
                        >
                          <FileEdit className="h-3.5 w-3.5" />
                          <span>编辑</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Quick Navigation & System Overview */}
        <div className="space-y-6">
          {/* Quick Operations */}
          <div className="rounded-2xl border border-border-subtle/80 bg-surface-elevated/90 p-5 shadow-xs backdrop-blur-md">
            <h2 className="text-sm font-bold text-text-primary">快捷管理入口</h2>
            <div className="mt-3.5 grid grid-cols-1 gap-2.5">
              <Link
                to="/wang/documents/new"
                className="group flex items-center justify-between rounded-xl border border-border-subtle/80 bg-surface p-3 transition-all hover:border-brand/40 hover:bg-surface-subtle"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-brand transition-transform group-hover:scale-105">
                    <PlusCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text-primary group-hover:text-brand transition-colors">
                      撰写新文档
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      Markdown / 富文本编辑器
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-text-tertiary transition-transform group-hover:translate-x-0.5" />
              </Link>

              <Link
                to="/wang/media"
                className="group flex items-center justify-between rounded-xl border border-border-subtle/80 bg-surface p-3 transition-all hover:border-purple-500/40 hover:bg-surface-subtle"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 transition-transform group-hover:scale-105">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text-primary group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      媒体资源库
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      图片/文件上传与管理
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-text-tertiary transition-transform group-hover:translate-x-0.5" />
              </Link>

              <Link
                to="/wang/users"
                className="group flex items-center justify-between rounded-xl border border-border-subtle/80 bg-surface p-3 transition-all hover:border-amber-500/40 hover:bg-surface-subtle"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-transform group-hover:scale-105">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text-primary group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      用户与邀请码
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      成员权限与注册邀请
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-text-tertiary transition-transform group-hover:translate-x-0.5" />
              </Link>

              <Link
                to="/wang/settings"
                className="group flex items-center justify-between rounded-xl border border-border-subtle/80 bg-surface p-3 transition-all hover:border-slate-400 hover:bg-surface-subtle"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 transition-transform group-hover:scale-105">
                    <Settings className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text-primary group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                      系统全局配置
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      站点名称/SEO与备案信息
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-text-tertiary transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* System & Architecture Status Card */}
          <div className="rounded-2xl border border-border-subtle/80 bg-surface-elevated/90 p-5 shadow-xs backdrop-blur-md">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-bold text-text-primary">
                系统与架构状态
              </h2>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-border-subtle/80 pb-2.5">
                <span className="text-text-tertiary">存储引擎</span>
                <span className="flex items-center gap-1 font-semibold text-text-primary">
                  <Database className="h-3.5 w-3.5 text-brand" />
                  SQLite (WAL 模式)
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border-subtle/80 pb-2.5">
                <span className="text-text-tertiary">全文检索索引</span>
                <span className="font-semibold text-text-primary">
                  SQLite FTS5
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border-subtle/80 pb-2.5">
                <span className="text-text-tertiary">前端驱动</span>
                <span className="font-semibold text-text-primary">
                  React 19 + Vite 8
                </span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-text-tertiary">服务健康检查</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  正常运行
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
