import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Media } from '../../api';
import { DocumentVisualEditor } from './DocumentVisualEditor';
import { htmlToMarkdown, markdownToEditorHtml } from '../../utils/htmlToMarkdown';

const media = (overrides: Partial<Media> = {}): Media => ({
  id: 1,
  folder_id: 1,
  original_name: 'asset.png',
  filename: 'asset.png',
  path: '/uploads/asset.png',
  url: '/uploads/asset.png',
  media_type: 'image',
  mime_type: 'image/png',
  size: 10,
  duration: 0,
  thumbnail: '',
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const openUploadInput = () => {
  fireEvent.click(screen.getByRole('button', { name: '插入块' }));
  return screen.getByLabelText('上传图片/视频') as HTMLInputElement;
};

describe('DocumentVisualEditor media upload regression paths', () => {
  it('exposes font selection and four heading levels in the persistent toolbar', () => {
    render(<DocumentVisualEditor markdownContent="" onChange={vi.fn()} onUploadFile={vi.fn()} />);

    expect(screen.getByRole('button', { name: /默认字体/ })).toBeTruthy();
    fireEvent.click(screen.getByTitle('设置当前行/选区字号'));
    expect(screen.getByText('18px (小标题/强调)')).toBeTruthy();
    expect(screen.queryByText('20px (中标题)')).toBeNull();
    fireEvent.click(screen.getByTitle('切换当前行标题格式 (光标停留即可生效)'));
    expect(screen.getByText('四级标题')).toBeTruthy();
  });

  it('shows the selected text formats in both toolbars', async () => {
    Object.defineProperty(document, 'queryCommandState', {
      configurable: true,
      value: vi.fn((command: string) => command === 'bold' || command === 'justifyCenter'),
    });
    const { container } = render(
      <DocumentVisualEditor markdownContent="<h1>你好</h1>" onChange={vi.fn()} onUploadFile={vi.fn()} />,
    );
    const root = container.firstElementChild as HTMLElement;
    const text = container.querySelector('h1')!.firstChild!;
    const range = document.createRange();
    range.selectNodeContents(text);
    Object.defineProperty(range, 'getBoundingClientRect', {
      value: () => new DOMRect(100, 100, 80, 20),
    });
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 900, 800));
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));

    await waitFor(() => expect(screen.getByTitle('加粗 (Ctrl+B)').className).toContain('bg-blue-100'));
    expect(screen.getByTitle('文本居中').className).toContain('bg-blue-100');
    expect(screen.getByTitle('斜体 (Ctrl+I)').className).not.toContain('bg-blue-100');
    expect(screen.getByTitle('加粗 (Bold)').className).toContain('bg-blue-100');
    expect(screen.getByTitle('对齐与列表').className).toContain('bg-blue-100');
    Reflect.deleteProperty(document, 'queryCommandState');
  });

  it('uploads an image and inserts it into the editable canvas', async () => {
    const onChange = vi.fn();
    const onUploadFile = vi.fn().mockResolvedValue(media());
    const { container } = render(
      <DocumentVisualEditor markdownContent="已有内容" onChange={onChange} onUploadFile={onUploadFile} />,
    );
    const file = new File(['image'], 'asset.png', { type: 'image/png' });

    fireEvent.change(openUploadInput(), { target: { files: [file] } });

    await waitFor(() => expect(onUploadFile).toHaveBeenCalledWith(file));
    await waitFor(() => {
      expect(container.querySelector('img[src="/uploads/asset.png"]')).not.toBeNull();
    });
    expect(container.querySelector('[contenteditable="true"]')?.textContent).toContain('已有内容');
    expect(onChange).toHaveBeenCalled();
  });

  it('uploads a video and preserves the video element attributes', async () => {
    const onUploadFile = vi.fn().mockResolvedValue(media({
      original_name: 'clip.mp4',
      url: '/uploads/clip.mp4',
      media_type: 'video',
      mime_type: 'video/mp4',
    }));
    const { container } = render(
      <DocumentVisualEditor markdownContent="" onChange={vi.fn()} onUploadFile={onUploadFile} />,
    );
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });

    fireEvent.change(openUploadInput(), { target: { files: [file] } });

    await waitFor(() => {
      const video = container.querySelector('video[src="/uploads/clip.mp4"]');
      expect(video).not.toBeNull();
      expect(video?.hasAttribute('controls')).toBe(true);
    });
  });

  it('does not insert a broken media node when upload fails', async () => {
    const onUploadFile = vi.fn().mockRejectedValue(new Error('upload failed'));
    const { container } = render(
      <DocumentVisualEditor markdownContent="保留内容" onChange={vi.fn()} onUploadFile={onUploadFile} />,
    );
    const file = new File(['image'], 'asset.png', { type: 'image/png' });

    fireEvent.change(openUploadInput(), { target: { files: [file] } });

    await waitFor(() => expect(onUploadFile).toHaveBeenCalledWith(file));
    expect(container.querySelector('img, video')).toBeNull();
    expect(container.querySelector('[contenteditable="true"]')?.textContent).toContain('保留内容');
  });

  it('keeps upload insertion safe when the editor unmounts while uploading', async () => {
    let resolveUpload: (value: Media) => void = () => undefined;
    const onChange = vi.fn();
    const onUploadFile = vi.fn().mockImplementation(() => new Promise<Media>((resolve) => {
      resolveUpload = resolve;
    }));
    const view = render(
      <DocumentVisualEditor markdownContent="" onChange={onChange} onUploadFile={onUploadFile} />,
    );
    const file = new File(['image'], 'asset.png', { type: 'image/png' });

    fireEvent.change(openUploadInput(), { target: { files: [file] } });
    await waitFor(() => expect(onUploadFile).toHaveBeenCalledWith(file));
    view.unmount();
    resolveUpload(media());

    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
  });
});

