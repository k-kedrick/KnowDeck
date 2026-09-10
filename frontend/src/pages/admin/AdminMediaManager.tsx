import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Image as ImageIcon,
  Video,
  FileText,
  Upload,
  Search,
  Check,
  Trash2,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Folder,
  FolderPlus,
  FolderInput,
  Edit2,
  X,
  Layers,
  ChevronRight,
  BookOpen,
  Plus,
  HardDrive,
  LoaderCircle,
  Play,
  RefreshCw,
  Info,
  ShieldAlert,
  CheckSquare,
  Square,
  ArrowUpDown,
  Filter,
  CircleDot,
} from 'lucide-react';
import { api } from '../../api';
import type {
  Media,
  MediaFolder,
  DocumentMediaRef,
  DocumentSummary,
  BatchDeleteResult,
  UploadMediaOptions,
} from '../../api';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { ImageLightbox } from '../../components/ImageLightbox';
import { ModalPortal } from '../../components/ModalPortal';

type ViewMode =
  | { type: 'all' }
  | { type: 'unclassified' }
  | { type: 'unused' }
  | { type: 'doc'; docId: number; docTitle: string }
  | { type: 'folder'; folderId: number; folderName: string };

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

const folderDepth = (folder: MediaFolder, folders: MediaFolder[], seen = new Set<number>()): number => {
  if (!folder.parent_id || seen.has(folder.id)) return 0;
  seen.add(folder.id);
  const parent = folders.find((candidate) => candidate.id === folder.parent_id);
  return parent ? Math.min(7, 1 + folderDepth(parent, folders, seen)) : 0;
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
interface MediaDetailModalProps {
  media: Media;
  folders: MediaFolder[];
  onClose: () => void;
  onMove: (media: Media) => void;
  onRequestDelete: (media: Media) => void;
  onPreviewImage: (media: Media) => void;
}

const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
  media,
  folders,
  onClose,
  onMove,
  onRequestDelete,
  onPreviewImage,
}) => {
  const [docReferences, setDocReferences] = useState<DocumentSummary[]>(media.references || []);
  const [loadingRefs, setLoadingRefs] = useState(false);

  useEffect(() => {
    if ((!media.references || media.references.length === 0) && media.reference_count && media.reference_count > 0) {
      setLoadingRefs(true);
      api
        .getMediaReferences(media.id)
        .then((res) => {
          if (res && res.documents) {
            setDocReferences(res.documents);
          }
        })
        .catch((err) => console.error('获取引用关系失败:', err))
        .finally(() => setLoadingRefs(false));
    }
  }, [media]);

  const folderName = useMemo(() => {
    if (!media.folder_id || media.folder_id === 0) return '未分类资源';
    const found = folders.find((f) => f.id === media.folder_id);
    return found ? found.name : '自定义文件夹';
  }, [folders, media.folder_id]);

  const sourceLabel = useMemo(() => {
    if (media.source === 'document/editor') return '文档编辑器上传';
    if (media.source === 'manual upload') return '手动后台上传';
    return '历史导入 / 遗留资源';
  }, [media.source]);

  const isImage = media.media_type === 'image';
  const isVideo = media.media_type === 'video';

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          className="flex flex-col w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-border-default bg-surface-elevated shadow-modal"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5 bg-surface">
            <div className="flex items-center space-x-2.5 min-w-0 pr-3">
              {isImage ? (
                <ImageIcon className="w-5 h-5 text-brand shrink-0" />
              ) : isVideo ? (
                <Video className="w-5 h-5 text-indigo-500 shrink-0" />
              ) : (
                <FileText className="w-5 h-5 text-amber-500 shrink-0" />
              )}
              <h3 className="text-sm font-bold text-text-primary truncate" title={media.original_name}>
                {media.original_name}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-surface-subtle transition"
              aria-label="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] overflow-y-auto divide-y md:divide-y-0 md:divide-x divide-border-subtle">
            {/* Left Preview */}
            <div className="flex flex-col items-center justify-center p-6 bg-surface-subtle/50 min-h-64">
              {isImage ? (
                <button
                  type="button"
                  onClick={() => onPreviewImage(media)}
                  className="cursor-zoom-in rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  aria-label={`查看图片：${media.original_name}`}
                >
                  <img
                    src={media.url}
                    alt={media.original_name}
                    className="max-h-72 w-auto object-contain rounded-lg border border-border-subtle bg-white shadow-xs dark:bg-slate-900"
                  />
                </button>
              ) : isVideo ? (
                <video
                  src={media.url}
                  controls
                  className="max-h-72 w-full rounded-lg border border-border-subtle shadow-xs bg-black"
                >
                  您的浏览器不支持视频播放
                </video>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 space-y-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-elevated border border-border-subtle shadow-sm">
                    <FileText className="w-8 h-8 text-text-tertiary" />
                  </div>
                  <span className="text-xs font-mono font-bold uppercase text-text-secondary">
                    {media.mime_type || 'FILE'}
                  </span>
                  <a
                    href={media.url}
                    target="_blank"
                    rel="noreferrer"
                    download={media.original_name}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-brand bg-brand/10 hover:bg-brand/20 rounded-lg transition"
                  >
                    <span>下载此文件</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

            </div>

            {/* Right Details */}
            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">基本信息</div>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-3 border border-border-subtle">
                  <div>
                    <span className="text-text-tertiary">文件大小</span>
                    <div className="font-semibold text-text-primary mt-0.5">{formatSize(media.size)}</div>
                  </div>
                  <div>
                    <span className="text-text-tertiary">文件格式</span>
                    <div className="font-semibold text-text-primary mt-0.5">{media.mime_type || '未知'}</div>
                  </div>
                  <div>
                    <span className="text-text-tertiary">上传时间</span>
                    <div className="font-semibold text-text-primary mt-0.5">
                      {media.created_at ? new Date(media.created_at).toLocaleString('zh-CN') : '未知'}
                    </div>
                  </div>
                  <div>
                    <span className="text-text-tertiary">所属文件夹</span>
                    <div className="font-semibold text-text-primary mt-0.5 truncate">{folderName}</div>
                  </div>
                </div>
              </div>

              {/* Source & Filename */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">资源属性</div>
                <div className="space-y-1.5 rounded-xl bg-surface p-3 border border-border-subtle">
                  <div className="flex items-center justify-between">
                    <span className="text-text-tertiary">来源渠道:</span>
                    <span className="font-medium text-text-primary px-2 py-0.5 rounded bg-surface-subtle">
                      {sourceLabel}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-0.5 pt-1">
                    <span className="text-text-tertiary">存储文件名:</span>
                    <span className="font-mono text-[11px] text-text-secondary break-all bg-surface-subtle p-1.5 rounded border border-border-subtle/50">
                      {media.filename}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-0.5 pt-1">
                    <span className="text-text-tertiary">访问 URL:</span>
                    <span className="font-mono text-[11px] text-text-secondary break-all bg-surface-subtle p-1.5 rounded border border-border-subtle/50">
                      {media.url}
                    </span>
                  </div>
                </div>
              </div>

              {/* Document References */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                    文档引用关联 ({docReferences.length})
                  </span>
                  {docReferences.length === 0 && !loadingRefs && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium">
                      ⚪ 未使用资源
                    </span>
                  )}
                </div>

                {loadingRefs ? (
                  <div className="p-3 text-center text-text-tertiary animate-pulse">加载引用关系中...</div>
                ) : docReferences.length === 0 ? (
                  <div className="p-3 rounded-xl bg-surface border border-dashed border-border-subtle text-text-tertiary text-center leading-relaxed">
                    当前暂无任何已发布或草稿文档引用该媒体，可安全清理。
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {docReferences.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border-subtle hover:border-brand/40 transition"
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
                          <span>编辑</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle p-3.5 bg-surface">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onMove(media);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-border-default bg-surface hover:bg-surface-subtle text-xs font-semibold text-text-primary transition shadow-xs"
              >
                <FolderInput className="w-3.5 h-3.5 text-text-tertiary" />
                <span>移动文件夹</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestDelete(media);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 text-xs font-semibold transition shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>删除资源</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

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
  const [uploadProgress, setUploadProgress] = useState<string>('');

  // 消息提示
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 文件夹与文档引用树
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [docRefs, setDocRefs] = useState<DocumentMediaRef[]>([]);
  const [totalMediaCount, setTotalMediaCount] = useState<number>(0);
  const [unclassifiedCount, setUnclassifiedCount] = useState<number>(0);
  const [usedCount, setUsedCount] = useState<number>(0);
  const [unusedCount, setUnusedCount] = useState<number>(0);
  const [foldersLoading, setFoldersLoading] = useState<boolean>(true);
  const [folderFilterQuery, setFolderFilterQuery] = useState<string>('');
  const [docFilterQuery, setDocFilterQuery] = useState<string>('');

  // 维护动作状态
  const [isReconciling, setIsReconciling] = useState<boolean>(false);

  // 批量选择
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 弹窗状态
  const [detailedMedia, setDetailedMedia] = useState<Media | null>(null);
  const [previewingMedia, setPreviewingMedia] = useState<Media | null>(getMediaPreviewFromLocation);

  // 新建/重命名文件夹
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null);
  const [renamingName, setRenamingName] = useState<string>('');
  const [isRenaming, setIsRenaming] = useState<boolean>(false);

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
        setRenamingFolderId(null);
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
    void foldersLoading;
  void setFolderFilterQuery;
  void setDocFilterQuery;
  void renamingFolderId;
  void isRenaming;
  void handleSaveRename;
  void filteredDocRefs;

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
      setUsedCount(res.used_media ?? 0);
      setUnusedCount(res.unused_media ?? 0);
      setDocRefs(res.document_refs || []);
    } catch (err: any) {
      console.error('加载文件夹列表失败:', err);
    } finally {
      setFoldersLoading(false);
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
      } else if (viewMode.type === 'doc') {
        params.document_id = viewMode.docId;
      } else if (viewMode.type === 'unused') {
        params.unused = true;
      }

      const res = await api.getAdminMedia(params, controller.signal);
      setMediaList(res.list || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setErrorMsg(err.message || '加载媒体文件库失败');
      setMediaList([]);
    } finally {
      setLoading(false);
    }
  }, [viewMode, page, pageSize, mediaTypeFilter, keyword, sortBy]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

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
    setUploadProgress('正在创建上传任务…');
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const uploadOptions: UploadMediaOptions = {
        onProgress: ({ completedChunks, chunks, uploadedBytes, totalBytes, speedBytesPerSecond, remainingSeconds }) => {
          const percent = Math.round((uploadedBytes / totalBytes) * 100);
          setUploadProgress(
            `已上传 ${completedChunks}/${chunks}（${percent}%）· ${(speedBytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s · 剩余约 ${formatRemainingTime(remainingSeconds)}`,
          );
        },
      };
      if (viewMode.type === 'folder' && viewMode.folderId > 0) {
        uploadOptions.folder_id = viewMode.folderId;
      } else if (viewMode.type === 'doc' && viewMode.docId > 0) {
        uploadOptions.document_id = viewMode.docId;
        uploadOptions.doc_title = viewMode.docTitle;
      }

      await api.uploadMedia(file, uploadOptions);
      setSuccessMsg(`✨ 媒体资源《${file.name}》上传成功！`);
      loadMedia();
      loadFolders();
    } catch (err: any) {
      setErrorMsg(err.message || '上传文件失败');
    } finally {
      setUploading(false);
      setUploadProgress('');
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

  // 保存文件夹重命名
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
      if (viewMode.type === 'folder' && viewMode.folderId === id) {
        setViewMode({ type: 'folder', folderId: id, folderName: trimmed });
      }
    } catch (err: any) {
      setErrorMsg(err.message || '重命名文件夹失败');
    } finally {
      setIsRenaming(false);
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

  // 搜索过滤文件夹和文档关联
  const filteredFolders = useMemo(() => {
    const q = folderFilterQuery.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, folderFilterQuery]);

  const filteredDocRefs = useMemo(() => {
    const q = docFilterQuery.trim().toLowerCase();
    if (!q) return docRefs;
    return docRefs.filter((d) => d.title.toLowerCase().includes(q));
  }, [docRefs, docFilterQuery]);

  // 当前视图描述与标题
  const currentViewInfo = useMemo(() => {
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
      case 'doc':
        return {
          title: viewMode.docTitle,
          count: total,
          documentId: viewMode.docId,
          desc: `文档智能关联：文档《${viewMode.docTitle}》中引用的全部媒体资源`,
        };
      case 'folder':
        return {
          title: viewMode.folderName,
          count: total,
          folderId: viewMode.folderId,
          desc: `自定义文件夹《${viewMode.folderName}》中的素材`,
        };
    }
  }, [viewMode, totalMediaCount, unclassifiedCount, unusedCount, total]);

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
                  ? uploadProgress || '正在上传…'
                  : viewMode.type === 'folder'
                  ? `上传至《${viewMode.folderName}》`
                  : viewMode.type === 'doc'
                  ? `上传并关联《${viewMode.docTitle}》`
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
        <aside className="min-w-0 lg:sticky lg:top-20 space-y-3">
          <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3 shadow-xs space-y-3.5">
            {/* Unified location tree: references and usage stay out of navigation. */}
            <div className="space-y-1.5">
              <button type="button" onClick={() => handleSwitchView({ type: 'all' })} className={`flex h-9 w-full items-center justify-between rounded-lg px-2 text-xs ${viewMode.type === 'all' ? 'bg-brand/10 text-brand font-semibold' : 'text-text-secondary hover:bg-surface-subtle'}`}>
                <span className="flex items-center gap-2"><Layers className="h-3.5 w-3.5" />媒体资源库</span><span className="tabular-nums">{totalMediaCount}</span>
              </button>
              <button type="button" onClick={() => handleSwitchView({ type: 'unclassified' })} className={`flex h-8 w-full items-center justify-between rounded-lg px-2 text-xs ${viewMode.type === 'unclassified' ? 'bg-brand/10 text-brand font-semibold' : 'text-text-secondary hover:bg-surface-subtle'}`}>
                <span className="flex items-center gap-2"><Folder className="h-3.5 w-3.5" />未整理</span><span className="tabular-nums">{unclassifiedCount}</span>
              </button>
              <button type="button" onClick={() => handleSwitchView({ type: 'unused' })} className={`flex h-8 w-full items-center justify-between rounded-lg px-2 text-xs ${viewMode.type === 'unused' ? 'bg-brand/10 text-brand font-semibold' : 'text-text-secondary hover:bg-surface-subtle'}`}>
                <span className="flex items-center gap-2"><CircleDot className="h-3.5 w-3.5" />未使用资源</span><span className="tabular-nums">{unusedCount}</span>
              </button>
              {filteredFolders.map((folder) => {
                const selected = viewMode.type === 'folder' && viewMode.folderId === folder.id;
                const depth = folderDepth(folder, folders);
                return <div key={folder.id} className={`group flex h-8 items-center justify-between rounded-lg pr-1 text-xs ${selected ? 'bg-brand/10 text-brand font-semibold' : 'text-text-secondary hover:bg-surface-subtle'}`} style={{ paddingLeft: `${8 + depth * 16}px` }}>
                  <button type="button" onClick={() => handleSwitchView({ type: 'folder', folderId: folder.id, folderName: folder.name })} className="flex min-w-0 flex-1 items-center gap-1.5 text-left"><ChevronRight className="h-3 w-3 text-text-tertiary" /><Folder className="h-3 w-3 text-amber-500" /><span className="truncate">{folder.name}</span></button>
                  <span className="tabular-nums group-hover:hidden">{folder.media_count}</span>
                  <div className="hidden gap-0.5 group-hover:flex"><button type="button" onClick={() => { setRenamingFolderId(folder.id); setRenamingName(folder.name); }} title="重命名"><Edit2 className="h-3 w-3" /></button><button type="button" onClick={() => setDeletingFolder(folder)} title="删除"><Trash2 className="h-3 w-3" /></button></div>
                </div>;
              })}
              <button type="button" onClick={() => { setNewFolderName(''); setShowCreateModal(true); }} className="flex h-8 w-full items-center gap-2 px-2 text-xs text-brand hover:bg-brand/10"><Plus className="h-3.5 w-3.5" />新建文件夹</button>
            </div>
            {/* Section 4: Global Stats & Reconcile */}
            <div className="space-y-2 border-t border-border-subtle pt-3">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                <span className="flex items-center space-x-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-brand" />
                  <span>资源库概况</span>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                <div className="rounded-lg bg-surface-subtle/80 p-1.5">
                  <div className="text-[10px] text-text-tertiary">总计</div>
                  <div className="font-bold text-text-primary tabular-nums mt-0.5">{totalMediaCount}</div>
                </div>
                <div className="rounded-lg bg-surface-subtle/80 p-1.5">
                  <div className="text-[10px] text-text-tertiary">已使用</div>
                  <div className="font-bold text-blue-600 dark:text-blue-400 tabular-nums mt-0.5">{usedCount}</div>
                </div>
                <div className="rounded-lg bg-surface-subtle/80 p-1.5">
                  <div className="text-[10px] text-text-tertiary">未使用</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">{unusedCount}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReconcileReferences}
                disabled={isReconciling}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg border border-border-default bg-surface hover:bg-surface-subtle text-[11px] font-medium text-text-secondary hover:text-text-primary transition shadow-2xs disabled:opacity-50"
                title="扫描所有文档内容并重新同步媒体引用关系"
              >
                <RefreshCw className={`w-3 h-3 ${isReconciling ? 'animate-spin text-brand' : 'text-text-tertiary'}`} />
                <span>{isReconciling ? '正在扫描引用…' : '重新扫描引用关系'}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ================= 2. Right Main Media Grid & Toolbar ================= */}
        <main className="min-w-0 space-y-3.5">
          {/* Breadcrumb & View Header */}
          <div className="flex flex-col justify-between gap-2 border-b border-border-subtle pb-3 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <div className="flex items-center space-x-1.5 text-xs text-text-tertiary">
                <button
                  type="button"
                  onClick={() => handleSwitchView({ type: 'all' })}
                  className="hover:text-brand transition font-medium"
                >
                  媒体资源库
                </button>
                <ChevronRight className="w-3 h-3" />
                {viewMode.type === 'doc' && (
                  <>
                    <span className="text-brand font-medium">文档关联</span>
                    <ChevronRight className="w-3 h-3" />
                  </>
                )}
                {viewMode.type === 'folder' && (
                  <>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">自定义文件夹</span>
                    <ChevronRight className="w-3 h-3" />
                  </>
                )}
                {viewMode.type === 'unused' && (
                  <>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">智能视图</span>
                    <ChevronRight className="w-3 h-3" />
                  </>
                )}
                <span className="font-semibold text-text-primary truncate max-w-xs">{currentViewInfo.title}</span>
              </div>

              <div className="flex items-center space-x-2.5">
                <h2 className="flex items-center space-x-2 text-sm md:text-base font-bold text-text-primary">
                  {viewMode.type === 'doc' && <BookOpen className="w-4 h-4 text-brand shrink-0" />}
                  {viewMode.type === 'folder' && <Folder className="w-4 h-4 text-amber-500 shrink-0" />}
                  {viewMode.type === 'unused' && <span className="text-emerald-500">⚪</span>}
                  {viewMode.type === 'unclassified' && <Folder className="w-4 h-4 text-slate-400 shrink-0" />}
                  {viewMode.type === 'all' && <Layers className="w-4 h-4 text-indigo-500 shrink-0" />}
                  <span className="truncate max-w-sm">{currentViewInfo.title}</span>
                  <span className="text-xs font-normal text-text-tertiary">
                    ({loading ? '加载中…' : `共 ${total} 项`})
                  </span>
                </h2>

                {viewMode.type === 'doc' && (
                  <a
                    href={`/wang/documents/${viewMode.docId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold text-brand bg-brand/10 hover:bg-brand/20 transition shadow-2xs"
                    title="在文档编辑器中打开本文档"
                  >
                    <span>打开此文档</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="text-[11px] text-text-tertiary">{currentViewInfo.desc}</p>
            </div>

            {/* Quick Actions in View Header */}
            <div className="flex items-center space-x-2 text-xs">
              {viewMode.type === 'folder' && (
                <button
                  type="button"
                  onClick={() => {
                    const target = folders.find((f) => f.id === viewMode.folderId);
                    if (target) {
                      setRenamingFolderId(target.id);
                      setRenamingName(target.name);
                    }
                  }}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-border-default bg-surface hover:bg-surface-subtle text-text-primary transition shadow-2xs font-medium text-xs"
                >
                  <Edit2 className="w-3 h-3 text-text-tertiary" />
                  <span>重命名</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter & Search & Sort Bar */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] xl:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 z-10 h-3.5 w-3.5 text-text-tertiary" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setPage(1);
                }}
                placeholder="搜索资源名称、原始文件名、关联文档..."
                className="h-9 w-full rounded-lg border border-border-default bg-surface pl-10 pr-3 text-xs text-text-primary outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  className="absolute right-2.5 top-2.5 text-text-tertiary hover:text-text-primary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Media Type Filter */}
            <div className="flex items-center space-x-1.5">
              <Filter className="w-3.5 h-3.5 text-text-tertiary hidden sm:block" />
              <select
                value={mediaTypeFilter}
                onChange={(e) => {
                  setMediaTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-border-default bg-surface px-2.5 text-xs text-text-primary outline-none transition focus:border-brand"
              >
                <option value="">全部类型 (图片/视频/文件)</option>
                <option value="image">图片 (Image)</option>
                <option value="video">视频 (Video)</option>
                <option value="file">附件文件 (File)</option>
              </select>
            </div>

            {/* Sort Filter */}
            <div className="flex items-center space-x-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-text-tertiary hidden sm:block" />
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-border-default bg-surface px-2.5 text-xs text-text-primary outline-none transition focus:border-brand"
              >
                <option value="latest">最新上传 (默认)</option>
                <option value="oldest">最早上传</option>
                <option value="name_asc">文件名 (A - Z)</option>
                <option value="name_desc">文件名 (Z - A)</option>
                <option value="size_desc">文件大小 (从大到小)</option>
                <option value="size_asc">文件大小 (从小到大)</option>
              </select>
            </div>

            <label className="flex items-center gap-1.5 sm:col-span-3 xl:col-span-1">
              <span className="whitespace-nowrap text-xs text-text-tertiary">每页</span>
              <input
                type="number"
                min={1}
                max={100}
                value={pageSize}
                onChange={(e) => {
                  const value = Math.max(1, Math.min(100, Number(e.target.value) || 1));
                  setPageSize(value);
                  setPage(1);
                }}
                className="h-9 w-20 rounded-lg border border-border-default bg-surface px-2 text-center text-xs text-text-primary outline-none transition focus:border-brand"
                aria-label="每页资源数量"
              />
              <span className="whitespace-nowrap text-xs text-text-tertiary">项</span>
            </label>
          </div>

          {/* Batch Selection Action Bar (when items selected) */}
          {selectedIds.size > 0 && (
            <div className="sticky top-20 z-20 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-brand/30 bg-surface-elevated/95 px-4 py-2.5 shadow-lg backdrop-blur-md transition">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={toggleSelectAllCurrentPage}
                  className="flex items-center space-x-1.5 text-xs font-semibold text-text-primary hover:text-brand transition"
                >
                  {isCurrentPageAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-brand" />
                  ) : (
                    <Square className="w-4 h-4 text-text-tertiary" />
                  )}
                  <span>{isCurrentPageAllSelected ? '取消全选当前页' : '全选当前页'}</span>
                </button>
                <span className="h-4 w-px bg-border-subtle" />
                <span className="text-xs font-medium text-text-secondary">
                  已选择 <strong className="text-brand font-bold tabular-nums">{selectedIds.size}</strong> 项资源
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setTargetFolderId(0);
                    setShowBatchMoveModal(true);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-border-default bg-surface hover:bg-surface-subtle text-xs font-semibold text-text-primary transition shadow-2xs"
                >
                  <FolderInput className="w-3.5 h-3.5 text-text-tertiary" />
                  <span>批量移动</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBatchDeleteModal(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 text-xs font-semibold transition shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>批量删除 ({selectedIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={clearSelection}
                  className="p-1.5 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-surface-subtle transition"
                  title="取消选择"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Media Grid Cards */}
          {loading ? (
            <div className="text-center py-24 text-xs text-text-tertiary animate-pulse space-y-2">
              <LoaderCircle className="w-6 h-6 mx-auto animate-spin text-brand" />
              <p>加载资源列表中...</p>
            </div>
          ) : mediaList.length === 0 ? (
            <div className="space-y-3 rounded-2xl border border-dashed border-border-subtle/80 py-20 text-center text-sm text-text-tertiary bg-surface-elevated/40">
              <ImageIcon className="mx-auto h-10 w-10 text-text-tertiary/40" />
              <div>
                <p className="font-semibold text-text-primary">当前视图下暂无媒体资源</p>
                <p className="mt-1 text-xs text-text-tertiary">
                  可点击右上角「上传媒体资源」导入，或在文档编辑时插入图片。
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {mediaList.map((m) => {
                const isSelected = selectedIds.has(m.id);
                const displayName = m.original_name?.trim() || m.filename;
                const folderName = m.folder_id
                  ? folders.find((folder) => folder.id === m.folder_id)?.name || '自定义文件夹'
                  : '未分类';
                const ext =
                  m.filename.split('.').pop()?.toUpperCase() ||
                  m.mime_type.split('/').pop()?.toUpperCase() ||
                  'FILE';
                const isImg = m.media_type === 'image';
                const isVid = m.media_type === 'video';

                return (
                  <div
                    key={m.id}
                    className={`group relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface-elevated transition-all duration-150 ${
                      isSelected
                        ? 'border-brand ring-2 ring-brand/30 shadow-md bg-brand/5'
                        : 'border-border-subtle hover:border-brand/40 hover:shadow-sm'
                    }`}
                  >
                    {/* Checkbox (Hover or Selected) */}
                    <div
                      className={`absolute left-2 top-2 z-10 transition-opacity ${
                        isSelected || selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => toggleSelectOne(m.id, e)}
                        className={`flex h-6 w-6 items-center justify-center rounded-md border shadow-sm transition ${
                          isSelected
                            ? 'border-brand bg-brand text-white'
                            : 'border-white/80 bg-black/40 text-white hover:bg-black/60'
                        }`}
                        aria-label={isSelected ? '取消勾选' : '勾选资源'}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5" /> : <div className="w-2.5 h-2.5 rounded-xs" />}
                      </button>
                    </div>

                    {/* Format Tag (Top Right) */}
                    <span className="absolute right-2 top-2 z-10 inline-flex h-5 items-center rounded bg-black/65 px-1.5 font-mono text-[9px] font-bold text-white uppercase backdrop-blur-2xs">
                      {isVid ? 'VIDEO' : ext}
                    </span>

                    {/* Card Preview Media Box */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setDetailedMedia(m)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setDetailedMedia(m);
                      }}
                      className="group/thumb relative flex aspect-[16/11] cursor-pointer items-center justify-center overflow-hidden bg-surface-subtle/80"
                    >
                      {isImg ? (
                        <img
                          src={m.url}
                          alt={m.original_name}
                          loading="lazy"
                          className="h-full w-full object-contain p-1.5 transition-transform duration-200 group-hover/thumb:scale-105"
                        />
                      ) : isVid ? (
                        <div className="relative flex h-full w-full items-center justify-center bg-slate-950">
                          {m.thumbnail ? (
                            <img
                              src={m.thumbnail}
                              alt={m.original_name}
                              className="h-full w-full object-cover opacity-75"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-linear-to-tr from-slate-900 to-indigo-950/60" />
                          )}
                          <div className="relative z-1 flex h-10 w-10 items-center justify-center rounded-full bg-brand/90 text-white shadow-md transition-transform group-hover/thumb:scale-110">
                            <Play className="w-4 h-4 ml-0.5 fill-current" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center p-3 text-text-tertiary space-y-1">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated border border-border-subtle shadow-xs">
                            <FileText className="w-5 h-5 text-text-tertiary" />
                          </div>
                          <span className="font-mono text-[10px] font-bold text-text-secondary">{ext}</span>
                        </div>
                      )}
                    </div>

                    {/* Card Information Body */}
                    <div className="flex min-h-48 flex-1 flex-col justify-between p-3.5">
                      <div className="space-y-2.5">
                        {/* Original Filename */}
                        <div
                          onClick={() => setDetailedMedia(m)}
                          className="min-h-10 cursor-pointer break-words font-semibold text-sm leading-5 text-text-primary line-clamp-2 hover:text-brand transition"
                          title={displayName}
                        >
                          {displayName}
                        </div>

                        {/* Size · Upload Date */}
                        <div className="flex items-center justify-between gap-3 text-xs text-text-tertiary">
                          <span className="shrink-0 tabular-nums">{formatSize(m.size)}</span>
                          <span className="shrink-0 tabular-nums">
                            {m.created_at
                              ? new Date(m.created_at).toLocaleDateString('zh-CN', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                })
                              : '最近'}
                          </span>
                        </div>

                        {/* Reference Badge */}
                        <div className="min-h-6">
                          {m.reference_count && m.reference_count > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailedMedia(m);
                              }}
                              className="inline-flex items-center space-x-1 rounded bg-blue-50 dark:bg-blue-950/60 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-300 hover:bg-blue-100 transition"
                              title={`当前被 ${m.reference_count} 篇文档引用，点击查看引用文档`}
                            >
                              <BookOpen className="w-3 h-3 shrink-0" />
                              <span>已使用 · {m.reference_count} 篇文档</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center space-x-1 rounded bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <span>●</span>
                              <span>未使用</span>
                            </span>
                          )}
                        </div>
                        <div className="min-h-5 break-words text-xs leading-5 text-text-tertiary line-clamp-1" title={folderName}>
                          文件夹：{folderName}
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="mt-3 flex items-center justify-end gap-1 border-t border-border-subtle pt-3">
                          <button
                            type="button"
                            onClick={() => setDetailedMedia(m)}
                            className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                            title="查看详情"
                            aria-label="查看详情"
                          >
                            <Info className="mr-1 w-3.5 h-3.5" />
                            <span>详情</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMovingMedia(m);
                              setTargetFolderId(m.folder_id || 0);
                            }}
                            className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium text-text-secondary transition hover:bg-surface-subtle hover:text-text-primary"
                            title="移动文件夹"
                            aria-label="移动文件夹"
                          >
                            <FolderInput className="mr-1 h-3.5 w-3.5" />
                            <span>移动</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRequestDelete(m)}
                            className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                            title="删除资源"
                            aria-label="删除资源"
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            <span>删除</span>
                          </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {total > pageSize && (
            <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3 text-xs">
              <span className="text-text-tertiary">
                显示第 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} 条，共 {total} 条
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 bg-surface border border-border-default hover:bg-surface-subtle rounded-md disabled:opacity-40 font-medium transition"
                >
                  上一页
                </button>
                <span className="font-semibold text-text-primary">
                  {page} / {Math.ceil(total / pageSize)}
                </span>
                <button
                  type="button"
                  disabled={page >= Math.ceil(total / pageSize)}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 bg-surface border border-border-default hover:bg-surface-subtle rounded-md disabled:opacity-40 font-medium transition"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </main>
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
