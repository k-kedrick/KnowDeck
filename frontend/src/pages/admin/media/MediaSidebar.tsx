import { ChevronRight, CircleDot, Folder, HardDrive, Layers, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { MediaFolder } from '../../../api';
import type { ViewMode } from './mediaTypes';

const folderDepth = (folder: MediaFolder, folders: MediaFolder[], seen = new Set<number>()): number => {
  if (!folder.parent_id || seen.has(folder.id)) return 0;
  seen.add(folder.id);
  const parent = folders.find((candidate) => candidate.id === folder.parent_id);
  return parent ? Math.min(7, 1 + folderDepth(parent, folders, seen)) : 0;
};

interface MediaSidebarProps {
  folders: MediaFolder[];
  isReconciling: boolean;
  onReconcileReferences: () => void;
  onRequestCreateFolder: () => void;
  onRequestDeleteFolder: (folder: MediaFolder) => void;
  onSwitchView: (viewMode: ViewMode) => void;
  totalMediaCount: number;
  unclassifiedCount: number;
  unusedCount: number;
  usedCount: number;
  viewMode: ViewMode;
}

export function MediaSidebar({
  folders, isReconciling, onReconcileReferences, onRequestCreateFolder,
  onRequestDeleteFolder, onSwitchView, totalMediaCount, unclassifiedCount,
  unusedCount, usedCount, viewMode,
}: MediaSidebarProps) {
  return (        <aside className="min-w-0 lg:sticky lg:top-20 space-y-3">
          <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3 shadow-xs space-y-3.5">
            {/* Unified location tree: references and usage stay out of navigation. */}
            <div className="space-y-1.5">
              <button type="button" onClick={() => onSwitchView({ type: 'all' })} className={`flex h-9 w-full items-center justify-between rounded-lg px-2 text-xs ${viewMode.type === 'all' ? 'bg-brand/10 text-brand font-semibold' : 'text-text-secondary hover:bg-surface-subtle'}`}>
                <span className="flex items-center gap-2"><Layers className="h-3.5 w-3.5" />媒体资源库</span><span className="tabular-nums">{totalMediaCount}</span>
              </button>
              <button type="button" onClick={() => onSwitchView({ type: 'unclassified' })} className={`flex h-8 w-full items-center justify-between rounded-lg px-2 text-xs ${viewMode.type === 'unclassified' ? 'bg-brand/10 text-brand font-semibold' : 'text-text-secondary hover:bg-surface-subtle'}`}>
                <span className="flex items-center gap-2"><Folder className="h-3.5 w-3.5" />未整理</span><span className="tabular-nums">{unclassifiedCount}</span>
              </button>
              <button type="button" onClick={() => onSwitchView({ type: 'unused' })} className={`flex h-8 w-full items-center justify-between rounded-lg px-2 text-xs ${viewMode.type === 'unused' ? 'bg-brand/10 text-brand font-semibold' : 'text-text-secondary hover:bg-surface-subtle'}`}>
                <span className="flex items-center gap-2"><CircleDot className="h-3.5 w-3.5" />未使用资源</span><span className="tabular-nums">{unusedCount}</span>
              </button>
              {folders.map((folder) => {
                const selected = viewMode.type === 'folder' && viewMode.folderId === folder.id;
                const depth = folderDepth(folder, folders);
                return <div key={folder.id} className={`group flex h-8 items-center justify-between rounded-lg pr-1 text-xs ${selected ? 'bg-brand/10 text-brand font-semibold' : 'text-text-secondary hover:bg-surface-subtle'}`} style={{ paddingLeft: `${8 + depth * 16}px` }}>
                  <button type="button" onClick={() => onSwitchView({ type: 'folder', folderId: folder.id, folderName: folder.name })} className="flex min-w-0 flex-1 items-center gap-1.5 text-left"><ChevronRight className="h-3 w-3 text-text-tertiary" /><Folder className="h-3 w-3 text-amber-500" /><span className="truncate">{folder.name}</span></button>
                  <span className="tabular-nums group-hover:hidden">{folder.media_count}</span>
                  <div className="hidden gap-0.5 group-hover:flex"><button type="button" onClick={() => onRequestDeleteFolder(folder)} title="删除"><Trash2 className="h-3 w-3" /></button></div>
                </div>;
              })}
              <button type="button" onClick={onRequestCreateFolder} className="flex h-8 w-full items-center gap-2 px-2 text-xs text-brand hover:bg-brand/10"><Plus className="h-3.5 w-3.5" />新建文件夹</button>
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
                onClick={onReconcileReferences}
                disabled={isReconciling}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg border border-border-default bg-surface hover:bg-surface-subtle text-[11px] font-medium text-text-secondary hover:text-text-primary transition shadow-2xs disabled:opacity-50"
                title="扫描所有文档内容并重新同步媒体引用关系"
              >
                <RefreshCw className={`w-3 h-3 ${isReconciling ? 'animate-spin text-brand' : 'text-text-tertiary'}`} />
                <span>{isReconciling ? '正在扫描引用…' : '重新扫描引用关系'}</span>
              </button>
            </div>
          </div>
        </aside>  );
}