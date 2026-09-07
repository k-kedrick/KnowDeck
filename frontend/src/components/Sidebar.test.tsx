import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

const tree = [{
  id: 1,
  name: '指南',
  slug: 'guide',
  icon: '',
  documents: [{
    id: 1,
    title: '开始使用',
    slug: 'getting-started',
    excerpt: '',
    cover: '',
    views: 0,
    updated_at: '2026-01-01T00:00:00Z',
  }],
}];

describe('Sidebar', () => {
  it('separates category expansion from document navigation', () => {
    const onSelectDocument = vi.fn();
    render(
      <Sidebar
        tree={tree}
        currentSlug={null}
        onSelectDocument={onSelectDocument}
        isOpen
        onCloseMobile={vi.fn()}
      />,
    );

    const categoryButton = screen.getByRole('button', { name: '折叠分类：指南' });
    fireEvent.click(categoryButton);
    expect(onSelectDocument).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '开始使用' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '展开分类：指南' }));
    fireEvent.click(screen.getByRole('button', { name: '开始使用' }));
    expect(onSelectDocument).toHaveBeenCalledOnce();
    expect(onSelectDocument).toHaveBeenCalledWith('getting-started');
  });
});
