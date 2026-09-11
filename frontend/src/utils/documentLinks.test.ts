import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  applyDocumentHtmlLinks,
  normalizeDocumentAnchors,
  normalizeDocumentLinks,
  splitUrlAndTrailingText,
} from './documentLinks';
import { processDocumentHtml } from './documentHtml';
import { DocumentLink } from '../components/admin/tiptap/extensions/DocumentLink';
import { prepareContentForEditor, serializeEditorContent } from '../components/admin/tiptap/editorContentAdapter';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('splitUrlAndTrailingText', () => {
  it('splits URLs correctly at whitespace, CJK characters, and punctuation', () => {
    expect(splitUrlAndTrailingText('https://example.com')).toEqual({
      url: 'https://example.com',
      trailing: '',
    });

    expect(splitUrlAndTrailingText('https://example.com\n中文说明')).toEqual({
      url: 'https://example.com',
      trailing: '\n中文说明',
    });

    expect(splitUrlAndTrailingText('https://example.com 中文说明')).toEqual({
      url: 'https://example.com',
      trailing: ' 中文说明',
    });

    expect(splitUrlAndTrailingText('https://example.com，中文说明')).toEqual({
      url: 'https://example.com',
      trailing: '，中文说明',
    });

    expect(splitUrlAndTrailingText('https://example.com（说明）')).toEqual({
      url: 'https://example.com',
      trailing: '（说明）',
    });

    expect(splitUrlAndTrailingText('https://2fa.cn/验证码获取方法')).toEqual({
      url: 'https://2fa.cn/',
      trailing: '验证码获取方法',
    });

    expect(splitUrlAndTrailingText('https://2fa.cc验证码的获取（备选方法）')).toEqual({
      url: 'https://2fa.cc',
      trailing: '验证码的获取（备选方法）',
    });

    expect(splitUrlAndTrailingText('https://en.wikipedia.org/wiki/ProseMirror_(software)')).toEqual({
      url: 'https://en.wikipedia.org/wiki/ProseMirror_(software)',
      trailing: '',
    });

    expect(splitUrlAndTrailingText('https://example.com.')).toEqual({
      url: 'https://example.com',
      trailing: '.',
    });
  });
});

