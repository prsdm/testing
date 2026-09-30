export type KnowledgeBaseCollaboratorRole = "editor" | "viewer";

export type KnowledgeBaseViewerRole = "owner" | KnowledgeBaseCollaboratorRole;

const ROLE_RANK: Record<KnowledgeBaseViewerRole, number> = {
  editor: 2,
  owner: 3,
  viewer: 1,
};

export function knowledgeBaseRoleAtLeast(
  role: KnowledgeBaseViewerRole,
  minimum: KnowledgeBaseViewerRole
): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function canEditKnowledgeBase(role: KnowledgeBaseViewerRole): boolean {
  return knowledgeBaseRoleAtLeast(role, "editor");
}

export function canManageKnowledgeBaseMembers(
  role: KnowledgeBaseViewerRole
): boolean {
  return role === "owner";
}

export function canDeleteKnowledgeBase(role: KnowledgeBaseViewerRole): boolean {
  return role === "owner";
}
