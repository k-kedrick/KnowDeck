import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocViewer } from './DocViewer';
const publicData = { document: { id: 1, title: '公开文章', slug: 'public', content: '# PUBLIC-HEADING-A\n\nPUBLIC-BODY-SECRET-A', excerpt: '', cover: '', status: 'published' as const, category_id: 1, author_id: 1, sort_order: 0, is_pinned: false, views: 0, created_at: '', updated_at: '' } };
const lockedData = { locked: true, document: { id: 2, title: '受限文章', slug: 'locked', status: 'published' as const, category_id: 1, author_id: 1, sort_order: 0, is_pinned: false, views: 0, cover: '', created_at: '', updated_at: '' } };
describe('DocViewer locked document', () => {
  it('renders locked state without body or TOC', () => { render(<MemoryRouter><DocViewer data={lockedData} loading={false} /></MemoryRouter>); expect(screen.getByTestId('document-locked').textContent).toContain('此文章仅对登录用户开放'); expect(screen.queryByTestId('desktop-toc')).toBeNull(); });
  it('clears prior public content and renders public content after locked navigation', () => { const view = render(<MemoryRouter><DocViewer data={publicData} loading={false} /></MemoryRouter>); expect(screen.getByText('PUBLIC-BODY-SECRET-A')).toBeTruthy(); view.rerender(<MemoryRouter><DocViewer data={lockedData} loading={false} /></MemoryRouter>); expect(screen.queryByText('PUBLIC-BODY-SECRET-A')).toBeNull(); expect(screen.queryByText('PUBLIC-HEADING-A')).toBeNull(); expect(screen.getByTestId('document-locked')).toBeTruthy(); view.rerender(<MemoryRouter><DocViewer data={publicData} loading={false} /></MemoryRouter>); expect(screen.getByText('PUBLIC-BODY-SECRET-A')).toBeTruthy(); });
  it('renders authenticated content when backend does not lock it', () => { render(<MemoryRouter><DocViewer data={{ ...publicData, document: { ...publicData.document, access_level: 'authenticated', content: 'AUTHENTICATED-FULL-CONTENT' } }} loading={false} /></MemoryRouter>); expect(screen.getByText('AUTHENTICATED-FULL-CONTENT')).toBeTruthy(); });
});
