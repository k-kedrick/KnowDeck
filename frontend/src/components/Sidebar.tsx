import React, { useEffect, useState } from 'react';
import type { CategoryTreeNode, DocumentSummary } from '../api';
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Search,
  X,
  Menu,
} from 'lucide-react';

interface SidebarProps {
  tree: CategoryTreeNode[];
  currentSlug: string | null;
  currentDocTitle?: string;
  onSelectDocument: (slug: string) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
  tocItems?: { id: string; text: string; level: number }[];
  activeHeadingId?: string;
  onSelectHeading?: (id: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface TreeNodeItemProps {
  node: CategoryTreeNode;
  currentSlug: string | null;
  onSelectDocument: (slug: string) => void;
  depth?: number;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  currentSlug,
  onSelectDocument,
  depth = 0,
}) => {
  const containsCurrentDocument = (treeNode: CategoryTreeNode): boolean =>
    !!treeNode.documents?.some((document) => document.slug === currentSlug)
    || !!treeNode.children?.some(containsCurrentDocument);
  const containsCurrent = containsCurrentDocument(node);
  const [expanded, setExpanded] = useState<boolean>(() => depth === 0 || containsCurrent);

  useEffect(() => {
    if (!containsCurrent) return;
    queueMicrotask(() => setExpanded(true));
  }, [containsCurrent]);

  const hasChildren = (node.children && node.children.length > 0) || (node.documents && node.documents.length > 0);
  const totalDocs = (node.documents?.length || 0) + (node.children?.reduce((acc, c) => acc + (c.documents?.length || 0), 0) || 0);

  return (
    <div className="select-none relative">
      {/* Category button */}
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={hasChildren ? expanded : undefined}
        aria-label={`${expanded ? '折叠' : '展开'}分类：${node.name}`}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        className="group my-0.5 flex w-full items-center justify-between rounded-lg py-1.5 pr-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800/70"
      >
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <span className="p-0.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors shrink-0">
            {hasChildren ? (
              expanded ? (
                <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )
            ) : (
              <span className="w-4 h-4 inline-block" />
            )}
          </span>
          {expanded ? (
            <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <span className="font-medium text-sm text-slate-800 dark:text-slate-200 break-words flex-1">
            {node.name}
          </span>
        </div>

        {totalDocs > 0 && (
          <span className="text-xs font-mono text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 ml-1">
            {totalDocs}
          </span>
        )}
      </button>

      {/* Children & documents */}
      {expanded && (
        <div className="toc-tree-guide space-y-0.5 relative pl-1">
          {node.children &&
            node.children.map((child) => (
              <TreeNodeItem
                key={`cat-${child.id}`}
                node={child}
                currentSlug={currentSlug}
                onSelectDocument={onSelectDocument}
                depth={depth + 1}
              />
            ))}

          {node.documents &&
            node.documents.map((doc: DocumentSummary) => {
              const isSelected = currentSlug === doc.slug;
              return (
                <button
                  type="button"
                  key={`doc-${doc.id}`}
                  onClick={() => onSelectDocument(doc.slug)}
                  aria-current={isSelected ? 'page' : undefined}
                  style={{ paddingLeft: `${(depth + 1) * 12 + 10}px` }}
                  title={doc.title}
                  className={`group relative my-0.5 flex w-full items-start space-x-2 rounded-lg py-1.5 pr-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isSelected
                      ? 'bg-blue-50/90 text-blue-600 font-semibold dark:bg-blue-950/60 dark:text-blue-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <FileText
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      isSelected
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                    }`}
                  />
                  <span className="break-words leading-relaxed flex-1">{doc.title}</span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  tree,
  currentSlug,
  onSelectDocument,
  isOpen,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filterTree = (nodes: CategoryTreeNode[], query: string): CategoryTreeNode[] => {
    if (!query.trim()) return nodes;
    const q = query.toLowerCase();

    return nodes
      .map((node) => {
        const matchedDocs = (node.documents || []).filter((doc) => doc.title.toLowerCase().includes(q));
        const matchedChildren = filterTree(node.children || [], query);
        const isSelfMatched = node.name.toLowerCase().includes(q);

        if (isSelfMatched || matchedDocs.length > 0 || matchedChildren.length > 0) {
          return {
            ...node,
            documents: isSelfMatched ? node.documents : matchedDocs,
            children: matchedChildren,
          };
        }
        return null;
      })
      .filter(Boolean) as CategoryTreeNode[];
  };

  const filteredTree = filterTree(tree, searchQuery);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          role="presentation"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity 2xl:hidden"
        />
      )}

      {/* Floating Expand Button when knowledge navigation is collapsed on wide screens */}
      {isCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="fixed left-4 top-20 z-30 hidden items-center space-x-1.5 rounded-ds-md border border-border-subtle bg-surface/95 px-3 py-1.5 text-xs font-semibold text-text-secondary shadow-floating backdrop-blur-md transition-colors hover:border-brand hover:text-brand 2xl:flex"
          title="展开知识库导航"
        >
          <Menu className="h-3.5 w-3.5 text-brand" />
          <span>展开导航</span>
        </button>
      )}

      <aside
        aria-label="知识库文档导航"
        className={`fixed left-0 top-16 z-40 flex h-[calc(100vh-4rem)] w-[min(20rem,88vw)] flex-col overflow-hidden border-r border-border-subtle bg-surface shadow-floating transition-transform duration-200 ease-in-out 2xl:sticky 2xl:top-20 2xl:z-10 2xl:h-[calc(100vh-6rem)] 2xl:w-64 2xl:shrink-0 2xl:border-r-0 2xl:bg-transparent 2xl:shadow-none ${
          isCollapsed ? '2xl:hidden' : '2xl:flex'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full 2xl:translate-x-0'}`}
      >
          {/* Header with Title & Filter */}
          <div className="p-2.5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between text-slate-800 dark:text-slate-100 font-bold text-xs">
              <div className="flex items-center space-x-1.5">
                <BookOpen className="h-3.5 w-3.5 text-brand" />
                <span>知识库目录</span>
              </div>
              {tree && (
                <span className="text-xs font-mono text-slate-400">
                  {tree.length} 分类
                </span>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索目录与文章..."
                className="w-full pl-8 pr-7 py-1 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {filteredTree && filteredTree.length > 0 ? (
              filteredTree.map((node) => (
                <TreeNodeItem
                  key={`tree-${node.id}`}
                  node={node}
                  currentSlug={currentSlug}
                  onSelectDocument={(slug) => {
                    onSelectDocument(slug);
                    onCloseMobile();
                  }}
                />
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">
                {searchQuery ? '未找到相关文章' : '暂无知识库目录'}
              </div>
            )}
          </div>
      </aside>
    </>
  );
};