const IMAGE_FIXTURE = '<p>Before</p><img src="/uploads/asset.png" alt="Sample" class="fixture-image" style="width: 240px; height: auto;"><p>After</p>';
const VIDEO_FIXTURE = '<p>Before</p><video src="/uploads/clip.mp4" controls class="fixture-video" style="width: 240px; max-width: 100%;"></video><p><br></p><p>After</p>';

// Geometry is the only platform substitute: DOM edits and HTML conversion use the real implementation.
const mountMedia = (html: string, strict = false) => {
  const onChange = vi.fn();
  const editor = <DocumentVisualEditor markdownContent={html} onChange={onChange} onUploadFile={vi.fn()} />;
  const view = render(strict ? <StrictMode>{editor}</StrictMode> : editor);
  const root = view.container.firstElementChild as HTMLElement;
  const canvas = view.container.querySelector('[contenteditable="true"]') as HTMLElement;
  vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 800, 900));
  for (const element of canvas.querySelectorAll<HTMLImageElement | HTMLVideoElement>('img, video')) {
    vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
      const width = element.style.width.endsWith('%') ? parseFloat(element.style.width) * 8
        : parseFloat(element.style.width) || 240;
      return new DOMRect(50, 180, width, width / 2);
    });
    Object.defineProperty(element, 'offsetWidth', { configurable: true, get: () => element.getBoundingClientRect().width });
  }
  return { ...view, canvas, onChange };
};

const emittedHtml = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.calls.at(-1)![0] as string;
const selectText = (textNode: Node, start: number, end = start) => {
  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, end);
  window.getSelection()!.removeAllRanges();
  window.getSelection()!.addRange(range);
};

