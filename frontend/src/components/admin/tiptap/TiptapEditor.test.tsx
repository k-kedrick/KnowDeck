import { act, createRef } from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TiptapEditor } from './TiptapEditor';
import type { TiptapEditorHandle } from './TiptapEditor';

describe('TiptapEditor hidden PoC', () => {
  it('keeps exact original content until a document-changing transaction occurs', async () => {
    const original = '# Legacy Markdown\n\nOriginal paragraph';
    const ref = createRef<TiptapEditorHandle>();
    const onChange = vi.fn();
    render(<TiptapEditor ref={ref} content={original} onChange={onChange} />);

    await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
    expect(ref.current?.isDirty()).toBe(false);
    expect(ref.current?.getContentForSave()).toBe(original);

    act(() => {
      const editor = ref.current?.getEditor();
      editor?.commands.insertContentAt(editor.state.doc.content.size, ' changed');
    });

    expect(ref.current?.isDirty()).toBe(true);
    expect(ref.current?.getContentForSave()).toContain('changed');
  });

  it('treats an external draft restore as a clean new source', async () => {
    const ref = createRef<TiptapEditorHandle>();
    const { rerender } = render(<TiptapEditor ref={ref} content="<p>server</p>" onChange={() => undefined} />);
    await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());

    rerender(<TiptapEditor ref={ref} content="# restored draft" onChange={() => undefined} />);
    await waitFor(() => expect(ref.current?.getContentForSave()).toBe('# restored draft'));
    expect(ref.current?.isDirty()).toBe(false);
  });

  it('does not snapshot a Chinese IME composition before its candidate is confirmed', async () => {
    const ref = createRef<TiptapEditorHandle>();
    const onChange = vi.fn();
    render(<TiptapEditor ref={ref} content="<p></p>" onChange={onChange} />);
    await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());

    vi.useFakeTimers();
    try {
      const editor = ref.current!.getEditor()!;
      act(() => {
        editor.view.dom.dispatchEvent(new Event('compositionstart'));
        editor.commands.insertContent('xuan');
        vi.advanceTimersByTime(400);
      });
      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        editor.view.dom.dispatchEvent(new Event('compositionend'));
        vi.advanceTimersByTime(400);
      });
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining('xuan'));
    } finally {
      vi.useRealTimers();
    }
  });
});
