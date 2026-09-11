import type { Tag } from '../api';

const CACHE_KEY = 'cached_site_tags';

export const getCachedSiteTags = (): Tag[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const cacheSiteTags = (tags: Tag[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(tags));
  } catch {}
};
