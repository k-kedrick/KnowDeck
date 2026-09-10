import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
} from 'lucide-react';
import { api } from '../../api';
import type { Category, CategorySaveReq } from '../../api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { ModalPortal } from '../../components/ModalPortal';
import { Button } from '../../components/ui/Button';
import { categoryPath, flattenCategoryTree } from '../../utils/categoryTree';

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
    <div className="select-none border-b border-border-subtle/80 last:border-b-0">
      <div className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3.5 py-2.5 transition-colors hover:bg-brand/5 xl:min-h-14 xl:grid-cols-[minmax(12rem,1.2fr)_minmax(9rem,1fr)_7.25rem_5.75rem_8rem]">
        <div style={{ paddingLeft: `${depth * 20}px` }} className="flex min-w-0 items-center gap-1.5">
          {hasChildren ? (
            <button type="button" onClick={() => onToggleExpand(category.id)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-tertiary transition hover:bg-surface hover:text-text-primary" aria-label={`${isExpanded ? '折叠' : '展开'}分类 ${category.name}`}>
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : <span className="flex h-6 w-6 shrink-0 items-center justify-center"><i className="h-1.5 w-1.5 rounded-full bg-border-default/80" /></span>}
          <span className="flex h-6 w-6 shrink-0 items-center justify-center text-amber-600 dark:text-amber-400">
            {isExpanded && hasChildren ? <FolderOpen className="h-[18px] w-[18px]" /> : <Folder className="h-[18px] w-[18px]" />}
          </span>
          <span className="min-w-0 break-words text-sm font-semibold leading-5 text-text-primary">{category.name}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1 xl:col-start-5 xl:row-start-1 xl:justify-self-end">
          <button type="button" onClick={() => onAddChild(category)} className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition hover:bg-brand/10 hover:text-brand" title="在此分类下添加子分类" aria-label={`为 ${category.name} 添加子分类`}><FolderPlus className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => onEdit(category)} className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition hover:bg-brand/10 hover:text-brand" title="编辑分类" aria-label={`编辑分类 ${category.name}`}><Edit className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => onDeleteRequest(category)} className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition hover:bg-red-500/10 hover:text-red-600" title="删除分类" aria-label={`删除分类 ${category.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>

        <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary xl:contents">
          <button type="button" onClick={() => onCopySlug(category.id, category.slug)} className="inline-flex max-w-full items-center gap-1 rounded-md border border-border-subtle/80 bg-surface-subtle px-2 py-1 font-mono text-[10px] leading-4 text-text-tertiary transition hover:border-brand/30 hover:bg-surface hover:text-brand xl:col-start-2 xl:row-start-1 xl:w-full xl:justify-between" title="复制 Slug">
            <span className="min-w-0 break-all">/{category.slug}</span>{copiedSlugId === category.id ? <Check className="h-2.5 w-2.5 shrink-0 text-emerald-500" /> : <Copy className="h-2.5 w-2.5 shrink-0 opacity-60" />}
          </button>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] text-text-tertiary xl:col-start-3 xl:row-start-1"><Calendar className="h-3.5 w-3.5 text-emerald-500" />{category.created_at ? new Date(category.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '最近'}</span>
          <Link to={`/wang/documents?category=${category.id}`} className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2 py-1 text-xs font-semibold text-brand transition hover:bg-brand/20 xl:col-start-4 xl:row-start-1 xl:justify-self-center"><BookOpen className="h-3 w-3" />{category.doc_count ?? 0} 篇</Link>
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
        <section className="admin-surface h-fit space-y-4 p-5">
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
                      {categoryPath(c, flatCategories)} (/{c.slug})
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
        <section className="admin-surface flex min-w-0 self-start flex-col overflow-hidden">
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
          <div className="overflow-hidden rounded-b-xl">
            <div className="hidden min-h-9 grid-cols-[minmax(12rem,1.2fr)_minmax(9rem,1fr)_7.25rem_5.75rem_8rem] items-center gap-x-3 border-b border-border-subtle/80 bg-surface-subtle/70 px-3.5 py-2 text-[11px] font-semibold leading-4 text-text-tertiary xl:grid">
              <span>分类名称</span>
              <span>URL Slug</span>
              <span>创建时间</span>
              <span className="text-center">关联文档</span>
              <span className="text-right">操作</span>
            </div>
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
