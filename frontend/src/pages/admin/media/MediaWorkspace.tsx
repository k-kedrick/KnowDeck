import type { MouseEvent } from 'react';
import {
  ArrowUpDown, BookOpen, Check, CheckSquare, ChevronRight, FileText, Filter, Search,
  Folder, FolderInput, Image as ImageIcon, Info, Layers, LoaderCircle, Play,
  Square, Trash2, X,
} from 'lucide-react';
import type { Media, MediaFolder } from '../../../api';
import type { MediaViewInfo, ViewMode } from './mediaTypes';

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface MediaWorkspaceProps {
  currentViewInfo: MediaViewInfo;
  folders: MediaFolder[];
  isCurrentPageAllSelected: boolean;
  keyword: string;
  loading: boolean;
  mediaList: Media[];
  mediaTypeFilter: string;
  onClearSelection: () => void;
  onKeywordChange: (keyword: string) => void;
  onMediaTypeFilterChange: (mediaType: string) => void;
  onOpenBatchDelete: () => void;
  onOpenBatchMove: () => void;
  onOpenDetail: (media: Media) => void;
  onOpenMove: (media: Media) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRequestDelete: (media: Media) => void;
  onSortByChange: (sortBy: string) => void;
  onSwitchView: (viewMode: ViewMode) => void;
  onToggleSelect: (id: number, event: MouseEvent<HTMLButtonElement>) => void;
  onToggleSelectAllCurrentPage: () => void;
  page: number;
  pageSize: number;
  selectedIds: Set<number>;
  sortBy: string;
  total: number;
  viewMode: ViewMode;
}

export function MediaWorkspace({
  currentViewInfo, folders, isCurrentPageAllSelected, keyword, loading, mediaList,
  mediaTypeFilter, onClearSelection, onKeywordChange, onMediaTypeFilterChange,
  onOpenBatchDelete, onOpenBatchMove, onOpenDetail, onOpenMove, onPageChange,
  onPageSizeChange, onRequestDelete, onSortByChange, onSwitchView, onToggleSelect,
  onToggleSelectAllCurrentPage, page, pageSize, selectedIds, sortBy, total, viewMode,
}: MediaWorkspaceProps) {
  return (        <main className="min-w-0 space-y-3.5">
          {/* Breadcrumb & View Header */}
          <div className="flex flex-col justify-between gap-2 border-b border-border-subtle pb-3 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <div className="flex items-center space-x-1.5 text-xs text-text-tertiary">
                <button
                  type="button"
                  onClick={() => onSwitchView({ type: 'all' })}
                  className="hover:text-brand transition font-medium"
                >
                  媒体资源库
                </button>
                <ChevronRight className="w-3 h-3" />
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
                  {viewMode.type === 'folder' && <Folder className="w-4 h-4 text-amber-500 shrink-0" />}
                  {viewMode.type === 'unused' && <span className="text-emerald-500">⚪</span>}
                  {viewMode.type === 'unclassified' && <Folder className="w-4 h-4 text-slate-400 shrink-0" />}
                  {viewMode.type === 'all' && <Layers className="w-4 h-4 text-indigo-500 shrink-0" />}
                  <span className="truncate max-w-sm">{currentViewInfo.title}</span>
                  <span className="text-xs font-normal text-text-tertiary">
                    ({loading ? '加载中…' : `共 ${total} 项`})
                  </span>
                </h2>

              </div>
              <p className="text-[11px] text-text-tertiary">{currentViewInfo.desc}</p>
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
                  onKeywordChange(e.target.value);
                }}
                placeholder="搜索资源名称、原始文件名、关联文档..."
                className="h-9 w-full rounded-lg border border-border-default bg-surface pl-10 pr-3 text-xs text-text-primary outline-none transition focus:border-brand focus:ring-1 focus:ring-brand"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => onKeywordChange('')}
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
                  onMediaTypeFilterChange(e.target.value);
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
                  onSortByChange(e.target.value);
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
                  onPageSizeChange(Math.max(1, Math.min(100, Number(e.target.value) || 1)));
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
                  onClick={onToggleSelectAllCurrentPage}
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
                    onOpenBatchMove();
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-border-default bg-surface hover:bg-surface-subtle text-xs font-semibold text-text-primary transition shadow-2xs"
                >
                  <FolderInput className="w-3.5 h-3.5 text-text-tertiary" />
                  <span>批量移动</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenBatchDelete}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 text-xs font-semibold transition shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>批量删除 ({selectedIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={onClearSelection}
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
                        onClick={(event) => onToggleSelect(m.id, event)}
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
                      onClick={() => onOpenDetail(m)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onOpenDetail(m);
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
                          onClick={() => onOpenDetail(m)}
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
                                onOpenDetail(m);
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
                            onClick={() => onOpenDetail(m)}
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
                              onOpenMove(m);
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
                            onClick={() => onRequestDelete(m)}
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
                  onClick={() => onPageChange(page - 1)}
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
                  onClick={() => onPageChange(page + 1)}
                  className="px-3 py-1 bg-surface border border-border-default hover:bg-surface-subtle rounded-md disabled:opacity-40 font-medium transition"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </main>  );
}