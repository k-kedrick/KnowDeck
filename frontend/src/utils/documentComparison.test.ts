import { describe, expect, it } from 'vitest';
import { documentSnapshotsEqual, type EditableDocumentSnapshot } from './documentComparison';

const snapshot = (overrides: Partial<EditableDocumentSnapshot> = {}): EditableDocumentSnapshot => ({
  title: '标题',
  slug: 'title',
  content: '# 正文',
  excerpt: '描述',
  cover: '/cover.png',
  status: 'draft',
  categoryId: 2,
  isPinned: false,
  tags: ['GPT', 'React'],
  ...overrides,
});

describe('documentSnapshotsEqual', () => {
  it('treats normalized text and reordered tags as equal', () => {
    expect(documentSnapshotsEqual(
      snapshot({ title: ' 标题\r\n', tags: ['React', 'GPT'] }),
      snapshot(),
    )).toBe(true);
  });

  it.each([
    ['title', { title: '新标题' }],
    ['slug', { slug: 'new-slug' }],
    ['content', { content: '新正文' }],
    ['excerpt', { excerpt: '新描述' }],
    ['cover', { cover: '/new.png' }],
    ['status', { status: 'published' }],
    ['category', { categoryId: 3 }],
    ['pinned', { isPinned: true }],
    ['tags', { tags: ['Claude'] }],
  ])('detects a %s change', (_field, change) => {
    expect(documentSnapshotsEqual(snapshot(), snapshot(change))).toBe(false);
  });
});
