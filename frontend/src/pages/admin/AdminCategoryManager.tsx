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
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { api } from '../../api';
import type { Category, CategorySaveReq } from '../../api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { ModalPortal } from '../../components/ModalPortal';
import { Button } from '../../components/ui/Button';

interface CategoryTreeItemProps {
  category: Category;
  depth?: number;
  onEdit: (c: Category) => void;
  onAddChild: (c: Category) => void;
  onDeleteRequest: (c: Category) => void;
  expandedIds: Set<number>;
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
  expandedIds,
  onToggleExpand,
  copiedSlugId,
  onCopySlug,
}) => {
  const hasChildren = category.children && category.children.length > 0;
  const isExpanded = expandedIds.has(category.id);

  return (
    <div className="relative select-none border-b border-border-subtle/80 last:border-b-0">
      {depth > 0 && (
        <div
          style={{ left: `${(depth - 1) * 20 + 18}px` }}
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-border-subtle/70"
          aria-hidden="true"
        />
      )}

      <div
        style={{ marginLeft: `${depth * 20}px` }}
        className="group relative px-4 py-2.5 transition-colors hover:bg-surface-subtle/65"
      >
        <div className="grid min-w-0 grid-cols-[1.5rem_1.5rem_minmax(0,1fr)] items-start gap-x-2 gap-y-1 sm:grid-cols-[1.5rem_1.5rem_minmax(0,1fr)_auto]">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggleExpand(category.id)}
              className="row-span-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-tertiary transition hover:bg-surface hover:text-text-primary"
              aria-label={`${isExpanded ? '折叠' : '展开'}分类 ${category.name}`}
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <div className="row-span-2 flex h-6 w-6 shrink-0 items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-border-default/80" />
            </div>
          )}

          <div className="row-span-2 flex h-6 w-6 shrink-0 items-center justify-center text-amber-600 dark:text-amber-400">
            {isExpanded && hasChildren ? <FolderOpen className="h-[18px] w-[18px]" /> : <Folder className="h-[18px] w-[18px]" />}
          </div>

          <span className="min-w-0 break-words pt-0.5 text-sm font-semibold leading-5 text-text-primary">
            {category.name}
          </span>

          <div className="col-span-3 flex flex-wrap items-center gap-1.5 pt-0.5 sm:col-span-1 sm:justify-end sm:pt-0">
            <span className="inline-flex h-6 whitespace-nowrap items-center gap-1 rounded-md bg-brand/10 px-2 text-xs font-medium text-brand">
              <BookOpen className="h-3 w-3" />
              <span>{category.doc_count ?? 0} 文档</span>
            </span>

            {hasChildren && (
              <span className="inline-flex h-6 whitespace-nowrap items-center gap-1 rounded-md bg-purple-500/10 px-2 text-xs font-medium text-purple-700 dark:text-purple-300">
                <Layers className="h-3 w-3" />
                <span>{category.children!.length} 子类</span>
              </span>
            )}

            <div className="flex items-center gap-1 pl-1">
              <button
                type="button"
                onClick={() => onAddChild(category)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition hover:bg-brand/10 hover:text-brand"
                title="在此分类下添加子分类"
                aria-label={`为 ${category.name} 添加子分类`}
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onEdit(category)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition hover:bg-brand/10 hover:text-brand"
                title="编辑分类"
                aria-label={`编辑分类 ${category.name}`}
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteRequest(category)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition hover:bg-red-500/10 hover:text-red-600"
                title="删除分类"
                aria-label={`删除分类 ${category.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="col-span-3 flex min-w-0 items-center gap-x-2 gap-y-1 pl-[3rem] text-xs leading-5 text-text-secondary sm:col-span-2 sm:col-start-3 sm:pl-0">
            <button
              type="button"
              onClick={() => onCopySlug(category.id, category.slug)}
              className="inline-flex min-w-0 max-w-full items-center gap-1 text-left text-xs text-text-secondary transition hover:text-brand"
              title="点击复制 URL Slug"
            >
              <span className="break-all">/{category.slug}</span>
              {copiedSlugId === category.id ? (
                <Check className="h-3 w-3 shrink-0 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
              )}
            </button>

            <span className="shrink-0 whitespace-nowrap text-xs text-text-secondary before:mr-2 before:text-border-default before:content-['·']">
              排序: {category.sort_order ?? 1}
            </span>

            {category.created_at && (
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-text-secondary before:mr-1 before:text-border-default before:content-['·']">
                <Calendar className="h-3 w-3 text-emerald-500" />
                {new Date(category.created_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
              </span>
            )}

            {category.description && (
              <p title={category.description} className="min-w-0 flex-1 truncate before:mr-2 before:text-border-default before:content-['·']">
                {category.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Subcategories Rendering */}
      {isExpanded && hasChildren && (
        <div className="border-t border-border-subtle/80">
          {category.children!.map((child) => (
            <CategoryTreeItem
              key={`cat-tree-${child.id}`}
              category={child}
              depth={depth + 1}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDeleteRequest={onDeleteRequest}
              expandedIds={expandedIds}
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
      // Keep the first level open by default so a large taxonomy stays scannable.
      setExpandedIds(new Set((tree || []).map((c) => c.id)));
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
  const visibleExpandedIds = useMemo(
    () => searchQuery.trim() ? new Set(flattenCategoryTree(filteredCategories).map((item) => item.id)) : expandedIds,
    [expandedIds, filteredCategories, searchQuery],
  );

  return (
    <div className="space-y-5 py-1">
      <AdminPageHeader
        icon={FolderTree}
        title="分类管理"
        description="维护知识库多层级分类、Slug、排序权重及前台导航呈现结构。"
      />

      {/* Top Metric Stats Grid */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="min-h-[78px] rounded-xl border border-border-subtle bg-surface-elevated px-4 py-3">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span className="font-semibold">分类总数</span>
            <FolderTree className="h-4 w-4 text-brand" />
          </div>
          <div className="mt-1.5 text-2xl font-extrabold leading-none text-text-primary">
            {loading ? '…' : totalCategories} <span className="text-xs font-medium text-text-tertiary">个</span>
          </div>
        </div>

        <div className="min-h-[78px] rounded-xl border border-border-subtle bg-surface-elevated px-4 py-3">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span className="font-semibold">一级分类</span>
            <Folder className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-1.5 text-2xl font-extrabold leading-none text-text-primary">
            {loading ? '…' : topLevelCategories} <span className="text-xs font-medium text-text-tertiary">个</span>
          </div>
        </div>

        <div className="min-h-[78px] rounded-xl border border-border-subtle bg-surface-elevated px-4 py-3">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span className="font-semibold">多级子分类</span>
            <Layers className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-1.5 text-2xl font-extrabold leading-none text-text-primary">
            {loading ? '…' : subCategoriesCount} <span className="text-xs font-medium text-text-tertiary">个</span>
          </div>
        </div>

        <div className="min-h-[78px] rounded-xl border border-border-subtle bg-surface-elevated px-4 py-3">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <span className="font-semibold">关联文档</span>
            <BookOpen className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-1.5 text-2xl font-extrabold leading-none text-text-primary">
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
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(19rem,21.25rem)_minmax(0,1fr)]">
        {/* Left Form Panel */}
        <section className="h-fit rounded-xl border border-border-subtle bg-surface-elevated p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle/80 pb-3">
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

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <label htmlFor="category-name" className="text-[13px] font-semibold text-text-secondary">
                分类名称 <span className="text-red-500">*</span>
              </label>
              <input
                id="category-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如: 使用教程 / 后端架构"
                className="h-10 w-full rounded-xl border border-border-default/80 bg-surface px-3 text-sm font-medium text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="category-slug" className="text-[13px] font-semibold text-text-secondary">URL Slug</label>
                <span className="text-xs text-text-tertiary">用于前台路由访问</span>
              </div>
              <input
                id="category-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="例如: guide (留空自动拼音/英文转换)"
                className="h-10 w-full rounded-xl border border-border-default/80 bg-surface px-3 font-mono text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="category-parent" className="text-[13px] font-semibold text-text-secondary">父级分类 (Parent)</label>
                {parentId > 0 && (
                  <button
                    type="button"
                    onClick={() => setParentId(0)}
                    className="text-xs text-brand hover:underline font-medium"
                  >
                    设为顶级
                  </button>
                )}
              </div>
              <select
                id="category-parent"
                value={parentId}
                onChange={(e) => setParentId(Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-border-default/80 bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
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
              <label htmlFor="category-sort" className="text-[13px] font-semibold text-text-secondary">排序权重 (越小越靠前)</label>
              <input
                id="category-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="h-10 w-full rounded-xl border border-border-default/80 bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="category-description" className="text-[13px] font-semibold text-text-secondary">分类说明与描述</label>
              <textarea
                id="category-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简短描述该分类包含的技术主题与文档..."
                rows={2}
                className="min-h-[5rem] w-full rounded-xl border border-border-default/80 bg-surface px-3 py-2 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
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
        <section className="flex min-w-0 self-start flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-elevated shadow-xs">
          {/* Header Toolbar */}
          <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-3.5 lg:flex-row lg:items-center">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <FolderTree className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-text-primary">
                  全部分类树状结构
                </h2>
                <p className="text-xs text-text-tertiary">
                  共 {totalCategories} 个分类 · 默认展开一级分类
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:ml-auto lg:max-w-[25rem]">
              <div className="relative min-w-0 basis-full flex-1 sm:basis-auto">
                <Search className="absolute left-3 top-3 h-4 w-4 text-text-tertiary" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索分类名称或 Slug..."
                  aria-label="搜索分类"
                  className="h-10 w-full rounded-lg border border-border-default bg-surface pl-9 pr-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span>全部展开</span>
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span>全部折叠</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tree Node List Container */}
          <div className="max-h-[min(56vh,34rem)] overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
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
                  expandedIds={visibleExpandedIds}
                  onToggleExpand={handleToggleExpand}
                  copiedSlugId={copiedSlugId}
                  onCopySlug={handleCopySlug}
                />
              ))
            )}
          </div>

          {/* Bottom Helpful Architecture Guide Card */}
          <div className="m-3 mt-0 rounded-lg border border-border-subtle bg-surface-subtle/50 p-3 text-xs text-text-secondary space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-text-primary">
              <Sparkles className="h-4 w-4 text-brand" />
              <span>知识库分类架构设计建议</span>
            </div>
            <ul className="space-y-1 text-text-tertiary list-disc list-inside leading-relaxed text-xs">
              <li>建议保持分类层级在 1~3 层以内，过深的层级会增加访客的查找成本；</li>
              <li>分类侧重于**宏观知识体系划分**（如「使用教程」、「API规范」），具体细分内容可结合**标签**进行多维归类；</li>
              <li>点击分类卡片上的 Slug 标签可一键复制路径，便于在前台链接中引用。</li>
            </ul>
          </div>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingCat && (
        <ModalPortal>
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
        </ModalPortal>
      )}
    </div>
  );
};
