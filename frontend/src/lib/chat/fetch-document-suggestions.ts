import type { Suggestion } from "@/contracts/documents";

export async function fetchDocumentSuggestions(
  documentId: string
): Promise<Suggestion[]> {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  const response = await fetch(
    `${basePath}/api/suggestions?documentId=${encodeURIComponent(documentId)}`,
    { credentials: "include" }
  );
  if (!response.ok) {
    return [];
  }
  return response.json() as Promise<Suggestion[]>;
}
