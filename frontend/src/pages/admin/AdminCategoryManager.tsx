import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FolderTree,
  Edit,
  Trash2,
  BookOpen,
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Calendar,
  Layers,
  Search,
  Plus,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { api } from '../../api';
import type { Category, CategorySaveReq } from '../../api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { Button } from '../../components/ui/Button';

interface CategoryTreeItemProps {
  category: Category;
  depth?: number;
  onEdit: (c: Category) => void;
  onAddChild: (c: Category) => void;
  onDeleteRequest: (c: Category) => void;
  isExpanded?: boolean;
  onToggleExpand: (id: number) => void;
  copiedSlugId: number | null;
  onCopySlug: (id: number, slug: string) => void;
}

const CategoryTreeItem: React.FC<CategoryTreeItemProps> = ({
  category,
  depth = 0,
  onEdit,
  onAddChild,
  onDeleteRequest,
  isExpanded = true,
  onToggleExpand,
  copiedSlugId,
  onCopySlug,
}) => {
  const hasChildren = category.children && category.children.length > 0;

  return (
    <div className="relative select-none">
      {/* Indentation guide line */}
      {depth > 0 && (
        <div
          style={{ left: `${(depth - 1) * 24 + 18}px` }}
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-border-subtle/80"
          aria-hidden="true"
        />
      )}

      <div
        style={{ marginLeft: `${depth * 24}px` }}
        className="group relative my-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl border border-border-subtle/90 bg-surface-elevated/95 p-3.5 backdrop-blur-md shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
      >
        <div className="flex min-w-0 items-center space-x-3 truncate">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggleExpand(category.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-tertiary transition hover:bg-surface-subtle hover:text-text-primary"
              aria-label={`${isExpanded ? '折叠' : '展开'}分类 ${category.name}`}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-border-default" />
            </div>
          )}

          {/* Folder Icon Badge */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-xs shadow-amber-500/10 transition-transform group-hover:scale-105">
            {isExpanded && hasChildren ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
          </div>

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sm text-text-primary truncate">{category.name}</span>
              
              {/* Slug Pill */}
              <button
                type="button"
                onClick={() => onCopySlug(category.id, category.slug)}
                className="inline-flex items-center gap-1 rounded-md border border-border-subtle/80 bg-surface px-1.5 py-0.5 font-mono text-[11px] text-text-tertiary transition hover:border-brand/30 hover:text-brand"
                title="点击复制 URL Slug"
              >
                <span>/{category.slug}</span>
                {copiedSlugId === category.id ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
                )}
              </button>

              {/* Sort Order Badge */}
              <span className="inline-flex items-center rounded-md bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
                排序: {category.sort_order ?? 1}
              </span>
            </div>

            {category.description && (
              <p className="text-xs text-text-tertiary line-clamp-1 truncate max-w-md">
                {category.description}
              </p>
            )}
          </div>
        </div>

        {/* Right Info Badges & Action Buttons */}
        <div className="flex shrink-0 items-center justify-between sm:justify-end gap-3 pl-10 sm:pl-0">
          <div className="flex items-center gap-2">
            {/* Document Count Badge */}
            <span className="inline-flex items-center gap-1 rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-brand">
              <BookOpen className="h-3 w-3" />
              <span>{category.doc_count ?? 0} 篇文档</span>
            </span>

            {/* Subcategory Count */}
            {hasChildren && (
              <span className="hidden md:inline-flex items-center gap-1 rounded-lg border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[11px] font-medium text-purple-700 dark:text-purple-300">
                <Layers className="h-3 w-3" />
                <span>{category.children!.length} 个子分类</span>
              </span>
            )}

            {/* Creation Date */}
            {category.created_at && (
              <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-text-tertiary font-mono">
                <Calendar className="h-3 w-3 text-emerald-500" />
                <span>
                  {new Date(category.created_at).toLocaleDateString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </span>
              </span>
            )}
          </div>

          {/* Action Button Group */}
          <div className="flex items-center space-x-1 border-l border-border-subtle/80 pl-2">
            <button
              type="button"
              onClick={() => onAddChild(category)}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-text-secondary transition hover:bg-brand/10 hover:text-brand"
              title="在此分类下添加子分类"
              aria-label={`为 ${category.name} 添加子分类`}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span className="hidden xl:inline text-[11px]">加子类</span>
            </button>
            <button
              type="button"
              onClick={() => onEdit(category)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition hover:bg-brand/10 hover:text-brand"
              title="编辑分类"
              aria-label={`编辑分类 ${category.name}`}
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteRequest(category)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition hover:bg-red-500/10 hover:text-red-600"
              title="删除分类"
              aria-label={`删除分类 ${category.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Subcategories Rendering */}
      {isExpanded && hasChildren && (
        <div className="space-y-1">
          {category.children!.map((child) => (
            <CategoryTreeItem
              key={`cat-tree-${child.id}`}
              category={child}
              depth={depth + 1}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDeleteRequest={onDeleteRequest}
              isExpanded={isExpanded}
              onToggleExpand={onToggleExpand}
              copiedSlugId={copiedSlugId}
              onCopySlug={onCopySlug}
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [copiedSlugId, setCopiedSlugId] = useState<number | null>(null);

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
      const flat = flattenCategoryTree(tree || []);
      setFlatCategories(flat);
      // Expand all by default
      setExpandedIds(new Set(flat.map((c) => c.id)));
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddChildClick = (parentCategory: Category) => {
    setEditingId(null);
    setName('');
    setSlug('');
    setDescription('');
    setIcon('BookOpen');
    setParentId(parentCategory.id);
    setSortOrder((parentCategory.children?.length ?? 0) + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setExpandedIds(new Set(flatCategories.map((c) => c.id)));
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleCopySlug = (id: number, slugStr: string) => {
    navigator.clipboard.writeText(slugStr).then(() => {
      setCopiedSlugId(id);
      setTimeout(() => setCopiedSlugId(null), 2000);
    });
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
      await loadCategories();
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

  // Metrics calculation
  const totalCategories = flatCategories.length;
  const topLevelCategories = categories.length;
  const subCategoriesCount = totalCategories - topLevelCategories;
  const totalAssociatedDocs = useMemo(() => {
    return flatCategories.reduce((acc, cur) => acc + (cur.doc_count || 0), 0);
  }, [flatCategories]);

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    const filterTree = (nodes: Category[]): Category[] => {
      const res: Category[] = [];
      for (const node of nodes) {
        const matchesSelf = node.name.toLowerCase().includes(q) || node.slug.toLowerCase().includes(q);
        const matchingChildren = node.children ? filterTree(node.children) : [];
        if (matchesSelf || matchingChildren.length > 0) {
          res.push({
            ...node,
            children: matchingChildren.length > 0 ? matchingChildren : node.children,
          });
        }
      }
      return res;
    };
    return filterTree(categories);
  }, [categories, searchQuery]);

  return (
    <div className="space-y-6 py-2">
      <AdminPageHeader
        icon={FolderTree}
        title="分类管理"
        description="维护知识库多层级分类、Slug、排序权重及前台导航呈现结构。"
        actions={
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-brand-hover px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-brand/20 transition-all hover:shadow-lg hover:shadow-brand/30 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>新建分类</span>
          </button>
        }
      />

      {/* Top Metric Stats Grid */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border-subtle/80 bg-surface-elevated/90 p-4 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span className="font-semibold">分类总数</span>
            <FolderTree className="h-4 w-4 text-brand" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-text-primary">
            {loading ? '…' : totalCategories} <span className="text-xs font-medium text-text-tertiary">个</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle/80 bg-surface-elevated/90 p-4 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span className="font-semibold">一级分类</span>
            <Folder className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-text-primary">
            {loading ? '…' : topLevelCategories} <span className="text-xs font-medium text-text-tertiary">个</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle/80 bg-surface-elevated/90 p-4 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span className="font-semibold">多级子分类</span>
            <Layers className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-text-primary">
            {loading ? '…' : subCategoriesCount} <span className="text-xs font-medium text-text-tertiary">个</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle/80 bg-surface-elevated/90 p-4 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span className="font-semibold">关联文档</span>
            <BookOpen className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-text-primary">
            {loading ? '…' : totalAssociatedDocs} <span className="text-xs font-medium text-text-tertiary">篇</span>
          </div>
        </div>
      </section>

      {/* Notifications Banner */}
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

      {/* Main Dual-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
        {/* Left Form Panel */}
        <section className="h-fit rounded-3xl border border-border-subtle/80 bg-surface-elevated/90 p-6 backdrop-blur-xl shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-border-subtle/80 pb-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand font-bold text-xs">
                {editingId ? <Edit className="h-3.5 w-3.5" /> : <FolderPlus className="h-3.5 w-3.5" />}
              </div>
              <h2 className="text-sm font-bold text-text-primary">
                {editingId ? '编辑分类属性' : '创建新分类'}
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
              <label htmlFor="category-name" className="text-xs font-semibold text-text-secondary">
                分类名称 <span className="text-red-500">*</span>
              </label>
              <input
                id="category-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如: 使用教程 / 后端架构"
                className="min-h-10 w-full rounded-xl border border-border-default/80 bg-surface px-3.5 text-sm font-medium text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="category-slug" className="text-xs font-semibold text-text-secondary">URL Slug</label>
                <span className="text-[11px] text-text-tertiary">用于前台路由访问</span>
              </div>
              <input
                id="category-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="例如: guide (留空自动拼音/英文转换)"
                className="min-h-10 w-full rounded-xl border border-border-default/80 bg-surface px-3.5 font-mono text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="category-parent" className="text-xs font-semibold text-text-secondary">父级分类 (Parent)</label>
                {parentId > 0 && (
                  <button
                    type="button"
                    onClick={() => setParentId(0)}
                    className="text-[11px] text-brand hover:underline font-medium"
                  >
                    设为顶级
                  </button>
                )}
              </div>
              <select
                id="category-parent"
                value={parentId}
                onChange={(e) => setParentId(Number(e.target.value))}
                className="min-h-10 w-full rounded-xl border border-border-default/80 bg-surface px-3.5 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value={0}>无 (作为一级根分类)</option>
                {flatCategories
                  .filter((c) => c.id !== editingId)
                  .map((c) => (
                    <option key={`opt-${c.id}`} value={c.id}>
                      {c.parent_id ? '  └ ' : ''}
                      {c.name} (/{c.slug})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="category-sort" className="text-xs font-semibold text-text-secondary">排序权重 (越小越靠前)</label>
              <input
                id="category-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="min-h-10 w-full rounded-xl border border-border-default/80 bg-surface px-3.5 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="category-description" className="text-xs font-semibold text-text-secondary">分类说明与描述</label>
              <textarea
                id="category-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简短描述该分类包含的技术主题与文档..."
                rows={3}
                className="w-full rounded-xl border border-border-default/80 bg-surface px-3.5 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                variant="primary"
                className="flex-1"
              >
                {submitting ? '保存中…' : editingId ? '保存分类修改' : '确认创建分类'}
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

        {/* Right Category Tree List Panel */}
        <section className="flex min-w-0 flex-col rounded-3xl border border-border-subtle/80 bg-surface-elevated/90 p-6 backdrop-blur-xl shadow-xs space-y-5">
          {/* Header Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle/80 pb-4">
            <div className="flex items-center space-x-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <FolderTree className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">
                  全部分类树状结构
                </h2>
                <p className="text-xs text-text-tertiary">
                  共 {totalCategories} 个分类，支持多级树形嵌套与快速复制
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExpandAll}
                className="inline-flex items-center gap-1 rounded-xl border border-border-default/80 bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                <span>全部展开</span>
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="inline-flex items-center gap-1 rounded-xl border border-border-default/80 bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                <span>全部折叠</span>
              </button>
            </div>
          </div>

          {/* Search Toolbar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索分类名称或 Slug..."
              aria-label="搜索分类"
              className="min-h-10 w-full rounded-xl border border-border-default/80 bg-surface pl-9 pr-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {/* Tree Node List Container */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {loading ? (
              <div className="text-center py-20 text-xs text-text-tertiary animate-pulse">
                加载分类树中...
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="text-center py-16 text-xs text-text-tertiary space-y-3 rounded-2xl border border-dashed border-border-subtle/80 bg-surface/50 p-6">
                <BookOpen className="w-10 h-10 text-text-tertiary/40 mx-auto" />
                <div>
                  <p className="font-semibold text-text-primary">
                    {searchQuery ? '未找到匹配的分类' : '暂无分类'}
                  </p>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {searchQuery ? '请尝试更换搜索关键字' : '请在左侧表单中创建您的第一个分类'}
                  </p>
                </div>
              </div>
            ) : (
              filteredCategories.map((c) => (
                <CategoryTreeItem
                  key={`cat-root-${c.id}`}
                  category={c}
                  onEdit={handleEditClick}
                  onAddChild={handleAddChildClick}
                  onDeleteRequest={(targetCat) => setDeletingCat(targetCat)}
                  isExpanded={expandedIds.has(c.id)}
                  onToggleExpand={handleToggleExpand}
                  copiedSlugId={copiedSlugId}
                  onCopySlug={handleCopySlug}
                />
              ))
            )}
          </div>

          {/* Bottom Helpful Architecture Guide Card */}
          <div className="rounded-2xl border border-border-subtle/80 bg-gradient-to-br from-brand/5 via-surface to-indigo-500/5 p-4.5 text-xs text-text-secondary space-y-2">
            <div className="flex items-center gap-2 font-bold text-text-primary">
              <Sparkles className="h-4 w-4 text-brand" />
              <span>知识库分类架构设计建议</span>
            </div>
            <ul className="space-y-1 text-text-tertiary list-disc list-inside leading-relaxed text-[11px]">
              <li>建议保持分类层级在 1~3 层以内，过深的层级会增加访客的查找成本；</li>
              <li>分类侧重于**宏观知识体系划分**（如「使用教程」、「API规范」），具体细分内容可结合**标签**进行多维归类；</li>
              <li>点击分类卡片上的 Slug 标签可一键复制路径，便于在前台链接中引用。</li>
            </ul>
          </div>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingCat && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-category-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-surface-elevated border border-border-subtle rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="delete-category-modal-title" className="text-base font-bold text-text-primary">
                  确认删除分类
                </h3>
                <p className="text-xs text-text-tertiary">此操作将移除该分类</p>
              </div>
            </div>

            <div className="text-xs text-text-secondary bg-surface-subtle p-3.5 rounded-2xl border border-border-subtle/80 leading-relaxed">
              确定要删除分类《<strong className="text-text-primary">{deletingCat.name}</strong>》吗？
              {deletingCat.children && deletingCat.children.length > 0 && (
                <div className="mt-2 text-red-500 font-semibold">
                  ⚠️ 注意：该分类下包含 {deletingCat.children.length} 个子分类，删除可能导致层级结构变更。
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setDeletingCat(null)}
                className="px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-subtle rounded-xl border border-border-default/80 transition"
              >
                取消
              </button>
              <Button
                type="button"
                onClick={confirmDeleteCategory}
                disabled={deleting}
                variant="danger"
              >
                {deleting ? '删除中...' : '确认删除'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
