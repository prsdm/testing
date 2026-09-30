/** App route for a knowledge base detail page (Next.js adds basePath). */
export function knowledgeBaseDetailPath(knowledgeBaseId: string) {
  return `/knowledge-bases/${knowledgeBaseId}`;
}

export function knowledgeBasesListPath() {
  return "/knowledge-bases";
}
