/** Next.js extends fetch `RequestInit` with `cache`; keep API typecheck aligned. */
interface RequestInit {
  cache?: RequestCache;
}
