import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChatMessage } from "@/shared/types";
import {
  extractReadWebSourcesFromPart,
  extractWebQueries,
  extractWebSourceDetails,
  extractWebSources,
  getUrlPathSlug,
  getWebSourceDisplayTitle,
  hasPendingWebSearch,
  webSourceLabel,
} from "./web-search-parts";

type Part = ChatMessage["parts"][number];

function webSearchPart(): Part {
  return {
    input: { query: "google news june 2026" },
    output: {
      query: "google news june 2026",
      results: [
        {
          snippet: "Google released new updates in June 2026.",
          title: "Google Webmaster Report",
          url: "https://seroundtable.com/example",
        },
      ],
    },
    state: "output-available",
    toolCallId: "call-1",
    type: "tool-webSearch",
  } as unknown as Part;
}

function openUrlPart(): Part {
  return {
    input: { urls: ["https://example.com/article"] },
    output: {
      results: [
        {
          content: "",
          title: "Example Article",
          url: "https://example.com/article",
        },
      ],
      urls: ["https://example.com/article"],
    },
    state: "output-available",
    toolCallId: "call-2",
    type: "tool-openUrl",
  } as unknown as Part;
}

describe("extractWebQueries", () => {
  it("reads queries from the web_search tool part", () => {
    assert.deepEqual(extractWebQueries([webSearchPart()]), [
      "google news june 2026",
    ]);
  });

  it("reads legacy batched queries from older web_search parts", () => {
    const legacy = {
      input: { queries: ["openai news", "anthropic news"] },
      output: {
        queries: ["openai news", "anthropic news"],
        results: [],
      },
      state: "output-available",
      toolCallId: "call-legacy",
      type: "tool-webSearch",
    } as unknown as Part;
    assert.deepEqual(extractWebQueries([legacy]), [
      "openai news",
      "anthropic news",
    ]);
  });
});

describe("extractReadWebSourcesFromPart", () => {
  it("returns sources for auto-read urls on web_search output", () => {
    const part = {
      input: { query: "openai news" },
      output: {
        query: "openai news",
        readUrls: ["https://seroundtable.com/example"],
        results: [
          {
            snippet: "Snippet",
            title: "Google Webmaster Report",
            url: "https://seroundtable.com/example",
          },
        ],
      },
      state: "output-available",
      toolCallId: "call-1",
      type: "tool-webSearch",
    } as unknown as Part;

    const sources = extractReadWebSourcesFromPart(part);
    assert.equal(sources.length, 1);
    const source = sources[0];
    assert.equal(source?.type, "url");
    assert.equal(
      source?.type === "url" ? source.url : undefined,
      "https://seroundtable.com/example"
    );
    assert.equal(
      source?.type === "url" ? source.title : undefined,
      "Google Webmaster Report"
    );
  });
});

describe("extractWebSources", () => {
  it("collects url sources from web_search and open_url parts", () => {
    const sources = extractWebSources([webSearchPart(), openUrlPart()]);
    const urls = sources.map((source) =>
      source.type === "url" ? source.url : source.name
    );
    assert.deepEqual(urls, [
      "https://seroundtable.com/example",
      "https://example.com/article",
    ]);
  });
});

describe("extractWebSourceDetails", () => {
  it("extracts snippets from web_search results", () => {
    const details = extractWebSourceDetails([webSearchPart()]);
    assert.equal(
      details.get("https://seroundtable.com/example")?.snippet,
      "Google released new updates in June 2026."
    );
  });

  it("extracts titles from open_url results", () => {
    const details = extractWebSourceDetails([openUrlPart()]);
    assert.equal(
      details.get("https://example.com/article")?.title,
      "Example Article"
    );
  });
});

describe("hasPendingWebSearch", () => {
  it("returns true while a web tool is awaiting output", () => {
    const pending = {
      input: { urls: ["https://example.com"] },
      state: "input-available",
      toolCallId: "call-3",
      type: "tool-openUrl",
    } as unknown as Part;
    assert.equal(hasPendingWebSearch([pending]), true);
  });

  it("returns false once output is available", () => {
    assert.equal(hasPendingWebSearch([webSearchPart()]), false);
  });
});

describe("getWebSourceDisplayTitle", () => {
  it("prefers provider titles when they are meaningful", () => {
    assert.equal(
      getWebSourceDisplayTitle(
        "https://www.apple.com/newsroom/2026/06/example",
        "Apple Newsroom Example"
      ),
      "Apple Newsroom Example"
    );
  });

  it("derives a slug from the url path when title is missing", () => {
    assert.equal(
      getWebSourceDisplayTitle(
        "https://developer.apple.com/documentation/swift/array"
      ),
      "array"
    );
  });

  it("includes pathname when only the hostname would be shown", () => {
    assert.equal(
      getUrlPathSlug("https://www.apple.com/newsroom/2026/06/example/"),
      "example"
    );
    assert.equal(getUrlPathSlug("https://www.apple.com/"), "www.apple.com");
  });
});

describe("webSourceLabel", () => {
  it("uses slug fallback for url sources without titles", () => {
    assert.equal(
      webSourceLabel({
        type: "url",
        url: "https://developer.apple.com/documentation/swift/array",
      }),
      "array"
    );
  });
});
