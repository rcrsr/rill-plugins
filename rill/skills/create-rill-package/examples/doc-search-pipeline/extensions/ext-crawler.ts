/**
 * Custom rill extension: crawler
 *
 * Purpose: Fetch and extract text content from web pages.
 * Built-in rill-ext packages do not include HTTP/HTML fetching.
 */

import type {
  RillExtensionFactory,
  RillExtensionConfig,
  RillExtensionValue,
} from "@rcrsr/rill";

interface CrawlerConfig {
  max_pages: number;
  timeout: number;
  user_agent: string;
}

export const createExtension: RillExtensionFactory = (
  config: RillExtensionConfig
): RillExtensionValue => {
  const cfg = config as unknown as CrawlerConfig;

  return {
    fetch_page: {
      description: "Fetch a URL and return its text content",
      parameters: [
        { name: "url", type: "string", description: "URL to fetch" },
      ],
      fn: async (url: string): Promise<{ url: string; title: string; text: string }> => {
        try {
          const response = await fetch(url, {
            headers: { "User-Agent": cfg.user_agent },
            signal: AbortSignal.timeout(cfg.timeout),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const html = await response.text();
          const title = html.match(/<title>(.*?)<\/title>/i)?.[1] ?? "";
          const text = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          return { url, title, text };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`crawler: ${message}`);
        }
      },
    },

    fetch_batch: {
      description: "Fetch multiple URLs and return their text content",
      parameters: [
        { name: "urls", type: "list", description: "List of URLs to fetch" },
      ],
      fn: async (urls: string[]): Promise<Array<{ url: string; title: string; text: string }>> => {
        const results = await Promise.allSettled(
          urls.slice(0, cfg.max_pages).map(async (url) => {
            const response = await fetch(url, {
              headers: { "User-Agent": cfg.user_agent },
              signal: AbortSignal.timeout(cfg.timeout),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            const title = html.match(/<title>(.*?)<\/title>/i)?.[1] ?? "";
            const text = html
              .replace(/<script[\s\S]*?<\/script>/gi, "")
              .replace(/<style[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            return { url, title, text };
          })
        );
        return results
          .filter((r): r is PromiseFulfilledResult<{ url: string; title: string; text: string }> =>
            r.status === "fulfilled"
          )
          .map((r) => r.value);
      },
    },
  };
};
