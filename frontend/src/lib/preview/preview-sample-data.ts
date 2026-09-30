import type { ChannelSummary } from "@/contracts/channels";
import type { ChatHistory } from "@/contracts/chat";
import type { DmSummary } from "@/contracts/dms";
import type { CapabilityId } from "@/shared/auth/capabilities";
import { CAPABILITY_IDS } from "@/shared/auth/capabilities";
import {
  chatModels,
  DEFAULT_CHAT_MODEL,
  getTenantAvailableCapabilities,
} from "@/shared/ai/models";
import type { ProfileOnboardingStatus } from "@/shared/onboarding/profile-status";
import type { WorkspaceShellContext } from "@/shared/workspace/shell-context-types";
import type { WorkspaceResponse } from "@/hooks/use-workspace";
import { CHANNEL_THREAD_EMPTY_ROOT_TEXT } from "@/lib/chat/message-preview-text";
import type { ChatMessage } from "@/shared/types";

export const PREVIEW_TENANT_SLUG = "demo-workspace";
export const PREVIEW_USER_ID = "00000000-0000-4000-8000-000000000010";

export const PREVIEW_CHAT_WELCOME_ID = "00000000-0000-4000-8000-000000000001";
export const PREVIEW_CHAT_ROADMAP_ID = "00000000-0000-4000-8000-000000000002";
export const PREVIEW_CHANNEL_ID = "00000000-0000-4000-8000-000000000020";

export const PREVIEW_CHANNEL_THREAD_COPY_ID =
  "00000000-0000-4000-8000-000000000021";
export const PREVIEW_CHANNEL_THREAD_LAUNCH_ID =
  "00000000-0000-4000-8000-000000000022";
export const PREVIEW_CHANNEL_THREAD_FAQ_ID =
  "00000000-0000-4000-8000-000000000023";

const PREVIEW_PEER_JORDAN_ID = "00000000-0000-4000-8000-000000000011";
const PREVIEW_PEER_SAM_ID = "00000000-0000-4000-8000-000000000012";

const previewCapabilities = [...CAPABILITY_IDS] as CapabilityId[];

export const previewShellContext: Extract<WorkspaceShellContext, { ok: true }> =
  {
    ok: true,
    user: {
      id: PREVIEW_USER_ID,
      email: "alex.demo@kimiro.app",
      name: "Alex Demo",
      image: null,
      type: "regular",
    },
    tenantSlug: PREVIEW_TENANT_SLUG,
    isAdmin: true,
    showAdminEntry: true,
    capabilities: previewCapabilities,
    sidebarOpen: true,
    idleTimeoutMs: 0,
  };

export const previewWorkspace: WorkspaceResponse = {
  companyName: "Kimiro Demo",
  slug: PREVIEW_TENANT_SLUG,
  logoUrl: null,
  activeTenantSlug: PREVIEW_TENANT_SLUG,
  planLabel: "Preview",
  workspaces: [
    {
      id: "00000000-0000-4000-8000-000000000100",
      slug: PREVIEW_TENANT_SLUG,
      companyName: "Kimiro Demo",
      primaryDomain: "demo.kimiro.app",
      logoUrl: null,
    },
  ],
};

export const previewProfileStatus: ProfileOnboardingStatus = {
  needsProfileSetup: false,
  profile: {
    name: "Alex Demo",
    jobTitle: "Product",
    department: "Design",
    preferredName: "Alex",
  },
};

export function previewChatHistory(): ChatHistory {
  const now = new Date().toISOString();
  return {
    hasMore: false,
    chats: [
      {
        id: PREVIEW_CHAT_WELCOME_ID,
        createdAt: now,
        title: "Welcome to Kimiro",
        userId: PREVIEW_USER_ID,
        tenantId: PREVIEW_TENANT_SLUG,
        knowledgeBaseId: null,
        contextSummary: null,
        contextSummaryThroughMessageId: null,
        contextSummaryUpdatedAt: null,
      },
      {
        id: PREVIEW_CHAT_ROADMAP_ID,
        createdAt: now,
        title: "Q3 launch checklist",
        userId: PREVIEW_USER_ID,
        tenantId: PREVIEW_TENANT_SLUG,
        knowledgeBaseId: null,
        contextSummary: null,
        contextSummaryThroughMessageId: null,
        contextSummaryUpdatedAt: null,
      },
    ],
  };
}