describe('Legacy image selection and DOM contract', () => {
  beforeEach(() => { vi.useFakeTimers(); window.getSelection()?.removeAllRanges(); });
  afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); });

  it('shows image overlay, remeasures on resize and clears it when clicking text', () => {
    const { canvas } = mountMedia(IMAGE_FIXTURE);
    const img = canvas.querySelector('img')!;
    fireEvent.click(img);
    expect(screen.getByText('图片尺寸')).toBeTruthy();
    const box = screen.getByTitle('按住拖拽调整图片宽度').parentElement!;
    expect([box.style.top, box.style.left, box.style.width, box.style.height]).toEqual(['160px', '40px', '240px', '120px']);
    vi.mocked(img.getBoundingClientRect).mockReturnValue(new DOMRect(90, 220, 320, 160));
    fireEvent.resize(window);
    expect([box.style.top, box.style.left, box.style.width, box.style.height]).toEqual(['200px', '80px', '320px', '160px']);
    fireEvent.click(screen.getByText('After'));
    expect(screen.queryByText('图片尺寸')).toBeNull();
    expect(screen.queryByTitle('按住拖拽调整图片宽度')).toBeNull();
  });

  it.each(['25%', '50%', '75%', '100%', 'auto'])('keeps image width preset %s and the exact emitted HTML', (width) => {
    const { canvas, onChange } = mountMedia(IMAGE_FIXTURE);
    const img = canvas.querySelector('img')!;
    fireEvent.click(img);
    fireEvent.click(screen.getByRole('button', { name: width === 'auto' ? '原图' : width }));
    expect(img.style.width).toBe(width);
    expect(img.style.height).toBe('auto');
    expect(emittedHtml(onChange)).toBe(`<p>Before</p><img src="/uploads/asset.png" alt="Sample" class="fixture-image" style="width: ${width}" referrerpolicy="no-referrer"><p>After</p>`);
    expect(screen.getByTitle('按住拖拽调整图片宽度').parentElement!.style.width).toBe(`${img.getBoundingClientRect().width}px`);
  });

  it.each([
    ['居左对齐', '0px', 'auto'], ['居中对齐', 'auto', 'auto'], ['居右对齐', 'auto', '0px'],
  ])('preserves image alignment %s and output styles', (label, left, right) => {
    const { canvas, onChange } = mountMedia(IMAGE_FIXTURE);
    const img = canvas.querySelector('img')!;
    fireEvent.click(img);
    fireEvent.click(screen.getByTitle(label));
    expect([img.style.display, img.style.marginLeft, img.style.marginRight, img.style.float]).toEqual(['block', left, right, 'none']);
    // Existing sanitizer drops display/margins; pin the real output, not an invented contract.
    expect(emittedHtml(onChange)).toBe('<p>Before</p><img src="/uploads/asset.png" alt="Sample" class="fixture-image" style="width: 240px; float: none" referrerpolicy="no-referrer"><p>After</p>');
    const roundTrip = markdownToEditorHtml(htmlToMarkdown(emittedHtml(onChange)));
    expect(roundTrip).toContain('src="/uploads/asset.png"');
    expect(roundTrip).toContain('width: 240px');
    expect(roundTrip).toContain('float: none');
    expect(roundTrip).not.toContain('margin-left');
    expect(roundTrip).not.toContain('margin-right');
  });

  it('drags image width, clamps at 100px, updates overlay and commits on mouseup', () => {
    const { canvas, onChange } = mountMedia(IMAGE_FIXTURE);
    const img = canvas.querySelector('img')!;
    fireEvent.click(img);
    fireEvent.mouseDown(screen.getByTitle('按住拖拽调整图片宽度'), { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 160 });
    expect(img.style.width).toBe('300px');
    expect(screen.getByTitle('按住拖拽调整图片宽度').parentElement!.style.width).toBe('300px');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.mouseMove(document, { clientX: -500 });
    expect(img.style.width).toBe('100px');
    fireEvent.mouseUp(document);
    expect(onChange).toHaveBeenCalledOnce();
    expect(emittedHtml(onChange)).toBe('<p>Before</p><img src="/uploads/asset.png" alt="Sample" class="fixture-image" style="width: 100px" referrerpolicy="no-referrer"><p>After</p>');
    fireEvent.mouseMove(document, { clientX: 300 });
    expect(img.style.width).toBe('100px');
  });

  it('switches between two images and edits only the selected real node', () => {
    const { canvas } = mountMedia(IMAGE_FIXTURE.replace('<p>After</p>', '<img src="/uploads/second.png"><p>After</p>'));
    const [first, second] = canvas.querySelectorAll('img');
    fireEvent.click(first);
    fireEvent.click(second);
    fireEvent.click(screen.getByRole('button', { name: '50%' }));
    expect(first.style.width).toBe('240px');
    expect(second.style.width).toBe('50%');
  });

  it.each(['Delete', 'Backspace', 'toolbar'])('deletes selected image through %s without deleting following text', (method) => {
    const { canvas, onChange } = mountMedia(IMAGE_FIXTURE);
    fireEvent.click(canvas.querySelector('img')!);
    if (method === 'toolbar') fireEvent.click(screen.getByTitle('删除图片'));
    else fireEvent.keyDown(window, { key: method });
    expect(canvas.querySelector('img')).toBeNull();
    expect(canvas.textContent).toBe('BeforeAfter');
    expect(screen.queryByText('图片尺寸')).toBeNull();
    expect(emittedHtml(onChange)).toBe('<p>Before</p><p>After</p>');
  });

  it('keeps image selection and resize functional through StrictMode cleanup/setup', () => {
    const { canvas, unmount } = mountMedia(IMAGE_FIXTURE, true);
    fireEvent.click(canvas.querySelector('img')!);
    fireEvent.click(screen.getByRole('button', { name: '75%' }));
    expect(canvas.querySelector('img')!.style.width).toBe('75%');
    unmount();
    fireEvent.resize(window);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(canvas.querySelector('img')).not.toBeNull();
  });

  it('keeps selected text and caret usable after returning from image controls', async () => {
    const { canvas, onChange } = mountMedia(IMAGE_FIXTURE);
    const paragraph = screen.getByText('After');
    fireEvent.click(canvas.querySelector('img')!);
    fireEvent.click(paragraph);
    selectText(paragraph.firstChild!, 0, 5);
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true, value: () => new DOMRect(50, 200, 100, 20),
    });
    fireEvent(document, new Event('selectionchange'));
    await act(async () => { await vi.advanceTimersByTimeAsync(30); });
    expect(screen.getByTitle('加粗 (Bold)')).toBeTruthy();
    expect(window.getSelection()!.toString()).toBe('After');
    selectText(paragraph.firstChild!, 5);
    fireEvent.mouseUp(paragraph);
    fireEvent.click(screen.getByRole('button', { name: '插入块' }));
    fireEvent.click(screen.getByRole('button', { name: '代码块' }));
    expect(canvas.querySelector('pre')?.parentElement).toBe(paragraph);
    expect(emittedHtml(onChange)).toContain('After</p><pre');
    delete (Range.prototype as Partial<Range>).getBoundingClientRect;
  });

  it('releases document drag listeners when unmounted before mouseup', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const { canvas, onChange, unmount } = mountMedia(IMAGE_FIXTURE);
    const img = canvas.querySelector('img')!;
    fireEvent.click(img);
    fireEvent.mouseDown(screen.getByTitle('按住拖拽调整图片宽度'), { clientX: 100 });
    const listeners = add.mock.calls.filter(([name]) => name === 'mousemove' || name === 'mouseup');
    unmount();
    for (const [name, listener] of listeners) expect(remove).toHaveBeenCalledWith(name, listener);
    fireEvent.mouseMove(document, { clientX: 400 });
    fireEvent.mouseUp(document);
    expect(img.style.width).toBe('240px');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Legacy video selection and DOM contract', () => {
  beforeEach(() => { vi.useFakeTimers(); window.getSelection()?.removeAllRanges(); });
  afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); });

  it('shows and remeasures video overlay, then clears it on a text click', () => {
    const { canvas } = mountMedia(VIDEO_FIXTURE);
    const video = canvas.querySelector('video')!;
    fireEvent.click(video);
    expect(screen.getByText('视频组件')).toBeTruthy();
    const box = screen.getByTitle('删除此视频 (按 Delete 键亦可)').parentElement!;
    expect([box.style.top, box.style.left, box.style.width, box.style.height]).toEqual(['160px', '40px', '240px', '120px']);
    vi.mocked(video.getBoundingClientRect).mockReturnValue(new DOMRect(100, 230, 400, 200));
    fireEvent.resize(window);
    expect([box.style.top, box.style.left, box.style.width, box.style.height]).toEqual(['210px', '90px', '400px', '200px']);
    fireEvent.click(screen.getByText('After'));
    expect(screen.queryByText('视频组件')).toBeNull();
    expect(screen.queryByTitle('删除此视频 (按 Delete 键亦可)')).toBeNull();
  });

  it.each(['50%', '75%', '100%'])('preserves video width %s, controls and the emitted HTML', (width) => {
    const { canvas, onChange } = mountMedia(VIDEO_FIXTURE);
    const video = canvas.querySelector('video')!;
    fireEvent.click(video);
    fireEvent.click(screen.getByRole('button', { name: width }));
    expect(video.style.width).toBe(width);
    expect(video.style.maxWidth).toBe('100%');
    expect(video.hasAttribute('controls')).toBe(true);
    expect(emittedHtml(onChange)).toBe(`<p>Before</p><video src="/uploads/clip.mp4" controls="" class="fixture-video" style="width: ${width}; max-width: 100%"></video><p><br></p><p>After</p>`);
    expect(screen.getByTitle('删除此视频 (按 Delete 键亦可)').parentElement!.style.width).toBe(`${video.getBoundingClientRect().width}px`);
    expect(markdownToEditorHtml(htmlToMarkdown(emittedHtml(onChange)))).toContain('src="/uploads/clip.mp4"');
  });

  it.each([
    ['居左对齐', '0px', 'auto'], ['居中对齐', 'auto', 'auto'], ['居右对齐', 'auto', '0px'],
  ])('preserves video alignment %s and the existing sanitized output', (label, left, right) => {
    const { canvas, onChange } = mountMedia(VIDEO_FIXTURE);
    const video = canvas.querySelector('video')!;
    fireEvent.click(video);
    fireEvent.click(screen.getByTitle(label));
    expect([video.style.display, video.style.marginLeft, video.style.marginRight]).toEqual(['block', left, right]);
    expect(emittedHtml(onChange)).toBe('<p>Before</p><video src="/uploads/clip.mp4" controls="" class="fixture-video" style="width: 240px; max-width: 100%"></video><p><br></p><p>After</p>');
  });

  it('switches image/video selections exclusively and targets only the selected video', () => {
    const { canvas } = mountMedia(IMAGE_FIXTURE + VIDEO_FIXTURE + '<video src="/uploads/second.mp4" controls></video>');
    const image = canvas.querySelector('img')!;
    const [first, second] = canvas.querySelectorAll('video');
    fireEvent.click(image);
    expect(screen.getByText('图片尺寸')).toBeTruthy();
    fireEvent.click(first);
    expect(screen.queryByText('图片尺寸')).toBeNull();
    expect(screen.getByText('视频组件')).toBeTruthy();
    fireEvent.click(second);
    fireEvent.click(screen.getByRole('button', { name: '50%' }));
    expect(first.style.width).toBe('240px');
    expect(second.style.width).toBe('50%');
    fireEvent.click(image);
    expect(screen.queryByText('视频组件')).toBeNull();
    expect(screen.getByText('图片尺寸')).toBeTruthy();
  });

  it.each(['Delete', 'Backspace', 'toolbar', 'corner'])('deletes video through %s and removes only the following empty paragraph', (method) => {
    const { canvas, onChange } = mountMedia(VIDEO_FIXTURE);
    fireEvent.click(canvas.querySelector('video')!);
    if (method === 'toolbar') fireEvent.click(screen.getByTitle('删除视频 (按键盘 Delete / Backspace 键亦可删除)'));
    else if (method === 'corner') fireEvent.click(screen.getByTitle('删除此视频 (按 Delete 键亦可)'));
    else fireEvent.keyDown(window, { key: method });
    expect(canvas.querySelector('video')).toBeNull();
    expect(emittedHtml(onChange)).toBe('<p>Before</p><p>After</p>');
    expect(screen.queryByText('视频组件')).toBeNull();
  });

  it('keeps video selection functional under StrictMode and removes global listeners', () => {
    const { canvas, unmount } = mountMedia(VIDEO_FIXTURE, true);
    fireEvent.click(canvas.querySelector('video')!);
    fireEvent.click(screen.getByRole('button', { name: '75%' }));
    expect(canvas.querySelector('video')!.style.width).toBe('75%');
    unmount();
    fireEvent.resize(window);
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(canvas.querySelector('video')).not.toBeNull();
  });

  it('releases direct video click handlers when the editor unmounts', () => {
    const { canvas, unmount } = mountMedia(VIDEO_FIXTURE);
    const video = canvas.querySelector('video')!;
    expect(video.onclick).not.toBeNull();
    fireEvent.click(video);
    unmount();
    expect(video.onclick).toBeNull();
  });
});

