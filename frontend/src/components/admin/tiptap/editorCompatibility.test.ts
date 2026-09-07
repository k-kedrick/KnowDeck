import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { EDITOR_COMPATIBILITY_FIXTURE } from './editorCompatibilityFixture';
import { prepareContentForEditor, serializeEditorContent } from './editorContentAdapter';
import { createEditorExtensions } from './extensions';

const editors: Editor[] = [];

const createFixtureEditor = () => {
  const editor = new Editor({
    extensions: createEditorExtensions(),
    content: prepareContentForEditor(EDITOR_COMPATIBILITY_FIXTURE),
  });
  editors.push(editor);
  return editor;
};

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

describe('TipTap E1 semantic compatibility', () => {
  it('round-trips the compatibility fixture without losing critical semantics', () => {
    const editor = createFixtureEditor();
    const output = serializeEditorContent(editor);
    const doc = new DOMParser().parseFromString(output, 'text/html');

    for (let level = 1; level <= 6; level += 1) {
      expect(doc.querySelectorAll(`h${level}`)).toHaveLength(1);
    }
    expect(doc.querySelectorAll('p')).not.toHaveLength(0);
    expect(doc.querySelector('strong')?.textContent).toContain('bold');
    expect(doc.querySelector('em')?.textContent).toContain('italic');
    expect(doc.querySelector('u')?.textContent).toContain('underline');
    expect(doc.querySelector('del, s')?.textContent).toContain('strike');
    expect(doc.querySelector('code')?.textContent).toContain('inline');

    const styled = Array.from(doc.querySelectorAll<HTMLElement>('span')).find((element) => element.textContent?.includes('styled text'));
    expect(styled?.getAttribute('style')).toContain('font-size: 20px');
    expect(styled?.getAttribute('style')).toContain('font-family:');
    expect(styled?.style.color).toBe('rgb(239, 68, 68)');
    expect(styled?.style.backgroundColor).toBe('rgb(254, 240, 138)');
    expect(doc.querySelector<HTMLElement>('mark')?.style.backgroundColor).toBe('rgb(219, 234, 254)');

    const aligned = Array.from(doc.querySelectorAll<HTMLElement>('p')).find((element) => element.textContent?.includes('styled text'));
    expect(aligned?.style.textAlign).toBe('center');
    expect(aligned?.style.lineHeight).toBe('1.5');

    expect(doc.querySelectorAll('table')).toHaveLength(2);
    expect(doc.querySelector('table.ace-table')?.getAttribute('style')).toContain('width: 500px');
    expect(doc.querySelector('td[rowspan="2"]')?.textContent).toContain('rowspan cell');
    expect(doc.querySelector('td[colspan="2"]')?.textContent).toContain('simple table cell');

    const image = doc.querySelector('img[src="/uploads/images/fixture.png"]');
    expect(image?.getAttribute('width')).toBe('320');
    expect(image?.getAttribute('height')).toBe('180');
    expect(image?.getAttribute('align')).toBe('right');

    const video = doc.querySelector('video[src="/uploads/videos/fixture.mp4"]');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('poster')).toBe('/uploads/images/poster.jpg');
    expect(video?.getAttribute('width')).toBe('640');
    expect(video?.getAttribute('height')).toBe('360');

    expect(doc.querySelectorAll('p.attachment')).toHaveLength(1);
    expect(doc.querySelector('p.attachment a')?.getAttribute('href')).toBe('/uploads/files/fixture.pdf');
    expect(doc.querySelector('iframe')?.getAttribute('src')).toBe('https://video.example.com/embed/fixture');
    expect(doc.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin allow-presentation');

    expect(doc.querySelectorAll('div.callout')).toHaveLength(3);
    expect(doc.querySelector('div.callout-note')).not.toBeNull();
    expect(doc.querySelector('div.callout-tip')).not.toBeNull();
    expect(doc.querySelector('div.callout-warning')).not.toBeNull();

    expect(doc.querySelector('a[href="/docs/internal"]')).not.toBeNull();
    expect(doc.querySelector('a[href="https://example.com/docs"]')).not.toBeNull();
    expect(doc.querySelector('ul[data-type="taskList"] li[data-checked="true"]')).not.toBeNull();
  });

  it('preserves all untouched critical nodes after editing one ordinary paragraph', () => {
    const editor = createFixtureEditor();
    let helloPosition = 0;
    editor.state.doc.descendants((node, position) => {
      if (node.isText && node.text?.startsWith('hello')) helloPosition = position;
    });
    editor.commands.insertContentAt(helloPosition + 'hello'.length, ' world');

    const doc = new DOMParser().parseFromString(serializeEditorContent(editor), 'text/html');
    expect(doc.body.textContent).toContain('hello world');
    expect(doc.querySelectorAll('table')).toHaveLength(2);
    expect(doc.querySelectorAll('img')).toHaveLength(1);
    expect(doc.querySelectorAll('video')).toHaveLength(1);
    expect(doc.querySelectorAll('p.attachment')).toHaveLength(1);
    expect(doc.querySelectorAll('iframe')).toHaveLength(1);
    expect(doc.querySelectorAll('div.callout')).toHaveLength(3);
    expect(doc.querySelector('p[style*="line-height"]')).not.toBeNull();
  });

  it('keeps the established security boundary for pasted and saved HTML', () => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: prepareContentForEditor(`
        <p onclick="alert(1)">Safe</p>
        <a href="javascript:alert(1)">bad</a>
        <img src="javascript:alert(1)" onerror="alert(1)" />
        <iframe src="javascript:alert(1)"></iframe>
        <script>alert(1)</script>
      `),
    });
    editors.push(editor);
    const output = serializeEditorContent(editor);

    expect(output).toContain('Safe');
    expect(output).not.toContain('javascript:');
    expect(output).not.toContain('onclick');
    expect(output).not.toContain('onerror');
    expect(output).not.toContain('<script');
  });
});
