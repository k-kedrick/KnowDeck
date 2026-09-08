import { describe, expect, it } from 'vitest';
import { buildDocumentPayload } from './documentPayload';

describe('buildDocumentPayload', () => {
  it('preserves the existing document save contract for a populated document', () => {
    expect(buildDocumentPayload({
      title: '  标题  ',
      slug: '  article  ',
      content: '# 正文',
      excerpt: '  摘要  ',
      cover: ' /cover.png ',
      status: 'published',
      categoryId: 2,
      isPinned: true,
      tags: ['GPT', 'React'],
    })).toEqual({
      title: '标题',
      slug: 'article',
      content: '# 正文',
      excerpt: '摘要',
      cover: '/cover.png',
      status: 'published',
      access_level: 'public',
      category_id: 2,
      is_pinned: true,
      tags: ['GPT', 'React'],
    });
  });

  it('converts blank optional text fields to undefined without changing status or tags', () => {
    expect(buildDocumentPayload({
      title: '标题',
      slug: '  ',
      content: '',
      excerpt: '',
      cover: '',
      status: 'draft',
      categoryId: 0,
      isPinned: false,
      tags: [],
    })).toEqual({
      title: '标题',
      slug: undefined,
      content: '',
      excerpt: undefined,
      cover: undefined,
      status: 'draft',
      access_level: 'public',
      category_id: 0,
      is_pinned: false,
      tags: [],
    });
  });
});
