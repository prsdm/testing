import { getEmbeddingProvider } from "./embedding-provider";
import { embedViaModelServer } from "./model-server";
import { embedViaOpenAI } from "./openai-embeddings";
import type { SearchRuntimeSettings } from "./runtime-settings";
import { envSearchRuntimeSettings } from "./runtime-settings";

export type EmbedTextType = "query" | "passage";
export type { EmbeddingProvider } from "./embedding-provider";
export { getEmbeddingProvider } from "./embedding-provider";

export async function embedTexts(
  texts: string[],
  textType: EmbedTextType,
  settings: SearchRuntimeSettings = envSearchRuntimeSettings()
): Promise<number[][]> {
  if (getEmbeddingProvider() === "openai") {
    return await embedViaOpenAI(texts, textType, settings);
  }
  return await embedViaModelServer(texts, textType, settings);
}
