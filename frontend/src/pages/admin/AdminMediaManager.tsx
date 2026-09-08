import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Image as ImageIcon,
  Video,
  FileText,
  Upload,
  Search,
  Copy,
  Check,
  Trash2,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Calendar,
  Folder,
  FolderPlus,
  FolderOpen,
  FolderInput,
  Edit2,
  X,
  Layers,
  ChevronRight,
  BookOpen,
  Plus,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import { api } from '../../api';
import type { Media, MediaFolder } from '../../api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';

export const AdminMediaManager: React.FC = () => {
  // 媒体列表与分页筛选
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(20);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // 文件夹状态
  // selectedFolderId: null = 全部资源, 0 = 未分类资源, >0 = 指定文件夹
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [totalMediaCount, setTotalMediaCount] = useState<number>(0);
  const [unclassifiedCount, setUnclassifiedCount] = useState<number>(0);
  const [foldersLoading, setFoldersLoading] = useState<boolean>(true);
  const [folderFilterQuery, setFolderFilterQuery] = useState<string>('');

  // 新建文件夹弹窗
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);

  // 行内重命名文件夹
  const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null);
  const [renamingName, setRenamingName] = useState<string>('');
  const [isRenaming, setIsRenaming] = useState<boolean>(false);

  // 删除文件夹确认弹窗
  const [deletingFolder, setDeletingFolder] = useState<MediaFolder | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState<boolean>(false);

  // 移动媒体文件弹窗
  const [movingMedia, setMovingMedia] = useState<Media | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<number>(0);
  const [isMoving, setIsMoving] = useState<boolean>(false);

  // 物理删除媒体确认弹窗
  const [deletingMedia, setDeletingMedia] = useState<Media | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 键盘快捷监听 Esc 关闭弹窗
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
        setRenamingFolderId(null);
        setDeletingFolder(null);
        setMovingMedia(null);
        setDeletingMedia(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 加载文件夹列表与统计
  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    try {
      const res = await api.getMediaFolders();
      setFolders(res.folders || []);
      setTotalMediaCount(res.total_media || 0);
      setUnclassifiedCount(res.unclassified_media || 0);
    } catch (err: any) {
      console.error('加载文件夹列表失败:', err);
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  // 加载媒体文件列表
  const loadMedia = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.getAdminMedia({
        folder_id: selectedFolderId === null ? undefined : selectedFolderId,
        page,
        page_size: pageSize,
        media_type: mediaTypeFilter || undefined,
        keyword: keyword.trim() || undefined,
      });
      setMediaList(res.list || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setErrorMsg(err.message || '加载媒体文件库失败');
      setMediaList([]);
    } finally {
      setLoading(false);
    }
  }, [selectedFolderId, page, pageSize, mediaTypeFilter, keyword]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  // 上传文件处理（自动上传至当前选中文件夹）
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const currentFid = selectedFolderId && selectedFolderId > 0 ? selectedFolderId : undefined;
      await api.uploadMedia(file, { folder_id: currentFid });
      setSuccessMsg(`✨ 媒体资源《${file.name}》上传成功！`);
      loadMedia();
      loadFolders();
    } catch (err: any) {
      setErrorMsg(err.message || '上传文件失败');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // 创建文件夹
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    setIsCreatingFolder(true);
    setErrorMsg(null);
    try {
      const created = await api.createMediaFolder(trimmed);
      setSuccessMsg(`📁 文件夹《${created.name}》创建成功！`);
      setShowCreateModal(false);
      setNewFolderName('');
      await loadFolders();
      setSelectedFolderId(created.id);
      setPage(1);
    } catch (err: any) {
      setErrorMsg(err.message || '创建文件夹失败');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // 触发重命名
  const startRenaming = (f: MediaFolder) => {
    setRenamingFolderId(f.id);
    setRenamingName(f.name);
  };

  // 保存重命名
  const handleSaveRename = async (id: number) => {
    const trimmed = renamingName.trim();
    if (!trimmed) {
      setRenamingFolderId(null);
      return;
    }
    setIsRenaming(true);
    try {
      await api.updateMediaFolder(id, trimmed);
      setSuccessMsg('文件夹重命名成功');
      setRenamingFolderId(null);
      loadFolders();
    } catch (err: any) {
      setErrorMsg(err.message || '重命名文件夹失败');
    } finally {
      setIsRenaming(false);
    }
  };

  // 删除文件夹
  const handleConfirmDeleteFolder = async () => {
    if (!deletingFolder) return;
    setIsDeletingFolder(true);
    try {
      await api.deleteMediaFolder(deletingFolder.id, true);
      setSuccessMsg(`🗑️ 文件夹《${deletingFolder.name}》已删除，内含文件已安全保留在「未分类」中`);
      if (selectedFolderId === deletingFolder.id) {
        setSelectedFolderId(null);
      }
      setDeletingFolder(null);
      loadFolders();
      loadMedia();
    } catch (err: any) {
      setErrorMsg(err.message || '删除文件夹失败');
    } finally {
      setIsDeletingFolder(false);
    }
  };

  // 移动媒体到指定文件夹
  const handleConfirmMove = async () => {
    if (!movingMedia) return;
    setIsMoving(true);
    try {
      await api.moveMedia(movingMedia.id, targetFolderId);
      const targetName = targetFolderId === 0
        ? '未分类资源'
        : folders.find((f) => f.id === targetFolderId)?.name || '目标文件夹';
      setSuccessMsg(`✨ 已将《${movingMedia.original_name}》移至《${targetName}》`);
      setMovingMedia(null);
      loadMedia();
      loadFolders();
    } catch (err: any) {
      setErrorMsg(err.message || '移动文件失败');
    } finally {
      setIsMoving(false);
    }
  };

  // 彻底物理删除媒体文件
  const handleConfirmDeleteMedia = async () => {
    if (!deletingMedia) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteMedia(deletingMedia.id);
      setSuccessMsg(`🗑️ 媒体资源《${deletingMedia.original_name}》已从磁盘彻底删除！`);
      setDeletingMedia(null);
      loadMedia();
      loadFolders();
    } catch (err: any) {
      setDeleteError(err.message || '删除媒体文件失败');
    } finally {
      setIsDeleting(false);
    }
  };

  // 复制 Markdown 引用代码
  const handleCopyMarkdown = (m: Media) => {
    let snippet = '';
    if (m.media_type === 'image') {
      snippet = `![${m.original_name}](${m.url})`;
    } else if (m.media_type === 'video') {
      snippet = `<video src="${m.url}" controls></video>`;
    } else {
      snippet = `[${m.original_name}](${m.url})`;
    }
    navigator.clipboard.writeText(snippet);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 格式化文件尺寸
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 分类与过滤文件夹
  const filteredFolders = useMemo(() => {
    const q = folderFilterQuery.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, folderFilterQuery]);

  const docFolders = useMemo(() => filteredFolders.filter((f) => f.document_id > 0), [filteredFolders]);
  const customFolders = useMemo(() => filteredFolders.filter((f) => f.document_id === 0), [filteredFolders]);

  // 当前选中文件夹的信息
  const currentFolder = useMemo(() => {
    if (selectedFolderId === null) {
      return {
        type: 'all' as const,
        name: '全部资源',
        count: totalMediaCount,
        desc: `汇总全库素材：包含所有文档专属文件夹与自定义文件夹中的全部素材（共 ${totalMediaCount} 项）`,
      };
    }
    if (selectedFolderId === 0) {
      return {
        type: 'unclassified' as const,
        name: '未分类资源',
        count: unclassifiedCount,
        desc: `散放素材：尚未关联任何文档或文件夹的独立素材（共 ${unclassifiedCount} 项）`,
      };
    }
    const found = folders.find((f) => f.id === selectedFolderId);
    if (found) {
      if (found.document_id > 0) {
        return {
          type: 'doc' as const,
          name: found.name,
          count: found.media_count,
          document_id: found.document_id,
          desc: `文档专属资源库：包含文档《${found.name}》（ID #${found.document_id}）中引用的所有图片与素材`,
        };
      }
      return {
        type: 'custom' as const,
        name: found.name,
        count: found.media_count,
        desc: `自定义文件夹：自主归类的素材库（共 ${found.media_count} 项）`,
      };
    }
    return { type: 'unknown' as const, name: '文件夹', count: 0, desc: '' };
  }, [selectedFolderId, totalMediaCount, unclassifiedCount, folders]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={ImageIcon}
        title="媒体资源库"
        description="按文档和自定义分类管理图片、视频与文件，支持随时重命名与归类。"
        actions={(
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setNewFolderName('');
                setShowCreateModal(true);
              }}
              className="inline-flex min-h-10 items-center space-x-1.5 rounded-ds-md border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <FolderPlus className="w-4 h-4 text-brand" />
              <span>新建文件夹</span>
            </button>

            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-ds-md bg-brand px-4 text-xs font-semibold text-white transition-colors hover:bg-brand-hover focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 shadow-sm">
              <Upload className="w-4 h-4" />
              <span>{uploading ? '正在上传…' : (selectedFolderId && selectedFolderId > 0 ? `上传至《${currentFolder.name}》` : '上传媒体资源')}</span>
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={handleUpload}
                accept="image/*,video/*,.pdf,.zip,.docx"
              />
            </label>
          </div>
        )}
      />

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

      {/* Main Dual-Column Layout: Left Sticky Folders Sidebar + Right Media Workspace */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ================= 1. Left Sidebar: Folder Navigation + Stats Card ================= */}
        <aside className="w-full lg:w-64 xl:w-72 shrink-0 lg:sticky lg:top-20 space-y-4">
          {/* Card 1: 文件夹导航 */}
          <div className="rounded-2xl border border-border-subtle/80 bg-surface-elevated/90 p-4 shadow-xs backdrop-blur-md space-y-3.5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle/80 pb-2.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-text-primary">
                <FolderOpen className="w-4 h-4 text-brand" />
                <span>资源文件夹</span>
                <span className="text-[10px] text-text-tertiary font-normal">({folders.length + 2})</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewFolderName('');
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center space-x-1 text-xs text-brand hover:text-brand-hover p-1 rounded-lg hover:bg-brand/10 transition"
                title="新建文件夹"
                aria-label="新建文件夹"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>

            {/* Quick search folders */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-text-tertiary" />
              <input
                type="text"
                value={folderFilterQuery}
                onChange={(e) => setFolderFilterQuery(e.target.value)}
                placeholder="筛选文件夹..."
                className="w-full rounded-xl border border-border-default/80 bg-surface pl-8 pr-7 py-1.5 text-xs text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              {folderFilterQuery && (
                <button
                  type="button"
                  onClick={() => setFolderFilterQuery('')}
                  className="absolute right-2 top-2 text-text-tertiary hover:text-text-primary"
                  title="清空筛选"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Built-in Views: All Resources & Unclassified */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedFolderId(null);
                  setPage(1);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${
                  selectedFolderId === null
                    ? 'bg-brand text-white font-semibold shadow-xs'
                    : 'text-text-primary hover:bg-surface-subtle font-medium'
                }`}
              >
                <span className="flex items-center space-x-2 truncate">
                  <Layers className={`w-4 h-4 shrink-0 ${selectedFolderId === null ? 'text-white' : 'text-indigo-500'}`} />
                  <span>全部资源</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                  selectedFolderId === null ? 'bg-white/20 text-white' : 'bg-surface-subtle text-text-tertiary'
                }`}>
                  {totalMediaCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedFolderId(0);
                  setPage(1);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition ${
                  selectedFolderId === 0
                    ? 'bg-brand text-white font-semibold shadow-xs'
                    : 'text-text-primary hover:bg-surface-subtle font-medium'
                }`}
              >
                <span className="flex items-center space-x-2 truncate">
                  <Folder className={`w-4 h-4 shrink-0 ${selectedFolderId === 0 ? 'text-white' : 'text-text-tertiary'}`} />
                  <span>未分类资源</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                  selectedFolderId === 0 ? 'bg-white/20 text-white' : 'bg-surface-subtle text-text-tertiary'
                }`}>
                  {unclassifiedCount}
                </span>
              </button>
            </div>

            {/* Document Exclusive Folders Section */}
            <div className="space-y-1.5 pt-2 border-t border-border-subtle/80">
              <div className="px-1 flex items-center justify-between text-[11px] font-semibold text-text-tertiary tracking-wider">
                <span className="flex items-center space-x-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-brand" />
                  <span>文档专属目录</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-subtle font-mono">
                  {docFolders.length}
                </span>
              </div>

              {foldersLoading ? (
                <div className="py-2.5 text-center text-xs text-text-tertiary animate-pulse">加载目录中...</div>
              ) : docFolders.length === 0 ? (
                <div className="py-2.5 px-2 text-center text-[11px] text-text-tertiary bg-surface-subtle/50 rounded-xl border border-dashed border-border-subtle/80">
                  {folderFilterQuery ? '无匹配文档' : '在文档中上传图片将自动建夹'}
                </div>
              ) : (
                <div className="space-y-0.5 max-h-48 overflow-y-auto pr-0.5">
                  {docFolders.map((f) => renderFolderItem(f))}
                </div>
              )}
            </div>

            {/* Custom Folders Section */}
            <div className="space-y-1.5 pt-2 border-t border-border-subtle/80">
              <div className="px-1 flex items-center justify-between text-[11px] font-semibold text-text-tertiary tracking-wider">
                <span className="flex items-center space-x-1.5">
                  <Folder className="w-3.5 h-3.5 text-amber-500" />
                  <span>自定义文件夹</span>
                </span>
                <div className="flex items-center space-x-1">
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-subtle font-mono">
                    {customFolders.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewFolderName('');
                      setShowCreateModal(true);
                    }}
                    className="p-0.5 text-text-tertiary hover:text-brand transition rounded"
                    title="新建自定义文件夹"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {foldersLoading ? (
                <div className="py-2 text-center text-xs text-text-tertiary animate-pulse">加载中...</div>
              ) : customFolders.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setNewFolderName('');
                    setShowCreateModal(true);
                  }}
                  className="w-full py-2 px-2 text-center text-[11px] text-brand hover:bg-brand/10 rounded-xl border border-dashed border-border-subtle/80 transition flex items-center justify-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>{folderFilterQuery ? '无匹配，新建此文件夹' : '新建自定义文件夹'}</span>
                </button>
              ) : (
                <div className="space-y-0.5 max-h-48 overflow-y-auto pr-0.5">
                  {customFolders.map((f) => renderFolderItem(f))}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: 资源库概况与保障卡片 */}
          <div className="rounded-2xl border border-border-subtle/80 bg-surface-elevated/90 p-4 shadow-xs backdrop-blur-md space-y-3 text-xs">
            <div className="flex items-center space-x-2 text-text-primary font-bold">
              <HardDrive className="w-3.5 h-3.5 text-brand" />
              <span>资源库概况</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-surface border border-border-subtle/80">
                <div className="text-text-tertiary">总资源数</div>
                <div className="font-bold text-sm text-text-primary font-mono mt-0.5">{totalMediaCount}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-surface border border-border-subtle/80">
                <div className="text-text-tertiary">分类文件夹</div>
                <div className="font-bold text-sm text-text-primary font-mono mt-0.5">{folders.length}</div>
              </div>
            </div>
            <div className="rounded-xl bg-blue-500/10 p-3 text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed flex items-start space-x-2 border border-blue-500/20">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-brand mt-0.5" />
              <span>在编辑文档时粘贴或导入的图片将自动落盘转存，并归档至该文档的专属文件夹中。</span>
            </div>
          </div>
        </aside>

        {/* ================= 2. Right Media Grid Workspace ================= */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Breadcrumb Path & Folder Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle/80 pb-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-xs text-text-tertiary">
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(null)}
                  className="hover:text-brand transition font-medium"
                >
                  媒体资源库
                </button>
                <ChevronRight className="w-3 h-3" />
                {currentFolder.type === 'doc' && (
                  <>
                    <span className="text-brand font-medium">文档专属</span>
                    <ChevronRight className="w-3 h-3" />
                  </>
                )}
                {currentFolder.type === 'custom' && (
                  <>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">自定义文件夹</span>
                    <ChevronRight className="w-3 h-3" />
                  </>
                )}
                <span className="font-semibold text-text-primary">{currentFolder.name}</span>
              </div>
              <div className="flex items-center space-x-3">
                <h2 className="text-base font-bold text-text-primary flex items-center space-x-2">
                  {currentFolder.type === 'doc' && <BookOpen className="w-5 h-5 text-brand shrink-0" />}
                  {currentFolder.type === 'custom' && <Folder className="w-5 h-5 text-amber-500 shrink-0" />}
                  {currentFolder.type === 'all' && <Layers className="w-5 h-5 text-indigo-500 shrink-0" />}
                  {currentFolder.type === 'unclassified' && <Folder className="w-5 h-5 text-text-tertiary shrink-0" />}
                  <span>{currentFolder.name}</span>
                  <span className="text-xs font-normal text-text-tertiary">
                    ({loading ? '加载中…' : `共 ${total} 项`})
                  </span>
                </h2>
                {currentFolder.type === 'doc' && currentFolder.document_id && (
                  <a
                    href={`/wang/documents/${currentFolder.document_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-brand bg-brand/10 hover:bg-brand/20 transition shadow-xs"
                    title="在文章编辑器中打开此文档"
                  >
                    <span>打开关联文档</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="text-xs text-text-tertiary">{currentFolder.desc}</p>
            </div>

            {/* Quick Action in this folder */}
            {selectedFolderId && selectedFolderId > 0 && (
              <div className="flex items-center space-x-2 text-xs">
                {(() => {
                  const target = folders.find((f) => f.id === selectedFolderId);
                  if (!target) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => startRenaming(target)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-border-default/80 bg-surface hover:bg-surface-subtle text-text-primary transition shadow-xs font-medium"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-text-tertiary" />
                      <span>重命名文件夹</span>
                    </button>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Search & Filter Toolbar */}
          <section aria-label="媒体筛选" className="rounded-2xl border border-border-subtle/80 bg-surface-elevated/80 p-4 shadow-xs backdrop-blur-md grid grid-cols-1 gap-3 sm:grid-cols-[minmax(14rem,1fr)_14rem]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-text-tertiary" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setPage(1);
                }}
                placeholder={`在 ${currentFolder.name} 中搜索文件名...`}
                aria-label="搜索媒体文件"
                className="min-h-10 w-full rounded-xl border border-border-default/80 bg-surface pl-9 pr-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <select
              value={mediaTypeFilter}
              onChange={(e) => {
                setMediaTypeFilter(e.target.value);
                setPage(1);
              }}
              aria-label="按媒体类型筛选"
              className="min-h-10 rounded-xl border border-border-default/80 bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <option value="">所有文件类型 (图片 + 视频 + 文件)</option>
              <option value="image">图片 (Image)</option>
              <option value="video">视频 (Video)</option>
              <option value="file">文件附件 (File)</option>
            </select>
          </section>

          {/* Media Grid Cards */}
          {loading ? (
            <div className="text-center py-20 text-xs text-text-tertiary animate-pulse">加载媒体库中...</div>
          ) : mediaList.length === 0 ? (
            <div className="space-y-3 rounded-2xl border border-dashed border-border-subtle/80 py-20 text-center text-sm text-text-tertiary bg-surface-elevated/40">
              <ImageIcon className="mx-auto h-10 w-10 text-text-tertiary/40" />
              <div>
                <p className="font-semibold text-text-primary">此文件夹暂无资源</p>
                <p className="mt-1 text-xs text-text-tertiary">
                  点击上方「上传」按钮，或者在文档编辑时导入图片即可。
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {mediaList.map((m) => {
                const folderOfMedia = folders.find((f) => f.id === m.folder_id);
                const ext = m.filename.split('.').pop()?.toUpperCase() || m.mime_type.split('/').pop()?.toUpperCase() || 'FILE';
                return (
                  <div
                    key={m.id}
                    className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border-subtle/80 bg-surface-elevated/95 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg shadow-xs"
                  >
                    {/* Media Preview Box */}
                    <div className="aspect-[4/3] bg-surface-subtle/90 flex items-center justify-center relative overflow-hidden group/thumb">
                      {m.media_type === 'image' ? (
                        <img
                          src={m.url}
                          alt={m.original_name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-108"
                        />
                      ) : m.media_type === 'video' ? (
                        <div className="flex flex-col items-center justify-center text-brand space-y-1.5 p-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 border border-brand/20">
                            <Video className="w-5 h-5 text-brand" />
                          </div>
                          <span className="text-[10px] font-semibold font-mono uppercase text-text-secondary">{ext}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-text-tertiary space-y-1.5 p-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated border border-border-subtle">
                            <FileText className="w-5 h-5 text-text-tertiary" />
                          </div>
                          <span className="text-[10px] font-semibold font-mono uppercase text-text-secondary">{ext}</span>
                        </div>
                      )}

                      {/* Format Badge */}
                      <span className="absolute top-2 left-2 rounded-md bg-black/60 backdrop-blur-md px-1.5 py-0.5 font-mono text-[9px] font-bold text-white uppercase shadow-xs">
                        {ext}
                      </span>

                      {/* Folder Badge */}
                      {folderOfMedia ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFolderId(folderOfMedia.id);
                            setPage(1);
                          }}
                          className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/65 hover:bg-black/85 backdrop-blur-md text-[10px] font-medium text-white max-w-[85%] truncate transition flex items-center space-x-1 shadow-xs"
                          title={`所属文件夹: ${folderOfMedia.name}，点击筛选此文件夹`}
                        >
                          {folderOfMedia.document_id > 0 ? (
                            <BookOpen className="w-3 h-3 text-blue-300 shrink-0" />
                          ) : (
                            <Folder className="w-3 h-3 text-amber-300 shrink-0" />
                          )}
                          <span className="truncate">{folderOfMedia.name}</span>
                        </button>
                      ) : (
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/50 backdrop-blur-md text-[10px] text-white/80">
                          未分类
                        </span>
                      )}

                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center bg-black/60 hover:bg-black/90 text-white rounded-lg opacity-0 group-hover/thumb:opacity-100 transition shadow-xs"
                        title="在新窗口查看原文件"
                        aria-label={`查看 ${m.original_name}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    {/* Card Info Footer */}
                    <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="font-semibold text-xs text-text-primary truncate" title={m.original_name}>
                          {m.original_name}
                        </div>
                        <div className="text-[11px] text-text-tertiary flex items-center justify-between mt-1 font-mono">
                          <span>{formatSize(m.size)}</span>
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span>
                              {m.created_at
                                ? new Date(m.created_at).toLocaleDateString('zh-CN', {
                                    month: '2-digit',
                                    day: '2-digit',
                                  })
                                : '最近'}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-2 border-t border-border-subtle/80 flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopyMarkdown(m)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-surface hover:bg-surface-subtle border border-border-default/80 text-text-secondary hover:text-text-primary rounded-lg text-[11px] font-medium transition shadow-xs"
                          title="复制 Markdown 引用语法"
                        >
                          {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === m.id ? '已复制' : '复制 MD'}</span>
                        </button>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              setMovingMedia(m);
                              setTargetFolderId(m.folder_id || 0);
                            }}
                            className="p-1.5 text-text-tertiary hover:text-brand hover:bg-brand/10 rounded-lg transition"
                            title="移动到其他文件夹"
                            aria-label="移动到其他文件夹"
                          >
                            <FolderInput className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setDeletingMedia(m);
                              setDeleteError(null);
                            }}
                            className="p-1.5 text-text-tertiary hover:text-red-600 hover:bg-red-500/10 rounded-lg transition"
                            title="删除媒体文件"
                            aria-label={`删除媒体 ${m.original_name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}


          {/* Pagination */}
          {total > pageSize && (
            <div className="flex items-center justify-between pt-3 text-xs">
              <span className="text-slate-500">
                显示第 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} 条，共 {total} 条
              </span>
              <div className="flex items-center space-x-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-md disabled:opacity-50 font-medium"
                >
                  上一页
                </button>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {page} / {Math.ceil(total / pageSize)}
                </span>
                <button
                  disabled={page >= Math.ceil(total / pageSize)}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-md disabled:opacity-50 font-medium"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= 3. Modals & Dialogs ================= */}

      {/* 3.1 🌟 新建文件夹模态框 (Create Folder Modal) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-ds-lg border border-border-default bg-surface-elevated p-5 shadow-modal space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
              <div className="flex items-center space-x-2 text-text-primary font-bold text-sm">
                <FolderPlus className="w-4 h-4 text-brand" />
                <span>新建媒体文件夹</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">文件夹名称</label>
                <input
                  type="text"
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="例如：文章配图、设计插画、头像素材..."
                  className="w-full rounded-md border border-border-default bg-surface px-3 py-2 text-xs text-text-primary outline-none focus:ring-2 focus:ring-brand"
                  maxLength={50}
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim() || isCreatingFolder}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-md transition disabled:opacity-50"
                >
                  {isCreatingFolder ? '正在创建…' : '立即创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3.2 🌟 移动媒体文件模态框 (Move Media Modal) */}
      {movingMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-ds-lg border border-border-default bg-surface-elevated p-5 shadow-modal space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
              <div className="flex items-center space-x-2 text-text-primary font-bold text-sm">
                <FolderInput className="w-4 h-4 text-brand" />
                <span>移动媒体资源</span>
              </div>
              <button
                type="button"
                onClick={() => setMovingMedia(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-text-tertiary">
              请选择目标文件夹以归档 <strong className="text-text-primary">《{movingMedia.original_name}》</strong>：
            </div>

            <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
              <label
                className={`flex items-center justify-between p-2.5 rounded-md border cursor-pointer transition text-xs ${
                  targetFolderId === 0
                    ? 'border-brand bg-brand/5 text-brand font-bold'
                    : 'border-border-subtle hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center space-x-2">
                  <Folder className="w-4 h-4 text-slate-400" />
                  <span>未分类资源 (根目录)</span>
                </span>
                <input
                  type="radio"
                  name="targetFolder"
                  checked={targetFolderId === 0}
                  onChange={() => setTargetFolderId(0)}
                  className="accent-brand"
                />
              </label>

              {folders.map((f) => (
                <label
                  key={f.id}
                  className={`flex items-center justify-between p-2.5 rounded-md border cursor-pointer transition text-xs ${
                    targetFolderId === f.id
                      ? 'border-brand bg-brand/5 text-brand font-bold'
                      : 'border-border-subtle hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="flex items-center space-x-2 truncate">
                    {f.document_id > 0 ? (
                      <BookOpen className="w-4 h-4 text-blue-500 shrink-0" />
                    ) : (
                      <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <span className="truncate">{f.name}</span>
                    {f.document_id > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                        文档
                      </span>
                    )}
                  </span>
                  <input
                    type="radio"
                    name="targetFolder"
                    checked={targetFolderId === f.id}
                    onChange={() => setTargetFolderId(f.id)}
                    className="accent-brand shrink-0"
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setMovingMedia(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmMove}
                disabled={isMoving}
                className="px-4 py-1.5 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-md transition disabled:opacity-50 shadow-sm"
              >
                {isMoving ? '正在移动…' : '确认移动'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3.3 🌟 删除文件夹确认模态框 (Delete Folder Modal) */}
      {deletingFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-ds-lg border border-border-default bg-surface-elevated p-5 shadow-modal space-y-4">
            <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 font-bold text-sm border-b border-border-subtle pb-2.5">
              <Trash2 className="w-4 h-4" />
              <span>确认删除文件夹《{deletingFolder.name}》？</span>
            </div>

            <div className="space-y-2 text-xs text-text-tertiary leading-relaxed">
              <p>
                即将删除文件夹 <strong className="text-text-primary">{deletingFolder.name}</strong>。
              </p>
              <p className="p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300">
                🛡️ 安全保护提示：文件夹内的媒体文件（共 {deletingFolder.media_count} 项）将<strong>安全移至「未分类资源」中</strong>，不会损坏文档中已经引用的图片链接。
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setDeletingFolder(null)}
                disabled={isDeletingFolder}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFolder}
                disabled={isDeletingFolder}
                className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md transition disabled:opacity-50 shadow-sm"
              >
                {isDeletingFolder ? '正在删除…' : '确认删除文件夹'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3.4 🌟 物理删除媒体文件模态框 (Delete Media Modal) */}
      {deletingMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-media-title" className="w-full max-w-md space-y-4 rounded-ds-lg border border-border-default bg-surface-elevated p-6 shadow-modal">
            <div className="flex items-center space-x-3 text-red-600 dark:text-red-400 border-b border-slate-100 dark:border-slate-700 pb-3">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h3 id="delete-media-title" className="truncate text-sm font-bold text-text-primary">
                确认物理删除《{deletingMedia.original_name}》？
              </h3>
            </div>

            {deleteError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
              <p>
                即将物理删除磁盘文件 <strong className="text-slate-900 dark:text-white">{deletingMedia.original_name}</strong>（大小 {formatSize(deletingMedia.size)}）。
              </p>
              <p className="text-amber-600 dark:text-amber-400">
                ⚠️ 注意：如果该媒体文件正被文档使用，系统会进行安全校验防止误删除。
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingMedia(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMedia}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-bold shadow transition disabled:opacity-50"
              >
                {isDeleting ? '正在删除文件...' : '确认彻底删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 渲染单个文件夹选项组件（带行内重命名与快捷操作）
  function renderFolderItem(f: MediaFolder) {
    const isSelected = selectedFolderId === f.id;
    const isEditing = renamingFolderId === f.id;

    if (isEditing) {
      return (
        <div key={f.id} className="flex items-center space-x-1 p-1 rounded-xl bg-brand/10 border border-brand">
          <input
            type="text"
            autoFocus
            value={renamingName}
            onChange={(e) => setRenamingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRename(f.id);
              if (e.key === 'Escape') setRenamingFolderId(null);
            }}
            className="flex-1 bg-transparent px-2 py-1 text-xs text-text-primary outline-none"
            maxLength={50}
          />
          <button
            type="button"
            onClick={() => handleSaveRename(f.id)}
            disabled={isRenaming}
            className="p-1 text-brand hover:text-brand-hover rounded-lg transition"
            title="保存"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setRenamingFolderId(null)}
            className="p-1 text-text-tertiary hover:text-text-primary rounded-lg transition"
            title="取消"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div
        key={f.id}
        className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
          isSelected
            ? 'bg-brand text-white font-semibold shadow-xs'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle font-medium'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setSelectedFolderId(f.id);
            setPage(1);
          }}
          className="flex-1 flex items-center space-x-2 text-left min-w-0 pr-2"
        >
          {f.document_id > 0 ? (
            <BookOpen className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-brand'}`} />
          ) : (
            <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-amber-500'}`} />
          )}
          <span className="truncate" title={f.name}>
            {f.name}
          </span>
        </button>

        {/* Action icons appear on hover */}
        <div className="flex items-center space-x-1 shrink-0">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono group-hover:hidden ${
            isSelected ? 'bg-white/20 text-white' : 'bg-surface-subtle text-text-tertiary'
          }`}>
            {f.media_count}
          </span>

          <div className="hidden group-hover:flex items-center space-x-0.5">
            <button
              type="button"
              onClick={() => startRenaming(f)}
              className={`p-1 transition rounded-lg ${isSelected ? 'text-white/80 hover:text-white hover:bg-white/20' : 'text-text-tertiary hover:text-brand hover:bg-brand/10'}`}
              title="重命名此文件夹"
              aria-label={`重命名 ${f.name}`}
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setDeletingFolder(f)}
              className={`p-1 transition rounded-lg ${isSelected ? 'text-white/80 hover:text-white hover:bg-white/20' : 'text-text-tertiary hover:text-red-500 hover:bg-red-500/10'}`}
              title="删除此文件夹"
              aria-label={`删除文件夹 ${f.name}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

};
