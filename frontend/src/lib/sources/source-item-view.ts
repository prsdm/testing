import type { SourceConnectorType } from "@/shared/sources/source-types";

export type KbItemView = {
  id: string;
  title: string;
  sourceType: SourceConnectorType;
  visibility: "private" | "shared";
  createdByUserId?: string | null;
  indexedByEmail?: string | null;
  indexedByName?: string | null;
  externalRef?: string | null;
  link: string | null;
  sourceUpdatedAt?: string | null;
  lastIndexedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export function formatKbIndexedByLabel(args: {
  createdByUserId?: string | null;
  indexedByEmail?: string | null;
  indexedByName?: string | null;
  viewerUserId: string;
}) {
  if (args.createdByUserId === args.viewerUserId) {
    return "You";
  }
  const name = args.indexedByName?.trim();
  if (name) {
    return name;
  }
  const email = args.indexedByEmail?.trim();
  if (email) {
    return email.split("@")[0] ?? email;
  }
  return "—";
}