describe('normalizeDocumentAnchors', () => {
  it('preserves manual custom hyperlinks', () => {
    const doc = parse('<p><a href="https://example.com">点击这里查看 Google</a></p>');
    normalizeDocumentAnchors(doc.body, doc);
    const a = doc.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.textContent).toBe('点击这里查看 Google');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('normalizes bare URL anchors that swallowed trailing CJK text', () => {
    const doc = parse('<p><a href="https://2fa.cn/验证码获取方法">https://2fa.cn/验证码获取方法</a></p>');
    normalizeDocumentAnchors(doc.body, doc);
    const a = doc.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://2fa.cn/');
    expect(a?.textContent).toBe('https://2fa.cn/');
    expect(doc.body.innerHTML).toContain('<a href="https://2fa.cn/" target="_blank" rel="noopener noreferrer">https://2fa.cn/</a>验证码获取方法');
  });

  it('normalizes bold bare URL anchors that swallowed trailing CJK text', () => {
    const doc = parse('<p><a href="https://2fa.cc获取验证码"><strong>https://2fa.cc获取验证码</strong></a></p>');
    normalizeDocumentAnchors(doc.body, doc);
    const a = doc.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://2fa.cc');
    expect(a?.textContent).toBe('https://2fa.cc');
    expect(doc.body.innerHTML).toContain('<a href="https://2fa.cc" target="_blank" rel="noopener noreferrer"><strong>https://2fa.cc</strong></a>获取验证码');
  });

  it('ejects <br> and following text from inside anchors', () => {
    const doc = parse('<p><a href="https://2fa.cn/">https://2fa.cn/<br>验证码获取方法</a></p>');
    normalizeDocumentAnchors(doc.body, doc);
    const a = doc.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://2fa.cn/');
    expect(a?.textContent).toBe('https://2fa.cn/');
    expect(doc.body.innerHTML).toContain('<a href="https://2fa.cn/" target="_blank" rel="noopener noreferrer">https://2fa.cn/</a><br>验证码获取方法');
  });
});

describe('Regression Cases CASE 1 through CASE 10', () => {
  // CASE 1: 输入 https://example.com 预期：单独 URL 为 Link
  it('CASE 1: recognizes standalone URL as Link', () => {
    const doc = parse('<p>https://example.com</p>');
    applyDocumentHtmlLinks(doc.body, doc);
    const a = doc.querySelector('a');
    expect(a).not.toBeNull();
    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.textContent).toBe('https://example.com');
  });

  // CASE 2: 输入 https://example.com\n中文说明 预期：只有 URL 是 Link
  it('CASE 2: only URL is link when followed by newline and Chinese', () => {
    const doc = parse('<p>https://example.com\n中文说明</p>');
    applyDocumentHtmlLinks(doc.body, doc);
    const a = doc.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.textContent).toBe('https://example.com');
    expect(doc.body.textContent).toContain('中文说明');
    expect(a?.textContent).not.toContain('中文说明');
  });

  // CASE 3: 输入 https://example.com 中文说明 预期：只有 URL 是 Link
  it('CASE 3: only URL is link when followed by space and Chinese', () => {
    const doc = parse('<p>https://example.com 中文说明</p>');
    applyDocumentHtmlLinks(doc.body, doc);
    const a = doc.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.textContent).toBe('https://example.com');
    expect(doc.body.textContent).toBe('https://example.com 中文说明');
    expect(a?.textContent).not.toContain('中文说明');
  });

  // CASE 4: 输入 https://example.com，中文说明 预期：逗号和中文不是 Link
  it('CASE 4: comma and Chinese are not included in link', () => {
    const doc = parse('<p>https://example.com，中文说明</p>');
    applyDocumentHtmlLinks(doc.body, doc);
    const a = doc.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.textContent).toBe('https://example.com');
    expect(doc.body.textContent).toBe('https://example.com，中文说明');
    expect(a?.textContent).not.toContain('，');
    expect(a?.textContent).not.toContain('中文说明');
  });

  // CASE 5: 输入 https://example.com（说明） 预期：中文括号内容不是 Link
  it('CASE 5: Chinese parentheses and explanation are not included in link', () => {
    const doc = parse('<p>https://example.com（说明）</p>');
    applyDocumentHtmlLinks(doc.body, doc);
    const a = doc.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.textContent).toBe('https://example.com');
    expect(doc.body.textContent).toBe('https://example.com（说明）');
    expect(a?.textContent).not.toContain('（说明）');
  });

  // CASE 6: HTML: <p><a href="https://example.com">https://example.com</a>中文</p> 必须 round-trip 后仍然正确
  it('CASE 6: maintains correct boundary after round-trip', () => {
    const source = '<p><a href="https://example.com">https://example.com</a>中文</p>';
    const normalized = normalizeDocumentLinks(source);
    expect(normalized).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>中文');
  });

  // CASE 7: 人工链接: <a href="https://example.com">点击这里</a> 必须保留，不得改成裸 URL
  it('CASE 7: preserves manual hyperlink with custom anchor text', () => {
    const source = '<p><a href="https://example.com">点击这里</a></p>';
    const normalized = normalizeDocumentLinks(source);
    expect(normalized).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">点击这里</a>');
  });

  // CASE 8: URL 后按 Enter 再输入中文: Link Mark 不得继承
  it('CASE 8: does not inherit link mark after Enter into new paragraph', () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ link: false }),
        DocumentLink.configure({ autolink: true, defaultProtocol: 'https' }),
      ],
      content: '<p>https://example.com</p>',
    });

    // Cursor at end, press Enter and insert text in new line
    editor.commands.focus('end');
    editor.commands.splitBlock();
    editor.commands.insertContent('验证码获取方法');

    const html = serializeEditorContent(editor);
    const doc = parse(html);
    const links = doc.querySelectorAll('a');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('https://example.com');
    expect(links[0].textContent).toBe('https://example.com');
    expect(doc.body.textContent).toContain('验证码获取方法');
    expect(links[0].textContent).not.toContain('验证码获取方法');
    editor.destroy();
  });

  // CASE 9: URL 后按 Space 再输入文字: Link Mark 不得继承
  it('CASE 9: does not inherit link mark after typing Space and following text', () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ link: false }),
        DocumentLink.configure({ autolink: true, defaultProtocol: 'https' }),
      ],
      content: '<p></p>',
    });

    editor.commands.setContent('<p><a href="https://2fa.cn/">https://2fa.cn/</a> </p>');
    editor.commands.focus('end');
    editor.commands.insertContent('验证码获取方法');

    const html = serializeEditorContent(editor);
    const doc = parse(html);
    const links = doc.querySelectorAll('a');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('https://2fa.cn/');
    expect(links[0].textContent).toBe('https://2fa.cn/');
    expect(doc.body.textContent).toContain('验证码获取方法');
    expect(links[0].textContent).not.toContain('验证码获取方法');
    editor.destroy();
  });

  // CASE 10: 经过 HTML -> Editor -> Save -> Load -> Frontend Render 完整 round-trip 后: Link 范围必须保持不变
  it('CASE 10: full round-trip maintains exact link boundaries', () => {
    const inputHtml = '<p><a href="https://2fa.cn/验证码获取方法">https://2fa.cn/验证码获取方法</a></p>';

    // 1. Prepare for editor (load / import)
    const editorHtml = prepareContentForEditor(inputHtml);
    const prepDoc = parse(editorHtml);
    const prepLink = prepDoc.querySelector('a');
    expect(prepLink?.getAttribute('href')).toBe('https://2fa.cn/');
    expect(prepLink?.textContent).toBe('https://2fa.cn/');
    expect(prepDoc.body.textContent).toBe('https://2fa.cn/验证码获取方法');

    // 2. Editor instance
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ link: false }),
        DocumentLink.configure({ autolink: true, defaultProtocol: 'https' }),
      ],
      content: editorHtml,
    });

    // 3. Save from editor
    const savedHtml = serializeEditorContent(editor);
    const saveDoc = parse(savedHtml);
    const saveLink = saveDoc.querySelector('a');
    expect(saveLink?.getAttribute('href')).toBe('https://2fa.cn/');
    expect(saveLink?.textContent).toBe('https://2fa.cn/');
    expect(saveDoc.body.textContent).toBe('https://2fa.cn/验证码获取方法');

    // 4. Load & Frontend Render (processDocumentHtml)
    const frontendRendered = processDocumentHtml(savedHtml);
    const frontDoc = parse(frontendRendered);
    const frontLink = frontDoc.querySelector('a');
    expect(frontLink?.getAttribute('href')).toBe('https://2fa.cn/');
    expect(frontLink?.textContent).toBe('https://2fa.cn/');
    expect(frontDoc.body.textContent).toBe('https://2fa.cn/验证码获取方法');

    editor.destroy();
  });
});
