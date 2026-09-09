import { describe, expect, it } from 'vitest';
import {
  htmlToMarkdown,
  isHtmlDocumentContent,
  markdownToEditorHtml,
  mediaUrlToDocumentHtml,
  normalizePastedDocumentHtml,
  sanitizeDocumentHtml,
} from './htmlToMarkdown';

describe('htmlToMarkdown', () => {
  it('preserves safe block and inline styles', () => {
    const md = htmlToMarkdown(`
      <p style="text-align: center; line-height: 2">Hello</p>
      <span style="font-size: 20px; color: #ef4444; background: #fef08a">World</span>
    `);

    expect(md).toContain('<p style="text-align: center; line-height: 2">Hello</p>');
    expect(md).toContain('font-size: 20px');
    expect(md).toContain('color: #ef4444');
    expect(md).toContain('background-color: #fef08a');
  });

  it('drops unsafe style expressions', () => {
    const md = htmlToMarkdown('<span style="background: url(javascript:alert(1)); font-size: 20px">Safe text</span>');

    expect(md).not.toContain('javascript');
    expect(md).not.toContain('url(');
    expect(md).toContain('font-size: 20px');
  });

  it('preserves blank editor paragraphs created by Enter', () => {
    const md = htmlToMarkdown('<h1>Title</h1><p><br></p><div><br></div><p>Next</p>');

    expect(md.match(/<p><br \/><\/p>/g)).toHaveLength(2);
    expect(md).toContain('# Title');
    expect(md).toContain('Next');
  });

  it('sanitizes saved document HTML without flattening editor spacing and styles', () => {
    const html = sanitizeDocumentHtml(`
      <h1 style="text-align: center; font-size: 12px; line-height: 3; color: #0f172a"><span style="font-size: 48px; color: #ef4444">Title</span></h1>
      <p><br></p>
      <p style="text-align: center; line-height: 2">Next</p>
      <img src="javascript:alert(1)" onerror="alert(1)" style="width: 60%" />
      <img src="https://cdn.example.com/safe.png" style="width: 60%" />
      <video src="/uploads/videos/demo.mp4" controls onplay="alert(1)" style="width: 100%; max-width: 100%"></video>
      <iframe src="javascript:alert(1)"></iframe>
      <iframe src="https://video.example.com/embed/1" allowfullscreen></iframe>
      <script>alert(1)</script>
    `);

    expect(html).toContain('text-align: center');
    expect(html).not.toContain('font-size');
    expect(html).toContain('text-align: center');
    expect(html).toContain('color: #ef4444');
    expect(html).toContain('color: #0f172a');
    expect(html).toContain('<p><br></p>');
    expect(html).toContain('line-height: 2');
    expect(html).toContain('width: 60%');
    expect(html).toContain('<video');
    expect(html).toContain('controls');
    expect(html).toContain('/uploads/videos/demo.mp4');
    expect(html).toContain('https://video.example.com/embed/1');
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-presentation"');
    expect(html).not.toContain('javascript');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('onplay');
    expect(html).not.toContain('<script>');
  });

  it('rejects dangerous document URL protocols and SVG/data payloads', () => {
    const html = sanitizeDocumentHtml(`
      <a href="javascript:alert(1)">bad link</a>
      <img src="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pg==" />
      <img src="data:text/html;base64,PHNjcmlwdD4=" />
      <img src="data:image/png;base64,iVBORw0KGgo=" />
      <svg><foreignObject><script>alert(1)</script></foreignObject></svg>
    `);

    expect(html).toContain('bad link');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('image/svg+xml');
    expect(html).not.toContain('data:text/html');
    expect(html).toContain('data:image/png;base64');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('foreignObject');
  });

  it('converts legacy markdown to sanitized editor HTML while identifying new HTML documents', () => {
    expect(isHtmlDocumentContent('<h1>Stored HTML</h1>')).toBe(true);
    expect(isHtmlDocumentContent('# Legacy markdown')).toBe(false);

    const html = markdownToEditorHtml('# Legacy **Title**\n\nPlain text');

    expect(html).toContain('<h1>Legacy <strong>Title</strong></h1>');
    expect(html).toContain('<p>Plain text</p>');
  });

  it('normalizes pasted rich HTML media from external editors', () => {
    const html = normalizePastedDocumentHtml(`
      <div style="background-image: url('https://cdn.example.com/background.png')"></div>
      <img data-src="https://cdn.example.com/pasted.webp" onerror="alert(1)" />
      <video><source src="https://cdn.example.com/movie.mp4" /></video>
      <a href="https://cdn.example.com/clip.webm">video link</a>
    `);

    expect(html).toContain('src="https://cdn.example.com/background.png"');
    expect(html).toContain('src="https://cdn.example.com/pasted.webp"');
    expect(html).toContain('src="https://cdn.example.com/movie.mp4"');
    expect(html).toContain('src="https://cdn.example.com/clip.webm"');
    expect(html).toContain('<video');
    expect(html).toContain('controls');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('background-image');
  });

  it('converts plain media URLs into document HTML', () => {
    expect(mediaUrlToDocumentHtml('https://cdn.example.com/photo.jpg')).toContain('<img');
    expect(mediaUrlToDocumentHtml('https://cdn.example.com/video.mp4')).toContain('<video');
    expect(mediaUrlToDocumentHtml('https://cdn.example.com/page')).toBe('');
  });
});
