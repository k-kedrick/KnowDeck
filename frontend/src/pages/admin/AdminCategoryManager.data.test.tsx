import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '../../api';

const apiMocks = vi.hoisted(() => ({
  getAdminCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, ...apiMocks } };
});

import { AdminCategoryManager } from './AdminCategoryManager';

const category = (id: number, name: string, slug: string, parentId = 0, children: Category[] = []): Category => ({
  id,
  name,
  slug,
  description: '',
  icon: 'BookOpen',
  parent_id: parentId,
  sort_order: 1,
  doc_count: 0,
  children,
  created_at: '2026-09-09T00:00:00Z',
  updated_at: '2026-09-09T00:00:00Z',
});

describe('AdminCategoryManager category data refresh', () => {
  beforeEach(() => {
    const development = category(1, '开发', 'development', 0, [
      category(2, 'React', 'react', 1),
      category(3, 'Go', 'go', 1),
    ]);
    const operations = category(4, '运维', 'operations', 0, [category(5, 'Docker', 'docker', 4)]);
    const python = category(6, 'Python', 'python');
    apiMocks.getAdminCategories.mockReset()
      .mockResolvedValueOnce([development, operations])
      .mockResolvedValueOnce([development, operations, python]);
    apiMocks.createCategory.mockReset().mockResolvedValue(python);
    apiMocks.updateCategory.mockReset();
    apiMocks.deleteCategory.mockReset();
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() });
  });

  afterEach(cleanup);

  it('refetches the complete tree after create instead of replacing it with the create response', async () => {
    render(<MemoryRouter><AdminCategoryManager /></MemoryRouter>);
    expect(await screen.findByText('开发')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('分类名称 *'), { target: { value: 'Python' } });
    fireEvent.change(screen.getByLabelText('URL Slug'), { target: { value: 'python' } });
    fireEvent.click(screen.getByRole('button', { name: '确认创建分类' }));

    await waitFor(() => expect(apiMocks.createCategory).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Python',
      slug: 'python',
      parent_id: 0,
    })));
    await waitFor(() => expect(apiMocks.getAdminCategories).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Python')).toBeTruthy();
    expect(screen.getByText('开发')).toBeTruthy();
    expect(screen.getByText('运维')).toBeTruthy();
    expect(screen.getByText('共 6 个分类 · 默认展开一级分类')).toBeTruthy();
  });
});
