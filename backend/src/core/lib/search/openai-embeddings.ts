import { getPlatformLlmApiKey } from "@/core/lib/ai/platform-api-keys";
import type { EmbedTextType } from "./embeddings";
import type { SearchRuntimeSettings } from "./runtime-settings";

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const OPENAI_EMBED_BATCH_SIZE = 64;

function withPrefix(
  text: string,
  textType: EmbedTextType,
  settings: SearchRuntimeSettings
) {
  const rawPrefix =
    textType === "query"
      ? settings.embeddingQueryPrefix
      : settings.embeddingPassagePrefix;
  const prefix = rawPrefix.trim();
  if (!prefix) {
    return text;
  }
  return `${prefix} ${text}`;
}

function normalizeEmbedding(vector: number[]): number[] {
  const magnitude = Math.hypot(...vector);
  if (magnitude === 0) {
    return vector;
  }
  return vector.map((value) => value / magnitude);
}

async function embedBatch(
  apiKey: string,
  inputs: string[],
  settings: SearchRuntimeSettings
): Promise<number[][]> {
  const body: Record<string, unknown> = {
    encoding_format: "float",
    input: inputs,
    model: settings.embeddingModel,
  };

  // text-embedding-3-* support shortening; keep pgvector column at 768 by default.
  if (
    settings.embeddingDimension > 0 &&
    settings.embeddingModel.startsWith("text-embedding-3")
  ) {
    body.dimensions = settings.embeddingDimension;
  }

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `OpenAI embeddings error (${response.status}): ${detail.slice(0, 400)}`
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[]; index?: number }>;
  };
  if (!Array.isArray(payload.data)) {
    throw new Error("OpenAI embeddings returned an unexpected response.");
  }

  const ordered = [...payload.data].sort(
    (left, right) => (left.index ?? 0) - (right.index ?? 0)
  );

  return ordered.map((item, index) => {
    if (!Array.isArray(item.embedding)) {
      throw new Error(`Missing OpenAI embedding vector at index ${index}`);
    }
    if (item.embedding.length !== settings.embeddingDimension) {
      throw new Error(
        `OpenAI embedding dimension mismatch at index ${index}: expected ${settings.embeddingDimension}, got ${item.embedding.length}`
      );
    }
    return settings.embeddingNormalize
      ? normalizeEmbedding(item.embedding)
      : item.embedding;
  });
}

export async function embedViaOpenAI(
  texts: string[],
  textType: EmbedTextType,
  settings: SearchRuntimeSettings
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const apiKey = getPlatformLlmApiKey("openai");
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY (or KIMIRO_MANAGED_OPENAI_API_KEY) is required when EMBEDDING_PROVIDER=openai"
    );
  }

  const inputs = texts.map((text) => withPrefix(text, textType, settings));
  const embeddings: number[][] = [];

  for (let index = 0; index < inputs.length; index += OPENAI_EMBED_BATCH_SIZE) {
    const batch = inputs.slice(index, index + OPENAI_EMBED_BATCH_SIZE);
    const batchEmbeddings = await embedBatch(apiKey, batch, settings);
    embeddings.push(...batchEmbeddings);
  }

  if (embeddings.length !== texts.length) {
    throw new Error("OpenAI embeddings returned an unexpected batch size.");
  }

  return embeddings;
}
