/**
 * Custom rill extension: crawler
 *
 * Purpose: Fetch and extract text content from web pages.
 * Built-in rill-ext packages do not include HTTP/HTML fetching.
 */

import {
  type ExtensionConfigSchema,
  type ExtensionFactoryCtx,
  type ExtensionFactoryResult,
  type ExtensionManifest,
  type RillFunction,
  type RillParam,
  type RillValue,
  type RuntimeContext,
  RuntimeError,
  structureToTypeValue,
  toCallable,
} from "@rcrsr/rill";

const PROVIDER = "crawler";

interface CrawlerConfig {
  max_pages: number;
  timeout: number;
  user_agent: string;
}

const pageReturn = structureToTypeValue({
  kind: "dict",
  fields: {
    url: { type: { kind: "string" } },
    title: { type: { kind: "string" } },
    text: { type: { kind: "string" } },
  },
});

const pageListReturn = structureToTypeValue({
  kind: "list",
  element: {
    kind: "dict",
    fields: {
      url: { type: { kind: "string" } },
      title: { type: { kind: "string" } },
      text: { type: { kind: "string" } },
    },
  },
});

function htmlToText(html: string): { title: string; text: string } {
  const title = html.match(/<title>(.*?)<\/title>/i)?.[1] ?? "";
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { title, text };
}

function createCrawlerExtension(
  config: CrawlerConfig,
  _ctx: ExtensionFactoryCtx,
): ExtensionFactoryResult {
  if (!config.user_agent) {
    throw new RuntimeError("RILL-R001", "crawler: user_agent is required");
  }

  const urlParam: RillParam = {
    name: "url",
    type: { kind: "string" },
    annotations: { description: "URL to fetch" },
  };

  const fetchPageFn: RillFunction = {
    params: [urlParam],
    fn: async (args, runCtx: RuntimeContext) => {
      const url = args["url"] as string;
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": config.user_agent },
          signal: AbortSignal.timeout(config.timeout),
        });
        if (!response.ok) {
          return runCtx.invalidate(
            new Error(`HTTP ${response.status}: ${response.statusText}`),
            {
              code: response.status === 404 ? "NOT_FOUND" : "UNAVAILABLE",
              provider: PROVIDER,
              raw: { kind: "http_error", status: response.status, url },
            },
          );
        }
        const html = await response.text();
        const { title, text } = htmlToText(html);
        return { url, title, text } as RillValue;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return runCtx.invalidate(new Error(`crawler: ${message}`), {
          code: "UNAVAILABLE",
          provider: PROVIDER,
          raw: { kind: "fetch_failed", url },
        });
      }
    },
    annotations: { description: "Fetch a URL and return its text content" },
    returnType: pageReturn,
  };

  const urlsParam: RillParam = {
    name: "urls",
    type: { kind: "list", element: { kind: "string" } },
    annotations: { description: "List of URLs to fetch" },
  };

  const fetchBatchFn: RillFunction = {
    params: [urlsParam],
    fn: async (args, _runCtx: RuntimeContext) => {
      const urls = args["urls"] as string[];
      const settled = await Promise.allSettled(
        urls.slice(0, config.max_pages).map(async (url) => {
          const response = await fetch(url, {
            headers: { "User-Agent": config.user_agent },
            signal: AbortSignal.timeout(config.timeout),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const html = await response.text();
          const { title, text } = htmlToText(html);
          return { url, title, text };
        }),
      );
      return settled
        .filter(
          (r): r is PromiseFulfilledResult<{ url: string; title: string; text: string }> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value) as RillValue;
    },
    annotations: { description: "Fetch multiple URLs and return their text content" },
    returnType: pageListReturn,
  };

  const value: Record<string, RillValue> = {
    fetch_page: toCallable(fetchPageFn),
    fetch_batch: toCallable(fetchBatchFn),
  };

  return { value };
}

export const configSchema: ExtensionConfigSchema = {
  max_pages: { type: "number", required: true },
  timeout: { type: "number", required: true },
  user_agent: { type: "string", required: true },
};

export const extensionManifest: ExtensionManifest = {
  factory: createCrawlerExtension as ExtensionManifest["factory"],
  configSchema,
  version: "0.1.0",
};
