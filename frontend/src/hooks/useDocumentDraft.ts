import { documentSnapshotsEqual } from '../utils/documentComparison';

export interface LocalDraftData {
  version?: 2;
  localDraftId?: string;
  id: number | 'new';
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  cover: string;
  status: string;
  categoryId: number;
  isPinned: boolean;
  tags: string[];
  updatedAt: number;
  serverUpdatedAt?: string;
  editorEngine?: 'legacy' | 'tiptap';
  contentFormat?: 'empty' | 'markdown' | 'html' | 'mixed';
}

export interface LocalDraftEntry {
  key: string;
  kind: 'new' | 'document';
  documentId?: number;
  draft: LocalDraftData;
}

export interface ServerDocumentSnapshot {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  cover: string;
  status: string;
  category_id: number;
  is_pinned: boolean;
  tags?: string[];
}

export const DRAFT_STORAGE_EVENT = 'kb:drafts-changed';
export const LEGACY_NEW_DRAFT_KEY = 'kb_draft_doc_new';
const DOCUMENT_DRAFT_PREFIX = 'kb_draft_doc_';
const NEW_DRAFT_PREFIX = 'kb_draft_new_';
const VALID_DRAFT_ID = /^[a-zA-Z0-9-]{8,80}$/;
let migratingLegacyDraft = false;

const notifyDraftChange = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DRAFT_STORAGE_EVENT));
};

export const localDraftDiffersFromDocument = (draft: LocalDraftData, document: ServerDocumentSnapshot) => {
  return !documentSnapshotsEqual(
    {
      title: draft.title,
      slug: draft.slug,
      content: draft.content,
      excerpt: draft.excerpt,
      cover: draft.cover,
      status: draft.status,
      categoryId: draft.categoryId,
      isPinned: draft.isPinned,
      tags: draft.tags,
    },
    {
      title: document.title,
      slug: document.slug,
      content: document.content,
      excerpt: document.excerpt,
      cover: document.cover,
      status: document.status,
      categoryId: document.category_id,
      isPinned: document.is_pinned,
      tags: document.tags || [],
    },
  );
};

export const createLocalDraftId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const isValidLocalDraftId = (value?: string | null): value is string => (
  Boolean(value && VALID_DRAFT_ID.test(value))
);

export const getDraftKey = (docId?: string | number, localDraftId?: string): string => {
  if (docId && docId !== 'new') return `${DOCUMENT_DRAFT_PREFIX}${docId}`;
  if (isValidLocalDraftId(localDraftId)) return `${NEW_DRAFT_PREFIX}${localDraftId}`;
  return LEGACY_NEW_DRAFT_KEY;
};

export const createNewDocumentDraftPath = (localDraftId = createLocalDraftId()): string => (
  `/admin/documents/new?draft=${encodeURIComponent(localDraftId)}`
);

const normalizeDraft = (value: unknown, key: string): LocalDraftData | null => {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<LocalDraftData>;
  if (typeof parsed.content !== 'string' || typeof parsed.updatedAt !== 'number') return null;

  const newDraftId = key.startsWith(NEW_DRAFT_PREFIX) ? key.slice(NEW_DRAFT_PREFIX.length) : undefined;
  const documentIdText = key.startsWith(DOCUMENT_DRAFT_PREFIX) && key !== LEGACY_NEW_DRAFT_KEY
    ? key.slice(DOCUMENT_DRAFT_PREFIX.length)
    : '';
  const documentId = /^\d+$/.test(documentIdText) ? Number(documentIdText) : undefined;

  return {
    version: parsed.version === 2 ? 2 : undefined,
    localDraftId: parsed.localDraftId || newDraftId,
    id: documentId ?? (typeof parsed.id === 'number' ? parsed.id : 'new'),
    title: typeof parsed.title === 'string' ? parsed.title : '',
    slug: typeof parsed.slug === 'string' ? parsed.slug : '',
    content: parsed.content,
    excerpt: typeof parsed.excerpt === 'string' ? parsed.excerpt : '',
    cover: typeof parsed.cover === 'string' ? parsed.cover : '',
    status: typeof parsed.status === 'string' ? parsed.status : 'draft',
    categoryId: typeof parsed.categoryId === 'number' ? parsed.categoryId : 0,
    isPinned: Boolean(parsed.isPinned),
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    updatedAt: parsed.updatedAt,
    serverUpdatedAt: typeof parsed.serverUpdatedAt === 'string' ? parsed.serverUpdatedAt : undefined,
    editorEngine: parsed.editorEngine,
    contentFormat: parsed.contentFormat,
  };
};

export const readLocalDraft = (key: string): LocalDraftData | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return normalizeDraft(JSON.parse(raw), key);
  } catch (error) {
    console.warn('[Draft] Failed to read or parse local draft:', error);
    return null;
  }
};

export const writeLocalDraft = (key: string, data: LocalDraftData): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify({ ...data, version: 2 }));
    notifyDraftChange();
    return true;
  } catch (error) {
    console.warn('[Draft] Failed to write local draft:', error);
    return false;
  }
};

export const removeLocalDraft = (key: string): boolean => {
  try {
    localStorage.removeItem(key);
    notifyDraftChange();
    return true;
  } catch (error) {
    console.warn('[Draft] Failed to remove local draft:', error);
    return false;
  }
};

export const migrateLegacyNewDraft = (requestedId?: string): string => {
  const localDraftId = isValidLocalDraftId(requestedId) ? requestedId : createLocalDraftId();
  const legacy = readLocalDraft(LEGACY_NEW_DRAFT_KEY);
  if (!legacy) return localDraftId;

  const targetKey = getDraftKey('new', localDraftId);
  if (readLocalDraft(targetKey)) {
    migrateLegacyNewDraft(createLocalDraftId());
    return localDraftId;
  }
  const migrated = writeLocalDraft(targetKey, { ...legacy, version: 2, id: 'new', localDraftId });
  if (migrated) removeLocalDraft(LEGACY_NEW_DRAFT_KEY);
  return localDraftId;
};

export const listLocalDrafts = (): LocalDraftEntry[] => {
  try {
    if (!migratingLegacyDraft && localStorage.getItem(LEGACY_NEW_DRAFT_KEY)) {
      migratingLegacyDraft = true;
      try {
        migrateLegacyNewDraft();
      } finally {
        migratingLegacyDraft = false;
      }
    }
    const entries: LocalDraftEntry[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || key === LEGACY_NEW_DRAFT_KEY) continue;

      if (key.startsWith(NEW_DRAFT_PREFIX)) {
        const localDraftId = key.slice(NEW_DRAFT_PREFIX.length);
        if (!isValidLocalDraftId(localDraftId)) continue;
        const draft = readLocalDraft(key);
        if (draft) entries.push({ key, kind: 'new', draft: { ...draft, localDraftId } });
        continue;
      }

      if (key.startsWith(DOCUMENT_DRAFT_PREFIX)) {
        const documentIdText = key.slice(DOCUMENT_DRAFT_PREFIX.length);
        if (!/^\d+$/.test(documentIdText)) continue;
        const draft = readLocalDraft(key);
        if (draft) entries.push({ key, kind: 'document', documentId: Number(documentIdText), draft });
      }
    }
    return entries.sort((left, right) => right.draft.updatedAt - left.draft.updatedAt);
  } catch (error) {
    console.warn('[Draft] Failed to list local drafts:', error);
    return [];
  }
};

export const useDocumentDraft = () => ({
  getDraftKey,
  readDraft: readLocalDraft,
  writeDraft: writeLocalDraft,
  removeDraft: removeLocalDraft,
  listDrafts: listLocalDrafts,
});
