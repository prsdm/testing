export type AuditEventCategoryId =
  | "all"
  | "auth"
  | "admin"
  | "integrations"
  | "security"
  | "general"
  | "members";

export type AuditEventCategory = {
  id: AuditEventCategoryId;
  label: string;
  actionPrefix: string | null;
};

export const AUDIT_EVENT_CATEGORIES: AuditEventCategory[] = [
  { actionPrefix: null, id: "all", label: "All activity" },
  { actionPrefix: "auth.", id: "auth", label: "Sign-in & sessions" },
  { actionPrefix: "tenant.admin.", id: "admin", label: "Admin changes" },
  {
    actionPrefix: "tenant.integrations.",
    id: "integrations",
    label: "Integrations",
  },
  { actionPrefix: "security.", id: "security", label: "Security" },
  { actionPrefix: "tenant.general.", id: "general", label: "Workspace" },
  { actionPrefix: "tenant.member.", id: "members", label: "Members" },
];

export function auditActionPrefixForCategory(
  categoryId: string | undefined
): string | undefined {
  if (!categoryId || categoryId === "all") {
    return undefined;
  }
  const category = AUDIT_EVENT_CATEGORIES.find(
    (entry) => entry.id === categoryId
  );
  return category?.actionPrefix ?? undefined;
}