describe('Legacy media caret and content integration', () => {
  it.each(['image', 'video'])('uploads %s at the saved text caret and selects the inserted node', async (type) => {
    const onChange = vi.fn();
    const isImage = type === 'image';
    const url = isImage ? '/uploads/asset.png' : '/uploads/clip.mp4';
    const onUploadFile = vi.fn().mockResolvedValue(media({ url, media_type: type }));
    const { container } = render(<DocumentVisualEditor markdownContent="<p>AB</p><p>Tail</p>" onChange={onChange} onUploadFile={onUploadFile} />);
    const paragraph = screen.getByText('AB');
    selectText(paragraph.firstChild!, 1);
    fireEvent.mouseUp(paragraph);
    const file = new File(['media'], isImage ? 'asset.png' : 'clip.mp4', { type: isImage ? 'image/png' : 'video/mp4' });
    fireEvent.change(openUploadInput(), { target: { files: [file] } });
    const selector = isImage ? 'img' : 'video';
    await waitFor(() => expect(paragraph.querySelector(selector)).not.toBeNull());
    const element = paragraph.querySelector(selector)!;
    expect(onUploadFile).toHaveBeenCalledWith(file);
    expect(paragraph.firstChild?.textContent).toBe('A');
    expect(paragraph.lastChild?.textContent).toBe('B');
    expect(element.getAttribute('src')).toBe(url);
    expect(container.querySelector('[contenteditable="true"]')?.lastElementChild?.textContent).toBe('Tail');
    expect(emittedHtml(onChange)).toContain(url);
    fireEvent.click(element);
    expect(screen.getByText(isImage ? '图片尺寸' : '视频组件')).toBeTruthy();
    fireEvent.click(screen.getByText('Tail'));
    expect(screen.queryByText(isImage ? '图片尺寸' : '视频组件')).toBeNull();
  });

  it('preserves text input and pasted tables after leaving media selection', () => {
    const { canvas, onChange } = mountMedia(IMAGE_FIXTURE);
    fireEvent.click(canvas.querySelector('img')!);
    const paragraph = screen.getByText('After');
    fireEvent.click(paragraph);
    paragraph.textContent = 'Edited';
    selectText(paragraph.firstChild!, 6);
    fireEvent.input(canvas);
    expect(emittedHtml(onChange)).toContain('<p>Edited</p>');
    fireEvent.paste(canvas, { clipboardData: {
      files: [], items: [], getData: (type: string) => type === 'text/html'
        ? '<table><tbody><tr><td>Cell A</td><td>Cell B</td></tr></tbody></table>' : '',
    } });
    expect(Array.from(canvas.querySelectorAll('td')).map((cell) => cell.textContent)).toEqual(['Cell A', 'Cell B']);
    expect(emittedHtml(onChange)).toContain('<table');
    expect(emittedHtml(onChange)).toContain('Edited');
    expect(emittedHtml(onChange)).toContain('/uploads/asset.png');
  });
});
