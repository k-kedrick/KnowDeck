import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ExternalLink, FileText, FolderInput, Image as ImageIcon, Trash2, Video, X } from 'lucide-react';
import { api } from '../../../api';
import type { DocumentSummary, Media, MediaFolder } from '../../../api';
import { ModalPortal } from '../../../components/ModalPortal';

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
interface MediaDetailModalProps {
  media: Media;
  folders: MediaFolder[];
  onClose: () => void;
  onMove: (media: Media) => void;
  onRequestDelete: (media: Media) => void;
  onPreviewImage: (media: Media) => void;
}

export const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
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