export function previewModelsResponse() {
  const models = chatModels.slice(0, 6);
  return {
    models,
    defaultChatModelId: DEFAULT_CHAT_MODEL,
    defaultChatReasoningEffort: "medium" as const,
    capabilities: getTenantAvailableCapabilities(models),
  };
}

export function previewChannels(): { channels: ChannelSummary[] } {
  return {
    channels: [
      {
        id: PREVIEW_CHANNEL_ID,
        tenantId: PREVIEW_TENANT_SLUG,
        title: "product-launch",
        userId: PREVIEW_USER_ID,
        knowledgeBaseId: null,
        createdAt: new Date().toISOString(),
        participantRole: "owner",
        unreadCount: 2,
      },
    ],
  };
}

export function previewDms(): { dms: DmSummary[] } {
  return {
    dms: [
      {
        id: "00000000-0000-4000-8000-000000000030",
        tenantId: PREVIEW_TENANT_SLUG,
        createdAt: new Date().toISOString(),
        isGroup: false,
        title: "Jordan Lee",
        peerUserId: "00000000-0000-4000-8000-000000000011",
        peerDisplayName: "Jordan Lee",
        peerEmail: "jordan@kimiro.app",
        peerImage: null,
        members: [],
        unreadCount: 0,
      },
    ],
  };
}

function channelThreadRoot(args: {
  id: string;
  threadTitle: string;
  authorUserId: string;
  authorDisplayName: string;
  authorEmail: string;
  createdAt: string;
}): ChatMessage {
  return {
    id: args.id,
    role: "user",
    threadRootMessageId: null,
    metadata: {
      authorAuthUserId: args.authorUserId,
      authorDisplayName: args.authorDisplayName,
      authorEmail: args.authorEmail,
      createdAt: args.createdAt,
      threadTitle: args.threadTitle,
    },
    parts: [{ type: "text", text: CHANNEL_THREAD_EMPTY_ROOT_TEXT }],
  };
}

export function previewChannelDetails(channelId: string) {
  if (channelId !== PREVIEW_CHANNEL_ID) {
    return { channel: null };
  }
  return {
    channel: {
      id: PREVIEW_CHANNEL_ID,
      title: "product-launch",
      knowledgeBaseId: null,
      createdAt: new Date().toISOString(),
      createdByName: "Alex Demo",
      threadTagCatalog: [
        { label: "Launch", color: "blue" as const },
        { label: "Copy", color: "purple" as const },
        { label: "Design", color: "pink" as const },
      ],
    },
  };
}

export function previewChannelMembers(_channelId: string) {
  return {
    canManageMembers: true,
    members: [
      {
        userId: PREVIEW_USER_ID,
        role: "owner" as const,
        email: "alex.demo@kimiro.app",
        displayName: "Alex Demo",
        image: null,
        createdAt: new Date().toISOString(),
      },
      {
        userId: PREVIEW_PEER_JORDAN_ID,
        role: "member" as const,
        email: "jordan@kimiro.app",
        displayName: "Jordan Lee",
        image: null,
        createdAt: new Date().toISOString(),
      },
      {
        userId: PREVIEW_PEER_SAM_ID,
        role: "member" as const,
        email: "sam@kimiro.app",
        displayName: "Sam Rivera",
        image: null,
        createdAt: new Date().toISOString(),
      },
    ],
    pickerOptions: [],
  };
}

