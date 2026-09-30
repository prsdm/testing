export type DmMemberSummary = {
  userId: string;
  displayName: string;
  email: string;
  image: string | null;
};

export type DmSummary = {
  id: string;
  tenantId: string;
  createdAt: string;
  isGroup: boolean;
  title: string;
  peerUserId: string;
  peerDisplayName: string;
  peerEmail: string;
  peerImage: string | null;
  members: DmMemberSummary[];
  unreadCount: number;
};

export type DmMemberPickerOption = {
  userId: string;
  email: string;
  displayName: string;
  image: string | null;
};
