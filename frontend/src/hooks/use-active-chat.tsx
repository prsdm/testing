"use client";

import { Chat, useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import useSWR, { useSWRConfig } from "swr";
import type { ComposerDocumentSelection } from "@/components/chat/composer-inject";
import type { ComposerKnowledgeBaseSelection } from "@/components/chat/composer-knowledge-base-chip";
import { useDataStream } from "@/components/chat/data-stream-provider";
import { FREE_TRIAL_API_URL } from "@/components/chat/free-trial-query-counter";
import { toast } from "@/components/chat/toast";
import { useSessionUser } from "@/components/providers/session-user-provider";
import { useTenant } from "@/components/providers/tenant-provider";
import type { DmMemberSummary } from "@/contracts/dms";
import type { MessageReaction } from "@/contracts/message-reactions";
import { useChatRoomEvents } from "@/hooks/use-chat-room-events";
import { chatModelsApiUrl, fetchChatModels } from "@/lib/ai/chat-models-api";
import { channelsListSwrKey } from "@/lib/channels/channels-api";
import type {
  ChatRunStatus,
  ChatSendMessage,
  ChatSetMessages,
} from "@/lib/chat/chat-helpers";
import {
  appendRegisteredOptimisticMessage,
  applyRegisteredAssistantMessageUpdate,
  applyRegisteredExecutedToolSync,
  applyRegisteredToolApproval,
  applyRegisteredWorkflowSnapshot,
  getRegisteredChat,
  getRegisteredChatSnapshot,
  getStreamingChatIdsSnapshot,
  hydrateRegisteredMessages,
  SERVER_REGISTERED_CHAT_SNAPSHOT,
  setRegisteredMessages,
  setRegisteredStatus,
  subscribeChatRegistry,
} from "@/lib/chat/chat-registry";
import { createChatRunTransport } from "@/lib/chat/chat-transport";
import {
  getComposerChatIdSnapshot,
  setComposerChatId,
  subscribeComposerChatId,
} from "@/lib/chat/composer-chat-id";
import { markChatRead } from "@/lib/chat/mark-chat-read";
import { revalidateChatMessageCaches } from "@/lib/chat/revalidate-chat-message-caches";
import {
  clearStoppedWorkflowRunsForChat,
  clearWorkflowRunStopped,
  isWorkflowRunStopped,
  markWorkflowRunStopped,
} from "@/lib/chat/stopped-workflow-runs";
import { reactionsApiUrl } from "@/lib/chat/toggle-message-reaction";
import {
  chatMessagesToWorkflowMessages,
  isEmptyAssistantMessage,
  workflowMessagesToChatMessages,
} from "@/lib/chat/workflow-message-bridge";
import { CONNECTOR_CHAT_FOCUS_EVENT } from "@/lib/connectors/open-connector-chat";
import { dmsListSwrKey } from "@/lib/dms/dms-api";
import { toTenantUserId } from "@/lib/tenant-user-id";
import {
  formatModelErrorMessage,
  isChatRequestCancelledError,
} from "@/shared/ai/format-model-error-message";
import { resolveCanonicalModelId } from "@/shared/ai/model-id-migrations";
import {
  type ChatModel,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
  type ModelCapabilities,
} from "@/shared/ai/models";
import {
  DEFAULT_REASONING_EFFORT,
  type ModelReasoningPreferences,
  modelSupportsReasoning,
  normalizeReasoningEffortForModel,
  parseModelReasoningPreferences,
  parseReasoningEffort,
  REASONING_EFFORT_BY_MODEL_COOKIE,
  REASONING_EFFORT_COOKIE,
  type ReasoningEffortLevel,
  resolveEffortForModelPreferences,
  serializeModelReasoningPreferences,
  withModelReasoningPreference,
} from "@/shared/ai/reasoning-effort";
import {
  isToolApprovalBatchComplete,
  messageHasInlineToolApproval,
} from "@/shared/chat/apply-tool-approval-response";
import {
  assistantTurnNeedsContinuation,
  assistantTurnNeedsPendingTodoContinuation,
  assistantTurnNeedsTodoExecutionContinuation,
} from "@/shared/chat/assistant-turn-continuation";
import type { ChatRoomTypist } from "@/shared/chat/chat-room-events";
import { messageInvokesKimiro } from "@/shared/chat/kimiro-mention";
import { assistantPartsRichness } from "@/shared/chat/merge-workflow-chat-messages";
import {
  CHAT_HOME,
  chatConversationPath,
  extractChatIdFromPath,
  isChatAreaPath,
  isChatHomePath,
} from "@/shared/chat/routes";
import { sanitizeAssistantPartsForPersistence } from "@/shared/chat/sanitize-assistant-parts-for-persistence";
import {
  type ComposerConnectorFocus,
  clearPendingConnectorFocus,
  consumePendingConnectorFocus,
  parseComposerConnectorFocus,
} from "@/shared/connectors/composer-connector-focus";
import { mergeComposerConnectorFocuses } from "@/shared/connectors/composer-connector-focuses";
import type {
  ChatMessage,
  ChatMessagePart,
  CustomUIDataTypes,
  DataUIPart,
  MessageMetadata,
} from "@/shared/types";
import {
  fetcher,
  fetchWithErrorHandlers,
  generateUUID,
  isUuid,
} from "@/shared/utils";

function composerConnectorFocusesFromMetadata(
  metadata: unknown
): ComposerConnectorFocus[] {
  if (!metadata || typeof metadata !== "object") {
    return [];
  }
  const record = metadata as Record<string, unknown>;
  if (Array.isArray(record.composerConnectorFocuses)) {
    return record.composerConnectorFocuses
      .map((entry) => parseComposerConnectorFocus(entry))
      .filter((entry): entry is ComposerConnectorFocus => entry !== null);
  }
  const single = parseComposerConnectorFocus(record.composerConnectorFocus);
  return single ? [single] : [];
}

type ActiveChatContextValue = {
  chatId: string;
  messages: ChatMessage[];
  setMessages: ChatSetMessages;
  sendMessage: ChatSendMessage;
  status: ChatRunStatus;
  stop: () => void | Promise<void>;
  regenerate: () => void;
  respondToToolApproval: (args: {
    approvalId: string;
    approved: boolean;
    reason?: string;
  }) => Promise<void>;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  documentSelection: ComposerDocumentSelection | null;
  setDocumentSelection: Dispatch<
    SetStateAction<ComposerDocumentSelection | null>
  >;
  isReadonly: boolean;
  isChannel: boolean;
  isDm: boolean;
  isGroupDm: boolean;
  isMultiplayerRoom: boolean;
  roomTypists: ChatRoomTypist[];
  sendRoomTypingSignal: (
    active: boolean,
    threadRootMessageId?: string | null
  ) => void;
  sessionUserId: string | undefined;
  threadReplyCounts: Record<string, number>;
  threadReplyMessages: ChatMessage[];
  pendingOpenThreadRootMessageId: string | null;
  clearPendingOpenThreadRoot: () => void;
  /** Keeps room thread SWR keys fresh while the thread panel is open. */
  syncOpenThreadRootMessageId: (threadRootMessageId: string | null) => void;
  /** Which room composer started the active run (`null` = main). Undefined when idle. */
  activeRunComposerThreadRootMessageId: string | null | undefined;
  channelTitle: string | null;
  dmTitle: string | null;
  dmMembers: DmMemberSummary[];
  dmPeerDisplayName: string | null;
  dmPeerEmail: string | null;
  dmPeerImage: string | null;
  dmPeerUserId: string | null;
  canManageChannelMembers: boolean;
  isLoading: boolean;
  messageReactions: MessageReaction[] | undefined;
  reactionsUserId: string | undefined;
  currentModelId: string;
  setCurrentModelId: (id: string) => void;
  currentReasoningEffort: ReasoningEffortLevel;
  setCurrentReasoningEffort: (effort: ReasoningEffortLevel) => void;
  modelReasoningPreferences: ModelReasoningPreferences;
  updateModelReasoningPreference: (
    modelId: string,
    effort: ReasoningEffortLevel,
    supportsReasoning: boolean
  ) => void;
  currentKnowledgeBase: ComposerKnowledgeBaseSelection;
  setCurrentKnowledgeBase: (
    knowledgeBase: ComposerKnowledgeBaseSelection
  ) => void;
  connectorFocus: ComposerConnectorFocus | null;
  setConnectorFocus: (focus: ComposerConnectorFocus | null) => void;
  clearConnectorFocus: () => void;
  connectorFocusClearGeneration: number;
  showCreditCardAlert: boolean;
  setShowCreditCardAlert: Dispatch<SetStateAction<boolean>>;
  streamingChatIds: ReadonlySet<string>;
  beginNewChat: () => void;
};

const ActiveChatContext = createContext<ActiveChatContextValue | null>(null);
const EMPTY_STREAMING_IDS: ReadonlySet<string> = new Set();
const WORKFLOW_FINALIZATION_POLL_DELAYS_MS = [0, 50, 100, 200, 400, 800];

async function waitForWorkflowFinalization(args: {
  chatId: string;
  runId: string;
}) {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  for (const delayMs of WORKFLOW_FINALIZATION_POLL_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    try {
      const response = await fetch(
        `${basePath}/api/chat/${args.chatId}/runs/${args.runId}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        continue;
      }
      const body = (await response.json()) as { productStatus?: string };
      if (
        body.productStatus &&
        body.productStatus !== "pending" &&
        body.productStatus !== "running"
      ) {
        return;
      }
    } catch {
      // The final messages revalidation below remains the fallback.
    }
  }
}

type ModelsApiResponse = {
  models?: ChatModel[];
  defaultChatModelId?: string;
  defaultChatReasoningEffort?: ReasoningEffortLevel;
  capabilities?: Record<string, ModelCapabilities>;
};

function readChatModelCookie(): string | null {
  const cookieModel = document.cookie
    .split("; ")
    .find((row) => row.startsWith("chat-model="))
    ?.split("=")[1];
  return cookieModel ? decodeURIComponent(cookieModel) : null;
}

function readModelReasoningPreferencesCookie(): ModelReasoningPreferences {
  const preferencesCookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${REASONING_EFFORT_BY_MODEL_COOKIE}=`))
    ?.split("=")[1];

  const preferences = parseModelReasoningPreferences(preferencesCookie);
  if (Object.keys(preferences).length > 0) {
    return preferences;
  }

  const legacyEffort = readReasoningEffortCookie();
  const legacyModelId = readChatModelCookie();
  if (!legacyModelId || legacyEffort === "off") {
    return preferences;
  }

  return {
    [legacyModelId]: legacyEffort,
  };
}

function writeModelReasoningPreferencesCookie(
  preferences: ModelReasoningPreferences
) {
  const maxAge = 60 * 60 * 24 * 365;
  // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
  document.cookie = `${REASONING_EFFORT_BY_MODEL_COOKIE}=${serializeModelReasoningPreferences(preferences)}; path=/; max-age=${maxAge}`;
}

function readReasoningEffortCookie(): ReasoningEffortLevel {
  const effortCookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${REASONING_EFFORT_COOKIE}=`))
    ?.split("=")[1];

  if (effortCookie) {
    return parseReasoningEffort(decodeURIComponent(effortCookie));
  }

  const legacyThinking = document.cookie
    .split("; ")
    .find((row) => row.startsWith("chat-thinking="))
    ?.split("=")[1];

  if (legacyThinking === "1") {
    return DEFAULT_REASONING_EFFORT;
  }
  if (legacyThinking === "0") {
    return "off";
  }

  return DEFAULT_REASONING_EFFORT;
}

function resolveModelIdFromApi(
  modelsData: ModelsApiResponse | undefined,
  preferredId?: string | null
): string {
  const models = modelsData?.models;
  const defaultId = modelsData?.defaultChatModelId ?? DEFAULT_CHAT_MODEL;
  const canonicalPreferredId = preferredId
    ? resolveCanonicalModelId(preferredId)
    : null;

  if (
    canonicalPreferredId &&
    models?.some((model) => model.id === canonicalPreferredId)
  ) {
    return canonicalPreferredId;
  }
  if (models?.some((model) => model.id === defaultId)) {
    return defaultId;
  }
  return models?.[0]?.id ?? DEFAULT_CHAT_MODEL;
}

function useRegisteredChatState(chatId: string) {
  return useSyncExternalStore(
    subscribeChatRegistry,
    () => getRegisteredChatSnapshot(chatId),
    () => SERVER_REGISTERED_CHAT_SNAPSHOT
  );
}

function shouldAutoContinueAssistantTurn(
  message: ChatMessage | undefined,
  nudgedMessageIds: {
    todoExecution: ReadonlySet<string>;
    todoPendingSteps: ReadonlySet<string>;
  }
): boolean {
  if (message?.role !== "assistant") {
    return false;
  }
  if (message.metadata?.workflowRunStatus === "cancelled") {
    return false;
  }
  if (message.metadata?.workflowRunStatus === "failed") {
    return false;
  }
  if (message.metadata?.pendingToolApproval) {
    return false;
  }
  if (messageHasInlineToolApproval(message)) {
    return false;
  }
  if (assistantTurnNeedsTodoExecutionContinuation(message.parts)) {
    return (
      message.metadata?.todoExecutionNudged !== true &&
      !nudgedMessageIds.todoExecution.has(message.id)
    );
  }
  if (assistantTurnNeedsPendingTodoContinuation(message.parts)) {
    return (
      message.metadata?.todoPendingStepsNudged !== true &&
      !nudgedMessageIds.todoPendingSteps.has(message.id)
    );
  }
  return assistantTurnNeedsContinuation(message.parts, {
    todoExecutionNudged: message.metadata?.todoExecutionNudged,
    todoPendingStepsNudged: message.metadata?.todoPendingStepsNudged,
  });
}

function workflowMessagesHavePendingApproval(messages: UIMessage[]): boolean {
  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }
    for (const part of message.parts) {
      if (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        typeof part.type === "string" &&
        part.type.startsWith("tool-") &&
        "state" in part &&
        part.state === "approval-requested"
      ) {
        return true;
      }
    }
  }
  return false;
}

function resolveWorkflowRunStatus(args: {
  message: ChatMessage;
  workflowStatus: ChatRunStatus;
  userStopped: boolean;
}): MessageMetadata["workflowRunStatus"] {
  if (
    args.message.metadata?.workflowRunStatus === "cancelled" ||
    args.message.metadata?.workflowRunStatus === "failed"
  ) {
    return args.message.metadata.workflowRunStatus;
  }
  if (args.userStopped && args.message.role === "assistant") {
    return "cancelled";
  }
  if (args.message.metadata?.pendingToolApproval) {
    return "suspended";
  }
  if (
    args.workflowStatus === "streaming" ||
    args.workflowStatus === "submitted"
  ) {
    return "running";
  }
  if (args.workflowStatus === "error") {
    return "failed";
  }
  if (args.workflowStatus === "ready") {
    if (
      args.message.metadata?.workflowRunStatus === "running" ||
      args.message.metadata?.workflowRunStatus === "suspended" ||
      assistantTurnNeedsContinuation(args.message.parts, {
        todoExecutionNudged: args.message.metadata?.todoExecutionNudged,
        todoPendingStepsNudged: args.message.metadata?.todoPendingStepsNudged,
      })
    ) {
      return "running";
    }
    return "success";
  }
  return "running";
}

function shouldResumeWorkflowRun(chatId: string, runId: string): boolean {
  if (isWorkflowRunStopped(chatId, runId)) {
    return false;
  }
  return true;
}

function continuationSignature(message: ChatMessage): string {
  const toolStates = message.parts
    .filter(
      (part): part is ChatMessagePart & { state: string; toolCallId: string } =>
        part.type.startsWith("tool-") && "state" in part && "toolCallId" in part
    )
    .map((part) => `${part.toolCallId}:${part.state}`)
    .join("|");
  return `${message.id}:${message.parts.length}:${toolStates}`;
}

function latestWorkflowRunId(messages: ChatMessage[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const id = messages[index]?.metadata?.workflowRunId;
    if (id) {
      return id;
    }
  }
  return undefined;
}

async function consumeArtifactStream(args: {
  chatId: string;
  runId: string;
  append: (chatId: string, part: DataUIPart<CustomUIDataTypes>) => void;
}) {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  const response = await fetch(
    `${basePath}/api/chat/${args.chatId}/runs/${args.runId}/artifacts`
  );
  if (!(response.ok && response.body)) {
    return;
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      args.append(
        args.chatId,
        JSON.parse(line) as DataUIPart<CustomUIDataTypes>
      );
    }
  }
}

/**
 * Workspace-level chat provider. Workflow runs keep streaming when navigating
 * away from chat because state lives in the module registry.
 */
export function ActiveChatProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { tenantSlug } = useTenant();
  const sessionUser = useSessionUser();
  const { appendDataPart } = useDataStream();
  const { mutate } = useSWRConfig();

  const urlChatId = extractChatIdFromPath(pathname);
  const onChatHome = isChatHomePath(pathname);
  const onChatArea = isChatAreaPath(pathname);

  const newChatIdRef = useRef<string | null>(null);
  const stickyChatIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const attemptedHydrationRef = useRef(
    new Map<string, ChatMessage[] | undefined>()
  );
  const prevPathnameRef = useRef(pathname);
  const [_newChatEpoch, setNewChatEpoch] = useState(0);

  const ensureNewChatId = (): string => {
    if (!newChatIdRef.current) {
      newChatIdRef.current =
        typeof window === "undefined"
          ? "00000000-0000-4000-8000-000000000000"
          : generateUUID();
    }
    return newChatIdRef.current;
  };

  if (onChatHome && prevPathnameRef.current !== pathname) {
    newChatIdRef.current =
      typeof window === "undefined"
        ? "00000000-0000-4000-8000-000000000000"
        : generateUUID();
  }
  prevPathnameRef.current = pathname;

  let chatId: string;
  if (urlChatId) {
    stickyChatIdRef.current = urlChatId;
    chatId = urlChatId;
  } else if (onChatHome) {
    const id = ensureNewChatId();
    stickyChatIdRef.current = id;
    chatId = id;
  } else if (busyRef.current && stickyChatIdRef.current) {
    chatId = stickyChatIdRef.current;
  } else {
    chatId = stickyChatIdRef.current ?? "workspace-idle";
  }

  const isNewChat = onChatHome && !urlChatId && !busyRef.current;

  const [currentModelId, setCurrentModelId] = useState(DEFAULT_CHAT_MODEL);
  const { data: modelsData } = useSWR<ModelsApiResponse>(
    tenantSlug ? chatModelsApiUrl(tenantSlug) : null,
    () => fetchChatModels(tenantSlug),
    { dedupingInterval: 60_000, revalidateOnFocus: true }
  );

  const prevIsNewChatRef = useRef<boolean | null>(null);
  const restoredCookieForChatRef = useRef(false);
  const appliedTenantDefaultRef = useRef<string | null>(null);
  const [currentReasoningEffort, setCurrentReasoningEffort] =
    useState<ReasoningEffortLevel>(DEFAULT_REASONING_EFFORT);
  const [modelReasoningPreferences, setModelReasoningPreferences] =
    useState<ModelReasoningPreferences>({});

  useEffect(() => {
    if (!modelsData) {
      return;
    }

    const wasNewChat = prevIsNewChatRef.current;
    const becameNewChat = isNewChat && wasNewChat === false;
    prevIsNewChatRef.current = isNewChat;

    if (!isNewChat) {
      if (!restoredCookieForChatRef.current) {
        restoredCookieForChatRef.current = true;
        const cookieModel = readChatModelCookie();
        const resolved = resolveModelIdFromApi(modelsData, cookieModel);
        setCurrentModelId(resolved);
      }
      return;
    }

    const tenantDefaultId = modelsData.defaultChatModelId ?? null;
    const shouldApplyTenantDefault =
      wasNewChat === null ||
      becameNewChat ||
      tenantDefaultId !== appliedTenantDefaultRef.current;

    if (!shouldApplyTenantDefault) {
      return;
    }

    appliedTenantDefaultRef.current = tenantDefaultId;
    const resolved = resolveModelIdFromApi(modelsData);
    setCurrentModelId(resolved);
    const maxAge = 60 * 60 * 24 * 365;
    // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
    document.cookie = `chat-model=${encodeURIComponent(resolved)}; path=/; max-age=${maxAge}`;

    const tenantDefaultReasoning = modelsData.defaultChatReasoningEffort;
    if (tenantDefaultReasoning) {
      const capabilities = modelsData.capabilities ?? getCapabilities();
      const supportsReasoning = modelSupportsReasoning(resolved, capabilities);
      const normalized = normalizeReasoningEffortForModel({
        effort: tenantDefaultReasoning,
        modelId: resolved,
        supportsReasoning,
      });
      setModelReasoningPreferences((current) => {
        if (current[resolved]) {
          return current;
        }
        const next = withModelReasoningPreference(
          current,
          resolved,
          normalized,
          supportsReasoning
        );
        writeModelReasoningPreferencesCookie(next);
        return next;
      });
      setCurrentReasoningEffort(normalized);
      // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
      document.cookie = `${REASONING_EFFORT_COOKIE}=${normalized}; path=/; max-age=${maxAge}`;
    }
  }, [isNewChat, modelsData]);

  const currentModelIdRef = useRef(currentModelId);
  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const currentReasoningEffortRef = useRef(currentReasoningEffort);
  useEffect(() => {
    currentReasoningEffortRef.current = currentReasoningEffort;
  }, [currentReasoningEffort]);

  const [currentKnowledgeBase, setCurrentKnowledgeBaseState] =
    useState<ComposerKnowledgeBaseSelection>(null);
  const currentKnowledgeBaseRef = useRef<ComposerKnowledgeBaseSelection>(null);
  useEffect(() => {
    currentKnowledgeBaseRef.current = currentKnowledgeBase;
  }, [currentKnowledgeBase]);

  const [connectorFocusClearGeneration, setConnectorFocusClearGeneration] =
    useState(0);
  const [connectorFocus, setConnectorFocusState] =
    useState<ComposerConnectorFocus | null>(null);
  const connectorFocusRef = useRef<ComposerConnectorFocus | null>(null);
  useEffect(() => {
    connectorFocusRef.current = connectorFocus;
  }, [connectorFocus]);
  const setConnectorFocus = useCallback(
    (focus: ComposerConnectorFocus | null) => {
      setConnectorFocusState(focus);
    },
    []
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname/chatId trigger intentional re-sync
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const urlKnowledgeBaseId = new URLSearchParams(window.location.search).get(
      "knowledgeBaseId"
    );
    if (!urlKnowledgeBaseId || !isUuid(urlKnowledgeBaseId)) {
      return;
    }
    const urlKnowledgeBaseName = new URLSearchParams(
      window.location.search
    ).get("knowledgeBaseName");
    setCurrentKnowledgeBaseState((previous) => {
      if (previous?.id === urlKnowledgeBaseId) {
        return previous;
      }
      return {
        id: urlKnowledgeBaseId,
        name: urlKnowledgeBaseName ?? previous?.name ?? "Knowledge base",
      };
    });
  }, [pathname, chatId]);

  const [input, setInput] = useState("");
  const clearConnectorFocus = useCallback(() => {
    setConnectorFocusState(null);
    connectorFocusRef.current = null;
    clearPendingConnectorFocus();
    setConnectorFocusClearGeneration((generation) => generation + 1);
  }, []);
  useEffect(() => {
    function applyPendingConnectorFocus() {
      const pending = consumePendingConnectorFocus();
      if (!pending) {
        return;
      }
      setConnectorFocusState(pending);
      connectorFocusRef.current = pending;
    }
    applyPendingConnectorFocus();
    window.addEventListener(
      CONNECTOR_CHAT_FOCUS_EVENT,
      applyPendingConnectorFocus
    );
    return () => {
      window.removeEventListener(
        CONNECTOR_CHAT_FOCUS_EVENT,
        applyPendingConnectorFocus
      );
    };
  }, []);
  const prevEphemeralHomeChatIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onChatHome || urlChatId || busyRef.current) {
      prevEphemeralHomeChatIdRef.current = chatId;
      return;
    }
    const previous = prevEphemeralHomeChatIdRef.current;
    prevEphemeralHomeChatIdRef.current = chatId;
    if (previous === null || previous === chatId) {
      return;
    }
    const pending = consumePendingConnectorFocus();
    if (pending) {
      setConnectorFocusState(pending);
      connectorFocusRef.current = pending;
      return;
    }
    clearConnectorFocus();
  }, [chatId, clearConnectorFocus, onChatHome, urlChatId]);
  const [documentSelection, setDocumentSelection] =
    useState<ComposerDocumentSelection | null>(null);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [
    activeRunComposerThreadRootMessageId,
    setActiveRunComposerThreadRootMessageId,
  ] = useState<string | null | undefined>(undefined);
  const clearActiveRunComposerScope = useCallback(() => {
    setActiveRunComposerThreadRootMessageId(undefined);
  }, []);

  const [pendingOpenThreadRootMessageId, setPendingOpenThreadRootMessageId] =
    useState<string | null>(null);
  const clearPendingOpenThreadRoot = useCallback(() => {
    setPendingOpenThreadRootMessageId(null);
  }, []);

  const openThreadRootMessageIdRef = useRef<string | null>(null);
  const syncOpenThreadRootMessageId = useCallback(
    (threadRootMessageId: string | null) => {
      openThreadRootMessageIdRef.current = threadRootMessageId;
    },
    []
  );

  const isPersistableChatId = isUuid(chatId);
  const shouldLoadMessages =
    isPersistableChatId && !(onChatHome && !urlChatId && !busyRef.current);

  const messagesApiKey = shouldLoadMessages
    ? `${process.env.KIMIRO_BASE_PATH ?? ""}/api/messages?chatId=${chatId}`
    : null;

  const { data: chatData, isLoading } = useSWR(messagesApiKey, fetcher, {
    revalidateOnFocus: false,
  });

  const markActiveRoomRead = useCallback(() => {
    if (!tenantSlug) {
      return;
    }
    void markChatRead(chatId).then(() => {
      void mutate(channelsListSwrKey(tenantSlug));
      void mutate(dmsListSwrKey(tenantSlug));
    });
  }, [chatId, mutate, tenantSlug]);

  const revalidateRoomMessageCachesRef = useRef<
    (messagesForThreadRoots?: ChatMessage[]) => Promise<void>
  >(async () => undefined);

  revalidateRoomMessageCachesRef.current = async (
    messagesForThreadRoots: ChatMessage[] = []
  ) => {
    if (!messagesApiKey) {
      return;
    }
    attemptedHydrationRef.current.delete(chatId);
    const registeredMessages =
      messagesForThreadRoots.length > 0
        ? messagesForThreadRoots
        : (getRegisteredChat(chatId)?.messages ?? []);
    const openRoot = openThreadRootMessageIdRef.current;
    await revalidateChatMessageCaches(
      mutate,
      chatId,
      registeredMessages,
      openRoot ? [openRoot] : []
    );
  };

  const isMultiplayerRoomRef = useRef(false);
  useEffect(() => {
    isMultiplayerRoomRef.current = Boolean(chatData?.isMultiplayerRoom);
  }, [chatData?.isMultiplayerRoom]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: chatId triggers composer run scope reset
  useEffect(() => {
    setActiveRunComposerThreadRootMessageId(undefined);
  }, [chatId]);

  const registeredChat = useRegisteredChatState(chatId);
  const messages = registeredChat.messages;
  const status = registeredChat.status;

  const isMultiplayerRoom = Boolean(chatData?.isMultiplayerRoom);

  useEffect(() => {
    if (!(isMultiplayerRoom && isPersistableChatId && shouldLoadMessages)) {
      return;
    }
    if (isLoading) {
      return;
    }

    markActiveRoomRead();
  }, [
    isLoading,
    isMultiplayerRoom,
    isPersistableChatId,
    markActiveRoomRead,
    shouldLoadMessages,
  ]);

  const setMessages = useCallback<ChatSetMessages>(
    (updater) => {
      setRegisteredMessages(chatId, updater);
    },
    [chatId]
  );

  useEffect(() => {
    if (!chatData || !("knowledgeBase" in chatData)) {
      return;
    }
    if (chatData.knowledgeBase) {
      setCurrentKnowledgeBaseState(chatData.knowledgeBase);
      return;
    }
    const urlKnowledgeBaseId = new URLSearchParams(window.location.search).get(
      "knowledgeBaseId"
    );
    if (!urlKnowledgeBaseId) {
      setCurrentKnowledgeBaseState(null);
    }
  }, [chatData]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: chatId signals new-chat transitions
  useEffect(() => {
    if (onChatHome && !urlChatId && !busyRef.current) {
      const urlKnowledgeBaseId = new URLSearchParams(
        window.location.search
      ).get("knowledgeBaseId");
      if (!urlKnowledgeBaseId) {
        setCurrentKnowledgeBaseState(null);
      }
    }
  }, [chatId, onChatHome, urlChatId]);

  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;
  const continueWorkflowRunRef = useRef<
    (args: {
      assistantMessageId: string;
      runId: string;
      allowAfterStop?: boolean;
    }) => Promise<void>
  >(async () => undefined);
  const autoContinueSignatureRef = useRef<string | null>(null);
  const todoExecutionNudgedRef = useRef<Set<string>>(new Set());
  const todoPendingStepsNudgedRef = useRef<Set<string>>(new Set());

  const transportApi = `${process.env.KIMIRO_BASE_PATH ?? ""}/api/chat`;

  const persistChatKnowledgeBase = useCallback(
    async (knowledgeBase: ComposerKnowledgeBaseSelection) => {
      if (!isPersistableChatId) {
        return;
      }
      try {
        await fetchWithErrorHandlers(
          `${transportApi}?id=${encodeURIComponent(chatId)}`,
          {
            body: JSON.stringify({
              knowledgeBaseId: knowledgeBase?.id ?? null,
            }),
            headers: { "Content-Type": "application/json" },
            method: "PATCH",
          }
        );
      } catch {
        // Non-critical — next message still carries knowledgeBaseId.
      }
    },
    [chatId, isPersistableChatId, transportApi]
  );

  const setCurrentKnowledgeBase = useCallback(
    (knowledgeBase: ComposerKnowledgeBaseSelection) => {
      setCurrentKnowledgeBaseState(knowledgeBase);
      currentKnowledgeBaseRef.current = knowledgeBase;
      if (chatData) {
        persistChatKnowledgeBase(knowledgeBase).catch(() => undefined);
      }
    },
    [chatData, persistChatKnowledgeBase]
  );

  const workflowRunByMessageRef = useRef(new Map<string, string>());
  const threadRootByMessageIdRef = useRef(new Map<string, string | null>());
  const createdAtByMessageIdRef = useRef(new Map<string, string>());
  const replyToMessageByAssistantIdRef = useRef(new Map<string, string>());
  const suppressNextStreamErrorRef = useRef(false);
  const userStoppedRunRef = useRef(false);
  const pendingAssistantMessageIdRef = useRef<string | null>(null);
  const artifactRunsRef = useRef(new Set<string>());
  const syncWorkflowMessagesRef = useRef<(messages: ChatMessage[]) => void>(
    () => undefined
  );
  const workflowTransport = useMemo(
    () =>
      createChatRunTransport({
        chatId,
        onRunHeaders: ({ runId, assistantMessageId, executedToolParts }) => {
          workflowRunByMessageRef.current.set(assistantMessageId, runId);
          if (executedToolParts && executedToolParts.length > 0) {
            applyRegisteredExecutedToolSync(chatId, {
              assistantMessageId,
              toolParts: executedToolParts,
            });
            const syncedMessages = getRegisteredChat(chatId)?.messages ?? [];
            syncWorkflowMessagesRef.current(syncedMessages);
          }
          if (!artifactRunsRef.current.has(runId)) {
            artifactRunsRef.current.add(runId);
            consumeArtifactStream({
              append: appendDataPart,
              chatId,
              runId,
            }).catch(() => undefined);
          }
        },
      }),
    [appendDataPart, chatId]
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: the Chat instance must remain stable while its messages stream
  const workflowChat = useMemo(
    () =>
      new Chat<UIMessage>({
        generateId: () =>
          pendingAssistantMessageIdRef.current ?? generateUUID(),
        id: chatId,
        messages: chatMessagesToWorkflowMessages(messages),
        onError(error) {
          if (
            suppressNextStreamErrorRef.current ||
            userStoppedRunRef.current ||
            isChatRequestCancelledError(error)
          ) {
            if (!userStoppedRunRef.current) {
              suppressNextStreamErrorRef.current = false;
            }
            setRegisteredStatus(chatId, "ready");
            clearActiveRunComposerScope();
            return;
          }
          setRegisteredStatus(chatId, "error");
          clearActiveRunComposerScope();
          toast({
            description: formatModelErrorMessage(error),
            type: "error",
          });
          if (isMultiplayerRoomRef.current) {
            void revalidateRoomMessageCachesRef.current(
              getRegisteredChat(chatId)?.messages ?? []
            );
          }
        },
        onFinish() {
          if (!userStoppedRunRef.current) {
            suppressNextStreamErrorRef.current = false;
          }
          setRegisteredStatus(chatId, "ready");
          clearActiveRunComposerScope();
          mutateRef.current(FREE_TRIAL_API_URL).catch(() => undefined);
          const registeredMessages = getRegisteredChat(chatId)?.messages ?? [];
          if (registeredMessages.some(messageHasInlineToolApproval)) {
            return;
          }
          const latestAssistant = [...registeredMessages]
            .reverse()
            .find((message) => message.role === "assistant");
          const runId = latestAssistant
            ? (workflowRunByMessageRef.current.get(latestAssistant.id) ??
              latestAssistant.metadata?.workflowRunId)
            : undefined;
          const refreshPersistedMessages = async () => {
            if (runId) {
              await waitForWorkflowFinalization({ chatId, runId });
            }
            await revalidateRoomMessageCachesRef.current(registeredMessages);
          };
          refreshPersistedMessages().catch(() => undefined);
        },
        transport: workflowTransport,
      }),
    [chatId, clearActiveRunComposerScope, workflowTransport]
  );
  const workflow = useChat({ chat: workflowChat });
  syncWorkflowMessagesRef.current = (syncedMessages) => {
    workflow.setMessages(chatMessagesToWorkflowMessages(syncedMessages));
  };
  const workflowMessageSnapshotsRef = useRef<
    Map<
      string,
      {
        message: UIMessage;
        parts: UIMessage["parts"];
        metadata: UIMessage["metadata"];
        runId?: string;
        status: ChatRunStatus;
      }
    >
  >(new Map());
  const workflowSnapshotChatIdRef = useRef(chatId);

  useEffect(() => {
    if (workflowSnapshotChatIdRef.current !== chatId) {
      workflowSnapshotChatIdRef.current = chatId;
      workflowMessageSnapshotsRef.current.clear();
    }
    const changedWorkflowMessages = workflow.messages.filter((message) => {
      const runId = workflowRunByMessageRef.current.get(message.id);
      const previous = workflowMessageSnapshotsRef.current.get(message.id);
      const changed =
        !previous ||
        previous.message !== message ||
        previous.parts !== message.parts ||
        previous.metadata !== message.metadata ||
        previous.runId !== runId ||
        previous.status !== workflow.status;
      if (changed) {
        workflowMessageSnapshotsRef.current.set(message.id, {
          message,
          metadata: message.metadata,
          parts: message.parts,
          runId,
          status: workflow.status,
        });
      }
      return changed;
    });
    const incoming = workflowMessagesToChatMessages(
      changedWorkflowMessages
    ).map((message) => {
      const runId = workflowRunByMessageRef.current.get(message.id);
      const registeredMessage = getRegisteredChat(chatId)?.messages.find(
        (entry) => entry.id === message.id
      );
      const turnCreatedAt = createdAtByMessageIdRef.current.get(message.id);
      const threadRootMessageId =
        message.threadRootMessageId ??
        threadRootByMessageIdRef.current.get(message.id) ??
        null;
      const resolved =
        runId || threadRootMessageId
          ? {
              ...message,
              ...(threadRootMessageId ? { threadRootMessageId } : {}),
              ...(runId
                ? {
                    metadata: {
                      ...message.metadata,
                      createdAt:
                        turnCreatedAt ??
                        registeredMessage?.metadata?.createdAt ??
                        message.metadata?.createdAt ??
                        new Date().toISOString(),
                      replyToMessageId:
                        replyToMessageByAssistantIdRef.current.get(
                          message.id
                        ) ??
                        registeredMessage?.metadata?.replyToMessageId ??
                        message.metadata?.replyToMessageId,
                      workflowRunId: runId,
                      workflowRunStatus: resolveWorkflowRunStatus({
                        message,
                        userStopped: userStoppedRunRef.current,
                        workflowStatus: workflow.status,
                      }),
                    },
                  }
                : {}),
            }
          : message;
      if (userStoppedRunRef.current && resolved.role === "assistant") {
        return {
          ...resolved,
          parts: sanitizeAssistantPartsForPersistence(resolved.parts),
        };
      }
      return resolved;
    });
    startTransition(() => {
      applyRegisteredWorkflowSnapshot(chatId, incoming, workflow.status);
    });
  }, [chatId, workflow.messages, workflow.status]);

  useEffect(() => {
    if (workflow.status === "streaming" || workflow.status === "submitted") {
      autoContinueSignatureRef.current = null;
      return;
    }
    if (workflow.status !== "ready") {
      return;
    }
    if (userStoppedRunRef.current) {
      return;
    }
    if (workflowMessagesHavePendingApproval(workflow.messages)) {
      return;
    }

    const registeredMessages = getRegisteredChat(chatId)?.messages ?? [];
    if (registeredMessages.some(messageHasInlineToolApproval)) {
      return;
    }

    const latestAssistant = [...registeredMessages]
      .reverse()
      .find((message) => message.role === "assistant");
    if (
      !latestAssistant ||
      !shouldAutoContinueAssistantTurn(latestAssistant, {
        todoExecution: todoExecutionNudgedRef.current,
        todoPendingSteps: todoPendingStepsNudgedRef.current,
      })
    ) {
      return;
    }

    const runId =
      workflowRunByMessageRef.current.get(latestAssistant.id) ??
      latestAssistant.metadata?.workflowRunId;
    if (!runId || !shouldResumeWorkflowRun(chatId, runId)) {
      return;
    }

    const signature = continuationSignature(latestAssistant);
    if (autoContinueSignatureRef.current === signature) {
      return;
    }
    autoContinueSignatureRef.current = signature;

    if (assistantTurnNeedsTodoExecutionContinuation(latestAssistant.parts)) {
      todoExecutionNudgedRef.current.add(latestAssistant.id);
    }
    if (assistantTurnNeedsPendingTodoContinuation(latestAssistant.parts)) {
      todoPendingStepsNudgedRef.current.add(latestAssistant.id);
    }

    continueWorkflowRunRef
      .current({
        assistantMessageId: latestAssistant.id,
        runId,
      })
      .catch(() => undefined);
  }, [chatId, workflow.messages, workflow.status]);

  const sendMessage = useCallback<ChatSendMessage>(
    async (message) => {
      userStoppedRunRef.current = false;
      clearStoppedWorkflowRunsForChat(chatId);
      if (!message || typeof message !== "object") {
        return;
      }
      const parts =
        "parts" in message && Array.isArray(message.parts) ? message.parts : [];
      const metadata = "metadata" in message ? message.metadata : undefined;
      const id =
        "id" in message && typeof message.id === "string"
          ? message.id
          : generateUUID();
      const replaceFromMessageId =
        "replaceFromMessageId" in message &&
        typeof message.replaceFromMessageId === "string"
          ? message.replaceFromMessageId
          : undefined;
      if (replaceFromMessageId) {
        const currentMessages = getRegisteredChat(chatId)?.messages ?? [];
        const replacementIndex = currentMessages.findIndex(
          (entry) => entry.id === replaceFromMessageId
        );
        if (replacementIndex >= 0) {
          const history = currentMessages.slice(0, replacementIndex);
          setRegisteredMessages(chatId, history);
          workflow.setMessages(chatMessagesToWorkflowMessages(history));
        }
      }
      const threadRootMessageId =
        "threadRootMessageId" in message &&
        (message.threadRootMessageId === null ||
          typeof message.threadRootMessageId === "string")
          ? message.threadRootMessageId
          : null;

      const plainText = parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim();
      const userCreatedAt =
        metadata &&
        typeof metadata === "object" &&
        "createdAt" in metadata &&
        typeof metadata.createdAt === "string"
          ? metadata.createdAt
          : new Date().toISOString();
      createdAtByMessageIdRef.current.set(id, userCreatedAt);
      if (
        isMultiplayerRoomRef.current &&
        !threadRootMessageId &&
        messageInvokesKimiro(plainText)
      ) {
        setPendingOpenThreadRootMessageId(id);
      }

      threadRootByMessageIdRef.current.set(id, threadRootMessageId);
      appendRegisteredOptimisticMessage(chatId, {
        id,
        metadata: {
          ...metadata,
          createdAt:
            metadata &&
            typeof metadata === "object" &&
            "createdAt" in metadata &&
            typeof metadata.createdAt === "string"
              ? metadata.createdAt
              : new Date().toISOString(),
        },
        parts,
        role: "user",
        threadRootMessageId,
      });
      try {
        const assistantMessageId = generateUUID();
        const userCreatedAtMs = Date.parse(userCreatedAt);
        createdAtByMessageIdRef.current.set(
          assistantMessageId,
          new Date(
            Number.isNaN(userCreatedAtMs) ? Date.now() : userCreatedAtMs + 1
          ).toISOString()
        );
        replyToMessageByAssistantIdRef.current.set(assistantMessageId, id);
        const runId = generateUUID();
        pendingAssistantMessageIdRef.current = assistantMessageId;
        workflowRunByMessageRef.current.set(assistantMessageId, runId);
        const assistantThreadRoot =
          threadRootMessageId ??
          (isMultiplayerRoomRef.current && messageInvokesKimiro(plainText)
            ? id
            : null);
        threadRootByMessageIdRef.current.set(
          assistantMessageId,
          assistantThreadRoot
        );
        setActiveRunComposerThreadRootMessageId(assistantThreadRoot);
        const runConnectorFocuses = mergeComposerConnectorFocuses(
          composerConnectorFocusesFromMetadata(metadata),
          connectorFocusRef.current
        );
        try {
          await workflow.sendMessage(
            {
              id,
              metadata,
              parts: parts as UIMessage["parts"],
              role: "user",
            },
            {
              body: {
                assistantMessageId,
                composerConnectorFocus: runConnectorFocuses[0],
                composerConnectorFocuses:
                  runConnectorFocuses.length > 0
                    ? runConnectorFocuses
                    : undefined,
                knowledgeBaseId: currentKnowledgeBaseRef.current?.id ?? null,
                reasoningEffort: currentReasoningEffortRef.current,
                runId,
                selectedChatModel: currentModelIdRef.current,
                threadRootMessageId,
                userMessageId: id,
              },
            }
          );
        } finally {
          pendingAssistantMessageIdRef.current = null;
        }

        if (isMultiplayerRoomRef.current && messagesApiKey) {
          await revalidateRoomMessageCachesRef.current(
            getRegisteredChat(chatId)?.messages ?? []
          );
        }

        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          if (url.searchParams.has("knowledgeBaseId")) {
            url.searchParams.delete("knowledgeBaseId");
            url.searchParams.delete("knowledgeBaseName");
            router.replace(`${url.pathname}${url.search}${url.hash}`);
          }
        }
      } catch (error) {
        if (!isChatRequestCancelledError(error)) {
          toast({
            description: formatModelErrorMessage(error),
            type: "error",
          });
        }
      }
    },
    [chatId, messagesApiKey, router, workflow]
  );

  const abortActiveStream = useCallback(() => {
    suppressNextStreamErrorRef.current = true;
    workflow.stop();
  }, [workflow]);

  const stop = useCallback(async () => {
    suppressNextStreamErrorRef.current = true;
    userStoppedRunRef.current = true;
    autoContinueSignatureRef.current = null;

    const activeAssistantMessageId = pendingAssistantMessageIdRef.current;
    const workflowAssistant = activeAssistantMessageId
      ? workflow.messages.find(
          (message) =>
            message.role === "assistant" &&
            message.id === activeAssistantMessageId
        )
      : undefined;
    const capturedAssistant = workflowAssistant
      ? workflowMessagesToChatMessages([workflowAssistant]).at(0)
      : undefined;

    const registeredMessages = getRegisteredChat(chatId)?.messages ?? [];
    const registryAssistant = activeAssistantMessageId
      ? registeredMessages.find(
          (message) =>
            message.role === "assistant" &&
            message.id === activeAssistantMessageId
        )
      : undefined;
    let lastAssistant =
      capturedAssistant &&
      (!registryAssistant ||
        assistantPartsRichness(capturedAssistant.parts) >=
          assistantPartsRichness(registryAssistant.parts))
        ? capturedAssistant
        : registryAssistant;

    let resolvedAssistantMessageId = activeAssistantMessageId;
    if (!lastAssistant) {
      const inFlightAssistant = [...registeredMessages]
        .reverse()
        .find((message) => {
          if (message.role !== "assistant") {
            return false;
          }
          const runStatus = message.metadata?.workflowRunStatus;
          return (
            runStatus === "pending" ||
            runStatus === "running" ||
            runStatus === "suspended"
          );
        });
      if (inFlightAssistant) {
        lastAssistant = inFlightAssistant;
        resolvedAssistantMessageId = inFlightAssistant.id;
      }
    }

    const cancelParts = lastAssistant
      ? sanitizeAssistantPartsForPersistence(lastAssistant.parts)
      : [];

    if (lastAssistant) {
      const cancelledMetadata = { workflowRunStatus: "cancelled" as const };
      const assistantForRegistry = {
        ...lastAssistant,
        parts: cancelParts,
      };
      if (isEmptyAssistantMessage(assistantForRegistry)) {
        setRegisteredMessages(chatId, (messages) =>
          messages.filter((message) => message.id !== lastAssistant.id)
        );
      } else {
        applyRegisteredAssistantMessageUpdate(chatId, {
          assistantMessageId: lastAssistant.id,
          metadata: cancelledMetadata,
          parts: cancelParts,
        });
      }
      const syncedMessages = getRegisteredChat(chatId)?.messages ?? [];
      workflow.setMessages(chatMessagesToWorkflowMessages(syncedMessages));
    }

    workflow.stop();

    const runId = resolvedAssistantMessageId
      ? (workflowRunByMessageRef.current.get(resolvedAssistantMessageId) ??
        lastAssistant?.metadata?.workflowRunId)
      : lastAssistant?.metadata?.workflowRunId;
    if (runId) {
      markWorkflowRunStopped(chatId, runId);
      await fetch(
        `${process.env.KIMIRO_BASE_PATH ?? ""}/api/chat/${chatId}/runs/${runId}/cancel`,
        {
          body: JSON.stringify(
            cancelParts.length > 0 ? { clientParts: cancelParts } : {}
          ),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      ).catch(() => undefined);
    }
    setRegisteredStatus(chatId, "ready");
    clearActiveRunComposerScope();
  }, [chatId, clearActiveRunComposerScope, workflow]);

  const regenerate = useCallback(() => {
    const lastAssistant = [...(getRegisteredChat(chatId)?.messages ?? [])]
      .reverse()
      .find((message) => message.role === "assistant");
    const assistantMessageId = lastAssistant?.id ?? generateUUID();
    pendingAssistantMessageIdRef.current = assistantMessageId;
    workflow
      .regenerate({
        body: {
          assistantMessageId,
          composerConnectorFocus: connectorFocusRef.current ?? undefined,
          composerConnectorFocuses: connectorFocusRef.current
            ? [connectorFocusRef.current]
            : undefined,
          knowledgeBaseId: currentKnowledgeBaseRef.current?.id ?? null,
          reasoningEffort: currentReasoningEffortRef.current,
          selectedChatModel: currentModelIdRef.current,
        },
      })
      .catch((error) => {
        if (!isChatRequestCancelledError(error)) {
          toast({
            description: formatModelErrorMessage(error),
            type: "error",
          });
        }
      })
      .finally(() => {
        pendingAssistantMessageIdRef.current = null;
      });
  }, [chatId, workflow]);

  const continueWorkflowRun = useCallback(
    async (args: {
      assistantMessageId: string;
      runId: string;
      allowAfterStop?: boolean;
    }) => {
      if (
        !args.allowAfterStop &&
        (userStoppedRunRef.current ||
          !shouldResumeWorkflowRun(chatId, args.runId))
      ) {
        return;
      }
      pendingAssistantMessageIdRef.current = args.assistantMessageId;
      try {
        await workflow.sendMessage(
          undefined as unknown as Parameters<typeof workflow.sendMessage>[0],
          {
            body: {
              assistantMessageId: args.assistantMessageId,
              knowledgeBaseId: currentKnowledgeBaseRef.current?.id ?? null,
              reasoningEffort: currentReasoningEffortRef.current,
              runId: args.runId,
              selectedChatModel: currentModelIdRef.current,
            },
          }
        );
      } catch (error) {
        if (!isChatRequestCancelledError(error)) {
          toast({
            description: formatModelErrorMessage(error),
            type: "error",
          });
        }
      } finally {
        pendingAssistantMessageIdRef.current = null;
      }
    },
    [chatId, workflow]
  );
  continueWorkflowRunRef.current = continueWorkflowRun;

  const respondToToolApproval = useCallback(
    async (args: {
      approvalId: string;
      approved: boolean;
      reason?: string;
    }) => {
      autoContinueSignatureRef.current = null;
      userStoppedRunRef.current = false;

      if (workflow.status === "streaming" || workflow.status === "submitted") {
        abortActiveStream();
      }

      const lastAssistant = [...(getRegisteredChat(chatId)?.messages ?? [])]
        .reverse()
        .find((message) => message.role === "assistant");
      if (!lastAssistant) {
        return;
      }

      const approvalPart = lastAssistant.parts.find(
        (part) =>
          "approval" in part &&
          part.approval?.id === args.approvalId &&
          part.type.startsWith("tool-")
      );
      if (
        approvalPart &&
        "state" in approvalPart &&
        approvalPart.state !== "approval-requested"
      ) {
        return;
      }

      const runId =
        workflowRunByMessageRef.current.get(lastAssistant.id) ??
        lastAssistant.metadata?.workflowRunId;

      if (!runId) {
        throw new Error("Workflow run not found");
      }

      const response = await fetchWithErrorHandlers(
        `${process.env.KIMIRO_BASE_PATH ?? ""}/api/chat/${chatId}/runs/${runId}/tool-approval`,
        {
          body: JSON.stringify({
            approvalId: args.approvalId,
            approved: args.approved,
            assistantMessageId: lastAssistant.id,
            clientParts: lastAssistant.parts,
            reason: args.reason,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      );

      const payload = (await response.json()) as {
        parts?: ChatMessage["parts"];
        metadata?: ChatMessage["metadata"];
        workflowRunId?: string;
      };

      const resolvedRunId =
        payload.workflowRunId ?? payload.metadata?.workflowRunId ?? runId;
      if (resolvedRunId) {
        workflowRunByMessageRef.current.set(lastAssistant.id, resolvedRunId);
      }

      if (payload.parts) {
        applyRegisteredAssistantMessageUpdate(chatId, {
          assistantMessageId: lastAssistant.id,
          metadata: payload.metadata,
          parts: payload.parts,
        });
      } else {
        applyRegisteredToolApproval(chatId, {
          approvalId: args.approvalId,
          approved: args.approved,
          reason: args.reason,
        });
      }

      const updatedMessages = getRegisteredChat(chatId)?.messages ?? [];
      workflow.setMessages(chatMessagesToWorkflowMessages(updatedMessages));

      const updatedAssistant = updatedMessages.find(
        (message) => message.id === lastAssistant.id
      );
      if (
        !updatedAssistant ||
        !isToolApprovalBatchComplete(updatedAssistant) ||
        !shouldAutoContinueAssistantTurn(updatedAssistant, {
          todoExecution: todoExecutionNudgedRef.current,
          todoPendingSteps: todoPendingStepsNudgedRef.current,
        })
      ) {
        return;
      }

      if (!resolvedRunId) {
        throw new Error("Workflow run not found");
      }

      autoContinueSignatureRef.current = null;
      clearWorkflowRunStopped(chatId, resolvedRunId);
      await continueWorkflowRun({
        allowAfterStop: true,
        assistantMessageId: updatedAssistant.id,
        runId: resolvedRunId,
      });
    },
    [chatId, abortActiveStream, continueWorkflowRun, workflow]
  );

  const isBusy = status === "streaming" || status === "submitted";
  busyRef.current = isBusy;
  if (isBusy) {
    stickyChatIdRef.current = chatId;
  }

  useEffect(() => {
    setComposerChatId(chatId);
  }, [chatId]);

  useEffect(() => {
    if (busyRef.current) {
      return;
    }
    if (onChatHome && !urlChatId) {
      return;
    }

    const registered = getRegisteredChat(chatId);
    const serverMessages = chatData?.messages ?? [];
    if (
      registered &&
      (registered.status === "streaming" || registered.status === "submitted")
    ) {
      return;
    }
    if (attemptedHydrationRef.current.get(chatId) === serverMessages) {
      return;
    }
    attemptedHydrationRef.current.set(chatId, serverMessages);

    const hydratedMessages = hydrateRegisteredMessages({
      chatId,
      expectedVersion: registeredChat.version,
      serverMessages,
    });
    if (!hydratedMessages) {
      return;
    }
    workflow.setMessages(chatMessagesToWorkflowMessages(hydratedMessages));
    const lastAssistant = hydratedMessages.at(-1);
    const runId = latestWorkflowRunId(hydratedMessages);
    if (
      !userStoppedRunRef.current &&
      runId &&
      shouldResumeWorkflowRun(chatId, runId) &&
      lastAssistant?.role === "assistant" &&
      shouldAutoContinueAssistantTurn(lastAssistant, {
        todoExecution: todoExecutionNudgedRef.current,
        todoPendingSteps: todoPendingStepsNudgedRef.current,
      })
    ) {
      pendingAssistantMessageIdRef.current = lastAssistant.id;
      continueWorkflowRunRef
        .current({
          assistantMessageId: lastAssistant.id,
          runId,
        })
        .catch(() => undefined)
        .finally(() => {
          pendingAssistantMessageIdRef.current = null;
        });
      if (!artifactRunsRef.current.has(runId)) {
        artifactRunsRef.current.add(runId);
        consumeArtifactStream({
          append: appendDataPart,
          chatId,
          runId,
        }).catch(() => undefined);
      }
    }
  }, [
    appendDataPart,
    chatData?.messages,
    chatId,
    onChatHome,
    registeredChat.version,
    urlChatId,
    workflow,
  ]);

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      todoExecutionNudgedRef.current.clear();
      todoPendingStepsNudgedRef.current.clear();
      if (onChatHome && !urlChatId && !isBusy) {
        setMessages([]);
      }
    }
  }, [chatId, isBusy, onChatHome, setMessages, urlChatId]);

  useEffect(() => {
    const preferences = readModelReasoningPreferencesCookie();
    setModelReasoningPreferences(preferences);

    const modelId = readChatModelCookie() ?? currentModelIdRef.current;
    const effort = resolveEffortForModelPreferences(preferences, modelId, true);
    setCurrentReasoningEffort(effort);
  }, []);

  const updateModelReasoningPreference = useCallback(
    (
      modelId: string,
      effort: ReasoningEffortLevel,
      supportsReasoning: boolean
    ) => {
      const normalized = normalizeReasoningEffortForModel({
        effort,
        modelId,
        supportsReasoning,
      });

      setModelReasoningPreferences((current) => {
        const next = withModelReasoningPreference(
          current,
          modelId,
          normalized,
          supportsReasoning
        );
        writeModelReasoningPreferencesCookie(next);
        return next;
      });

      if (modelId === currentModelIdRef.current) {
        setCurrentReasoningEffort(normalized);
        const maxAge = 60 * 60 * 24 * 365;
        // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
        document.cookie = `${REASONING_EFFORT_COOKIE}=${normalized}; path=/; max-age=${maxAge}`;
      }
    },
    []
  );

  useEffect(() => {
    if (!modelsData) {
      return;
    }

    const capabilities = modelsData.capabilities ?? getCapabilities();
    const supportsReasoning = modelSupportsReasoning(
      currentModelId,
      capabilities
    );
    const effort = resolveEffortForModelPreferences(
      modelReasoningPreferences,
      currentModelId,
      supportsReasoning
    );

    setCurrentReasoningEffort(effort);
    const maxAge = 60 * 60 * 24 * 365;
    // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
    document.cookie = `${REASONING_EFFORT_COOKIE}=${effort}; path=/; max-age=${maxAge}`;
  }, [currentModelId, modelReasoningPreferences, modelsData]);

  const hasAppendedQueryRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onChatArea) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const query = params.get("query");
    if (query && hasAppendedQueryRef.current !== chatId) {
      hasAppendedQueryRef.current = chatId;
      router.replace(chatConversationPath(chatId), {
        scroll: false,
      });
      sendMessage({
        parts: [{ text: query, type: "text" }],
        role: "user" as const,
      });
    }
  }, [router, sendMessage, chatId, onChatArea]);

  const isReadonly =
    onChatHome && !urlChatId && !isBusy
      ? false
      : (chatData?.isReadonly ?? false);

  const reactionsUserId = sessionUser?.id
    ? toTenantUserId(sessionUser.id)
    : undefined;
  const reactionsApiKey =
    !isReadonly && isPersistableChatId && messages.length > 0
      ? reactionsApiUrl(chatId)
      : null;

  const { data: messageReactions } = useSWR<MessageReaction[]>(
    reactionsApiKey,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false }
  );

  const { roomTypists, sendRoomTypingSignal } = useChatRoomEvents({
    chatId,
    enabled: Boolean(chatData?.isMultiplayerRoom),
    messagesApiKey,
    reactionsApiKey,
    onMessagesChanged: markActiveRoomRead,
    onReconnect: () => {
      void revalidateRoomMessageCachesRef.current();
    },
    onRemoteMessagesChanged: () => {
      attemptedHydrationRef.current.delete(chatId);
    },
  });

  const registryStreamingIds = useSyncExternalStore(
    subscribeChatRegistry,
    getStreamingChatIdsSnapshot,
    () => EMPTY_STREAMING_IDS
  );

  const streamingChatIds = useMemo(() => {
    if (!isBusy) {
      return registryStreamingIds.size > 0
        ? registryStreamingIds
        : EMPTY_STREAMING_IDS;
    }
    if (registryStreamingIds.has(chatId) && registryStreamingIds.size > 0) {
      return registryStreamingIds;
    }
    const ids = new Set(registryStreamingIds);
    ids.add(chatId);
    return ids;
  }, [chatId, isBusy, registryStreamingIds]);

  const beginNewChat = useCallback(() => {
    const id = generateUUID();
    newChatIdRef.current = id;
    stickyChatIdRef.current = id;
    setInput("");
    setDocumentSelection(null);
    setCurrentKnowledgeBaseState(null);
    currentKnowledgeBaseRef.current = null;
    clearConnectorFocus();
    setNewChatEpoch((epoch) => epoch + 1);
    if (!onChatHome) {
      router.push(CHAT_HOME);
    }
  }, [clearConnectorFocus, onChatHome, router]);

  const value = useMemo<ActiveChatContextValue>(
    () => ({
      beginNewChat,
      chatId,
      clearConnectorFocus,
      connectorFocus,
      connectorFocusClearGeneration,
      currentKnowledgeBase,
      currentModelId,
      currentReasoningEffort,
      documentSelection,
      input,
      canManageChannelMembers: chatData?.channelParticipantRole === "owner",
      channelTitle:
        typeof chatData?.channelTitle === "string"
          ? chatData.channelTitle
          : null,
      dmMembers: Array.isArray(chatData?.dmMembers)
        ? (chatData.dmMembers as DmMemberSummary[])
        : [],
      dmTitle: typeof chatData?.dmTitle === "string" ? chatData.dmTitle : null,
      dmPeerDisplayName:
        typeof chatData?.dmPeerDisplayName === "string"
          ? chatData.dmPeerDisplayName
          : null,
      dmPeerEmail:
        typeof chatData?.dmPeerEmail === "string" ? chatData.dmPeerEmail : null,
      dmPeerImage:
        chatData?.dmPeerImage === null ||
        typeof chatData?.dmPeerImage === "string"
          ? (chatData?.dmPeerImage ?? null)
          : null,
      dmPeerUserId:
        typeof chatData?.dmPeerUserId === "string"
          ? chatData.dmPeerUserId
          : null,
      isChannel: Boolean(chatData?.isChannel),
      isDm: Boolean(chatData?.isDm),
      isGroupDm: Boolean(chatData?.isGroupDm),
      isLoading: Boolean(urlChatId) && isLoading,
      isMultiplayerRoom: Boolean(chatData?.isMultiplayerRoom),
      roomTypists,
      sendRoomTypingSignal,
      sessionUserId: sessionUser?.id,
      threadReplyCounts:
        chatData?.threadReplyCounts &&
        typeof chatData.threadReplyCounts === "object"
          ? (chatData.threadReplyCounts as Record<string, number>)
          : {},
      threadReplyMessages: Array.isArray(chatData?.threadReplyMessages)
        ? (chatData.threadReplyMessages as ChatMessage[])
        : [],
      pendingOpenThreadRootMessageId,
      clearPendingOpenThreadRoot,
      syncOpenThreadRootMessageId,
      activeRunComposerThreadRootMessageId,
      isReadonly,
      messages,
      modelReasoningPreferences,
      regenerate,
      respondToToolApproval,
      sendMessage,
      setConnectorFocus,
      setCurrentKnowledgeBase,
      setCurrentModelId,
      setCurrentReasoningEffort,
      setDocumentSelection,
      setInput,
      setMessages,
      setShowCreditCardAlert,
      showCreditCardAlert,
      status,
      stop,
      streamingChatIds,
      updateModelReasoningPreference,
      messageReactions,
      reactionsUserId,
    }),
    [
      chatId,
      messages,
      setMessages,
      sendMessage,
      status,
      stop,
      regenerate,
      respondToToolApproval,
      input,
      documentSelection,
      isReadonly,
      urlChatId,
      isLoading,
      messageReactions,
      reactionsUserId,
      currentModelId,
      currentReasoningEffort,
      modelReasoningPreferences,
      clearConnectorFocus,
      connectorFocus,
      connectorFocusClearGeneration,
      currentKnowledgeBase,
      setConnectorFocus,
      setCurrentKnowledgeBase,
      showCreditCardAlert,
      updateModelReasoningPreference,
      streamingChatIds,
      beginNewChat,
      chatData?.channelParticipantRole,
      chatData?.channelTitle,
      chatData?.dmMembers,
      chatData?.dmTitle,
      chatData?.dmPeerDisplayName,
      chatData?.dmPeerEmail,
      chatData?.dmPeerImage,
      chatData?.dmPeerUserId,
      chatData?.isChannel,
      chatData?.isDm,
      chatData?.isGroupDm,
      chatData?.isMultiplayerRoom,
      roomTypists,
      sendRoomTypingSignal,
      sessionUser?.id,
      chatData?.threadReplyCounts,
      chatData?.threadReplyMessages,
      pendingOpenThreadRootMessageId,
      clearPendingOpenThreadRoot,
      syncOpenThreadRootMessageId,
      activeRunComposerThreadRootMessageId,
    ]
  );

  return (
    <ActiveChatContext.Provider value={value}>
      {children}
    </ActiveChatContext.Provider>
  );
}

export function useActiveChat() {
  const context = useContext(ActiveChatContext);
  if (!context) {
    throw new Error("useActiveChat must be used within ActiveChatProvider");
  }
  return context;
}

export function useStreamingChatIds(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribeChatRegistry,
    getStreamingChatIdsSnapshot,
    () => EMPTY_STREAMING_IDS
  );
}

export function useActiveChatId(): string | null {
  const pathname = usePathname();
  const urlChatId = extractChatIdFromPath(pathname);
  const composerChatId = useSyncExternalStore(
    subscribeComposerChatId,
    getComposerChatIdSnapshot,
    () => null
  );
  return urlChatId ?? composerChatId;
}

export function useBeginNewChat(): () => void {
  const router = useRouter();
  const contextBegin = useContext(ActiveChatContext)?.beginNewChat;
  return useCallback(() => {
    if (contextBegin) {
      contextBegin();
      return;
    }
    const id = generateUUID();
    setComposerChatId(id);
    router.push(CHAT_HOME);
  }, [contextBegin, router]);
}
