import { applyHistoricalDocumentImages } from './documentImages';
import { applyDocumentHtmlLinks } from './documentLinks';
import { applyDocumentHeadingIds } from './documentHeadings';

/**
 * Unified single-pass DOM post-processing pipeline for sanitized HTML documents.
 * Eliminates multiple consecutive DOMParser / innerHTML rounds by:
 * 1. Parsing sanitized HTML exactly once into a single DOM tree.
 * 2. Rewriting historical proxy images and applying lazy/async loading attributes.
 * 3. Normalizing anchors and auto-linking plain URLs in text nodes.
 * 4. Assigning unique, deterministic IDs to all headings for TOC navigation.
 * 5. Serializing back to HTML string exactly once.
 */
export function processDocumentHtml(sanitizedHtml: string): string {
  if (!sanitizedHtml.trim() || typeof document === 'undefined') return sanitizedHtml;

  const doc = new DOMParser().parseFromString(sanitizedHtml, 'text/html');
  const root = doc.body;

  applyHistoricalDocumentImages(root, { lazyLoad: true });
  applyDocumentHtmlLinks(root, doc);
  applyDocumentHeadingIds(root);

  return root.innerHTML;
}
