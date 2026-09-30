import { formatLlmProviderErrorMessage } from "@/shared/ai/format-model-error-message";
import type { WellKnownLlmProvider } from "@/shared/ai/llm-providers";

export { formatLlmProviderErrorMessage } from "@/shared/ai/format-model-error-message";

export async function testLlmProviderConnection(input: {
  provider: WellKnownLlmProvider;
  apiKey: string;
  apiBase?: string | null;
}) {
  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new Error("API key is required");
  }

  if (input.provider === "openai") {
    const base = (input.apiBase?.trim() || "https://api.openai.com/v1").replace(
      /\/$/,
      ""
    );
    const response = await fetch(`${base}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        formatLlmProviderErrorMessage(
          body,
          `OpenAI request failed (${response.status})`
        )
      );
    }
    return { ok: true as const };
  }

  if (input.provider === "google") {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      {
        signal: AbortSignal.timeout(15_000),
      }
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        formatLlmProviderErrorMessage(
          body,
          `Google AI request failed (${response.status})`
        )
      );
    }
    return { ok: true as const };
  }

  const response = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      formatLlmProviderErrorMessage(
        body,
        `Anthropic request failed (${response.status})`
      )
    );
  }
  return { ok: true as const };
}
