import type { ThreadTag } from "@/shared/chat/thread-tags";

export type ChannelDetails = {
  id: string;
  title: string;
  knowledgeBaseId: string | null;
  createdAt: string;
  createdByName: string;
  threadTagCatalog?: ThreadTag[];
};

export type ChannelSummary = {
  id: string;
  tenantId: string;
  title: string;
  userId: string;
  knowledgeBaseId: string | null;
  createdAt: string;
  participantRole: "owner" | "member";
  unreadCount: number;
};

export type ChannelMember = {
  userId: string;
  role: "owner" | "member";
  email: string;
  displayName: string;
  image: string | null;
  createdAt: string;
};

export type ChannelMemberPickerOption = {
  userId: string;
  email: string;
  displayName: string;
  image: string | null;
};
