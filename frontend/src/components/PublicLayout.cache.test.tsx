import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useOutletContext } from 'react-router-dom';
import type { CategoryTreeNode, SiteInfo } from '../api';
import { PublicLayout } from './PublicLayout';
import type { PublicOutletContext } from './publicLayoutContext';

const apiMocks = vi.hoisted(() => ({
  getSiteInfo: vi.fn(),
  getKnowledgeTree: vi.fn(),
}));

vi.mock('../api', () => ({ api: apiMocks }));
vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: null, loading: false, logout: vi.fn() }) }));

const siteInfo: SiteInfo = {
  site_name: '当前站点',
  site_subtitle: '',
  site_logo: '',
  footer_text: '',
  allow_download: true,
  doc_count: 0,
  category_count: 1,
  tag_count: 0,
};

const tree: CategoryTreeNode[] = [{ id: 1, name: '当前分类', slug: 'current', icon: 'BookOpen', children: [], documents: [] }];

const Probe = () => {
  const { siteInfo: currentSiteInfo, tree: currentTree } = useOutletContext<PublicOutletContext>();
  return <output data-testid="public-layout-state">{`${currentSiteInfo?.site_name ?? 'null'}:${currentTree.length}`}</output>;
};

const renderPublicLayout = () => render(
  <MemoryRouter>
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="*" element={<Probe />} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

describe('PublicLayout public API state', () => {
  beforeEach(() => {
    localStorage.clear();
    apiMocks.getSiteInfo.mockReset();
    apiMocks.getKnowledgeTree.mockReset();
  });

  afterEach(() => vi.restoreAllMocks());

  it('ignores legacy localStorage values and starts from empty API state', () => {
    localStorage.setItem('cached_site_info', JSON.stringify({ site_name: '旧站点' }));
    localStorage.setItem('cached_site_tree', JSON.stringify([{ id: 2, name: '旧分类' }]));
    apiMocks.getSiteInfo.mockReturnValue(new Promise(() => undefined));
    apiMocks.getKnowledgeTree.mockReturnValue(new Promise(() => undefined));

    renderPublicLayout();

    expect(screen.getByTestId('public-layout-state').textContent).toBe('null:0');
  });

  it('publishes successful API responses to the public outlet context', async () => {
    apiMocks.getSiteInfo.mockResolvedValue(siteInfo);
    apiMocks.getKnowledgeTree.mockResolvedValue(tree);

    renderPublicLayout();

    await waitFor(() => expect(screen.getByTestId('public-layout-state').textContent).toBe('当前站点:1'));
  });

  it('keeps default state when both public API requests fail', async () => {
    apiMocks.getSiteInfo.mockRejectedValue(new Error('unavailable'));
    apiMocks.getKnowledgeTree.mockRejectedValue(new Error('unavailable'));

    renderPublicLayout();

    await waitFor(() => expect(screen.getByTestId('public-layout-state').textContent).toBe('null:0'));
  });
});
