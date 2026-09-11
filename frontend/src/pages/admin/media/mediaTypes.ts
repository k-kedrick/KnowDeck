export type ViewMode =
  | { type: 'all' }
  | { type: 'unclassified' }
  | { type: 'unused' }
  | { type: 'folder'; folderId: number; folderName: string };

export interface MediaViewInfo {
  title: string;
  count: number;
  desc: string;
}