import { act, createRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('keeps localized content dirty until document persistence succeeds', async () => {
    const ref = createRef<TiptapEditorHandle>();
    const external = '<p><img src="https://images.example.test/a.png"></p>';
    const localized = '<p><img src="/uploads/images/a.png"></p>';
    render(<TiptapEditor ref={ref} content={external} onChange={() => undefined} />);
    await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
    act(() => ref.current?.getEditor()?.commands.setTextSelection(1));

    act(() => ref.current?.replaceContentForSave(localized));

    expect(ref.current?.getEditor()?.getHTML()).toContain('/uploads/images/a.png');
    expect(ref.current?.getEditor()?.state.selection.from).toBe(1);
    expect(ref.current?.getContentForSave()).toContain('/uploads/images/a.png');
    expect(ref.current?.isDirty()).toBe(true);

    act(() => ref.current?.markSaved(localized));
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

  it('places the document title in the writing canvas', async () => {
    const onTitleChange = vi.fn();
    render(<TiptapEditor content="<p>正文</p>" onChange={() => undefined} title="编辑器标题" onTitleChange={onTitleChange} />);

    const title = await screen.findByRole('textbox', { name: '文档标题' });
    expect((title as HTMLInputElement).value).toBe('编辑器标题');
    fireEvent.change(title, { target: { value: '更新标题' } });
    expect(onTitleChange).toHaveBeenCalledWith('更新标题');
  });

  it('turns only the selected line into a heading from the floating block menu', async () => {
    const ref = createRef<TiptapEditorHandle>();
    render(<TiptapEditor ref={ref} content="<p>第一行</p><p>第二行</p><p>第三行</p>" onChange={() => undefined} />);
    await waitFor(() => expect(ref.current?.getEditor()).not.toBeNull());
    vi.spyOn(ref.current!.getEditor()!.view, 'coordsAtPos').mockReturnValue({ left: 0, right: 0, top: 0, bottom: 0 });

    act(() => {
      ref.current!.getEditor()!.commands.setTextSelection({ from: 1, to: 4 });
    });
    fireEvent.click(await screen.findByTestId('bubble-block-selector'));
    fireEvent.click(await screen.findByText('标题 1 (H1)'));

    expect(ref.current!.getEditor()!.getHTML()).toBe('<h1>第一行</h1><p>第二行</p><p>第三行</p>');
  });
});
