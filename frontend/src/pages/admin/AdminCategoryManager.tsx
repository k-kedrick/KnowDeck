import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderTree,
  Edit,
  Trash2,
  BookOpen,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Calendar,
} from 'lucide-react';
import { api } from '../../api';
import type { Category, CategorySaveReq } from '../../api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { Button } from '../../components/ui/Button';

interface CategoryTreeItemProps {
  category: Category;
  depth?: number;
  onEdit: (c: Category) => void;
  onDeleteRequest: (c: Category) => void;
}

const CategoryTreeItem: React.FC<CategoryTreeItemProps> = ({
  category,
  depth = 0,
  onEdit,
  onDeleteRequest,
}) => {
  const [expanded, setExpanded] = useState<boolean>(true);
  const hasChildren = category.children && category.children.length > 0;

  return (
    <div className="relative select-none">
      <div
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        className="group flex min-h-11 items-center justify-between border-b border-border-subtle py-2.5 pr-2 transition-colors hover:bg-surface-subtle"
      >
        <div className="flex items-center space-x-2 truncate">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition shrink-0"
              aria-label={`${expanded ? '折叠' : '展开'}分类 ${category.name}`}
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-4 h-4 shrink-0" />
          )}

          {expanded ? (
            <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
          )}

          <div className="flex items-center space-x-2 truncate">
            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{category.name}</span>
            <span className="text-[10px] font-mono text-slate-400 shrink-0">/{category.slug}</span>
            {category.doc_count !== undefined && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 text-[10px] rounded-full font-semibold shrink-0">
                {category.doc_count} 篇文档
              </span>
            )}
            {category.created_at && (
              <span className="hidden sm:inline-flex items-center space-x-1 text-[10px] text-slate-400 font-mono shrink-0 ml-1">
                <Calendar className="w-3 h-3 text-emerald-500" />
                <span>
                  {new Date(category.created_at).toLocaleDateString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <button
            type="button"
            onClick={() => onEdit(category)}
            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition"
            title="编辑分类"
            aria-label={`编辑分类 ${category.name}`}
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteRequest(category)}
            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
            title="删除分类"
            aria-label={`删除分类 ${category.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subcategories Rendering */}
      {expanded && hasChildren && (
        <div className="space-y-1">
          {category.children!.map((child) => (
            <CategoryTreeItem
              key={`cat-tree-${child.id}`}
              category={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDeleteRequest={onDeleteRequest}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const flattenCategoryTree = (nodes: Category[]): Category[] => {
  let result: Category[] = [];
  nodes.forEach((node) => {
    result.push(node);
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenCategoryTree(node.children));
    }
  });
  return result;
};

export const AdminCategoryManager: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [flatCategories, setFlatCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [icon, setIcon] = useState<string>('BookOpen');
  const [parentId, setParentId] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Deletion Modal State
  const [deletingCat, setDeletingCat] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  useEffect(() => {
    if (!deletingCat) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setDeletingCat(null); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); trigger?.focus(); };
  }, [deletingCat]);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const tree = await api.getAdminCategories();
      setCategories(tree || []);
      setFlatCategories(flattenCategoryTree(tree || []));
    } catch (err: any) {
      setErrorMsg(err.message || '加载分类列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setSlug('');
    setDescription('');
    setIcon('BookOpen');
    setParentId(0);
    setSortOrder(1);
  };

  const handleEditClick = (c: Category) => {
    setEditingId(c.id);
    setName(c.name);
    setSlug(c.slug);
    setDescription(c.description || '');
    setIcon(c.icon || 'BookOpen');
    setParentId(c.parent_id || 0);
    setSortOrder(c.sort_order || 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('分类名称不能为空');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload: CategorySaveReq = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      description: description.trim(),
      icon: icon.trim() || 'BookOpen',
      parent_id: parentId,
      sort_order: sortOrder,
    };

    try {
      if (editingId) {
        await api.updateCategory(editingId, payload);
        setSuccessMsg(`✨ 分类《${name.trim()}》已成功更新！`);
      } else {
        await api.createCategory(payload);
        setSuccessMsg(`✨ 分类《${name.trim()}》已成功创建！`);
      }
      resetForm();
      loadCategories();
    } catch (err: any) {
      setErrorMsg(err.message || '保存分类失败');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCat) return;

    setDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await api.deleteCategory(deletingCat.id);
      setSuccessMsg(`🗑️ 已成功删除分类《${deletingCat.name}》！`);
      if (editingId === deletingCat.id) {
        resetForm();
      }
      setDeletingCat(null);
      await loadCategories();
    } catch (err: any) {
      setErrorMsg(err.message || '删除分类失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={FolderTree} title="分类管理" description="维护知识库分类层级、Slug、排序与前台导航结构。" />

      {/* Notifications Banner */}
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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[21rem_minmax(0,1fr)]">
        {/* Left Form Panel */}
        <section className="h-fit space-y-4 border-t border-border-subtle pt-4">
          <h2 className="flex items-center justify-between text-sm font-bold text-text-primary">
            <span>{editingId ? '编辑分类' : '新建分类'}</span>
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
              <label htmlFor="category-name" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                分类名称 <span className="text-red-500">*</span>
              </label>
              <input
                id="category-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如: 使用指南"
                className="min-h-10 w-full rounded-ds-md border border-border-default bg-surface px-3 text-sm font-semibold text-text-primary outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="category-slug" className="text-xs font-semibold text-slate-700 dark:text-slate-300">URL Slug</label>
              <input
                id="category-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="guide (留空自动生成)"
                className="min-h-10 w-full rounded-ds-md border border-border-default bg-surface px-3 font-mono text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="category-parent" className="text-xs font-semibold text-slate-700 dark:text-slate-300">父分类 (Parent)</label>
              <select
                id="category-parent"
                value={parentId}
                onChange={(e) => setParentId(Number(e.target.value))}
                className="min-h-10 w-full rounded-ds-md border border-border-default bg-surface px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand"
              >
                <option value={0}>无 (作为顶级分类)</option>
                {flatCategories
                  .filter((c) => c.id !== editingId)
                  .map((c) => (
                    <option key={`opt-${c.id}`} value={c.id}>
                      {c.parent_id ? '  └ ' : ''}
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="category-sort" className="text-xs font-semibold text-slate-700 dark:text-slate-300">排序权重 (越小越靠前)</label>
              <input
                id="category-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="min-h-10 w-full rounded-ds-md border border-border-default bg-surface px-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="category-description" className="text-xs font-semibold text-slate-700 dark:text-slate-300">描述</label>
              <textarea
                id="category-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="分类简要说明..."
                rows={2}
                className="w-full rounded-ds-md border border-border-default bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                variant="primary"
                className="flex-1"
              >
                {submitting ? '提交中...' : editingId ? '保存修改' : '创建分类'}
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

        {/* Right Category Tree List Panel */}
        <section className="flex min-w-0 flex-col border-t border-border-subtle pt-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3 text-xs font-bold text-text-secondary">
            <span className="flex items-center space-x-2">
              <FolderTree className="w-4 h-4 text-blue-500" />
              <span>全部分类树状列表 ({flatCategories.length} 个分类)</span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <div className="text-center py-12 text-xs text-slate-400 animate-pulse">
                加载分类树中...
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 space-y-2">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                <div>暂无分类，请在左侧创建第一个分类</div>
              </div>
            ) : (
              categories.map((c) => (
                <CategoryTreeItem
                  key={`cat-root-${c.id}`}
                  category={c}
                  onEdit={handleEditClick}
                  onDeleteRequest={(targetCat) => setDeletingCat(targetCat)}
                />
              ))
            )}
          </div>
        </section>
      </div>

      {/* 🌟 100% 可靠的反阻断分类删除确认弹窗 (Inline Modal) */}
      {deletingCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-category-title" className="w-full max-w-md space-y-4 rounded-ds-lg border border-border-default bg-surface-elevated p-6 shadow-modal">
            <div className="flex items-center space-x-3 text-red-600 dark:text-red-400 border-b border-slate-100 dark:border-slate-700 pb-3">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h3 id="delete-category-title" className="text-sm font-bold text-text-primary">
                确认删除分类《{deletingCat.name}》？
              </h3>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <p>删除分类后，系统将执行以下安全处理：</p>
              <ul className="list-disc pl-4 space-y-1 text-slate-500 dark:text-slate-400">
                <li>关联的文档将自动变更为<strong>未分类 (顶级文档)</strong>，数据绝不会被抹除。</li>
                <li>所属的子分类将自动提升为<strong>顶级分类</strong>，结构安全保留。</li>
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCat(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDeleteCategory}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-bold shadow transition disabled:opacity-50"
              >
                {deleting ? '正在删除...' : '确认删除分类'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
