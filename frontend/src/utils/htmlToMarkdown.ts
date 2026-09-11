import DOMPurify from 'dompurify';

const DOCUMENT_ALLOWED_TAGS = [
  'iframe', 'video', 'source', 'div', 'span', 'mark', 'u', 'code', 'pre', 'hr', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'strong', 'em', 'del', 'a', 'img', 'ul', 'ol',
  'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'br',
];

const DOCUMENT_ALLOWED_ATTR = [
  'class', 'id', 'src', 'alt', 'href', 'target', 'controls', 'style', 'rel', 'width', 'height',
  'align', 'referrerpolicy', 'colspan', 'rowspan', 'loading', 'sandbox', 'allow',
  'allowfullscreen', 'title', 'type', 'preload', 'poster',
];

const DATA_IMAGE_RE = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i;
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

function isSafeDocumentUrl(tagName: string, rawValue: string): boolean {
  const value = Array.from(rawValue.trim())
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');
  if (!value) return false;

  const isRelative = !SCHEME_RE.test(value) && !value.startsWith('//');
  if (isRelative) return true;
  if (tagName === 'img' && DATA_IMAGE_RE.test(value)) return true;

  let url: URL;
  try {
    url = new URL(value, 'https://local.invalid');
  } catch {
    return false;
  }

  if (tagName === 'a') return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
  if (tagName === 'img') return ['http:', 'https:', 'blob:'].includes(url.protocol);
  if (tagName === 'video' || tagName === 'source') return ['http:', 'https:', 'blob:'].includes(url.protocol);
  if (tagName === 'iframe') {
    return url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  }
  return false;
}

/**
 * 自动分离 URL 路径末尾黏连的中文字符及中文标点，防止 URL 将后续中文句子吞入成非法 404 链接
 */
export function sanitizeUrlAndText(rawHref: string, rawLabel?: string): { url: string; textAfterUrl: string; label: string } {
  if (!rawHref) return { url: '#', textAfterUrl: '', label: rawLabel || '' };

  let href = rawHref.trim();
  let decodedHref = href;
  try {
    decodedHref = decodeURIComponent(href);
  } catch {
    // Keep raw href if decodeURIComponent fails
  }

  let textAfterUrl = '';

  // 识别 URL 末尾粘连的 CJK 中文字符与中文标点 (如 https://example.com/security下滑找到这个位置)
  const cjkMatch = decodedHref.match(/^([a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]+)([\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef].*)$/);
  if (cjkMatch) {
    decodedHref = cjkMatch[1];
    textAfterUrl = cjkMatch[2];
  }

  // 剥离末尾的中文标点符号（，。！？）】》；：）
  decodedHref = decodedHref.replace(/[，。！？）】》；：\s]+$/, '');

  let label = (rawLabel || '').trim();
  if (label.includes('<img') || label.includes('src=') || label.startsWith('![')) {
    return { url: decodedHref, textAfterUrl, label };
  }

  try {
    if (label && label.includes('%')) {
      label = decodeURIComponent(label);
    }
  } catch {
    // ignore
  }

  if (!label || label === rawHref || label === href || label === decodeURIComponent(rawHref || '')) {
    label = decodedHref;
  }

  return { url: decodedHref, textAfterUrl, label };
}

export function isHtmlDocumentContent(content: string): boolean {
  if (!content || !content.trim()) return false;
  const trimmed = content.trim();
  return /^<(?:p|div|h[1-6]|blockquote|ul|ol|table|pre|hr|img|video|section|article)\b/i.test(trimmed);
}

/**
 * 清理内联 CSS 样式，严格按照 Allowlist 校验放行：
 * - font-size (字号: 10px ~ 72px 范围)
 * - color (文字颜色)
 * - background-color / background (荧光高亮)
 * - text-decoration, font-weight, width, max-width, float
 * 绝对过滤危险表达式 (url, expression, javascript, calc, var) 以及尚未开放的属性。
 */
