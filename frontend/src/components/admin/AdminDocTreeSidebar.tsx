import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import type { CategoryTreeNode, DocumentSummary } from '../../api';
import { createNewDocumentDraftPath } from '../../hooks/useDocumentDraft';
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from 'lucide-react';

interface AdminDocTreeSidebarProps {
  currentDocId?: number | 'new';
  isOpen: boolean;
  onToggle: () => void;
  onBeforeSwitch?: () => void;
}

interface TreeNodeItemProps {
  node: CategoryTreeNode;
  currentDocId?: number | 'new';
  onSelectDoc: (id: number) => void;
  depth?: number;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  currentDocId,
  onSelectDoc,
  depth = 0,
}) => {
  const [expanded, setExpanded] = useState<boolean>(true);
  const hasChildren = (node.children && node.children.length > 0) || (node.documents && node.documents.length > 0);
  const totalDocs = (node.documents?.length || 0) + (node.children?.reduce((acc, c) => acc + (c.documents?.length || 0), 0) || 0);

  return (
    <div className="select-none relative">
      {/* Category Node */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        className="flex items-center justify-between py-1.5 pr-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl cursor-pointer group transition-all my-0.5"
      >
        <div className="flex items-center space-x-1.5 min-w-0 flex-1">
          <button
            type="button"
            className="p-0.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors shrink-0"
          >
            {hasChildren ? (
              expanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )
            ) : (
              <span className="w-3.5 h-3.5 inline-block" />
            )}
          </button>
          {expanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          )}
          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 break-words flex-1">
            {node.name}
          </span>
        </div>

        {totalDocs > 0 && (
          <span className="ml-1 shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-400 group-hover:text-slate-600 dark:bg-slate-800 dark:group-hover:text-slate-300">
            {totalDocs}
          </span>
        )}
      </div>

      {/* Children Nodes & Documents */}
      {expanded && (
        <div className="toc-tree-guide space-y-0.5 relative pl-1">
          {node.children &&
            node.children.map((child) => (
              <TreeNodeItem
                key={`admin-cat-${child.id}`}
                node={child}
                currentDocId={currentDocId}
                onSelectDoc={onSelectDoc}
                depth={depth + 1}
              />
            ))}

          {node.documents &&
            node.documents.map((doc: DocumentSummary) => {
              const isSelected = currentDocId === doc.id;
              return (
                <div
                  key={`admin-doc-${doc.id}`}
                  onClick={() => onSelectDoc(doc.id)}
                  style={{ paddingLeft: `${(depth + 1) * 12 + 10}px` }}
                  className={`group relative flex items-start space-x-2 py-1.5 pr-2 text-xs rounded-xl cursor-pointer transition-all my-0.5 ${
                    isSelected
                      ? 'bg-blue-50 text-blue-600 font-bold dark:bg-blue-950/60 dark:text-blue-300 ring-1 ring-blue-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                  title={doc.title}
                >
                  {isSelected && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-1.5 left-0 top-1.5 w-1 rounded-r-full bg-blue-600 dark:bg-blue-400"
                    />
                  )}
                  <FileText
                    className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                      isSelected
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                    }`}
                  />
                  <span className="break-words leading-relaxed flex-1">{doc.title}</span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export const AdminDocTreeSidebar: React.FC<AdminDocTreeSidebarProps> = ({
  currentDocId,
  isOpen,
  onToggle,
  onBeforeSwitch,
}) => {
  const navigate = useNavigate();
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterQuery, setFilterQuery] = useState<string>('');

  useEffect(() => {
    const fetchTree = async () => {
      try {
        setLoading(true);
        const data = await api.getKnowledgeTree();
        setTree(data || []);
      } catch (err) {
        console.error('Failed to load admin knowledge tree:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTree();
  }, []);

  const handleSelectDoc = (id: number) => {
    if (currentDocId === id) return;
    if (onBeforeSwitch) onBeforeSwitch();
    navigate(`/admin/documents/${id}`);
  };

  const handleNewDoc = () => {
    if (onBeforeSwitch) onBeforeSwitch();
    navigate(createNewDocumentDraftPath());
  };

  // Filter tree nodes by document title
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

  const filteredTree = filterTree(tree, filterQuery);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="p-2 text-slate-500 hover:text-blue-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition flex items-center space-x-1.5 text-xs shrink-0 self-start"
        title="展开知识库目录导航"
      >
        <PanelLeftOpen className="w-4 h-4 text-blue-500" />
        <span className="font-semibold text-[11px] hidden sm:inline">目录导航</span>
      </button>
    );
  }

  return (
    <aside className="static flex h-72 w-full flex-shrink-0 flex-col overflow-hidden rounded-ds-lg border border-border-subtle bg-surface xl:sticky xl:top-20 xl:h-[calc(100vh-8.5rem)] xl:w-72 2xl:w-80">
      {/* Top Header */}
      <div className="p-3 border-b border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/80">
        <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-100 font-bold text-xs">
          <BookOpen className="w-4 h-4 text-blue-500" />
          <span>知识库目录导航</span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          title="收起目录导航"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* New Doc Button & Quick Search */}
      <div className="p-2.5 space-y-2 border-b border-slate-200/60 dark:border-slate-700/60">
        <button
          type="button"
          onClick={handleNewDoc}
          className="flex w-full items-center justify-center space-x-1.5 rounded-ds-md border border-blue-200/80 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/70"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ 新建文档</span>
        </button>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="过滤目录与文章..."
            className="w-full pl-8 pr-7 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() => setFilterQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading ? (
          <div className="p-4 text-center text-xs text-slate-400 animate-pulse">
            加载目录树中...
          </div>
        ) : filteredTree.length > 0 ? (
          filteredTree.map((node) => (
            <TreeNodeItem
              key={`admin-tree-root-${node.id}`}
              node={node}
              currentDocId={currentDocId}
              onSelectDoc={handleSelectDoc}
            />
          ))
        ) : (
          <div className="p-4 text-center text-xs text-slate-400">
            {filterQuery ? '未找到匹配文档' : '暂无分类文档'}
          </div>
        )}
      </div>
    </aside>
  );
};
