import type {
  KnowledgeBaseCollaboratorRole,
  KnowledgeBaseViewerRole,
} from "@/shared/knowledge-bases/knowledge-base-access";

/** JSON representation returned by knowledge-base API endpoints. */
export type KnowledgeBaseSummary = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  viewerRole: KnowledgeBaseViewerRole;
};

export type KnowledgeBaseMemberPickerOption = {
  userId: string;
  email: string;
  displayName: string;
  image: string | null;
};

export type KnowledgeBaseMember = {
  userId: string;
  role: KnowledgeBaseCollaboratorRole;
  email: string;
  displayName: string;
  image: string | null;
  createdAt: string;
};
