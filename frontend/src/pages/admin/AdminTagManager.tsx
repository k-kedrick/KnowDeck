import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Tag as TagIcon,
  Plus,
  Trash2,
  Edit,
  AlertCircle,
  CheckCircle,
  Calendar,
} from 'lucide-react';
import { api } from '../../api';
import type { Tag } from '../../api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { Button } from '../../components/ui/Button';

export const AdminTagManager: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={TagIcon} title="标签管理" description="创建和维护用于组织、筛选文档的内容标签。" />

      {/* Notifications */}
      {errorMsg && (
        <div className="flex items-center space-x-2 rounded-ds-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center space-x-2 rounded-ds-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-600">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* Left Form Panel */}
        <section className="h-fit space-y-4 border-t border-border-subtle pt-4">
          <h2 className="flex items-center justify-between text-sm font-bold text-text-primary">
            <span>{editingId ? '编辑标签' : '新建标签'}</span>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-normal"
              >
                + 转为新建模式
              </button>
            )}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="tag-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                标签名称 <span className="text-red-500">*</span>
              </label>
              <input
                id="tag-name"
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="例如: Go语言"
                className="min-h-10 w-full rounded-ds-md border border-border-default bg-surface px-3 text-sm font-semibold text-text-primary outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="tag-slug" className="text-xs font-semibold text-slate-700 dark:text-slate-300">URL Slug</label>
              <input
                id="tag-slug"
                type="text"
                value={tagSlug}
                onChange={(e) => setTagSlug(e.target.value)}
                placeholder="golang (留空自动生成)"
                className="min-h-10 w-full rounded-ds-md border border-border-default bg-surface px-3 font-mono text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                variant="primary"
                className="flex-1"
              >
                <Plus className="w-4 h-4" />
                <span>{submitting ? '保存中...' : editingId ? '保存标签修改' : '添加新标签'}</span>
              </Button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 transition"
                >
                  取消
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Right Tag List Panel */}
        <section className="min-w-0 space-y-4 border-t border-border-subtle pt-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <h2 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-2">
              <TagIcon className="w-4 h-4 text-blue-500" />
              <span>已有标签列表 ({tags.length} 个)</span>
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-12 text-xs text-slate-400 animate-pulse">加载标签列表中...</div>
          ) : tags.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">暂无标签，请在左侧添加</div>
          ) : (
            <div className="grid grid-cols-1 gap-x-6 xl:grid-cols-2">
              {tags.map((t) => (
                <div
                  key={t.id}
                  className="flex min-w-0 items-center justify-between border-b border-border-subtle px-1 py-3 transition-colors hover:bg-surface-subtle"
                >
                  <div className="space-y-1 min-w-0 pr-2">
                    <div className="flex items-center space-x-2 truncate">
                      <span className="font-bold text-xs text-blue-600 dark:text-blue-400 truncate">
                        #{t.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">/{t.slug}</span>
                      <Link
                        to={`/wang/documents?tag=${encodeURIComponent(t.slug)}`}
                        className="px-1.5 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-[10px] rounded font-semibold shrink-0 transition"
                        title={`查看使用 #${t.name} 的文档`}
                      >
                        {t.doc_count ?? 0} 篇
                      </Link>
                    </div>

                    {/* 🌟 Creation Time Display */}
                    <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-mono">
                      <Calendar className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span>
                        创建于{' '}
                        {t.created_at
                          ? new Date(t.created_at).toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '最近'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditClick(t)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition"
                      title="编辑标签"
                      aria-label={`编辑标签 ${t.name}`}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingTag(t)}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                      title="删除标签"
                      aria-label={`删除标签 ${t.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Deletion Confirm Modal */}
      {deletingTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-tag-title" className="w-full max-w-sm space-y-4 rounded-ds-lg border border-border-default bg-surface-elevated p-6 shadow-modal">
            <div className="flex items-center space-x-3 text-red-600 dark:text-red-400 border-b border-slate-100 dark:border-slate-700 pb-3">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h3 id="delete-tag-title" className="text-sm font-bold text-text-primary">
                确认删除标签 #{deletingTag.name}？
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {(deletingTag.doc_count ?? 0) > 0 ? (
                <>
                  标签 <strong className="text-slate-900 dark:text-white font-semibold">#{deletingTag.name}</strong>{' '}
                  关联了 <strong>{deletingTag.doc_count} 篇文档</strong>。删除后会解除这些标签关联，但不会删除文档内容。
                </>
              ) : (
                <>
                  标签 <strong className="text-slate-900 dark:text-white font-semibold">#{deletingTag.name}</strong>{' '}
                  尚未关联文档，可以安全删除。
                </>
              )}
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTag(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition disabled:opacity-50"
              >
                {isDeleting
                  ? '正在删除...'
                  : (deletingTag.doc_count ?? 0) > 0
                    ? '解除关联并删除'
                    : '删除标签'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
