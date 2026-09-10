import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Tag as TagIcon,
  Plus,
  Trash2,
  Edit,
  AlertCircle,
  CheckCircle,
  Calendar,
  Search,
  BookOpen,
  Copy,
  Check,
  Sparkles,
  Layers,
} from 'lucide-react';
import { api } from '../../api';
import type { Tag } from '../../api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { ModalPortal } from '../../components/ModalPortal';
import { Button } from '../../components/ui/Button';

export const AdminTagManager: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedSlugId, setCopiedSlugId] = useState<number | null>(null);

  // Form State (Support Create & Update)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tagName, setTagName] = useState<string>('');
  const [tagSlug, setTagSlug] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Deletion Modal State
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    if (!deletingTag) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setDeletingTag(null); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); trigger?.focus(); };
  }, [deletingTag]);

  const loadTags = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await api.getAdminTags();
      setTags(list || []);
    } catch (err: any) {
      setErrorMsg(err.message || '加载标签失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const resetForm = () => {
    setEditingId(null);
    setTagName('');
    setTagSlug('');
  };

  const handleEditClick = (t: Tag) => {
    setEditingId(t.id);
    setTagName(t.name);
    setTagSlug(t.slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopySlug = (id: number, slugStr: string) => {
    navigator.clipboard.writeText(slugStr).then(() => {
      setCopiedSlugId(id);
      setTimeout(() => setCopiedSlugId(null), 2000);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) {
      setErrorMsg('请输入标签名称');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (editingId) {
        await api.updateTag(editingId, tagName.trim(), tagSlug.trim() || undefined);
        setSuccessMsg(`✨ 标签 #${tagName.trim()} 修改成功！`);
      } else {
        await api.createTag(tagName.trim(), tagSlug.trim() || undefined);
        setSuccessMsg(`✨ 标签 #${tagName.trim()} 创建成功！`);
      }
      resetForm();
      loadTags();
    } catch (err: any) {
      setErrorMsg(err.message || '保存标签失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTag) return;
    setIsDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.deleteTag(deletingTag.id, (deletingTag.doc_count ?? 0) > 0);
      setSuccessMsg(`🗑️ 标签 #${deletingTag.name} 已彻底删除！`);
      if (editingId === deletingTag.id) {
        resetForm();
      }
      setDeletingTag(null);
      loadTags();
    } catch (err: any) {
      setErrorMsg(err.message || '删除标签失败');
    } finally {
      setIsDeleting(false);
    }
  };

  // Stats calculation
  const totalTags = tags.length;
  const activeTagsCount = useMemo(() => tags.filter((t) => (t.doc_count ?? 0) > 0).length, [tags]);
  const totalDocReferences = useMemo(() => tags.reduce((acc, cur) => acc + (cur.doc_count || 0), 0), [tags]);

  // Filter tags by search query
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const q = searchQuery.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
  }, [tags, searchQuery]);

  return (
    <div className="space-y-5 py-1">
      <AdminPageHeader
        icon={TagIcon}
        title="标签管理"
        description="创建与维护用于组织、筛选以及多维度关联知识库内容的技术标签。"
      />

      {/* Top Metric Stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="admin-surface p-4">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span className="font-semibold">标签总数</span>
            <TagIcon className="h-4 w-4 text-brand" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-text-primary">
            {loading ? '…' : totalTags} <span className="text-xs font-medium text-text-tertiary">个</span>
          </div>
        </div>

        <div className="admin-surface p-4">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span className="font-semibold">活跃使用中</span>
            <Sparkles className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-text-primary">
            {loading ? '…' : activeTagsCount} <span className="text-xs font-medium text-text-tertiary">个</span>
          </div>
        </div>

        <div className="admin-surface p-4">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span className="font-semibold">未关联标签</span>
            <Layers className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-text-primary">
            {loading ? '…' : totalTags - activeTagsCount} <span className="text-xs font-medium text-text-tertiary">个</span>
          </div>
        </div>

        <div className="admin-surface p-4">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span className="font-semibold">累计引用次数</span>
            <BookOpen className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-text-primary">
            {loading ? '…' : totalDocReferences} <span className="text-xs font-medium text-text-tertiary">次</span>
          </div>
        </div>
      </section>

      {/* Notifications */}
      {errorMsg && (
        <div className="flex items-center space-x-2.5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center space-x-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {/* Left Form Panel */}
        <section className="admin-surface h-fit space-y-5 p-5">
          <div className="flex items-center justify-between border-b border-border-subtle/80 pb-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand font-bold text-xs">
                {editingId ? <Edit className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </div>
              <h2 className="text-sm font-bold text-text-primary">
                {editingId ? '编辑标签' : '新建标签'}
              </h2>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-brand hover:text-brand-hover font-semibold transition"
              >
                + 转为新建
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="tag-name" className="text-xs font-semibold text-text-secondary">
                标签名称 <span className="text-red-500">*</span>
              </label>
              <input
                id="tag-name"
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="例如: Golang / React / 算法"
                className="min-h-10 w-full rounded-xl border border-border-default/80 bg-surface px-3.5 text-sm font-medium text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="tag-slug" className="text-xs font-semibold text-text-secondary">URL Slug</label>
                <span className="text-[11px] text-text-tertiary">留空自动生成</span>
              </div>
              <input
                id="tag-slug"
                type="text"
                value={tagSlug}
                onChange={(e) => setTagSlug(e.target.value)}
                placeholder="golang"
                className="min-h-10 w-full rounded-xl border border-border-default/80 bg-surface px-3.5 font-mono text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                variant="primary"
                className="flex-1"
              >
                {submitting ? '保存中…' : editingId ? '保存标签修改' : '确认添加标签'}
              </Button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 bg-surface hover:bg-surface-subtle border border-border-default/80 rounded-xl text-xs font-semibold text-text-secondary transition shadow-xs"
                >
                  取消
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Right Tag List Panel */}
        <section className="admin-surface flex min-w-0 self-start flex-col space-y-5 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle/80 pb-4">
            <div className="flex items-center space-x-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <TagIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">
                  已有标签库
                </h2>
                <p className="text-xs text-text-tertiary">
                  共 {tags.length} 个标签，点击文档数可跳转对应筛选列表
                </p>
              </div>
            </div>
          </div>

          {/* Search Toolbar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索标签名称或 Slug..."
              aria-label="搜索标签"
              className="min-h-10 w-full rounded-xl border border-border-default/80 bg-surface pl-9 pr-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {loading ? (
            <div className="animate-pulse py-20 text-center text-xs text-text-tertiary">加载标签列表中...</div>
          ) : filteredTags.length === 0 ? (
            <div className="space-y-3 rounded-2xl border border-dashed border-border-subtle/80 bg-surface/50 p-6 py-16 text-center text-xs text-text-tertiary">
              <TagIcon className="mx-auto h-10 w-10 text-text-tertiary/40" />
              <div>
                <p className="font-semibold text-text-primary">
                  {searchQuery ? '未找到匹配的标签' : '暂无标签'}
                </p>
                <p className="mt-1 text-xs text-text-tertiary">
                  {searchQuery ? '请尝试更换关键词' : '请在左侧表单中创建您的第一个标签'}
                </p>
              </div>
            </div>
          ) : (
            <div className="admin-table-shell">
              <div className="hidden min-h-9 grid-cols-[minmax(7.5rem,1fr)_minmax(9rem,1.35fr)_7.25rem_5.75rem_7.5rem] items-center gap-x-3 border-b border-border-subtle/80 bg-surface-subtle/70 px-3.5 py-2 text-[11px] font-semibold leading-4 text-text-tertiary xl:grid">
                <span>标签名称</span>
                <span>URL Slug</span>
                <span>创建时间</span>
                <span className="text-center">关联文档</span>
                <span className="text-right">操作</span>
              </div>

              <div className="max-h-[min(56vh,34rem)] divide-y divide-border-subtle/80 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
                {filteredTags.map((t) => (
                  <div
                    key={t.id}
                    className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3.5 py-2.5 transition-colors hover:bg-brand/5 xl:min-h-14 xl:grid-cols-[minmax(7.5rem,1fr)_minmax(9rem,1.35fr)_7.25rem_5.75rem_7.5rem]"
                  >
                    <span className="min-w-0 whitespace-normal break-words text-sm font-bold leading-5 text-brand xl:col-start-1 xl:row-start-1">
                      #{t.name}
                    </span>

                    <Link
                      to={`/wang/documents?tag=${encodeURIComponent(t.slug)}`}
                      className="col-start-2 row-start-1 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-blue-500/10 px-2 py-1 text-xs font-semibold text-brand transition hover:bg-blue-500/20 xl:col-start-4 xl:row-start-1 xl:justify-self-center"
                      title={`查看使用 #${t.name} 的文档`}
                    >
                      <BookOpen className="h-3 w-3" />
                      <span>{t.doc_count ?? 0} 篇</span>
                    </Link>

                    <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 xl:contents">
                      <button
                        type="button"
                        onClick={() => handleCopySlug(t.id, t.slug)}
                        className="inline-flex max-w-full items-center gap-1 rounded-md border border-border-subtle/80 bg-surface-subtle px-2 py-1 text-left font-mono text-[10px] leading-4 text-text-tertiary transition hover:border-brand/30 hover:bg-surface hover:text-brand xl:col-start-2 xl:row-start-1 xl:w-full xl:justify-between"
                        title="复制 Slug"
                      >
                        <span className="min-w-0 break-all">/{t.slug}</span>
                        {copiedSlugId === t.id ? (
                          <Check className="h-2.5 w-2.5 shrink-0 text-emerald-500" />
                        ) : (
                          <Copy className="h-2.5 w-2.5 shrink-0 opacity-60" />
                        )}
                      </button>

                      <div className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[11px] text-text-tertiary xl:col-start-3 xl:row-start-1">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span>
                          {t.created_at
                            ? new Date(t.created_at).toLocaleDateString('zh-CN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                              })
                            : '最近'}
                        </span>
                      </div>

                      <div className="ml-auto flex shrink-0 items-center justify-end gap-1 whitespace-nowrap xl:col-start-5 xl:row-start-1 xl:ml-0">
                        <button
                          type="button"
                          onClick={() => handleEditClick(t)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-text-secondary transition hover:bg-brand/10 hover:text-brand"
                          title="编辑标签"
                          aria-label={`编辑标签 ${t.name}`}
                        >
                          <Edit className="h-3 w-3" />
                          <span>编辑</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTag(t)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-text-tertiary transition hover:bg-red-500/10 hover:text-red-600"
                          title="删除标签"
                          aria-label={`删除标签 ${t.name}`}
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>删除</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingTag && (
        <ModalPortal>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-tag-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-surface-elevated border border-border-subtle rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="delete-tag-modal-title" className="text-base font-bold text-text-primary">
                  确认删除标签
                </h3>
                <p className="text-xs text-text-tertiary">此操作不可恢复</p>
              </div>
            </div>

            <div className="text-xs text-text-secondary bg-surface-subtle p-3.5 rounded-2xl border border-border-subtle/80 leading-relaxed">
              确定要删除标签「<strong className="text-text-primary">#{deletingTag.name}</strong>」吗？
              {(deletingTag.doc_count ?? 0) > 0 && (
                <div className="mt-2 text-amber-600 dark:text-amber-400 font-semibold">
                  ⚠️ 该标签当前被 {deletingTag.doc_count} 篇文档使用，删除后将自动解除关联。
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeletingTag(null)}
                className="px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-subtle rounded-xl border border-border-default/80 transition"
              >
                取消
              </button>
              <Button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                variant="danger"
              >
                {isDeleting ? '删除中...' : '确认删除'}
              </Button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};