export function cleanInlineStyle(styleAttr: string | null): string {
  if (!styleAttr) return '';
  const rules = styleAttr.split(';');
  const cleanedRules: string[] = [];

  for (const rule of rules) {
    const trimmed = rule.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const prop = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const val = trimmed.slice(colonIdx + 1).trim();
    const lowerVal = val.toLowerCase();

    // 绝对禁止危险表达式与注入
    if (
      lowerVal.includes('url(') ||
      lowerVal.includes('javascript:') ||
      lowerVal.includes('expression(') ||
      lowerVal.includes('@import') ||
      lowerVal.includes('calc(') ||
      lowerVal.includes('var(') ||
      lowerVal.includes('eval(')
    ) {
      continue;
    }

    // 0. 字体栈白名单校验 (font-family: 仅放行安全跨平台回退字体栈，严格过滤引号注入与非法字符)
    if (prop === 'font-family') {
      const safeVal = val.replace(/"/g, "'");
      if (/^[a-zA-Z0-9\s,\-_']+$/.test(safeVal)) {
        const lower = safeVal.toLowerCase();
        if (
          lower.includes('sans-serif') ||
          lower.includes('serif') ||
          lower.includes('monospace') ||
          lower.includes('cursive') ||
          lower.includes('pingfang') ||
          lower.includes('yahei') ||
          lower.includes('songti') ||
          lower.includes('simsun') ||
          lower.includes('kaiti') ||
          lower.includes('fangsong') ||
          lower.includes('consolas') ||
          lower.includes('menlo') ||
          lower.includes('sfmono')
        ) {
          cleanedRules.push(`font-family: ${safeVal}`);
        }
      }
      continue;
    }

    // 1. 字号白名单校验 (10px ~ 72px 范围，或标准 rem/em/inherit)
    if (prop === 'font-size') {
      if (/^(?:(?:1[0-9]|[2-6][0-9]|7[0-2])px|(?:0\.[5-9]|[1-4](\.[0-9])?|5)rem|inherit)$/.test(lowerVal)) {
        cleanedRules.push(`font-size: ${val}`);
      }
      continue;
    }

    // 2. 文字颜色白名单校验
    if (prop === 'color') {
      if (/^(?:#(?:[0-9a-fA-F]{3,8})|rgba?\([^)]+\)|hsla?\([^)]+\)|transparent|[a-zA-Z]+)$/.test(val)) {
        cleanedRules.push(`color: ${val}`);
      }
      continue;
    }

    // 3. 背景颜色 / 高亮白名单校验
    if (prop === 'background-color' || prop === 'background') {
      if (/^(?:#(?:[0-9a-fA-F]{3,8})|rgba?\([^)]+\)|hsla?\([^)]+\)|transparent)$/.test(val)) {
        cleanedRules.push(`background-color: ${val}`);
      }
      continue;
    }

    // 4. 辅助行内修饰
    if (prop === 'text-decoration') {
      if (/^(?:underline|line-through|none)$/.test(lowerVal)) {
        cleanedRules.push(`text-decoration: ${lowerVal}`);
      }
      continue;
    }
    if (prop === 'font-weight') {
      if (/^(?:bold|normal|bolder|lighter|[1-9]00)$/.test(lowerVal)) {
        cleanedRules.push(`font-weight: ${lowerVal}`);
      }
      continue;
    }
    if (prop === 'width' || prop === 'max-width') {
      if (/^(?:\d{1,4}px|\d{1,3}%|auto|100%)$/.test(lowerVal)) {
        cleanedRules.push(`${prop}: ${val}`);
      }
      continue;
    }
    if (prop === 'float') {
      if (/^(?:left|right|none)$/.test(lowerVal)) {
        cleanedRules.push(`float: ${lowerVal}`);
      }
      continue;
    }
  }

  return cleanedRules.join('; ');
}

/**
 * 提取并清洗块级元素 (p, div, h1-h6, blockquote, li) 上的合法排版属性 (如 text-align, line-height)
 * 严格按照 Allowlist 校验，过滤非法注入：
 * - text-align: left, center, right, justify
 * - line-height: 1.0 ~ 3.0 (无单位数值，步进 0.1)
 */
export function extractBlockStyle(el: HTMLElement): string {
  const rules: string[] = [];

  // 1. text-align 属性或 style 提取
  let textAlign = el.style.textAlign || el.getAttribute('align') || '';
  textAlign = textAlign.trim().toLowerCase();
  if (textAlign && (textAlign === 'center' || textAlign === 'right' || textAlign === 'justify')) {
    rules.push(`text-align: ${textAlign}`);
  }

  // 2. line-height 提取与校验 (仅允许无单位 1.0 ~ 3.0 范围，步进 0.1)
  const rawLineHeight = el.style.lineHeight ? el.style.lineHeight.trim() : '';
  if (rawLineHeight) {
    const num = parseFloat(rawLineHeight);
    if (!isNaN(num) && num >= 1.0 && num <= 3.0 && /^(?:[1-2](?:\.[0-9])?|3(?:\.0)?|[1-3])$/.test(rawLineHeight)) {
      rules.push(`line-height: ${rawLineHeight}`);
    }
  }

  // 3. 检查 style 属性中其他合法块级规则
  const styleAttr = el.getAttribute('style');
  if (styleAttr) {
    const rawRules = styleAttr.split(';');
    for (const rule of rawRules) {
      const trimmed = rule.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      const prop = trimmed.slice(0, colonIdx).trim().toLowerCase();
      const val = trimmed.slice(colonIdx + 1).trim();
      const lowerVal = val.toLowerCase();

      // 绝对禁止危险注入与表达式
      if (
        lowerVal.includes('url(') ||
        lowerVal.includes('javascript:') ||
        lowerVal.includes('expression(') ||
        lowerVal.includes('@import') ||
        lowerVal.includes('calc(') ||
        lowerVal.includes('var(') ||
        lowerVal.includes('eval(')
      ) {
        continue;
      }

      if (prop === 'text-align' && !rules.some((r) => r.startsWith('text-align:'))) {
        if (lowerVal === 'center' || lowerVal === 'right' || lowerVal === 'justify') {
          rules.push(`text-align: ${lowerVal}`);
        }
      } else if (prop === 'line-height' && !rules.some((r) => r.startsWith('line-height:'))) {
        const num = parseFloat(lowerVal);
        if (!isNaN(num) && num >= 1.0 && num <= 3.0 && /^(?:[1-2](?:\.[0-9])?|3(?:\.0)?|[1-3])$/.test(lowerVal)) {
          rules.push(`line-height: ${val}`);
        }
      }
    }
  }

  return rules.join('; ');
}

const PASTED_IMAGE_ATTRS = ['src', 'data-src', 'data-original', 'data-origin-src', 'data-image-src', 'data-lazy-src'];
const PASTED_VIDEO_ATTRS = ['src', 'data-src', 'data-video-src', 'data-url', 'href'];
const IMAGE_URL_RE = /\.(?:png|jpe?g|gif|webp|bmp|svg)(?:[?#].*)?$/i;
const VIDEO_URL_RE = /\.(?:mp4|webm|ogg|mov|m4v)(?:[?#].*)?$/i;

function getFirstAttr(el: Element, names: string[]): string {
  for (const name of names) {
    const value = el.getAttribute(name);
    if (value && value.trim()) return value.trim();
  }
  return '';
}

function extractCssBackgroundUrl(style: string | null): string {
  if (!style) return '';
  const match = style.match(/background(?:-image)?\s*:\s*[^;]*url\((['"]?)(.*?)\1\)/i);
  return match?.[2]?.trim() || '';
}

function createImageElement(doc: Document, src: string, alt = ''): HTMLImageElement {
  const img = doc.createElement('img');
  img.setAttribute('src', src);
  if (alt) img.setAttribute('alt', alt);
  img.setAttribute('referrerpolicy', 'no-referrer');
  img.setAttribute('class', 'max-w-full rounded-xl my-4 shadow-sm');
  return img;
}

function createVideoElement(doc: Document, src: string): HTMLVideoElement {
  const video = doc.createElement('video');
  video.setAttribute('src', src);
  video.setAttribute('controls', '');
  video.setAttribute('class', 'w-full rounded-xl my-4 shadow-sm border border-slate-200/60 dark:border-slate-800');
  video.setAttribute('style', 'width: 100%; max-width: 100%;');
  return video;
}

export function normalizePastedDocumentHtml(html: string): string {
  if (!html || !html.trim()) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  doc.body.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const backgroundUrl = extractCssBackgroundUrl(el.getAttribute('style'));
    if (!backgroundUrl || el.querySelector('img, video')) return;

    const ownText = Array.from(el.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '')
      .join('')
      .trim();

    if (!ownText) {
      el.replaceWith(createImageElement(doc, backgroundUrl, el.getAttribute('aria-label') || ''));
    }
  });

  doc.body.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    const src = getFirstAttr(img, PASTED_IMAGE_ATTRS);
    if (!src) {
      img.remove();
      return;
    }

    img.setAttribute('src', src);
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.setAttribute('class', [img.getAttribute('class'), 'max-w-full rounded-xl my-4 shadow-sm'].filter(Boolean).join(' '));
  });

  doc.body.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
    const src = getFirstAttr(video, PASTED_VIDEO_ATTRS) || video.querySelector('source')?.getAttribute('src')?.trim() || '';
    if (!src) {
      video.remove();
      return;
    }

    video.replaceWith(createVideoElement(doc, src));
  });

  doc.body.querySelectorAll<HTMLSourceElement>('source').forEach((source) => {
    const src = source.getAttribute('src')?.trim() || '';
    if (VIDEO_URL_RE.test(src)) {
      source.replaceWith(createVideoElement(doc, src));
    }
  });

  doc.body.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href')?.trim() || '';
    if (VIDEO_URL_RE.test(href)) {
      anchor.replaceWith(createVideoElement(doc, href));
    } else if (!anchor.querySelector('img') && IMAGE_URL_RE.test(href)) {
      anchor.replaceWith(createImageElement(doc, href, anchor.textContent?.trim() || ''));
    }
  });

  return sanitizeDocumentHtml(doc.body.innerHTML);
}

export function sanitizeDocumentHtml(html: string): string {
  if (!html || !html.trim()) return '<p><br /></p>';

  const normalized = html.replace(/[!！]\s*\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" referrerpolicy="no-referrer" class="max-w-full h-auto rounded-xl my-4 shadow-sm" />');
  const sanitized = DOMPurify.sanitize(normalized, {
    ALLOWED_TAGS: DOCUMENT_ALLOWED_TAGS,
    ALLOWED_ATTR: DOCUMENT_ALLOWED_ATTR,
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, 'text/html');

  doc.body.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const blockStyle = /^(p|div|h[1-6]|blockquote|li|td|th)$/i.test(el.tagName)
      ? [extractBlockStyle(el), cleanInlineStyle(el.getAttribute('style'))].filter(Boolean).join('; ')
      : cleanInlineStyle(el.getAttribute('style'));

    if (blockStyle) {
      el.setAttribute('style', blockStyle);
    } else {
      el.removeAttribute('style');
    }
  });

  doc.body.querySelectorAll<HTMLAnchorElement>('a').forEach((el) => {
    if (!isSafeDocumentUrl('a', el.getAttribute('href') || '')) el.removeAttribute('href');
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener noreferrer');
  });

  doc.body.querySelectorAll<HTMLImageElement>('img').forEach((el) => {
    if (!isSafeDocumentUrl('img', el.getAttribute('src') || '')) {
      el.remove();
      return;
    }
    el.setAttribute('referrerpolicy', 'no-referrer');
  });

  doc.body.querySelectorAll<HTMLVideoElement>('video').forEach((el) => {
    if (!isSafeDocumentUrl('video', el.getAttribute('src') || '')) el.removeAttribute('src');
  });

  doc.body.querySelectorAll<HTMLSourceElement>('source').forEach((el) => {
    if (!isSafeDocumentUrl('source', el.getAttribute('src') || '')) el.remove();
  });

  doc.body.querySelectorAll<HTMLIFrameElement>('iframe').forEach((el) => {
    if (!isSafeDocumentUrl('iframe', el.getAttribute('src') || '')) {
      el.remove();
      return;
    }
    el.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
    el.setAttribute('loading', 'lazy');
    el.setAttribute('referrerpolicy', 'no-referrer');
  });

  return doc.body.innerHTML.trim() || '<p><br /></p>';
}

export function markdownToEditorHtml(md: string): string {
  if (!md || !md.trim()) return '<p><br /></p>';
  if (isHtmlDocumentContent(md)) return sanitizeDocumentHtml(md);

  const parseInline = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/~~(.*?)~~/g, '<del>$1</del>')
      .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-xs text-blue-600 dark:text-blue-400">$1</code>')
      .replace(/[!！]\s*\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" referrerpolicy="no-referrer" class="max-w-full rounded-xl my-4 shadow-sm" />')
      .replace(/(^|[^!！])\[(.*?)\]\((.*?)\)/g, (_, prefix, label, url) => {
        if (label.includes('<img') || label.includes('src=')) {
          return `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        }
        const { url: cleanUrl, textAfterUrl, label: cleanLabel } = sanitizeUrlAndText(url, label);
        return `${prefix}<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline font-medium">${cleanLabel}</a>${textAfterUrl}`;
      });
  };

  const processed = md.replace(/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*\n((?:^>.*$\n?)+)/gm, (_, type, body) => {
    const cleanBody = body.replace(/^>\s?/gm, '');
    const t = type.toLowerCase();
    let title = '提示 NOTE';
    let bgClass = 'bg-blue-50/70 border-blue-500 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-500';
    if (t === 'tip') {
      title = '技巧 TIP';
      bgClass = 'bg-emerald-50/70 border-emerald-500 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-500';
    } else if (t === 'warning') {
      title = '警告 WARNING';
      bgClass = 'bg-amber-50/70 border-amber-500 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500';
    }
    return `<div class="callout callout-${t} p-4 my-4 rounded-xl border-l-4 ${bgClass} font-sans leading-relaxed text-sm"><strong>[${title}]</strong> ${cleanBody}</div>`;
  });

  const htmlBlocks: string[] = [];

  for (const rawBlock of processed.split(/\n{2,}/)) {
    const block = rawBlock.trim();
    if (!block) continue;

    if (/^<(p|div|table|blockquote|h[1-6]|pre|video|hr|ul|ol)\b/i.test(block)) {
      htmlBlocks.push(parseInline(block));
    } else if (/^#\s+(.*)$/s.test(block)) {
      htmlBlocks.push(`<h1>${parseInline(block.replace(/^#\s+/, ''))}</h1>`);
    } else if (/^##\s+(.*)$/s.test(block)) {
      htmlBlocks.push(`<h2>${parseInline(block.replace(/^##\s+/, ''))}</h2>`);
    } else if (/^###\s+(.*)$/s.test(block)) {
      htmlBlocks.push(`<h3>${parseInline(block.replace(/^###\s+/, ''))}</h3>`);
    } else if (/^####\s+(.*)$/s.test(block)) {
      htmlBlocks.push(`<h4>${parseInline(block.replace(/^####\s+/, ''))}</h4>`);
    } else if (/^>\s+(.*)$/s.test(block)) {
      const text = block.replace(/^>\s?/gm, '');
      htmlBlocks.push(`<blockquote>${parseInline(text).replace(/\n/g, '<br />')}</blockquote>`);
    } else if (/^```/.test(block)) {
      const codeContent = block.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '');
      htmlBlocks.push(`<pre><code>${codeContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`);
    } else if (block === '---' || block === '***') {
      htmlBlocks.push('<hr />');
    } else if (/^[-*]\s+/.test(block)) {
      const items = block.split(/\n/).map((line) => line.replace(/^[-*]\s+/, '').trim()).filter(Boolean);
      htmlBlocks.push(`<ul>${items.map((item) => `<li>${parseInline(item)}</li>`).join('')}</ul>`);
    } else if (/^\d+\.\s+/.test(block)) {
      const items = block.split(/\n/).map((line) => line.replace(/^\d+\.\s+/, '').trim()).filter(Boolean);
      htmlBlocks.push(`<ol>${items.map((item) => `<li>${parseInline(item)}</li>`).join('')}</ol>`);
    } else {
      htmlBlocks.push(`<p>${parseInline(block).replace(/\n/g, '<br />')}</p>`);
    }
  }

  return sanitizeDocumentHtml(htmlBlocks.join(''));
}

/**
 * 飞书/Notion/网页富文本 HTML 自动转换为 Markdown 解析工具
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) {
    return '';
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const isEditableBlankBlock = (el: HTMLElement): boolean => {
    const text = (el.textContent || '').replace(/\u00a0/g, '').trim();
    if (text) return false;
    return Boolean(el.querySelector('br')) || /^(&nbsp;|\s|<br\s*\/?>)*$/i.test(el.innerHTML);
  };

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      let decodedText = text;
      try {
        if (text.includes('%')) {
          decodedText = decodeURIComponent(text);
        }
      } catch {
        // ignore
      }
      // 自动在裸 URL 与后续紧贴的中文字符之间插入空格隔开
      const cleanedText = decodedText.replace(/(https?:\/\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]+)([\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef])/g, '$1 $2');
      return cleanedText.replace(/\s+/g, ' ');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    const childrenStr = Array.from(el.childNodes).map(walk).join('');

    switch (tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const level = parseInt(tagName.substring(1), 10);
        const blockStyle = extractBlockStyle(el);
        const trimmed = childrenStr.trim();
        if (!trimmed) return '';
        if (blockStyle) {
          return `\n\n<${tagName} style="${blockStyle}">${trimmed}</${tagName}>\n\n`;
        }
        const hashes = '#'.repeat(level);
        return `\n\n${hashes} ${trimmed}\n\n`;
      }
      case 'p': {
        const blockStyle = extractBlockStyle(el);
        const trimmed = childrenStr.trim();
        if (!trimmed) {
          return isEditableBlankBlock(el) ? '\n\n<p><br /></p>\n\n' : '';
        }
        if (blockStyle) {
          return `\n\n<p style="${blockStyle}">${trimmed}</p>\n\n`;
        }
        return `\n\n${trimmed}\n\n`;
      }
      case 'strong':
      case 'b':
        return childrenStr.trim() ? ` **${childrenStr.trim()}** ` : '';
      case 'em':
      case 'i':
        return childrenStr.trim() ? ` *${childrenStr.trim()}* ` : '';
      case 'del':
      case 's':
      case 'strike':
        return childrenStr.trim() ? ` ~~${childrenStr.trim()}~~ ` : '';
      case 'code':
        if (el.parentElement?.tagName.toLowerCase() === 'pre') {
          return childrenStr;
        }
        return childrenStr.trim() ? ` \`${childrenStr.trim()}\` ` : '';
      case 'pre':
        return `\n\n\`\`\`\n${childrenStr.trim()}\n\`\`\`\n\n`;
      case 'blockquote': {
        const blockStyle = extractBlockStyle(el);
        const trimmed = childrenStr.trim();
        if (!trimmed) return '';
        if (blockStyle) {
          return `\n\n<blockquote style="${blockStyle}">\n${trimmed}\n</blockquote>\n\n`;
        }
        return `\n\n> ${trimmed.replace(/\n/g, '\n> ')}\n\n`;
      }
      case 'ul':
        return `\n\n${childrenStr.trim()}\n\n`;
      case 'ol':
        return `\n\n${childrenStr.trim()}\n\n`;
      case 'li': {
        const parentTag = el.parentElement?.tagName.toLowerCase();
        const blockStyle = extractBlockStyle(el);
        if (parentTag === 'ol') {
          const siblings = Array.from(el.parentElement?.children || []);
          const index = siblings.indexOf(el) + 1;
          if (blockStyle) {
            return `<li style="${blockStyle}">${childrenStr.trim()}</li>\n`;
          }
          return `${index}. ${childrenStr.trim()}\n`;
        }
        if (blockStyle) {
          return `<li style="${blockStyle}">${childrenStr.trim()}</li>\n`;
        }
        return `- ${childrenStr.trim()}\n`;
      }
      case 'a': {
        const rawHref = el.getAttribute('href') || '#';
        const trimmedChildren = childrenStr.trim();
        if (!trimmedChildren) return '';
        // 核心防护：若 <a> 标签内包含 <img> 节点或已转出的图片语法，直接保持 HTML <a> 结构，严禁嵌套生成破坏性 `[ ![图片](url) ](href)`
        if (trimmedChildren.includes('<img') || trimmedChildren.includes('src=') || /^![!\s]*\[/.test(trimmedChildren)) {
          return `\n\n<a href="${rawHref}" target="_blank" rel="noopener noreferrer">${trimmedChildren}</a>\n\n`;
        }
        const rawLabel = trimmedChildren || rawHref;
        const { url, textAfterUrl, label } = sanitizeUrlAndText(rawHref, rawLabel);
        return ` [${label}](${url})${textAfterUrl} `;
      }
      case 'img': {
        const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
        const alt = el.getAttribute('alt') || '图片';
        if (!src) return '';
        const style = el.getAttribute('style') || '';
        const width = el.getAttribute('width') || '';

        if (style || width) {
          let styleAttr = style;
          if (!styleAttr && width) {
            styleAttr = `width: ${width.endsWith('%') || width.endsWith('px') ? width : width + 'px'};`;
          }
          return `\n\n<img src="${src}" alt="${alt}" style="${styleAttr}" referrerpolicy="no-referrer" />\n\n`;
        }
        return `\n\n![${alt}](${src})\n\n`;
      }
      case 'video': {
        const src = el.getAttribute('src') || el.querySelector('source')?.getAttribute('src') || '';
        if (!src) return '';
        return `\n\n<video src="${src}" controls class="w-full rounded-xl my-4"></video>\n\n`;
      }
      case 'table': {
        const hasRichContent = el.querySelector('img, video, iframe, div, blockquote, pre') !== null;
        const hasTh = el.querySelector('th') !== null;
        if (hasRichContent || !hasTh || el.classList.contains('feishu-rich-table')) {
          // Preserve HTML table structure for rich text tables with embedded images/divs
          return `\n\n<table class="feishu-rich-table min-w-full my-4 border-collapse border border-slate-200 dark:border-slate-700 text-sm font-sans">${el.innerHTML}</table>\n\n`;
        }
        return `\n\n${childrenStr.trim()}\n\n`;
      }
      case 'tr': {
        const parentTable = el.closest('table');
        const isRichTable = parentTable && (parentTable.querySelector('img, video, iframe, div, blockquote, pre') !== null || parentTable.classList.contains('feishu-rich-table') || !parentTable.querySelector('th'));
        if (isRichTable) {
          return `<tr>${childrenStr}</tr>`;
        }
        return `${childrenStr.trim()}\n`;
      }
      case 'td':
      case 'th': {
        const parentTable = el.closest('table');
        const isRichTable = parentTable && (parentTable.querySelector('img, video, iframe, div, blockquote, pre') !== null || parentTable.classList.contains('feishu-rich-table') || !parentTable.querySelector('th'));
        if (isRichTable) {
          return `<${tagName} class="border border-slate-200 dark:border-slate-700 p-3 align-top">${childrenStr}</${tagName}>`;
        }
        return `| ${childrenStr.trim()} `;
      }
      case 'br':
        return '\n';
      case 'hr':
        return '\n\n---\n\n';
      case 'div':
      case 'section':
      case 'article':
      case 'main':
      case 'header':
      case 'footer': {
        const className = el.className || '';
        if (className.includes('callout')) {
          let type = 'NOTE';
          if (className.includes('callout-tip')) type = 'TIP';
          else if (className.includes('callout-warning')) type = 'WARNING';
          else if (className.includes('callout-important')) type = 'IMPORTANT';
          else if (className.includes('callout-caution')) type = 'CAUTION';
          const innerText = childrenStr.trim().replace(/\n/g, '\n> ');
          return `\n\n> [!${type}]\n> ${innerText}\n\n`;
        }
        const trimmed = childrenStr.trim();
        if (!trimmed) {
          return isEditableBlankBlock(el) ? '\n\n<p><br /></p>\n\n' : '';
        }
        const blockStyle = extractBlockStyle(el);
        if (blockStyle) {
          return `\n\n<p style="${blockStyle}">${trimmed}</p>\n\n`;
        }
        return `\n\n${trimmed}\n\n`;
      }
      case 'font':
      case 'mark':
      case 'span': {
        const style = el.getAttribute('style');
        const color = el.getAttribute('color');
        const trimmed = childrenStr.trim();
        if (!trimmed) return '';

        const cleanedStyle = cleanInlineStyle(style);
        if (cleanedStyle) {
          return `<span style="${cleanedStyle}">${childrenStr}</span>`;
        }
        if (color) {
          return `<span style="color: ${color}">${childrenStr}</span>`;
        }
        if (tagName === 'mark') {
          return `<mark>${childrenStr}</mark>`;
        }
        return childrenStr;
      }
      default:
        return childrenStr;
    }
  }

  const rawMd = walk(doc.body);
  return rawMd
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
