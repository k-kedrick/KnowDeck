import type { DocumentSaveReq } from '../api';

export interface DocumentPayloadInput {
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

export const buildDocumentPayload = ({
  title,
  slug,
  content,
  excerpt,
  cover,
  status,
  categoryId,
  isPinned,
  tags,
}: DocumentPayloadInput): DocumentSaveReq => ({
  title: title.trim(),
  slug: slug.trim() || undefined,
  content,
  excerpt: excerpt.trim() || undefined,
  cover: cover.trim() || undefined,
  status,
  category_id: categoryId,
  is_pinned: isPinned,
  tags,
});
