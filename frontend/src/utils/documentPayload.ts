import type { DocumentAccessLevel, DocumentSaveReq } from '../api';

export interface DocumentPayloadInput {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  cover: string;
  status: string;
  accessLevel?: DocumentAccessLevel;
  categoryId: number;
  sortOrder?: number;
  isPinned: boolean;
  tags: string[];
}

export const buildDocumentPayload = ({
  title,
  slug,
  content,
  excerpt,
  cover,
  status,
  accessLevel,
  categoryId,
  sortOrder,
  isPinned,
  tags,
}: DocumentPayloadInput): DocumentSaveReq => ({
  title: title.trim(),
  slug: slug.trim() || undefined,
  content,
  excerpt: excerpt.trim() || undefined,
  cover: cover.trim() || undefined,
  status,
  access_level: accessLevel || 'public',
  category_id: categoryId,
  sort_order: sortOrder || 0,
  is_pinned: isPinned,
  tags,
});
