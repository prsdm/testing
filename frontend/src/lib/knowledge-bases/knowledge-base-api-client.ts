export function knowledgeBasesApiBase(tenantSlug: string) {
  return `${process.env.KIMIRO_BASE_PATH ?? ""}/api/knowledge-bases/${tenantSlug}`;
}

export async function readKnowledgeBasesApiError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };
    return payload.error ?? payload.message ?? fallback;
  } catch {
    return fallback;
  }
}