export function previewChannelThreadMessages(threadRootMessageId: string): {
  messages: ChatMessage[];
} {
  if (threadRootMessageId === PREVIEW_CHANNEL_THREAD_LAUNCH_ID) {
    return {
      messages: [
        channelThreadRoot({
          id: PREVIEW_CHANNEL_THREAD_LAUNCH_ID,
          threadTitle: "Launch checklist",
          authorUserId: PREVIEW_USER_ID,
          authorDisplayName: "Alex Demo",
          authorEmail: "alex.demo@kimiro.app",
          createdAt: "2026-09-28T10:00:00.000Z",
        }),
        {
          id: "00000000-0000-4000-8000-000000000221",
          role: "user",
          threadRootMessageId: PREVIEW_CHANNEL_THREAD_LAUNCH_ID,
          metadata: {
            authorAuthUserId: PREVIEW_USER_ID,
            authorDisplayName: "Alex Demo",
            authorEmail: "alex.demo@kimiro.app",
            createdAt: "2026-09-28T10:01:00.000Z",
          },
          parts: [
            {
              type: "text",
              text: "@kimiro Turn this into a launch checklist we can share with the team.",
            },
          ],
        },
        {
          id: "00000000-0000-4000-8000-000000000222",
          role: "assistant",
          threadRootMessageId: PREVIEW_CHANNEL_THREAD_LAUNCH_ID,
          metadata: {
            agentName: "Kimiro",
            createdAt: "2026-09-28T10:01:30.000Z",
            workflowRunStatus: "success",
          },
          parts: [
            {
              type: "text",
              text: "Here is a draft launch checklist:\n\n• Finalize positioning and hero copy\n• Ship onboarding + empty states\n• Record a 2-minute product walkthrough\n• Dogfood with design + sales for one week\n• Publish changelog and customer email",
            },
          ],
        },
        {
          id: "00000000-0000-4000-8000-000000000223",
          role: "user",
          threadRootMessageId: PREVIEW_CHANNEL_THREAD_LAUNCH_ID,
          metadata: {
            authorAuthUserId: PREVIEW_PEER_JORDAN_ID,
            authorDisplayName: "Jordan Lee",
            authorEmail: "jordan@kimiro.app",
            createdAt: "2026-09-28T10:05:00.000Z",
          },
          parts: [
            {
              type: "text",
              text: "Love this — I'll take the walkthrough and changelog items.",
            },
          ],
        },
      ],
    };
  }

  if (threadRootMessageId === PREVIEW_CHANNEL_THREAD_COPY_ID) {
    return {
      messages: [
        channelThreadRoot({
          id: PREVIEW_CHANNEL_THREAD_COPY_ID,
          threadTitle: "Website copy review",
          authorUserId: PREVIEW_PEER_JORDAN_ID,
          authorDisplayName: "Jordan Lee",
          authorEmail: "jordan@kimiro.app",
          createdAt: "2026-09-27T15:00:00.000Z",
        }),
        {
          id: "00000000-0000-4000-8000-000000000211",
          role: "user",
          threadRootMessageId: PREVIEW_CHANNEL_THREAD_COPY_ID,
          metadata: {
            authorAuthUserId: PREVIEW_PEER_JORDAN_ID,
            authorDisplayName: "Jordan Lee",
            authorEmail: "jordan@kimiro.app",
            createdAt: "2026-09-27T15:02:00.000Z",
          },
          parts: [
            {
              type: "text",
              text: "Can we tighten the hero subhead before we ship?",
            },
          ],
        },
      ],
    };
  }

  if (threadRootMessageId === PREVIEW_CHANNEL_THREAD_FAQ_ID) {
    return {
      messages: [
        channelThreadRoot({
          id: PREVIEW_CHANNEL_THREAD_FAQ_ID,
          threadTitle: "Pricing page FAQ",
          authorUserId: PREVIEW_PEER_SAM_ID,
          authorDisplayName: "Sam Rivera",
          authorEmail: "sam@kimiro.app",
          createdAt: "2026-09-26T09:00:00.000Z",
        }),
      ],
    };
  }

  return { messages: [] };
}

