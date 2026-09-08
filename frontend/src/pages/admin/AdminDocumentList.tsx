import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  FileText,
  Eye,
  Edit,
  Trash2,
  Pin,
  CheckCircle,
  Clock,
  Calendar,
  Archive,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../api';
import type { DocumentListItem, Category, Tag } from '../../api';
import {
  createNewDocumentDraftPath,
  DRAFT_STORAGE_EVENT,
  listLocalDrafts,
  removeLocalDraft,
} from '../../hooks/useDocumentDraft';
import type { LocalDraftEntry } from '../../hooks/useDocumentDraft';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { Button } from '../../components/ui/Button';

export const AdminDocumentList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [localDrafts, setLocalDrafts] = useState<LocalDraftEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);

  const [keyword, setKeyword] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<number>(0);
  const tagFilter = searchParams.get('tag') || '';

  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshLocalDrafts = useCallback(() => {
    setLocalDrafts(listLocalDrafts().filter((entry) => entry.kind === 'new'));
  }, []);

  useEffect(() => {
    queueMicrotask(refreshLocalDrafts);
    window.addEventListener(DRAFT_STORAGE_EVENT, refreshLocalDrafts);
    window.addEventListener('storage', refreshLocalDrafts);
    return () => {
      window.removeEventListener(DRAFT_STORAGE_EVENT, refreshLocalDrafts);
      window.removeEventListener('storage', refreshLocalDrafts);
    };
  }, [refreshLocalDrafts]);

  const visibleLocalDrafts = useMemo(() => {
    if (statusFilter && statusFilter !== 'draft') return [];
    const normalizedKeyword = keyword.trim().toLocaleLowerCase();
    return localDrafts.filter((entry) => {
      const draft = entry.draft;
      if (normalizedKeyword && !`${draft.title} ${draft.excerpt} ${draft.content}`.toLocaleLowerCase().includes(normalizedKeyword)) return false;
      if (categoryFilter > 0 && draft.categoryId !== categoryFilter) return false;
      if (tagFilter) {
        const selectedTag = tags.find((tag) => tag.slug === tagFilter);
        if (!selectedTag || !draft.tags.some((tag) => tag.toLocaleLowerCase() === selectedTag.name.toLocaleLowerCase())) return false;
      }
      return true;
    });
  }, [categoryFilter, keyword, localDrafts, statusFilter, tagFilter, tags]);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await api.getAdminCategories();
      setCategories(cats || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }, []);

  const loadTags = useCallback(async () => {
    try {
      const list = await api.getAdminTags();
      setTags(list || []);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await api.getAdminDocuments({
        page,
        page_size: pageSize,
        keyword: keyword.trim() || undefined,
        status: statusFilter || undefined,
        category_id: categoryFilter > 0 ? categoryFilter : undefined,
        tag: tagFilter || undefined,
      });
      setDocuments(res.list || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setActionError(err.message || '加载文档列表失败');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, statusFilter, categoryFilter, tagFilter]);

  useEffect(() => {
    loadCategories();
    loadTags();
  }, [loadCategories, loadTags]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const [deletingDoc, setDeletingDoc] = useState<{ id: number; title: string } | null>(null);
  const [discardingLocalDraft, setDiscardingLocalDraft] = useState<LocalDraftEntry | null>(null);

  useEffect(() => {
    if (!deletingDoc && !discardingLocalDraft) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setDeletingDoc(null);
      setDiscardingLocalDraft(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); trigger?.focus(); };
  }, [deletingDoc, discardingLocalDraft]);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleConfirmDelete = async () => {
    if (!deletingDoc) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await api.deleteDocument(deletingDoc.id);
      setDeletingDoc(null);
      loadDocuments();
    } catch (err: any) {
      setActionError(err.message || '删除文档失败');
      setDeletingDoc(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (doc: DocumentListItem) => {
    const nextStatus = doc.status === 'published' ? 'draft' : 'published';
    try {
      await api.updateDocumentStatus(doc.id, nextStatus);
      loadDocuments();
    } catch (err: any) {
      alert(err.message || '更新状态失败');
    }
  };

  return (
    <div className="space-y-6 py-2">
      <AdminPageHeader
        icon={FileText}
        title="文档管理"
        description={`管理、筛选和发布知识库内容。当前共 ${total + visibleLocalDrafts.length} 篇文档。`}
        actions={(
          <Button variant="primary" onClick={() => navigate(createNewDocumentDraftPath())}>
            <Plus className="h-4 w-4" />新建文档
          </Button>
        )}
      />

      {/* Action Alerts */}
      {actionError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Filters Toolbar */}
      <section aria-label="文档筛选" className="rounded-2xl border border-border-subtle/80 bg-surface-elevated/80 p-4 shadow-xs backdrop-blur-md grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1.5fr)_repeat(3,minmax(10rem,1fr))_auto]">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-text-tertiary" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            placeholder="搜索文档标题或摘要..."
            aria-label="搜索文档"
            className="min-h-10 w-full rounded-xl border border-border-default/80 bg-surface pl-9 pr-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="按状态筛选"
          className="min-h-10 rounded-xl border border-border-default/80 bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        >
          <option value="">所有状态 (草稿 + 已发布)</option>
          <option value="published">已发布 (Published)</option>
          <option value="draft">草稿 (Draft)</option>
          <option value="archived">已归档 (Archived)</option>
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(Number(e.target.value));
            setPage(1);
          }}
          aria-label="按分类筛选"
          className="min-h-10 rounded-xl border border-border-default/80 bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        >
          <option value={0}>所有分类</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Tag Filter */}
        <select
          value={tagFilter}
          onChange={(e) => {
            const nextParams = new URLSearchParams(searchParams);
            if (e.target.value) {
              nextParams.set('tag', e.target.value);
            } else {
              nextParams.delete('tag');
            }
            setSearchParams(nextParams, { replace: true });
            setPage(1);
          }}
          className="min-h-10 rounded-xl border border-border-default/80 bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          aria-label="按标签筛选"
        >
          <option value="">所有标签</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.slug}>
              #{tag.name}（{tag.doc_count ?? 0}）
            </option>
          ))}
        </select>
        {(keyword || statusFilter || categoryFilter || tagFilter) && (
          <Button size="sm" variant="ghost" onClick={() => { setKeyword(''); setStatusFilter(''); setCategoryFilter(0); setSearchParams({}, { replace: true }); setPage(1); }}>
            清除筛选
          </Button>
        )}
      </section>

      {/* Documents Table */}
      <div className="overflow-hidden rounded-2xl border border-border-subtle/80 bg-surface-elevated/90 backdrop-blur-md shadow-xs" tabIndex={0} aria-label="文档列表，可横向滚动">
        <div className="overflow-x-auto">
          <table className="min-w-[70rem] w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-subtle/70 border-b border-border-subtle/80 text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                <th className="px-5 py-3.5">文档标题 / Slug</th>
                <th className="px-4 py-3.5">分类</th>
                <th className="px-4 py-3.5">状态与权限</th>
                <th className="px-4 py-3.5">浏览量</th>
                <th className="px-4 py-3.5">创建时间</th>
                <th className="px-4 py-3.5">最后更新</th>
                <th className="px-5 py-3.5 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-text-tertiary">
                    <div className="inline-flex items-center space-x-2">
                      <svg className="animate-spin h-4 w-4 text-brand" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>加载文档列表中...</span>
                    </div>
                  </td>
                </tr>
              ) : documents.length === 0 && visibleLocalDrafts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-text-tertiary">
                    暂无匹配文档
                  </td>
                </tr>
              ) : (
                <>
                {visibleLocalDrafts.map((entry) => (
                  <tr key={entry.key} className="bg-blue-50/30 hover:bg-blue-50/60 dark:bg-blue-950/20 dark:hover:bg-blue-950/35 transition-colors">
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="font-semibold text-text-primary truncate">
                        {entry.draft.title.trim() || '未命名文档'}
                      </div>
                      <div className="text-[11px] text-text-tertiary mt-0.5">尚未保存到服务器</div>
                    </td>
                    <td className="px-4 py-3.5 text-text-secondary">
                      <span className="px-2.5 py-0.5 bg-surface-subtle border border-border-subtle/80 rounded-lg text-[11px] font-medium">
                        {categories.find((category) => category.id === entry.draft.categoryId)?.name || '未分类'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-blue-500/10 text-brand border border-blue-500/20 rounded-lg text-[11px] font-medium">
                        <Clock className="w-3 h-3" />
                        <span>本地草稿</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-text-tertiary">—</td>
                    <td className="px-4 py-3.5 text-text-tertiary">—</td>
                    <td className="px-4 py-3.5 text-text-secondary text-[11px] font-mono whitespace-nowrap">
                      {new Date(entry.draft.updatedAt).toLocaleString('zh-CN', {
                        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => navigate(createNewDocumentDraftPath(entry.draft.localDraftId))}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-surface hover:bg-surface-subtle border border-border-default/80 text-text-primary rounded-lg text-[11px] transition font-medium shadow-xs"
                      >
                        <Edit className="w-3 h-3 text-brand" />
                        <span>继续编辑</span>
                      </button>
                      <button
                        onClick={() => setDiscardingLocalDraft(entry)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-lg text-[11px] transition font-medium"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>放弃</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-brand/5 transition-colors">
                    {/* Title & Slug */}
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="flex items-center space-x-2">
                        {doc.is_pinned && (
                          <span title="已置顶">
                            <Pin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          </span>
                        )}
                        <span className="font-semibold text-text-primary truncate">
                          {doc.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-tertiary font-mono truncate mt-0.5">
                        /{doc.slug}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3.5 text-text-secondary">
                      <span className="px-2.5 py-0.5 bg-surface-subtle border border-border-subtle/80 rounded-lg text-[11px] font-medium">
                        {doc.category_name || '未分类'}
                      </span>
                    </td>

                    {/* Status & Access Level Badges */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {doc.status === 'published' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-[11px] font-medium">
                            <CheckCircle className="w-3 h-3" />
                            <span>已发布</span>
                          </span>
                        ) : doc.status === 'archived' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20 rounded-lg text-[11px] font-medium">
                            <Archive className="w-3 h-3" />
                            <span>已归档</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-lg text-[11px] font-medium">
                            <Clock className="w-3 h-3" />
                            <span>草稿</span>
                          </span>
                        )}
                        <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-medium border ${doc.access_level === 'authenticated' ? 'bg-blue-500/10 text-brand border-blue-500/20' : 'bg-surface-subtle text-text-tertiary border-border-subtle/80'}`}>{doc.access_level === 'authenticated' ? '登录可见' : '公开'}</span>
                      </div>
                    </td>

                    {/* Views */}
                    <td className="px-4 py-3.5 text-text-secondary font-mono">
                      <div className="flex items-center space-x-1 text-text-tertiary">
                        <Eye className="w-3.5 h-3.5" />
                        <span className="font-semibold text-text-primary">{doc.views}</span>
                      </div>
                    </td>

                    {/* Created At */}
                    <td className="px-4 py-3.5 text-text-secondary text-[11px] font-mono whitespace-nowrap">
                      <div className="flex items-center space-x-1.5 text-text-tertiary">
                        <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>
                          {doc.created_at
                            ? new Date(doc.created_at).toLocaleString('zh-CN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '未知时间'}
                        </span>
                      </div>
                    </td>

                    {/* Updated At */}
                    <td className="px-4 py-3.5 text-text-secondary text-[11px] font-mono whitespace-nowrap">
                      <div className="flex items-center space-x-1.5 text-text-tertiary">
                        <Clock className="w-3.5 h-3.5 text-brand shrink-0" />
                        <span>
                          {new Date(doc.updated_at).toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(doc)}
                        className="inline-flex items-center px-2 py-1 rounded-lg border border-border-default/80 bg-surface hover:bg-surface-subtle text-[11px] text-text-secondary hover:text-brand transition font-medium shadow-xs"
                        title={doc.status === 'published' ? '下架为草稿' : '发布文档'}
                      >
                        {doc.status === 'published' ? '下架' : '发布'}
                      </button>
                      <button
                        onClick={() => navigate(`/wang/documents/${doc.id}`)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-surface hover:bg-surface-subtle border border-border-default/80 text-text-primary rounded-lg text-[11px] transition font-medium shadow-xs"
                      >
                        <Edit className="w-3 h-3 text-brand" />
                        <span>编辑</span>
                      </button>
                      <button
                        onClick={() => setDeletingDoc({ id: doc.id, title: doc.title })}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-lg text-[11px] transition font-medium cursor-pointer"
                        title="彻底删除此文档"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>删除</span>
                      </button>
                    </td>
                  </tr>
                ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between pt-2 text-xs">
          <span className="text-text-tertiary">
            显示第 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} 条，共 {total} 条
          </span>
          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3.5 py-1.5 rounded-xl border border-border-default/80 bg-surface hover:bg-surface-subtle text-text-primary disabled:opacity-40 font-medium transition shadow-xs"
            >
              上一页
            </button>
            <span className="px-2 font-semibold text-text-primary">
              {page} / {Math.ceil(total / pageSize)}
            </span>
            <button
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => setPage(page + 1)}
              className="px-3.5 py-1.5 rounded-xl border border-border-default/80 bg-surface hover:bg-surface-subtle text-text-primary disabled:opacity-40 font-medium transition shadow-xs"
            >
              下一页
            </button>
          </div>
        </div>
      )}


      {/* React Custom Delete Modal */}
      {deletingDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-document-title" className="w-full max-w-sm space-y-4 rounded-ds-lg border border-border-default bg-surface-elevated p-6 shadow-modal">
            <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <h3 id="delete-document-title" className="text-base font-bold text-text-primary">确认彻底删除文档？</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              确定要彻底删除文档 <strong className="text-slate-900 dark:text-white font-semibold">《{deletingDoc.title}》</strong> 吗？删除后此操作无法撤销。
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingDoc(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow transition disabled:opacity-50"
              >
                {isDeleting ? '删除中...' : '确认彻底删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {discardingLocalDraft && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="discard-draft-title" className="w-full max-w-sm space-y-4 rounded-ds-lg border border-border-default bg-surface-elevated p-6 shadow-modal">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-6 h-6 flex-shrink-0 text-amber-500" />
              <h3 id="discard-draft-title" className="text-base font-bold text-text-primary">放弃本地草稿？</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              《{discardingLocalDraft.draft.title.trim() || '未命名文档'}》尚未保存到服务器，放弃后无法恢复。
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button type="button" onClick={() => setDiscardingLocalDraft(null)} className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition">
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  removeLocalDraft(discardingLocalDraft.key);
                  setDiscardingLocalDraft(null);
                  refreshLocalDrafts();
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition"
              >
                确认放弃
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
