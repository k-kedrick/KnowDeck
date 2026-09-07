export interface EditableDocumentSnapshot {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  cover: string;
  status: string;
  categoryId: number;
  isPinned: boolean;
  tags: string[];
}

const normalizedText = (value?: string) => (value || '').replace(/\r\n/g, '\n').trim();

const sameTags = (left: string[], right: string[]) => (
  [...left].sort().join('\u0000') === [...right].sort().join('\u0000')
);

export const documentSnapshotsEqual = (
  left: EditableDocumentSnapshot,
  right: EditableDocumentSnapshot,
): boolean => (
  normalizedText(left.title) === normalizedText(right.title)
  && normalizedText(left.slug) === normalizedText(right.slug)
  && normalizedText(left.content) === normalizedText(right.content)
  && normalizedText(left.excerpt) === normalizedText(right.excerpt)
  && normalizedText(left.cover) === normalizedText(right.cover)
  && (left.status || '') === (right.status || '')
  && (left.categoryId || 0) === (right.categoryId || 0)
  && Boolean(left.isPinned) === Boolean(right.isPinned)
  && sameTags(left.tags || [], right.tags || [])
);
