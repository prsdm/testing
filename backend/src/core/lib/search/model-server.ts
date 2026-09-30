import type { EmbedTextType } from "./embeddings";
import type { SearchRuntimeSettings } from "./runtime-settings";

export function getModelServerBaseUrl(textType: EmbedTextType) {
  const indexingUrl =
    process.env.INDEXING_MODEL_SERVER_URL ??
    process.env.MODEL_SERVER_URL ??
    "http://localhost:9000";
  const inferenceUrl =
    process.env.MODEL_SERVER_URL ?? indexingUrl ?? "http://localhost:9000";
  const chosen = textType === "passage" ? indexingUrl : inferenceUrl;
  return chosen.replace(/\/+$/, "");
}

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

async function readErrorBody(response: Response): Promise<string> {
  return await response.text().catch(() => "");
}

async function requestEmbeddingsViaOpenAIEndpoint(
  baseUrl: string,
  input: string[],
  settings: SearchRuntimeSettings
): Promise<number[][] | null> {
  const response = await fetch(`${baseUrl}/v1/embeddings`, {
    body: JSON.stringify({
      encoding_format: "float",
      input,
      model: settings.embeddingModel,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (
    response.status === 404 ||
    response.status === 405 ||
    response.status === 422
  ) {
    return null;
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(
      `Model server error (${response.status}): ${body.slice(0, 400)}`
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[]; index?: number }>;
  };
  if (!Array.isArray(payload.data)) {
    throw new Error("Model server returned an unexpected embedding response.");
  }

  const ordered = [...payload.data].sort(
    (left, right) => (left.index ?? 0) - (right.index ?? 0)
  );
  return ordered.map((item) => {
    if (!Array.isArray(item.embedding)) {
      throw new Error(
        "Model server returned an unexpected embedding response."
      );
    }
    return item.embedding;
  });
}

async function requestEmbeddingsViaEmbedEndpoint(
  baseUrl: string,
  input: string[]
): Promise<number[][] | null> {
  const response = await fetch(`${baseUrl}/embed`, {
    body: JSON.stringify({ inputs: input }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (
    response.status === 404 ||
    response.status === 405 ||
    response.status === 422
  ) {
    return null;
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(
      `Model server error (${response.status}): ${body.slice(0, 400)}`
    );
  }

  const payload = (await response.json()) as { embeddings?: number[][] };
  const embeddings = Array.isArray(payload) ? payload : payload.embeddings;
  if (!Array.isArray(embeddings)) {
    throw new Error("Model server returned an unexpected embedding response.");
  }
  return embeddings;
}

export async function embedViaModelServer(
  texts: string[],
  textType: EmbedTextType,
  settings: SearchRuntimeSettings
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const baseUrl = getModelServerBaseUrl(textType);
  const inputs = texts.map((text) => withPrefix(text, textType, settings));

  const embedEmbeddings = await requestEmbeddingsViaEmbedEndpoint(
    baseUrl,
    inputs
  );
  const openAiEmbeddings =
    embedEmbeddings === null
      ? await requestEmbeddingsViaOpenAIEndpoint(baseUrl, inputs, settings)
      : null;
  const embeddings = embedEmbeddings ?? openAiEmbeddings;
  if (embeddings === null) {
    throw new Error(
      "Model server does not expose a supported TEI embedding endpoint (/embed or /v1/embeddings)."
    );
  }
  if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
    throw new Error("Model server returned an unexpected embedding response.");
  }

  for (const [index, vector] of embeddings.entries()) {
    if (!Array.isArray(vector)) {
      throw new Error(`Missing embedding vector at index ${index}`);
    }
    const normalizedVector = settings.embeddingNormalize
      ? normalizeEmbedding(vector)
      : vector;

    if (normalizedVector.length !== settings.embeddingDimension) {
      throw new Error(
        `Embedding dimension mismatch at index ${index}: expected ${settings.embeddingDimension}, got ${normalizedVector.length}`
      );
    }
    embeddings[index] = normalizedVector;
  }

  return embeddings;
}
