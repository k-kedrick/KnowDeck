import { beforeEach, describe, expect, it } from 'vitest';
import { cacheSiteTags, getCachedSiteTags } from './siteTagCache';

describe('site tag cache', () => {
  beforeEach(() => localStorage.clear());

  it('returns an empty list when the cache is absent or malformed', () => {
    expect(getCachedSiteTags()).toEqual([]);
    localStorage.setItem('cached_site_tags', 'not-json');
    expect(getCachedSiteTags()).toEqual([]);
  });

  it('round-trips tags shared by public pages', () => {
    const tags = [{ id: 1, name: 'React', slug: 'react', doc_count: 2, created_at: '' }];
    cacheSiteTags(tags);
    expect(getCachedSiteTags()).toEqual(tags);
  });
});
