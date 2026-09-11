import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createNewDocumentDraftPath,
  getDraftKey,
  LEGACY_NEW_DRAFT_KEY,
  listLocalDrafts,
  localDraftDiffersFromDocument,
  migrateLegacyNewDraft,
  readLocalDraft,
  writeLocalDraft,
} from './useDocumentDraft';
import type { LocalDraftData, ServerDocumentSnapshot } from './useDocumentDraft';

const draft = (overrides: Partial<LocalDraftData> = {}): LocalDraftData => ({
  id: 'new',
  title: '标题',
  slug: 'title',
  content: '# 正文',
  excerpt: '描述',
  cover: '/cover.png',
  status: 'draft',
  categoryId: 2,
  isPinned: false,
  tags: ['GPT'],
  updatedAt: 100,
  ...overrides,
});

describe('local document drafts', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps multiple new drafts independently and sorts them by update time', () => {
    writeLocalDraft(getDraftKey('new', 'draft-id-one'), draft({ localDraftId: 'draft-id-one', updatedAt: 100 }));
    writeLocalDraft(getDraftKey('new', 'draft-id-two'), draft({ localDraftId: 'draft-id-two', title: '第二篇', updatedAt: 200 }));

    const entries = listLocalDrafts();
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.draft.title)).toEqual(['第二篇', '标题']);
  });

  it('creates a distinct draft URL for each new document', () => {
    const first = createNewDocumentDraftPath();
    const second = createNewDocumentDraftPath();
    expect(first).toMatch(/^\/wang\/documents\/new\?draft=/);
    expect(second).not.toBe(first);
  });

  it('migrates the legacy new draft only after the new record is written', () => {
    localStorage.setItem(LEGACY_NEW_DRAFT_KEY, JSON.stringify(draft()));
    const id = migrateLegacyNewDraft('migrated-draft');

    expect(id).toBe('migrated-draft');
    expect(localStorage.getItem(LEGACY_NEW_DRAFT_KEY)).toBeNull();
    expect(readLocalDraft(getDraftKey('new', id))?.localDraftId).toBe(id);
  });

  it('returns the actual destination when the requested draft ID is occupied', () => {
    localStorage.setItem(LEGACY_NEW_DRAFT_KEY, JSON.stringify(draft()));
    writeLocalDraft(getDraftKey('new', 'occupied-draft'), draft({ localDraftId: 'occupied-draft', title: '已有草稿' }));

    const id = migrateLegacyNewDraft('occupied-draft');

    expect(id).not.toBe('occupied-draft');
    expect(readLocalDraft(getDraftKey('new', id))?.title).toBe('标题');
    expect(readLocalDraft(getDraftKey('new', 'occupied-draft'))?.title).toBe('已有草稿');
    expect(localStorage.getItem(LEGACY_NEW_DRAFT_KEY)).toBeNull();
  });

  it('retains the legacy record when migration storage fails', () => {
    localStorage.setItem(LEGACY_NEW_DRAFT_KEY, JSON.stringify(draft()));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });

    migrateLegacyNewDraft('failed-migration');
    expect(localStorage.getItem(LEGACY_NEW_DRAFT_KEY)).not.toBeNull();
    expect(localStorage.getItem(getDraftKey('new', 'failed-migration'))).toBeNull();
  });

  it('detects differences across every editable metadata field', () => {
    const local = draft({ id: 9 });
    const server: ServerDocumentSnapshot = {
      title: local.title,
      slug: local.slug,
      content: local.content,
      excerpt: local.excerpt,
      cover: local.cover,
      status: local.status,
      category_id: local.categoryId,
      is_pinned: local.isPinned,
      tags: [...local.tags],
    };
    expect(localDraftDiffersFromDocument(local, server)).toBe(false);

    const changes: ServerDocumentSnapshot[] = [
      { ...server, title: '新标题' },
      { ...server, slug: 'new-slug' },
      { ...server, content: '新正文' },
      { ...server, excerpt: '新描述' },
      { ...server, cover: '/new.png' },
      { ...server, status: 'published' },
      { ...server, category_id: 3 },
      { ...server, is_pinned: true },
      { ...server, tags: ['Claude'] },
    ];
    changes.forEach((changed) => expect(localDraftDiffersFromDocument(local, changed)).toBe(true));
  });
});
