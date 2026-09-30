export type EmbeddingProvider = "tei" | "openai";

export function getEmbeddingProvider(): EmbeddingProvider {
  const raw = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();
  if (raw === "openai") {
    return "openai";
  }
  return "tei";
}