export function previewChannelRoomMessages() {
  const roots = [
    channelThreadRoot({
      id: PREVIEW_CHANNEL_THREAD_COPY_ID,
      threadTitle: "Website copy review",
      authorUserId: PREVIEW_PEER_JORDAN_ID,
      authorDisplayName: "Jordan Lee",
      authorEmail: "jordan@kimiro.app",
      createdAt: "2026-09-27T15:00:00.000Z",
    }),
    channelThreadRoot({
      id: PREVIEW_CHANNEL_THREAD_LAUNCH_ID,
      threadTitle: "Launch checklist",
      authorUserId: PREVIEW_USER_ID,
      authorDisplayName: "Alex Demo",
      authorEmail: "alex.demo@kimiro.app",
      createdAt: "2026-09-28T10:00:00.000Z",
    }),
    channelThreadRoot({
      id: PREVIEW_CHANNEL_THREAD_FAQ_ID,
      threadTitle: "Pricing page FAQ",
      authorUserId: PREVIEW_PEER_SAM_ID,
      authorDisplayName: "Sam Rivera",
      authorEmail: "sam@kimiro.app",
      createdAt: "2026-09-26T09:00:00.000Z",
    }),
  ];

  const launchThread = previewChannelThreadMessages(
    PREVIEW_CHANNEL_THREAD_LAUNCH_ID
  ).messages.filter((message) => message.threadRootMessageId);

  return {
    channelParticipantRole: "owner" as const,
    channelTitle: "product-launch",
    chatKind: "channel",
    dmMembers: [],
    dmPeerDisplayName: null,
    dmPeerEmail: null,
    dmPeerImage: null,
    dmPeerUserId: null,
    dmTitle: null,
    isChannel: true,
    isDm: false,
    isGroupDm: false,
    isMultiplayerRoom: true,
    isReadonly: false,
    knowledgeBase: null,
    messages: roots,
    threadReplyCounts: {
      [PREVIEW_CHANNEL_THREAD_COPY_ID]: 1,
      [PREVIEW_CHANNEL_THREAD_LAUNCH_ID]: 3,
      [PREVIEW_CHANNEL_THREAD_FAQ_ID]: 0,
    },
    threadReplyMessages: launchThread.slice(-1),
    userId: PREVIEW_USER_ID,
  };
}

export function previewMessagesForChat(
  chatId: string,
  threadRootMessageId?: string | null
): {
  messages: ChatMessage[];
  isMultiplayerRoom: boolean;
  isReadonly: boolean;
} & Record<string, unknown> {
  if (chatId === PREVIEW_CHANNEL_ID) {
    if (threadRootMessageId) {
      return {
        ...previewChannelThreadMessages(threadRootMessageId),
        isMultiplayerRoom: true,
        isReadonly: false,
      };
    }
    return previewChannelRoomMessages();
  }

  if (chatId === PREVIEW_CHAT_WELCOME_ID) {
    return {
      isMultiplayerRoom: false,
      isReadonly: false,
      messages: [
        {
          id: "00000000-0000-4000-8000-000000000101",
          role: "user",
          parts: [{ type: "text", text: "Give me a quick tour of what Kimiro can do." }],
        },
        {
          id: "00000000-0000-4000-8000-000000000102",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "You're viewing a **preview deploy** with sample data. Explore chats, channels, and the composer UI. Connect a backend later for live AI and sign-in.",
            },
          ],
        },
      ],
    };
  }

  if (chatId === PREVIEW_CHAT_ROADMAP_ID) {
    return {
      isMultiplayerRoom: false,
      isReadonly: false,
      messages: [
        {
          id: "00000000-0000-4000-8000-000000000201",
          role: "user",
          parts: [{ type: "text", text: "Draft a short launch checklist for the team." }],
        },
        {
          id: "00000000-0000-4000-8000-000000000202",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "1. Finalize positioning\n2. Ship onboarding flow\n3. Run a dogfood week\n4. Publish docs + demo video",
            },
          ],
        },
      ],
    };
  }

  return {
    isMultiplayerRoom: false,
    isReadonly: false,
    messages: [],
  };
}
