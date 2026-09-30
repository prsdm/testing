import type { UserType } from "@/core/lib/auth/server-session";

type Entitlements = {
  maxMessagesPerMinute: number;
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  regular: {
    maxMessagesPerMinute: 10,
  },
};
