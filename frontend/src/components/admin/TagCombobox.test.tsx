import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { Tag } from '../../api';
import { TagCombobox } from './TagCombobox';

const initialTags: Tag[] = [
  { id: 1, name: 'GPT', slug: 'gpt', doc_count: 2 },
  { id: 2, name: 'Claude', slug: 'claude', doc_count: 1 },
];

const Harness = ({ onCreate = vi.fn() }: { onCreate?: (name: string) => Promise<Tag> }) => {
  const [available, setAvailable] = useState(initialTags);
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <TagCombobox
      availableTags={available}
      selectedTags={selected}
      onChange={setSelected}
      onCreate={onCreate}
      onCreated={(tag) => setAvailable((items) => [tag, ...items])}
    />
  );
};

describe('TagCombobox', () => {
  afterEach(cleanup);

  it('searches and selects an existing tag without creating a case variant', async () => {
    const onCreate = vi.fn();
    render(<Harness onCreate={onCreate} />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'gpt' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('#GPT')).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('creates, selects and removes a new tag', async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: 3, name: 'Gemini', slug: 'gemini', doc_count: 0 });
    render(<Harness onCreate={onCreate} />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Gemini' } });
    fireEvent.click(screen.getByRole('option', { name: /创建并使用 #Gemini/ }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('Gemini'));
    expect(await screen.findByText('#Gemini')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '移除标签 Gemini' }));
    expect(screen.queryByRole('button', { name: '移除标签 Gemini' })).toBeNull();
  });
});
