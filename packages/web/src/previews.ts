// Previews of other pages, fetched from the server on the first hover and
// kept for as long as the page is open. A reload starts empty, so a page is
// always previewed as it is now.

export interface PagePreview {
  name: string;
  properties: Record<string, string>;
  lines: string[];
}

const cache = new Map<string, Promise<PagePreview>>();

export function loadPreview(name: string): Promise<PagePreview> {
  let preview = cache.get(name);
  if (!preview) {
    preview = fetch(`/api/preview/${encodeURIComponent(name)}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error(`no preview of ${name}`);
      return (await response.json()) as PagePreview;
    });
    cache.set(name, preview);
  }
  return preview;
}

// A linked page that has changed is fetched again on the next hover.
export function forgetPreview(name: string): void {
  cache.delete(name);
}
