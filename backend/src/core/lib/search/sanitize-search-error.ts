/**
 * User/LLM-facing search failure copy. Never mention infra (Vespa, docker, etc.).
 */
export function sanitizeSearchErrorForLlm(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (
    /vespa|ECONNREFUSED|fetch failed|ENOTFOUND|ETIMEDOUT|config server|docker compose/i.test(
      raw
    )
  ) {
    return "Workspace search is temporarily unavailable. If you are in a knowledge base, search its indexed files instead.";
  }

  return "Search is temporarily unavailable. Try again or rephrase the question.";
}

export function isLegacySearchInfraError(error: unknown): boolean {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return /vespa|ECONNREFUSED|fetch failed|config server|docker compose/i.test(
    raw
  );
}
