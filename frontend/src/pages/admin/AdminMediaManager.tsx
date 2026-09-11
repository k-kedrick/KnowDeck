import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Folder,
  FolderPlus,
  FolderInput,
  X,
  BookOpen,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../api';
import type {
  Media,
  MediaFolder,
  DocumentSummary,
  BatchDeleteResult,
  UploadMediaOptions,
  UploadProgress,
} from '../../api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { ImageLightbox } from '../../components/ImageLightbox';
import { ModalPortal } from '../../components/ModalPortal';
import { MediaDetailModal } from './media/MediaDetailModal';
import { MediaSidebar } from './media/MediaSidebar';
import { MediaWorkspace } from './media/MediaWorkspace';
import type { ViewMode } from './media/mediaTypes';

const folderDepth = (folder: MediaFolder, folders: MediaFolder[], seen = new Set<number>()): number => {
  if (!folder.parent_id || seen.has(folder.id)) return 0;
  seen.add(folder.id);
  const parent = folders.find((candidate) => candidate.id === folder.parent_id);
  return parent ? Math.min(7, 1 + folderDepth(parent, folders, seen)) : 0;
};
const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatRemainingTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '计算中';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}分${remainingSeconds}秒` : `${remainingSeconds}秒`;
};

const uploadProgressLabel = (progress: UploadProgress | null) => {
  if (!progress || progress.completedChunks === 0) return '正在创建上传任务…';
  const percent = Math.round((progress.uploadedBytes / progress.totalBytes) * 100);
  return `已上传 ${progress.completedChunks}/${progress.chunks}（${percent}%）· ${(progress.speedBytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s · 剩余约 ${formatRemainingTime(progress.remainingSeconds)}`;
};

const getMediaPreviewFromLocation = (): Media | null => {
  if (typeof window === 'undefined') return null;

  const search = new URLSearchParams(window.location.search);
  const url = search.get('url');
  const originalName = search.get('name');
  if (search.get('preview') !== '1' || !url || !originalName) return null;

  return {
    id: Number(search.get('id')) || 0,
    original_name: originalName,
    filename: search.get('filename') || originalName,
    path: search.get('path') || '',
    url,
    media_type: search.get('type') || '',
    mime_type: search.get('mime') || '',
    size: Number(search.get('size')) || 0,
    duration: Number(search.get('duration')) || 0,
    thumbnail: search.get('thumbnail') || '',
    created_at: search.get('createdAt') || '',
  };
};


// 媒体详情与完整属性查看模态框

export const AdminMediaManager: React.FC = () => {
  // 视图模式：all / unclassified / unused / doc / folder
  const [viewMode, setViewMode] = useState<ViewMode>({ type: 'all' });

  // 媒体列表与筛选状态
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(40);
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('latest');
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  // 消息提示
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 文件夹与统计
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [totalMediaCount, setTotalMediaCount] = useState<number>(0);
  const [unclassifiedCount, setUnclassifiedCount] = useState<number>(0);
  const [usedCount, setUsedCount] = useState<number>(0);
  const [unusedCount, setUnusedCount] = useState<number>(0);

  // 维护动作状态
  const [isReconciling, setIsReconciling] = useState<boolean>(false);

  // 批量选择
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 弹窗状态
  const [detailedMedia, setDetailedMedia] = useState<Media | null>(null);
  const [previewingMedia, setPreviewingMedia] = useState<Media | null>(getMediaPreviewFromLocation);

  // 新建文件夹
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);

  // 删除文件夹
  const [deletingFolder, setDeletingFolder] = useState<MediaFolder | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState<boolean>(false);

  // 移动单个媒体 / 批量移动媒体
  const [movingMedia, setMovingMedia] = useState<Media | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<number>(0);
  const [isMoving, setIsMoving] = useState<boolean>(false);
  const [showBatchMoveModal, setShowBatchMoveModal] = useState<boolean>(false);

  // 单个删除 / 拦截保护
  const [deletingMedia, setDeletingMedia] = useState<Media | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteBlockedInfo, setDeleteBlockedInfo] = useState<{ media: Media; docs: DocumentSummary[] } | null>(null);

  // 批量删除
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState<boolean>(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState<boolean>(false);

  // 请求防抖/竞态控制器
  const abortControllerRef = useRef<AbortController | null>(null);

  const closeMediaPreview = useCallback(() => {
    setPreviewingMedia(null);
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      if (search.get('preview') === '1') {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  // 键盘快捷监听 Esc 关闭所有弹窗
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
        setDeletingFolder(null);
        setMovingMedia(null);
        setShowBatchMoveModal(false);
        setDeletingMedia(null);
        setDeleteBlockedInfo(null);
        setShowBatchDeleteModal(false);
        setDetailedMedia(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 加载文件夹列表与统计
  const loadFolders = useCallback(async () => {
    try {
      const res = await api.getMediaFolders();
      setFolders(res.folders || []);
      setTotalMediaCount(res.total_media || 0);
      setUnclassifiedCount(res.unclassified_media || 0);
      setUsedCount(res.used_media ?? 0);
      setUnusedCount(res.unused_media ?? 0);
    } catch (err: any) {
      console.error('加载文件夹列表失败:', err);
    }
  }, []);

  // 加载媒体文件列表（支持竞态保护）
  const loadMedia = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setErrorMsg(null);

    try {
      const params: Parameters<typeof api.getAdminMedia>[0] = {
        page,
        page_size: pageSize,
        media_type: mediaTypeFilter || undefined,
        keyword: keyword.trim() || undefined,
        sort_by: sortBy,
      };

      if (viewMode.type === 'unclassified') {
        params.folder_id = 0;
      } else if (viewMode.type === 'folder') {
        params.folder_id = viewMode.folderId;
      } else if (viewMode.type === 'unused') {
        params.unused = true;
      }

      const res = await api.getAdminMedia(params, controller.signal);
      if (controller.signal.aborted || abortControllerRef.current !== controller) return;
      setMediaList(res.list || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted || abortControllerRef.current !== controller) return;
      setErrorMsg(err.message || '加载媒体文件库失败');
      setMediaList([]);
    } finally {
      if (abortControllerRef.current === controller) setLoading(false);
    }
  }, [viewMode, page, pageSize, mediaTypeFilter, keyword, sortBy]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  // 切换视图时清空选择与页码
  const handleSwitchView = (newView: ViewMode) => {
    setViewMode(newView);
    setPage(1);
    setSelectedIds(new Set());
  };

  // 批量选择切换
  const toggleSelectOne = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isCurrentPageAllSelected = useMemo(() => {
    if (mediaList.length === 0) return false;
    return mediaList.every((m) => selectedIds.has(m.id));
  }, [mediaList, selectedIds]);

  const toggleSelectAllCurrentPage = () => {
    if (isCurrentPageAllSelected) {
      // 取消当前页全选
      setSelectedIds((prev) => {
        const next = new Set(prev);
        mediaList.forEach((m) => next.delete(m.id));
        return next;
      });
    } else {
      // 全选当前页
      setSelectedIds((prev) => {
        const next = new Set(prev);
        mediaList.forEach((m) => next.add(m.id));
        return next;
      });
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // 上传文件处理
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);
    setUploadProgress(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const uploadOptions: UploadMediaOptions = { onProgress: setUploadProgress };
      if (viewMode.type === 'folder' && viewMode.folderId > 0) {
        uploadOptions.folder_id = viewMode.folderId;
      }

      await api.uploadMedia(file, uploadOptions);
      setSuccessMsg(`✨ 媒体资源《${file.name}》上传成功！`);
      loadMedia();
      loadFolders();
    } catch (err: any) {
      setErrorMsg(err.message || '上传文件失败');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  // 重新扫描引用关系 (Reconcile)
  const handleReconcileReferences = async () => {
    setIsReconciling(true);
    setErrorMsg(null);
    try {
      const res = await api.rebuildMediaReferences();
      setSuccessMsg(`✨ 媒体引用关系扫描重构完成！已扫描 ${res.documents_scanned} 篇文档。`);
      await loadFolders();
      await loadMedia();
    } catch (err: any) {
      setErrorMsg(err.message || '重新扫描媒体引用失败');
    } finally {
      setIsReconciling(false);
    }
  };

  // 触发单个删除（执行防误删安全检查）
  const handleRequestDelete = async (m: Media) => {
    // 检查是否有引用
    if (m.reference_count && m.reference_count > 0) {
      if (m.references && m.references.length > 0) {
        setDeleteBlockedInfo({ media: m, docs: m.references });
      } else {
        // 请求后台最新引用
        try {
          const res = await api.getMediaReferences(m.id);
          setDeleteBlockedInfo({ media: m, docs: res.documents || [] });
        } catch {
          setDeleteBlockedInfo({
            media: m,
            docs: [{ id: 0, title: '未知关联文档', slug: '', excerpt: '', cover: '', views: 0, updated_at: '' }],
          });
        }
      }
      return;
    }

    // 0 引用则弹出普通确认删除
    setDeletingMedia(m);
  };

  // 确认单个删除
  const handleConfirmDeleteMedia = async () => {
    if (!deletingMedia) return;
    setIsDeleting(true);
    try {
      await api.deleteMedia(deletingMedia.id);
      setSuccessMsg(`🗑️ 媒体资源《${deletingMedia.original_name}》已从磁盘彻底删除！`);
      setDeletingMedia(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deletingMedia.id);
        return next;
      });
      loadMedia();
      loadFolders();
    } catch (err: any) {
      setErrorMsg(err.message || '删除媒体文件失败');
    } finally {
      setIsDeleting(false);
    }
  };

  // 批量移动确认
  const handleConfirmBatchMove = async () => {
    if (selectedIds.size === 0) return;
    setIsMoving(true);
    try {
      const ids = Array.from(selectedIds);
      await api.batchMoveMedia(ids, targetFolderId);
      const targetName =
        targetFolderId === 0
          ? '未分类资源'
          : folders.find((f) => f.id === targetFolderId)?.name || '目标文件夹';
      setSuccessMsg(`✨ 已将选中的 ${ids.length} 项资源移动至《${targetName}》`);
      setShowBatchMoveModal(false);
      clearSelection();
      loadMedia();
      loadFolders();
    } catch (err: any) {
      setErrorMsg(err.message || '批量移动失败');
    } finally {
      setIsMoving(false);
    }
  };

  // 移动单个媒体确认
  const handleConfirmSingleMove = async () => {
    if (!movingMedia) return;
    setIsMoving(true);
    try {
      await api.moveMedia(movingMedia.id, targetFolderId);
      const targetName =
        targetFolderId === 0
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

  // 批量删除统计与安全检查
  const batchDeleteStats = useMemo(() => {
    const selectedMedia = mediaList.filter((m) => selectedIds.has(m.id));
    const safeCount = selectedMedia.filter((m) => !m.reference_count || m.reference_count === 0).length;
    const blockedCount = selectedMedia.filter((m) => m.reference_count && m.reference_count > 0).length;
    return {
      total: selectedIds.size,
      safeCount,
      blockedCount,
    };
  }, [mediaList, selectedIds]);

  // 确认批量删除
  const handleConfirmBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBatchDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const res: BatchDeleteResult = await api.batchDeleteMedia(ids);
      if (res.deleted_count > 0 && res.blocked_count > 0) {
        setSuccessMsg(`🗑️ 成功清理 ${res.deleted_count} 项无引用文件；${res.blocked_count} 项因正在被文档引用已自动受保护跳过！`);
      } else if (res.deleted_count > 0) {
        setSuccessMsg(`🗑️ 成功清理选中的 ${res.deleted_count} 项闲置资源！`);
      } else if (res.blocked_count > 0) {
        setErrorMsg(`⚠️ 所选的 ${res.blocked_count} 项资源全部正在被文档引用，已全部安全保留，未执行删除。`);
      }
      setShowBatchDeleteModal(false);
      clearSelection();
      loadMedia();
      loadFolders();
    } catch (err: any) {
      setErrorMsg(err.message || '批量删除失败');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // 创建自定义文件夹
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
      handleSwitchView({ type: 'folder', folderId: created.id, folderName: created.name });
    } catch (err: any) {
      setErrorMsg(err.message || '创建文件夹失败');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // 删除自定义文件夹
  const handleConfirmDeleteFolder = async () => {
    if (!deletingFolder) return;
    setIsDeletingFolder(true);
    try {
      await api.deleteMediaFolder(deletingFolder.id, true);
      setSuccessMsg(`🗑️ 文件夹《${deletingFolder.name}》已删除，内含文件已安全保留在「未分类」中`);
      if (viewMode.type === 'folder' && viewMode.folderId === deletingFolder.id) {
        handleSwitchView({ type: 'all' });
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

  // 当前视图描述与标题
  const currentViewInfo = (() => {
    switch (viewMode.type) {
      case 'all':
        return {
          title: '全部资源',
          count: totalMediaCount,
          desc: `汇总全库素材：包含所有文章引用与自定义文件夹中的资源（共 ${totalMediaCount} 项）`,
        };
      case 'unclassified':
        return {
          title: '未分类资源',
          count: unclassifiedCount,
          desc: `尚未归入任何自定义文件夹的素材（共 ${unclassifiedCount} 项）`,
        };
      case 'unused':
        return {
          title: '未使用资源',
          count: unusedCount,
          desc: `当前未被任何文档引用的闲置资源（共 ${unusedCount} 项，可安全批量清理）`,
        };
      case 'folder':
        return {
          title: viewMode.folderName,
          count: total,
          folderId: viewMode.folderId,
          desc: `自定义文件夹《${viewMode.folderName}》中的素材`,
        };
    }
  })();

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <AdminPageHeader
        icon={ImageIcon}
        title="媒体资源库"
        description="统一管理系统图片、视频与附件资产，支持文档引用追踪、批量管理与安全防误删保护。"
        actions={(
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setNewFolderName('');
                setShowCreateModal(true);
              }}
              className="inline-flex min-h-9 items-center space-x-1.5 rounded-lg border border-border-default bg-surface px-3 text-xs font-semibold text-text-primary shadow-xs transition hover:bg-surface-subtle"
            >
              <FolderPlus className="w-4 h-4 text-brand" />
              <span>新建文件夹</span>
            </button>

            <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-brand px-3.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-brand-hover focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2">
              <Upload className="w-4 h-4" />
              <span>
                {uploading
                  ? uploadProgressLabel(uploadProgress)
                  : viewMode.type === 'folder'
                  ? `上传至《${viewMode.folderName}》`
                  : '上传媒体资源'}
              </span>
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
      {uploading && (
        <div role="status" aria-live="polite" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100">
          <div className="flex items-center justify-between gap-3 font-semibold">
            <span>大文件上传中</span>
            <span>{uploadProgress ? `${Math.round((uploadProgress.uploadedBytes / uploadProgress.totalBytes) * 100)}%` : '准备中'}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900">
            <div className="h-full rounded-full bg-blue-600 transition-[width] duration-300" style={{ width: `${uploadProgress ? Math.round((uploadProgress.uploadedBytes / uploadProgress.totalBytes) * 100) : 0}%` }} />
          </div>
          <p className="mt-2 text-xs font-medium">{uploadProgressLabel(uploadProgress)}</p>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <div className="flex items-center space-x-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="p-1 hover:text-red-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-600 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <div className="flex items-center space-x-2 min-w-0">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="p-1 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Dual-Column Workspace */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[15.5rem_minmax(0,1fr)]">
        {/* ================= 1. Left Sidebar Navigation ================= */}
        <MediaSidebar
          folders={folders}
          isReconciling={isReconciling}
          onReconcileReferences={handleReconcileReferences}
          onRequestCreateFolder={() => { setNewFolderName(''); setShowCreateModal(true); }}
          onRequestDeleteFolder={setDeletingFolder}
          onSwitchView={handleSwitchView}
          totalMediaCount={totalMediaCount}
          unclassifiedCount={unclassifiedCount}
          unusedCount={unusedCount}
          usedCount={usedCount}
          viewMode={viewMode}
        />

        {/* ================= 2. Right Main Media Grid & Toolbar ================= */}
        <MediaWorkspace
          currentViewInfo={currentViewInfo}
          folders={folders}
          isCurrentPageAllSelected={isCurrentPageAllSelected}
          keyword={keyword}
          loading={loading}
          mediaList={mediaList}
          mediaTypeFilter={mediaTypeFilter}
          onClearSelection={clearSelection}
          onKeywordChange={(value) => { setKeyword(value); setPage(1); }}
          onMediaTypeFilterChange={(value) => { setMediaTypeFilter(value); setPage(1); }}
          onOpenBatchDelete={() => setShowBatchDeleteModal(true)}
          onOpenBatchMove={() => { setTargetFolderId(0); setShowBatchMoveModal(true); }}
          onOpenDetail={setDetailedMedia}
          onOpenMove={(media) => { setMovingMedia(media); setTargetFolderId(media.folder_id || 0); }}
          onPageChange={setPage}
          onPageSizeChange={(value) => { setPageSize(value); setPage(1); }}
          onRequestDelete={handleRequestDelete}
          onSortByChange={(value) => { setSortBy(value); setPage(1); }}
          onSwitchView={handleSwitchView}
          onToggleSelect={toggleSelectOne}
          onToggleSelectAllCurrentPage={toggleSelectAllCurrentPage}
          page={page}
          pageSize={pageSize}
          selectedIds={selectedIds}
          sortBy={sortBy}
          total={total}
          viewMode={viewMode}
        />
      </div>

      {/* ================= 3. Modals & Dialogs ================= */}

      {/* 3.1 资源详情模态框 */}
      {detailedMedia && (
        <MediaDetailModal
          media={detailedMedia}
          folders={folders}
          onClose={() => setDetailedMedia(null)}
          onMove={(m) => {
            setMovingMedia(m);
            setTargetFolderId(m.folder_id || 0);
          }}
          onRequestDelete={(m) => handleRequestDelete(m)}
          onPreviewImage={setPreviewingMedia}
        />
      )}

      {/* 3.2 遗留 URL 预览弹窗 */}
      {previewingMedia && (
        <ImageLightbox
          src={previewingMedia.url}
          alt={previewingMedia.original_name}
          onClose={closeMediaPreview}
        />
      )}

      {/* 3.3 新建文件夹模态框 */}
      {showCreateModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-sm rounded-xl border border-border-default bg-surface-elevated p-5 shadow-modal space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
                <div className="flex items-center space-x-2 text-text-primary font-bold text-sm">
                  <FolderPlus className="w-4 h-4 text-brand" />
                  <span>新建自定义文件夹</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-text-tertiary hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateFolder} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">文件夹名称</label>
                  <input
                    type="text"
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="例如：产品插画、博客封面、头像素材..."
                    className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-xs text-text-primary outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    maxLength={50}
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-subtle rounded-lg transition"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={!newFolderName.trim() || isCreatingFolder}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-lg transition disabled:opacity-50"
                  >
                    {isCreatingFolder ? '正在创建…' : '立即创建'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 3.4 移动单个资源模态框 */}
      {movingMedia && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-xl border border-border-default bg-surface-elevated p-5 shadow-modal space-y-3.5"
            >
              <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
                <div className="flex items-center space-x-2 text-text-primary font-bold text-sm">
                  <FolderInput className="w-4 h-4 text-brand" />
                  <span>移动资源到文件夹</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMovingMedia(null)}
                  className="text-text-tertiary hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-text-tertiary">
                请选择归档目标文件夹（当前选择：《<strong className="text-text-primary">{movingMedia.original_name}</strong>》）：
              </div>

              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                <label
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition text-xs ${
                    targetFolderId === 0
                      ? 'border-brand bg-brand/5 text-brand font-bold'
                      : 'border-border-subtle hover:bg-surface-subtle'
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
                    style={{ paddingLeft: `${10 + folderDepth(f, folders) * 16}px` }}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition text-xs ${
                      targetFolderId === f.id
                        ? 'border-brand bg-brand/5 text-brand font-bold'
                        : 'border-border-subtle hover:bg-surface-subtle'
                    }`}
                  >
                    <span className="flex items-center space-x-2 truncate">
                      <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="truncate">{f.name}</span>
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
                  className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-subtle rounded-lg transition"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSingleMove}
                  disabled={isMoving}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-lg transition disabled:opacity-50"
                >
                  {isMoving ? '正在移动…' : '确认移动'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 3.5 批量移动资源模态框 */}
      {showBatchMoveModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-xl border border-border-default bg-surface-elevated p-5 shadow-modal space-y-3.5"
            >
              <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
                <div className="flex items-center space-x-2 text-text-primary font-bold text-sm">
                  <FolderInput className="w-4 h-4 text-brand" />
                  <span>批量移动选中的 {selectedIds.size} 项资源</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBatchMoveModal(false)}
                  className="text-text-tertiary hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-text-tertiary">
                请选择目标自定义文件夹：
              </div>

              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                <label
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition text-xs ${
                    targetFolderId === 0
                      ? 'border-brand bg-brand/5 text-brand font-bold'
                      : 'border-border-subtle hover:bg-surface-subtle'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <Folder className="w-4 h-4 text-slate-400" />
                    <span>移入未分类资源</span>
                  </span>
                  <input
                    type="radio"
                    name="targetFolderBatch"
                    checked={targetFolderId === 0}
                    onChange={() => setTargetFolderId(0)}
                    className="accent-brand"
                  />
                </label>

                {folders.map((f) => (
                  <label
                    key={f.id}
                    style={{ paddingLeft: `${10 + folderDepth(f, folders) * 16}px` }}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition text-xs ${
                      targetFolderId === f.id
                        ? 'border-brand bg-brand/5 text-brand font-bold'
                        : 'border-border-subtle hover:bg-surface-subtle'
                    }`}
                  >
                    <span className="flex items-center space-x-2 truncate">
                      <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </span>
                    <input
                      type="radio"
                      name="targetFolderBatch"
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
                  onClick={() => setShowBatchMoveModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-subtle rounded-lg transition"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBatchMove}
                  disabled={isMoving}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-lg transition disabled:opacity-50"
                >
                  {isMoving ? '正在移动…' : `确认移动 (${selectedIds.size} 项)`}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 3.6 单个删除确认模态框（仅当 0 引用时允许） */}
      {deletingMedia && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md space-y-4 rounded-xl border border-border-default bg-surface-elevated p-5 shadow-modal"
            >
              <div className="flex items-center space-x-2.5 text-red-600 dark:text-red-400 border-b border-border-subtle pb-2.5">
                <Trash2 className="w-4 h-4 shrink-0" />
                <h3 className="truncate text-sm font-bold text-text-primary">
                  确认删除《{deletingMedia.original_name}》？
                </h3>
              </div>

              <div className="text-xs text-text-secondary space-y-2 leading-relaxed">
                <p>
                  即将从磁盘和数据库中彻底删除文件：
                  <strong className="block mt-1 font-mono text-text-primary bg-surface-subtle p-2 rounded border border-border-subtle break-all">
                    {deletingMedia.original_name} ({formatSize(deletingMedia.size)})
                  </strong>
                </p>
                <p className="text-text-tertiary">
                  经安全校验，该媒体当前<strong>没有被任何已发布或草稿文档引用</strong>，可放心删除。
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setDeletingMedia(null)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-subtle rounded-lg transition disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteMedia}
                  disabled={isDeleting}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 shadow-xs"
                >
                  {isDeleting ? '正在删除…' : '确认彻底删除'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 3.7 拦截删除防误删警示模态框（引用大于 0 时禁止直接物理删除） */}
      {deleteBlockedInfo && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md space-y-4 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-surface-elevated p-5 shadow-modal"
            >
              <div className="flex items-center space-x-2.5 text-amber-600 dark:text-amber-400 border-b border-border-subtle pb-2.5">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold text-text-primary">系统已拦截删除（正被文档引用）</h3>
              </div>

              <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
                <p>
                  媒体《<strong className="text-text-primary">{deleteBlockedInfo.media.original_name}</strong>》当前正被以下{' '}
                  <strong className="text-amber-600 dark:text-amber-400">{deleteBlockedInfo.docs.length}</strong> 篇文档使用：
                </p>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {deleteBlockedInfo.docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border-subtle"
                    >
                      <div className="flex items-center space-x-2 min-w-0 pr-2">
                        <BookOpen className="w-3.5 h-3.5 text-brand shrink-0" />
                        <span className="font-semibold text-text-primary truncate" title={doc.title}>
                          {doc.title}
                        </span>
                      </div>
                      <a
                        href={`/wang/documents/${doc.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-[11px] text-brand hover:underline shrink-0"
                      >
                        <span>查看文档</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-[11px]">
                  🛡️ <strong>安全保护机制</strong>：为防止已发布文章中的配图与视频链接失效，系统默认禁止直接删除被引用的媒体。请先在相关文档中移除此媒体，或确认无引用后再行删除。
                </div>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setDeleteBlockedInfo(null)}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-brand hover:bg-brand-hover rounded-lg transition shadow-xs"
                >
                  我知道了
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 3.8 批量安全删除确认模态框 */}
      {showBatchDeleteModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md space-y-4 rounded-xl border border-border-default bg-surface-elevated p-5 shadow-modal"
            >
              <div className="flex items-center space-x-2.5 text-red-600 dark:text-red-400 border-b border-border-subtle pb-2.5">
                <Trash2 className="w-4 h-4 shrink-0" />
                <h3 className="text-sm font-bold text-text-primary">批量安全删除资源确认</h3>
              </div>

              <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
                <p>
                  你已勾选了 <strong className="text-text-primary">{batchDeleteStats.total}</strong> 项资源。系统将执行严格的安全引用校验：
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/40 p-3">
                    <div className="font-semibold text-emerald-700 dark:text-emerald-300">✅ 可安全删除</div>
                    <div className="mt-1 text-base font-bold text-emerald-800 dark:text-emerald-200 tabular-nums">
                      {batchDeleteStats.safeCount} 项
                    </div>
                    <div className="mt-0.5 text-[11px] text-emerald-600/80 dark:text-emerald-400/80">未被任何文档引用</div>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/40 p-3">
                    <div className="font-semibold text-amber-700 dark:text-amber-300">🛡️ 受保护跳过</div>
                    <div className="mt-1 text-base font-bold text-amber-800 dark:text-amber-200 tabular-nums">
                      {batchDeleteStats.blockedCount} 项
                    </div>
                    <div className="mt-0.5 text-[11px] text-amber-600/80 dark:text-amber-400/80">正被文档使用，将自动保留</div>
                  </div>
                </div>

                {batchDeleteStats.safeCount === 0 ? (
                  <p className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[11px]">
                    ⚠️ 当前所选资源全部正在被文档引用，为防止文章图片失效，无法执行任何删除。
                  </p>
                ) : (
                  <p className="text-text-tertiary">
                    点击「确认安全删除」后，系统将仅彻底删除上述 {batchDeleteStats.safeCount} 项未引用资源，自动跳过被引用的资源。
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setShowBatchDeleteModal(false)}
                  disabled={isBatchDeleting}
                  className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-subtle rounded-lg transition disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBatchDelete}
                  disabled={isBatchDeleting || batchDeleteStats.safeCount === 0}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 shadow-xs"
                >
                  {isBatchDeleting ? '正在执行…' : `安全删除 (${batchDeleteStats.safeCount} 项)`}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 3.9 删除文件夹确认模态框 */}
      {deletingFolder && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-xl border border-border-default bg-surface-elevated p-5 shadow-modal space-y-4"
            >
              <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 font-bold text-sm border-b border-border-subtle pb-2.5">
                <Trash2 className="w-4 h-4" />
                <span>确认删除文件夹《{deletingFolder.name}》？</span>
              </div>

              <div className="space-y-2 text-xs text-text-secondary leading-relaxed">
                <p>
                  即将删除自定义文件夹 <strong className="text-text-primary">{deletingFolder.name}</strong>。
                </p>
                <p className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300">
                  🛡️ 安全保护提示：文件夹内的媒体文件（共 {deletingFolder.media_count} 项）将<strong>安全移至「未分类资源」中</strong>，不会删除文件或损坏文章图片。
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setDeletingFolder(null)}
                  disabled={isDeletingFolder}
                  className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-subtle rounded-lg transition disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteFolder}
                  disabled={isDeletingFolder}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 shadow-xs"
                >
                  {isDeletingFolder ? '正在删除…' : '确认删除文件夹'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
