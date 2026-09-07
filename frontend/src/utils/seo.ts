export interface SEOConfig {
  title: string;
  description: string;
  canonicalPath?: string | null;
  siteName: string;
  robots?: 'index,follow' | 'noindex,follow' | 'noindex,nofollow';
  type?: 'website' | 'article';
  image?: string;
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    section?: string;
    tags?: string[];
  };
  structuredData?: Record<string, unknown>;
}

const upsertMeta = (key: string, attribute: 'name' | 'property', value?: string) => {
  const selector = `meta[${attribute}="${key}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  if (!value) {
    if (existing?.dataset.seoManaged === 'true' || existing?.hasAttribute('data-seo')) existing.remove();
    return;
  }
  const element = existing || document.createElement('meta');
  element.setAttribute(attribute, key);
  element.content = value;
  element.dataset.seoManaged = 'true';
  if (!existing) document.head.appendChild(element);
};

export const getSiteUrl = () => {
  const configured = document.querySelector<HTMLMetaElement>('meta[name="site-url"]')?.content.trim();
  return (configured || window.location.origin).replace(/\/$/, '');
};

export const toAbsoluteUrl = (value?: string) => {
  if (!value) return undefined;
  try {
    return new URL(value, `${getSiteUrl()}/`).toString();
  } catch {
    return undefined;
  }
};

export const textDescription = (excerpt: string | undefined, content: string | undefined, maxLength = 160) => {
  const source = excerpt?.trim() || content || '';
  const normalized = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^[#>*+-]+/gm, ' ')
    .replace(/[`_*~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
};

export const applySEO = (config: SEOConfig) => {
  const canonical = config.canonicalPath === null ? undefined : toAbsoluteUrl(config.canonicalPath || window.location.pathname);
  const image = toAbsoluteUrl(config.image);
  const robots = config.robots || 'index,follow';
  document.title = config.title;

  let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    if (canonicalLink?.dataset.seoManaged === 'true' || canonicalLink?.hasAttribute('data-seo')) canonicalLink.remove();
    canonicalLink = null;
  } else if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.rel = 'canonical';
    document.head.appendChild(canonicalLink);
  }
  if (canonicalLink && canonical) {
    canonicalLink.href = canonical;
    canonicalLink.dataset.seoManaged = 'true';
  }

  upsertMeta('description', 'name', config.description);
  upsertMeta('robots', 'name', robots);
  upsertMeta('og:title', 'property', config.title);
  upsertMeta('og:description', 'property', config.description);
  upsertMeta('og:type', 'property', config.type || 'website');
  upsertMeta('og:url', 'property', canonical);
  upsertMeta('og:site_name', 'property', config.siteName);
  upsertMeta('og:image', 'property', image);
  upsertMeta('twitter:card', 'name', image ? 'summary_large_image' : 'summary');
  upsertMeta('twitter:title', 'name', config.title);
  upsertMeta('twitter:description', 'name', config.description);
  upsertMeta('twitter:image', 'name', image);
  upsertMeta('article:published_time', 'property', config.article?.publishedTime);
  upsertMeta('article:modified_time', 'property', config.article?.modifiedTime);
  upsertMeta('article:section', 'property', config.article?.section);

  document.head.querySelectorAll('meta[property="article:tag"][data-seo-managed="true"], meta[property="article:tag"][data-seo]').forEach((element) => element.remove());
  config.article?.tags?.forEach((tag) => {
    const element = document.createElement('meta');
    element.setAttribute('property', 'article:tag');
    element.content = tag;
    element.dataset.seoManaged = 'true';
    document.head.appendChild(element);
  });

  document.getElementById('seo-structured-data')?.remove();
  if (config.structuredData) {
    const script = document.createElement('script');
    script.id = 'seo-structured-data';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(config.structuredData).replace(/</g, '\\u003c');
    document.head.appendChild(script);
  }
};
