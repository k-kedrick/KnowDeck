const leadingTagFragment = /^(\.{3})?[^<>]*(?:\s(?:class|style|id|data-[\w-]+)=["'][^"']*["'])[^>]*>/i;

export const searchSnippetToText = (snippet: string): string => {
  const withoutBrokenEdges = snippet
    .replace(leadingTagFragment, '$1')
    .replace(/<[^>]*$/, ' ')
    .replace(/<[^>]*>/g, ' ');
  const parsed = new DOMParser().parseFromString(withoutBrokenEdges, 'text/html');
  return (parsed.body.textContent || '').replace(/\s+/g, ' ').trim();
};
