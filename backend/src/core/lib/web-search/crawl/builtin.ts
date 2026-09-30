import { Resolver } from "node:dns/promises";
import { isIP } from "node:net";
import { load } from "cheerio";

export type CrawledPage = {
  url: string;
  title: string;
  content: string;
  error?: string;
};

const CRAWL_TIMEOUT_MS = 12_000;
const MAX_CONTENT_CHARS = 12_000;
const MAX_REDIRECTS = 5;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const dnsResolver = new Resolver();

function isPrivateIpLiteral(ip: string): boolean {
  const lower = ip.toLowerCase();

  if (lower === "::1" || lower === "0.0.0.0") {
    return true;
  }

  // IPv4-mapped IPv6 (::ffff:a.b.c.d)
  const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped?.[1]) {
    return isPrivateIpLiteral(v4Mapped[1]);
  }

  // IPv6 ULA fc00::/7 and link-local fe80::/10
  if (lower.includes(":")) {
    if (
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    ) {
      return true;
    }
    return false;
  }

  if (
    lower.startsWith("127.") ||
    lower.startsWith("10.") ||
    lower.startsWith("192.168.") ||
    lower.startsWith("169.254.") ||
    lower.startsWith("0.")
  ) {
    return true;
  }

  const octets = lower.split(".");
  if (octets.length === 4 && octets[0] === "172") {
    const second = Number.parseInt(octets[1] ?? "", 10);
    if (second >= 16 && second <= 31) {
      return true;
    }
  }

  // 100.64.0.0/10 CGNAT
  if (octets.length === 4 && octets[0] === "100") {
    const second = Number.parseInt(octets[1] ?? "", 10);
    if (second >= 64 && second <= 127) {
      return true;
    }
  }

  return false;
}

function isPrivateHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".corp")
  ) {
    return true;
  }

  if (!lower) {
    return true;
  }

  if (isIP(lower) !== 0) {
    return isPrivateIpLiteral(lower);
  }

  return false;
}

export function isSafeUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  if (parsed.username || parsed.password) {
    return false;
  }

  return !isPrivateHostname(parsed.hostname);
}

async function hostnameResolvesToPrivateIp(hostname: string): Promise<boolean> {
  if (isIP(hostname) !== 0) {
    return isPrivateIpLiteral(hostname);
  }

  try {
    const [v4, v6] = await Promise.all([
      dnsResolver.resolve4(hostname).catch(() => [] as string[]),
      dnsResolver.resolve6(hostname).catch(() => [] as string[]),
    ]);
    for (const ip of [...v4, ...v6]) {
      if (isPrivateIpLiteral(ip)) {
        return true;
      }
    }
    // No records → treat as unsafe (fail closed for SSRF)
    return v4.length === 0 && v6.length === 0;
  } catch {
    return true;
  }
}

export async function isSafeUrlAsync(rawUrl: string): Promise<boolean> {
  if (!isSafeUrl(rawUrl)) {
    return false;
  }
  const hostname = new URL(rawUrl).hostname;
  return !(await hostnameResolvesToPrivateIp(hostname));
}

function extractReadableText(html: string): { title: string; content: string } {
  const $ = load(html);

  $(
    "script, style, noscript, nav, header, footer, aside, iframe, svg, form, button"
  ).remove();

  const title = $("title").first().text().trim();

  const main = $("main").first();
  const scope = main.length > 0 ? main : $("body");

  const text = scope
    .text()
    .replace(/\s+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

  return {
    content: text.slice(0, MAX_CONTENT_CHARS),
    title,
  };
}

async function fetchWithSafeRedirects(
  startUrl: string,
  signal: AbortSignal
): Promise<Response> {
  let currentUrl = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isSafeUrlAsync(currentUrl))) {
      throw new Error("URL is not allowed");
    }

    const response = await fetch(currentUrl, {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "en-US,en;q=0.9",
        "sec-ch-ua":
          '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "user-agent": USER_AGENT,
      },
      redirect: "manual",
      signal,
    });

    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      return response;
    }

    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error("Too many redirects");
}

export async function builtinCrawl(url: string): Promise<CrawledPage> {
  if (!(await isSafeUrlAsync(url))) {
    return {
      content: "",
      error: "URL is not allowed",
      title: "",
      url,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);

  try {
    const response = await fetchWithSafeRedirects(url, controller.signal);

    if (!response.ok) {
      return {
        content: "",
        error: `Request failed with status ${response.status}`,
        title: "",
        url,
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      return {
        content: "",
        error: "Unsupported content type",
        title: "",
        url,
      };
    }

    const html = await response.text();
    const { title, content } = extractReadableText(html);

    return { content, title, url };
  } catch (error) {
    const message =
      error instanceof Error && error.message === "URL is not allowed"
        ? "URL is not allowed"
        : error instanceof Error && error.name === "AbortError"
          ? "Request timed out"
          : error instanceof Error && error.message === "Too many redirects"
            ? "Too many redirects"
            : "Failed to fetch page";
    return {
      content: "",
      error: message,
      title: "",
      url,
    };
  } finally {
    clearTimeout(timeout);
  }
}
