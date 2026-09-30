"use client";

import equal from "fast-deep-equal";
import { CheckIcon, MicIcon, SendHorizontal, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { useSessionUser } from "@/components/providers/session-user-provider";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import type { ChannelMember } from "@/contracts/channels";
import { useActiveChat, useBeginNewChat } from "@/hooks/use-active-chat";
import { useComposerSpeechRecognition } from "@/hooks/use-composer-speech-recognition";
import { useRoomTypingActivity } from "@/hooks/use-room-typing-activity";
import { chatModelsApiUrl, fetchChatModels } from "@/lib/ai/chat-models-api";
import { channelMembersApiUrl } from "@/lib/channels/channel-api";
import type {
  ChatRunStatus,
  ChatSendMessage,
  ChatSetMessages,
} from "@/lib/chat/chat-helpers";
import {
  appendInlineConnectorSegment,
  type ComposerInlineBody,
  composerInlineFocuses,
  composerInlineHasContent,
  composerInlinePlainText,
  composerInlineWireText,
  emptyComposerInlineBody,
  inlineBodyFromPlainText,
  inlineBodyHasConnectorSegments,
  inlineBodyIsConnectorToolChipOnly,
  insertComposerInlineBodyAtWireOffset,
  insertConnectorAtWireMention,
  insertRoomMentionAtWireMention,
  parseComposerInlineBody,
  removeInlineConnectorFocus,
  stripInlineConnectorSegments,
} from "@/lib/chat/composer-inline-body";
import {
  inlineBodyFromClipboardPlainText,
  readComposerInlineBodyFromDataTransfer,
} from "@/lib/chat/composer-inline-clipboard";
import {
  parseComposerEditableRoot,
  resolveActiveMentionInEditable,
  wireTextBeforeSelection,
} from "@/lib/chat/composer-inline-editable-dom";
import {
  createOptimisticChatEntry,
  prependChatToHistory,
} from "@/lib/chat/history-sync";
import {
  type ActiveRoomMention,
  buildRoomMentionTargets,
  filterRoomMentionTargets,
  parseActiveRoomMention,
  type RoomMentionTarget,
  roomMentionHandleSet,
} from "@/lib/chat/room-mention-autocomplete";
import {
  buildConnectorMentionTargets,
  type ConnectorMentionTarget,
  connectorMentionHandleSet,
  filterConnectorMentionTargets,
} from "@/lib/connectors/connector-mention-targets";
import { getCapabilities, type ModelCapabilities } from "@/shared/ai/models";
import type {
  ModelReasoningPreferences,
  ReasoningEffortLevel,
} from "@/shared/ai/reasoning-effort";
import { DEFAULT_COMPOSER_ASSISTANT_SLUG } from "@/shared/chat/assistant-brand";
import { CHAT_HOME, chatConversationPath } from "@/shared/chat/routes";
import { chatTitleFromMessage } from "@/shared/chat/title";
import type { ComposerConnectorFocus } from "@/shared/connectors/composer-connector-focus";
import {
  composerFocusKey,
  mergeComposerConnectorFocuses,
  resolveComposerConnectorFocusesFromText,
} from "@/shared/connectors/composer-connector-focuses";
import type { ConnectorPanelItem } from "@/shared/connectors/connectors-panel-types";
import type { Attachment, ChatMessage } from "@/shared/types";
import { cn, fetcher } from "@/shared/utils";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "../ai-elements/prompt-input";
import { Button } from "../ui/button";
import { InputGroupAddon } from "../ui/input-group";
import { buildDocumentSelectionMessage } from "./composer-inject";
import { ComposerInlineEditor } from "./composer-inline-editor";
import { ComposerInlineMentionMirror } from "./composer-inline-mention-mirror";
import type { ComposerKnowledgeBaseSelection } from "./composer-knowledge-base-chip";
import {
  COMPOSER_MENTION_MIRROR_CLASS,
  ComposerMentionHighlightMirror,
  composerMentionHighlightEnabled,
  composerMentionTextareaClassName,
} from "./composer-mention-highlight";
import {
  type ComposerMentionPick,
  ComposerMentionPicker,
} from "./composer-mention-picker";
import { DocumentSelectionChip } from "./document-selection-chip";
import { ComposerAttachMenu } from "./drive-file-picker";
import { FreeTrialQueryCounter } from "./free-trial-query-counter";
import { StopIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import {
  type SlashCommand,
  SlashCommandMenu,
  slashCommands,
} from "./slash-commands";

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedModelId,
  onModelChange: _onModelChange,
  reasoningEffort: _reasoningEffort,
  modelReasoningPreferences: _modelReasoningPreferences,
  onModelReasoningPreferenceChange: _onModelReasoningPreferenceChange,
  knowledgeBase: _knowledgeBase,
  onKnowledgeBaseChange: _onKnowledgeBaseChange,
  connectorFocus = null,
  onClearConnectorFocus,
  onConnectorFocusChange,
  isLoading: _isLoading,
  composerBlocked = false,
  composerBlockedMessage,
  isChannel = false,
  isMultiplayerRoom = false,
  sendRoomTypingSignal,
  typingThreadRootMessageId = null,
  draftStorageKey = "input",
  autoFocus = true,
  placeholder: placeholderOverride,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: ChatRunStatus;
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: ChatMessage[];
  setMessages: ChatSetMessages;
  sendMessage: ChatSendMessage;
  className?: string;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  reasoningEffort: ReasoningEffortLevel;
  modelReasoningPreferences: ModelReasoningPreferences;
  onModelReasoningPreferenceChange?: (
    modelId: string,
    effort: ReasoningEffortLevel,
    supportsReasoning: boolean
  ) => void;
  knowledgeBase: ComposerKnowledgeBaseSelection;
  onKnowledgeBaseChange?: (
    knowledgeBase: ComposerKnowledgeBaseSelection
  ) => void;
  connectorFocus?: ComposerConnectorFocus | null;
  onClearConnectorFocus?: () => void;
  onConnectorFocusChange?: (focus: ComposerConnectorFocus | null) => void;
  isLoading?: boolean;
  isChannel?: boolean;
  isMultiplayerRoom?: boolean;
  sendRoomTypingSignal?: (
    active: boolean,
    threadRootMessageId?: string | null
  ) => void;
  typingThreadRootMessageId?: string | null;
  draftStorageKey?: string;
  autoFocus?: boolean;
  placeholder?: string;
  composerBlocked?: boolean;
  composerBlockedMessage?: string | null;
}) {
  const router = useRouter();
  const beginNewChat = useBeginNewChat();
  const {
    activeRunComposerThreadRootMessageId,
    connectorFocusClearGeneration,
    documentSelection,
    setDocumentSelection,
    dmMembers,
  } = useActiveChat();
  const sessionUser = useSessionUser();
  const tenantSlug = useTenantSlug();
  const channelMembersKey =
    isMultiplayerRoom && isChannel && tenantSlug
      ? channelMembersApiUrl(tenantSlug, chatId)
      : null;
  const connectorsBootstrapKey = tenantSlug
    ? `${process.env.KIMIRO_BASE_PATH ?? ""}/api/connectors/${tenantSlug}/bootstrap`
    : null;
  const { data: channelMembersData } = useSWR<{ members: ChannelMember[] }>(
    channelMembersKey,
    fetcher,
    { revalidateOnFocus: false }
  );
  const { data: connectorsBootstrap } = useSWR<{ items: ConnectorPanelItem[] }>(
    connectorsBootstrapKey,
    fetcher,
    { revalidateOnFocus: false }
  );
  const connectorMentionTargets = useMemo(
    () => buildConnectorMentionTargets(connectorsBootstrap?.items ?? []),
    [connectorsBootstrap?.items]
  );
  const roomMentionTargets = useMemo(
    () =>
      buildRoomMentionTargets({
        members:
          isChannel && channelMembersData?.members
            ? channelMembersData.members.map((member) => ({
                displayName: member.displayName,
                email: member.email,
                userId: member.userId,
              }))
            : dmMembers.map((member) => ({
                displayName: member.displayName,
                email: member.email,
                userId: member.userId,
              })),
        sessionUserId: sessionUser?.id,
      }),
    [channelMembersData?.members, dmMembers, isChannel, sessionUser?.id]
  );
  const { setTheme, resolvedTheme } = useTheme();
  const speech = useComposerSpeechRecognition({
    enabled: !composerBlocked,
    onChange: setInput,
    value: input,
  });
  const useInlineComposer = !speech.listening;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inlineEditorRef = useRef<HTMLDivElement>(null);
  const activeTextRef = useRef<HTMLSpanElement>(null);
  const singleLineComposerHeightRef = useRef<number | null>(null);
  const mentionMirrorRef = useRef<HTMLDivElement>(null);
  const inlineMentionMirrorRef = useRef<HTMLDivElement>(null);
  const bodyHydratedRef = useRef(false);
  const prevConnectorFocusRef = useRef(connectorFocus);
  const wasSpeechListeningRef = useRef(false);
  const [inlineBody, setInlineBody] = useState<ComposerInlineBody>(
    emptyComposerInlineBody
  );
  const [composerStacked, setComposerStacked] = useState(false);
  const [composerCursor, setComposerCursor] = useState(0);
  const mentionHandles = useMemo(() => {
    const handles = roomMentionHandleSet(roomMentionTargets);
    for (const handle of connectorMentionHandleSet(connectorMentionTargets)) {
      handles.add(handle);
    }
    return handles;
  }, [connectorMentionTargets, roomMentionTargets]);
  const composerWireText = useMemo(
    () => composerInlineWireText(inlineBody),
    [inlineBody]
  );
  const [inlineWireCursor, setInlineWireCursor] = useState(0);
  const mentionHighlightActive = useInlineComposer
    ? composerMentionHighlightEnabled(
        composerWireText,
        inlineWireCursor,
        mentionHandles
      )
    : composerMentionHighlightEnabled(input, composerCursor, mentionHandles);
  const composerHasContent = useMemo(
    () => composerInlineHasContent(inlineBody),
    [inlineBody]
  );
  const syncComposerCursor = useCallback((textarea: HTMLTextAreaElement) => {
    setComposerCursor(textarea.selectionStart ?? textarea.value.length);
  }, []);
  const { width } = useWindowSize();
  const hasAutoFocused = useRef(false);
  useEffect(() => {
    if (!(autoFocus && width)) {
      return;
    }
    if (!hasAutoFocused.current) {
      const timer = setTimeout(() => {
        (speech.listening ? textareaRef : activeTextRef).current?.focus();
        hasAutoFocused.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, speech.listening, width]);

  const inlineDraftStorageKey = `${draftStorageKey}:composerInlineBody`;
  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    draftStorageKey,
    ""
  );
  const [localStorageInlineBodyJson, setLocalStorageInlineBodyJson] =
    useLocalStorage(inlineDraftStorageKey, "");

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
    }
  }, [localStorageInput, setInput]);

  useEffect(() => {
    if (useInlineComposer) {
      return;
    }
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput, useInlineComposer]);

  const syncInlineDraft = useCallback(
    (body: ComposerInlineBody) => {
      const wire = composerInlineWireText(body);
      setInput(wire);
      setLocalStorageInput(wire);
      if (composerInlineHasContent(body)) {
        setLocalStorageInlineBodyJson(JSON.stringify(body));
      } else {
        setLocalStorageInlineBodyJson("");
      }
    },
    [setInput, setLocalStorageInlineBodyJson, setLocalStorageInput]
  );

  useEffect(() => {
    if (bodyHydratedRef.current) {
      return;
    }

    if (localStorageInlineBodyJson) {
      try {
        const stored = parseComposerInlineBody(
          JSON.parse(localStorageInlineBodyJson)
        );
        if (stored) {
          const orphanedToolChipOnly =
            !connectorFocus && inlineBodyIsConnectorToolChipOnly(stored);
          setInlineBody(
            orphanedToolChipOnly ? stripInlineConnectorSegments(stored) : stored
          );
          bodyHydratedRef.current = true;
          return;
        }
      } catch {
        // Fall through to wire seed.
      }
    }

    const seed = localStorageInput || input;
    if (!seed) {
      bodyHydratedRef.current = true;
      return;
    }

    const mentionsInSeed = /\B@[\w.-]+/.test(seed);
    const bootstrapPending =
      connectorsBootstrapKey != null && connectorsBootstrap === undefined;
    if (mentionsInSeed && bootstrapPending) {
      setInlineBody(inlineBodyFromPlainText(seed, []));
      return;
    }

    setInlineBody(
      inlineBodyFromPlainText(
        seed,
        connectorFocus ? connectorMentionTargets : []
      )
    );
    bodyHydratedRef.current = true;
  }, [
    connectorFocus,
    connectorMentionTargets,
    connectorsBootstrap,
    connectorsBootstrapKey,
    input,
    localStorageInlineBodyJson,
    localStorageInput,
  ]);

  useEffect(() => {
    if (!bodyHydratedRef.current || !connectorFocus) {
      return;
    }
    if (inlineBodyHasConnectorSegments(inlineBody)) {
      return;
    }
    const seed = localStorageInput || composerInlineWireText(inlineBody);
    if (!/\B@[\w.-]+/.test(seed)) {
      return;
    }
    if (connectorsBootstrapKey != null && connectorsBootstrap === undefined) {
      return;
    }
    const reparsed = inlineBodyFromPlainText(seed, connectorMentionTargets);
    if (inlineBodyHasConnectorSegments(reparsed)) {
      setInlineBody(reparsed);
    }
  }, [
    connectorFocus,
    connectorMentionTargets,
    connectorsBootstrap,
    connectorsBootstrapKey,
    inlineBody,
    localStorageInput,
  ]);

  useEffect(() => {
    if (connectorFocusClearGeneration === 0) {
      return;
    }
    setInlineBody((body) => stripInlineConnectorSegments(body));
    prevConnectorFocusRef.current = null;
    setLocalStorageInlineBodyJson("");
  }, [connectorFocusClearGeneration, setLocalStorageInlineBodyJson]);

  useEffect(() => {
    if (!connectorFocus) {
      return;
    }
    setInlineBody((body) => {
      const existing = new Set(
        composerInlineFocuses(body).map((focus) => composerFocusKey(focus))
      );
      if (existing.has(composerFocusKey(connectorFocus))) {
        return body;
      }
      return appendInlineConnectorSegment(body, connectorFocus);
    });
  }, [connectorFocus]);

  useEffect(() => {
    if (!bodyHydratedRef.current) {
      return;
    }
    syncInlineDraft(inlineBody);
  }, [inlineBody, syncInlineDraft]);

  useEffect(() => {
    const previous = prevConnectorFocusRef.current;
    if (previous && !connectorFocus) {
      setInlineBody((body) => removeInlineConnectorFocus(body, previous));
    }
    prevConnectorFocusRef.current = connectorFocus;
  }, [connectorFocus]);

  useEffect(() => {
    if (!onConnectorFocusChange || !connectorFocus) {
      return;
    }
    const keys = new Set(
      composerInlineFocuses(inlineBody).map((focus) => composerFocusKey(focus))
    );
    if (!keys.has(composerFocusKey(connectorFocus))) {
      onConnectorFocusChange(null);
    }
  }, [connectorFocus, inlineBody, onConnectorFocusChange]);

  useEffect(() => {
    if (wasSpeechListeningRef.current && !speech.listening) {
      setInlineBody(inlineBodyFromPlainText(input, connectorMentionTargets));
    }
    wasSpeechListeningRef.current = speech.listening;
  }, [connectorMentionTargets, input, speech.listening]);

  useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      speech.cancel();
    }
  }, [speech.cancel, status]);

  useRoomTypingActivity({
    enabled: Boolean(isMultiplayerRoom && sendRoomTypingSignal),
    input,
    sendRoomTypingSignal: sendRoomTypingSignal ?? (() => undefined),
    threadRootMessageId: typingThreadRootMessageId,
  });

  const isComposerRunActive = status === "submitted" || status === "streaming";
  const showComposerRunStop =
    isComposerRunActive &&
    (!isMultiplayerRoom ||
      (activeRunComposerThreadRootMessageId !== undefined &&
        activeRunComposerThreadRootMessageId === typingThreadRootMessageId));

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (composerBlocked) {
      return;
    }
    const val = event.target.value;
    const cursor = event.target.selectionStart ?? val.length;
    setInput(val);
    setComposerCursor(cursor);

    const activeMention = parseActiveRoomMention(val, cursor);
    if (activeMention) {
      const roomHits =
        isMultiplayerRoom && roomMentionTargets.length > 0
          ? filterRoomMentionTargets(roomMentionTargets, activeMention.query)
          : [];
      const connectorHits =
        connectorMentionTargets.length > 0
          ? filterConnectorMentionTargets(
              connectorMentionTargets,
              activeMention.query
            )
          : [];
      if (roomHits.length > 0 || connectorHits.length > 0) {
        setMentionQuery(activeMention.query);
        setMentionRange(activeMention);
        setMentionIndex(0);
        setSlashOpen(false);
        return;
      }
    }
    setMentionRange(null);

    if (val.startsWith("/") && !val.includes(" ")) {
      setSlashOpen(true);
      setSlashQuery(val.slice(1));
      setSlashIndex(0);
    } else {
      setSlashOpen(false);
    }
  };

  const handleSlashSelect = (cmd: SlashCommand) => {
    setSlashOpen(false);
    setInput("");
    setInlineBody(emptyComposerInlineBody());
    switch (cmd.action) {
      case "new":
        beginNewChat();
        break;
      case "clear":
        setMessages(() => []);
        break;
      case "rename":
        toast("Rename is available from the sidebar chat menu.");
        break;
      case "model": {
        const modelBtn = document.querySelector<HTMLButtonElement>(
          "[data-testid='model-selector']"
        );
        modelBtn?.click();
        break;
      }
      case "theme":
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        break;
      case "delete":
        toast("Delete this chat?", {
          action: {
            label: "Delete",
            onClick: () => {
              fetch(
                `${process.env.KIMIRO_BASE_PATH ?? ""}/api/chat?id=${chatId}`,
                { method: "DELETE" }
              );
              router.push(CHAT_HOME);
              toast.success("Chat deleted");
            },
          },
        });
        break;
      default:
        break;
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

  const hasComposerAttachments =
    attachments.length > 0 ||
    uploadQueue.length > 0 ||
    Boolean(documentSelection);

  const syncComposerLayout = useCallback(() => {
    const el = useInlineComposer
      ? inlineEditorRef.current
      : textareaRef.current;
    if (!el) {
      return;
    }
    if (hasComposerAttachments) {
      setComposerStacked(true);
      return;
    }
    const contentEmpty = useInlineComposer
      ? !composerHasContent
      : !input.trim();
    if (contentEmpty) {
      singleLineComposerHeightRef.current = el.scrollHeight;
      setComposerStacked(false);
      return;
    }
    if (useInlineComposer) {
      // Once content needs the stacked layout, keep it there until the composer
      // is cleared. Unstacking widens the editor, which can unwrap its content
      // and create a stack/unstack feedback loop while the user is typing.
      const height = el.scrollHeight;
      const stackAt = 56;
      setComposerStacked((stacked) => stacked || height > stackAt);
      return;
    }
    const baseline = singleLineComposerHeightRef.current ?? el.scrollHeight;
    setComposerStacked(el.scrollHeight > baseline + 2);
  }, [composerHasContent, hasComposerAttachments, input, useInlineComposer]);

  useLayoutEffect(() => {
    syncComposerLayout();
  }, [syncComposerLayout]);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionRange, setMentionRange] = useState<ActiveRoomMention | null>(
    null
  );
  const mentionRangeRef = useRef<ActiveRoomMention | null>(null);
  useEffect(() => {
    mentionRangeRef.current = mentionRange;
  }, [mentionRange]);
  const filteredMentionTargets = useMemo(
    () =>
      mentionRange && isMultiplayerRoom
        ? filterRoomMentionTargets(roomMentionTargets, mentionQuery)
        : [],
    [isMultiplayerRoom, mentionQuery, mentionRange, roomMentionTargets]
  );
  const filteredConnectorMentionTargets = useMemo(
    () =>
      mentionRange
        ? filterConnectorMentionTargets(connectorMentionTargets, mentionQuery)
        : [],
    [connectorMentionTargets, mentionQuery, mentionRange]
  );
  const mentionPickerPicks = useMemo((): ComposerMentionPick[] => {
    if (!mentionRange) {
      return [];
    }
    const picks: ComposerMentionPick[] = [];
    for (const target of filteredMentionTargets) {
      picks.push({ kind: "room", target });
    }
    for (const target of filteredConnectorMentionTargets) {
      picks.push({ kind: "connector", target });
    }
    return picks;
  }, [filteredConnectorMentionTargets, filteredMentionTargets, mentionRange]);
  const mentionPickerOpen = mentionPickerPicks.length > 0;

  const updateSlashStateFromWire = useCallback((wire: string) => {
    if (wire.startsWith("/") && !wire.includes(" ")) {
      setSlashOpen(true);
      setSlashQuery(wire.slice(1));
      setSlashIndex(0);
    } else {
      setSlashOpen(false);
    }
  }, []);

  const handleInlineBodyChange = useCallback(
    (body: ComposerInlineBody) => {
      setInlineBody(body);
      updateSlashStateFromWire(composerInlineWireText(body));
    },
    [updateSlashStateFromWire]
  );

  const handleActiveMentionChange = useCallback(
    ({ mention }: { mention: ActiveRoomMention | null }) => {
      if (!mention) {
        setMentionRange(null);
        return;
      }
      const roomHits =
        isMultiplayerRoom && roomMentionTargets.length > 0
          ? filterRoomMentionTargets(roomMentionTargets, mention.query)
          : [];
      const connectorHits =
        connectorMentionTargets.length > 0
          ? filterConnectorMentionTargets(
              connectorMentionTargets,
              mention.query
            )
          : [];
      if (roomHits.length > 0 || connectorHits.length > 0) {
        setMentionQuery(mention.query);
        setMentionRange(mention);
        setMentionIndex(0);
        setSlashOpen(false);
        return;
      }
      setMentionRange(null);
    },
    [connectorMentionTargets, isMultiplayerRoom, roomMentionTargets]
  );

  const resolveMentionApplyContext = useCallback(() => {
    const root = activeTextRef.current as HTMLDivElement | null;
    if (!root) {
      return null;
    }
    const mention =
      mentionRangeRef.current ?? resolveActiveMentionInEditable(root);
    if (!mention) {
      return null;
    }
    return {
      body: parseComposerEditableRoot(root),
      mention,
      root,
    };
  }, []);

  const applyMentionSelection = useCallback(
    (target: RoomMentionTarget) => {
      const ctx = resolveMentionApplyContext();
      if (!ctx) {
        return;
      }
      const handle = target.kind === "agent" ? "kimiro" : target.handle;
      handleInlineBodyChange(
        insertRoomMentionAtWireMention({
          body: ctx.body,
          handle,
          mention: ctx.mention,
        })
      );
      setMentionRange(null);
      requestAnimationFrame(() => ctx.root.focus());
    },
    [handleInlineBodyChange, resolveMentionApplyContext]
  );

  const applyConnectorMentionSelection = useCallback(
    (target: ConnectorMentionTarget) => {
      const ctx = resolveMentionApplyContext();
      if (!ctx) {
        return;
      }
      handleInlineBodyChange(
        insertConnectorAtWireMention({
          body: ctx.body,
          focus: target.focus,
          mention: ctx.mention,
        })
      );
      onConnectorFocusChange?.(target.focus);
      setMentionRange(null);
      requestAnimationFrame(() => ctx.root.focus());
    },
    [handleInlineBodyChange, onConnectorFocusChange, resolveMentionApplyContext]
  );

  const applyMentionPickerSelection = useCallback(
    (pick: ComposerMentionPick) => {
      if (pick.kind === "room") {
        applyMentionSelection(pick.target);
        return;
      }
      applyConnectorMentionSelection(pick.target);
    },
    [applyConnectorMentionSelection, applyMentionSelection]
  );

  const submitForm = useCallback(() => {
    router.replace(chatConversationPath(chatId), {
      scroll: false,
    });

    const bodyForSend =
      useInlineComposer && inlineEditorRef.current
        ? parseComposerEditableRoot(inlineEditorRef.current)
        : inlineBody;
    const composerText = composerInlinePlainText(bodyForSend).trim();
    const wireText = composerInlineWireText(bodyForSend).trim();
    const messageText = documentSelection
      ? buildDocumentSelectionMessage({
          selection: documentSelection,
          userText: wireText,
        })
      : wireText;

    if (composerText && messages.length === 0 && !isMultiplayerRoom) {
      prependChatToHistory(
        createOptimisticChatEntry({
          id: chatId,
          title: chatTitleFromMessage({
            id: chatId,
            parts: [{ text: messageText, type: "text" }],
            role: "user",
          }),
        })
      );
    }

    sendRoomTypingSignal?.(false, typingThreadRootMessageId);

    const composerConnectorFocuses = mergeComposerConnectorFocuses(
      connectorFocus,
      composerInlineFocuses(bodyForSend),
      resolveComposerConnectorFocusesFromText(
        messageText,
        connectorMentionTargets
      )
    );

    sendMessage({
      metadata: {
        agentSlug: DEFAULT_COMPOSER_ASSISTANT_SLUG,
        createdAt: new Date().toISOString(),
        ...(inlineBodyHasConnectorSegments(bodyForSend)
          ? { composerInlineBody: bodyForSend }
          : {}),
        ...(documentSelection
          ? {
              composerText,
              documentSelection,
            }
          : isMultiplayerRoom
            ? { composerText }
            : composerText
              ? { composerText }
              : {}),
        ...(composerConnectorFocuses.length > 0
          ? {
              composerConnectorFocus: composerConnectorFocuses[0],
              composerConnectorFocuses,
            }
          : {}),
      },
      parts: [
        ...attachments.map((attachment) => ({
          filename: attachment.name,
          mediaType: attachment.contentType,
          name: attachment.name,
          type: "file" as const,
          url: attachment.url,
        })),
        {
          text: messageText,
          type: "text",
        },
      ],
      role: "user",
    });

    setAttachments([]);
    setDocumentSelection(null);
    setLocalStorageInput("");
    setLocalStorageInlineBodyJson("");
    setInput("");
    setInlineBody(emptyComposerInlineBody());
    onConnectorFocusChange?.(null);
    onClearConnectorFocus?.();

    if (width && width > 768) {
      (useInlineComposer ? activeTextRef : textareaRef).current?.focus();
    }
  }, [
    inlineBody,
    onClearConnectorFocus,
    useInlineComposer,
    setInput,
    attachments,
    documentSelection,
    sendMessage,
    setAttachments,
    setDocumentSelection,
    setLocalStorageInput,
    setLocalStorageInlineBodyJson,
    width,
    chatId,
    isMultiplayerRoom,
    router,
    messages.length,
    sendRoomTypingSignal,
    typingThreadRootMessageId,
    connectorFocus,
    connectorMentionTargets,
    onConnectorFocusChange,
  ]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${process.env.KIMIRO_BASE_PATH ?? ""}/api/files/upload`,
        {
          body: formData,
          method: "POST",
        }
      );

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          contentType,
          name: pathname,
          url,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (_error) {
      toast.error("Failed to upload file, please try again!");
    }
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (_error) {
        toast.error("Failed to upload files");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith("image/")
      );

      if (imageItems.length === 0) {
        return;
      }

      event.preventDefault();

      setUploadQueue((prev) => [...prev, "Pasted image"]);

      try {
        const uploadPromises = imageItems
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null)
          .map((file) => uploadFile(file));

        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) =>
            attachment !== undefined &&
            attachment.url !== undefined &&
            attachment.contentType !== undefined
        );

        setAttachments((curr) => [
          ...curr,
          ...(successfullyUploadedAttachments as Attachment[]),
        ]);
      } catch (_error) {
        toast.error("Failed to upload pasted image(s)");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.addEventListener("paste", handlePaste);
    return () => textarea.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleComposerPaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) {
        return;
      }

      const items = clipboardData.items;
      const imageItems = items
        ? Array.from(items).filter((item) => item.type.startsWith("image/"))
        : [];
      if (imageItems.length > 0) {
        event.preventDefault();
        void handlePaste(event as unknown as ClipboardEvent);
        return;
      }

      const pastedInline =
        readComposerInlineBodyFromDataTransfer(clipboardData) ??
        inlineBodyFromClipboardPlainText({
          mentionTargets: connectorMentionTargets,
          text: clipboardData.getData("text/plain"),
        });

      if (!pastedInline || !inlineBodyHasConnectorSegments(pastedInline)) {
        return;
      }

      event.preventDefault();
      const root = inlineEditorRef.current;
      const wireCursor = root
        ? wireTextBeforeSelection(root).length
        : inlineWireCursor;

      setInlineBody((current) => {
        if (!composerInlineHasContent(current)) {
          return pastedInline;
        }
        return insertComposerInlineBodyAtWireOffset(
          current,
          wireCursor,
          pastedInline
        );
      });
    },
    [connectorMentionTargets, handlePaste, inlineWireCursor]
  );

  const composerAttachmentsButton = (
    <AttachmentsButton
      composerBlocked={composerBlocked}
      fileInputRef={fileInputRef}
      selectedModelId={selectedModelId}
      setAttachments={setAttachments}
      status={status}
      tenantSlug={tenantSlug}
    />
  );

  const composerTrailingControls = (
    <div className="flex shrink-0 items-center gap-1">
      {composerAttachmentsButton}
      {speech.listening ? (
        <>
          <Button
            aria-label="Cancel dictation"
            className="size-8 rounded-md p-0 text-red-500 hover:bg-red-500/10"
            data-testid="composer-mic-cancel-button"
            onClick={(event) => {
              event.preventDefault();
              speech.cancel();
            }}
            type="button"
            variant="ghost"
          >
            <XIcon className="size-5" />
          </Button>
          <Button
            aria-label="Done dictating"
            className="size-8 rounded-md bg-foreground p-0 text-background"
            data-testid="composer-mic-confirm-button"
            onClick={(event) => {
              event.preventDefault();
              speech.confirm();
            }}
            type="button"
            variant="ghost"
          >
            <CheckIcon className="size-5" />
          </Button>
        </>
      ) : (
        <>
          {speech.supported ? (
            <Button
              aria-label="Dictate message"
              className="size-8 rounded-md p-0 text-muted-foreground/70 hover:bg-muted/60 hover:text-muted-foreground"
              data-testid="composer-mic-button"
              disabled={composerBlocked}
              onClick={(event) => {
                event.preventDefault();
                speech.start();
              }}
              type="button"
              variant="ghost"
            >
              <MicIcon className="size-5" />
            </Button>
          ) : null}
          <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border/50" />
          {showComposerRunStop ? (
            <StopButton setMessages={setMessages} stop={stop} />
          ) : (
            <PromptInputSubmit
              className={cn(
                "size-8 rounded-md bg-transparent p-0 shadow-none hover:bg-muted/60 disabled:opacity-100",
                (useInlineComposer ? composerHasContent : input.trim())
                  ? "text-foreground/85 hover:text-foreground"
                  : "text-muted-foreground/70 hover:text-muted-foreground"
              )}
              data-testid="send-button"
              disabled={
                composerBlocked ||
                !(useInlineComposer ? composerHasContent : input.trim()) ||
                uploadQueue.length > 0
              }
              status={status}
              variant="ghost"
            >
              <SendHorizontal className="size-5" />
            </PromptInputSubmit>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className={cn("relative flex w-full flex-col", className)}>
      <FreeTrialQueryCounter />
      <input
        accept=".jpg,.jpeg,.png,.pdf,.txt,.md,.docx,.xlsx,image/jpeg,image/png,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <div className="relative">
        {mentionPickerOpen ? (
          <ComposerMentionPicker
            onSelect={applyMentionPickerSelection}
            picks={mentionPickerPicks}
            selectedIndex={mentionIndex}
          />
        ) : null}
        {slashOpen && !mentionPickerOpen ? (
          <SlashCommandMenu
            onClose={() => setSlashOpen(false)}
            onSelect={handleSlashSelect}
            query={slashQuery}
            selectedIndex={slashIndex}
          />
        ) : null}
      </div>

      <PromptInput
        className={cn(
          "[&>div]:h-auto [&>div]:min-h-10 [&>div]:cursor-pointer [&>div]:!border [&>div]:!border-border/55 [&>div]:bg-card/70 [&>div]:shadow-(--shadow-composer) [&>div]:transition-[border-color,box-shadow] [&>div]:duration-300 [&>div]:focus-within:!border-border/35 [&>div]:focus-within:shadow-(--shadow-composer-focus)",
          "[&>div]:!rounded-lg [&>div]:has-[textarea]:!rounded-lg",
          !composerStacked &&
            "[&>div]:flex-row [&>div]:flex-nowrap [&>div]:items-center [&>div]:py-1",
          composerBlocked &&
            "[&>div]:cursor-not-allowed [&>div]:opacity-60 [&>div]:focus-within:shadow-(--shadow-composer)"
        )}
        onSubmit={() => {
          if (composerBlocked) {
            return;
          }
          if (!useInlineComposer && input.startsWith("/")) {
            const query = input.slice(1).trim();
            const cmd = slashCommands.find((c) => c.name === query);
            if (cmd) {
              handleSlashSelect(cmd);
            }
            return;
          }
          const hasText = useInlineComposer
            ? composerHasContent
            : Boolean(input.trim());
          if (!hasText && attachments.length === 0) {
            return;
          }
          // Selection chip alone is not enough — require an instruction.
          if (documentSelection && !hasText) {
            return;
          }
          if (useInlineComposer && composerWireText.startsWith("/")) {
            const query = composerWireText.slice(1).trim();
            const cmd = slashCommands.find((c) => c.name === query);
            if (cmd) {
              handleSlashSelect(cmd);
            }
            return;
          }
          if (status === "ready" || status === "error") {
            submitForm();
          } else {
            toast.error("Please wait for the model to finish its response!");
          }
        }}
      >
        {(attachments.length > 0 ||
          uploadQueue.length > 0 ||
          documentSelection) && (
          <div
            className="flex w-full basis-full flex-col gap-2 px-3 pt-2"
            data-testid="attachments-preview"
          >
            {documentSelection ? (
              <div className="w-full">
                <div className="mb-1.5 px-0.5 text-[11px] text-muted-foreground">
                  1 document
                </div>
                <DocumentSelectionChip
                  onRemove={() => setDocumentSelection(null)}
                  text={documentSelection.text}
                  title={documentSelection.title}
                />
              </div>
            ) : null}
            {(attachments.length > 0 || uploadQueue.length > 0) && (
              <div className="flex w-full flex-row gap-2 overflow-x-auto no-scrollbar">
                {attachments.map((attachment) => (
                  <PreviewAttachment
                    attachment={attachment}
                    key={attachment.url}
                    onRemove={() => {
                      setAttachments((currentAttachments) =>
                        currentAttachments.filter(
                          (a) => a.url !== attachment.url
                        )
                      );
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  />
                ))}

                {uploadQueue.map((filename) => (
                  <PreviewAttachment
                    attachment={{
                      contentType: "",
                      name: filename,
                      url: "",
                    }}
                    isUploading={true}
                    key={filename}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        <div
          className={cn(
            "flex min-w-0 flex-1 items-start gap-2",
            composerStacked ? "w-full flex-col" : "min-h-10"
          )}
        >
          <div
            className={cn(
              "relative min-w-0 flex-1",
              composerStacked ? "w-full" : undefined
            )}
          >
            {useInlineComposer ? (
              <>
                {composerHasContent ? null : (
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute inset-x-0 top-0 z-0 text-base text-muted-foreground/50 leading-normal md:text-base",
                      composerStacked ? "px-3 pt-3 pb-0" : "px-3 py-2"
                    )}
                  >
                    {composerBlocked && composerBlockedMessage
                      ? composerBlockedMessage
                      : placeholderOverride?.trim()
                        ? placeholderOverride
                        : isMultiplayerRoom
                          ? "Message…"
                          : `Ask ${DEFAULT_COMPOSER_ASSISTANT_SLUG}…`}
                  </div>
                )}
                {mentionHighlightActive ? (
                  <div
                    aria-hidden
                    className={cn(
                      COMPOSER_MENTION_MIRROR_CLASS,
                      "absolute inset-x-0 top-0 z-0 max-h-48 overflow-hidden text-base leading-6 md:text-base",
                      composerStacked ? "px-3 pt-3 pb-0" : "px-3 py-2"
                    )}
                    ref={inlineMentionMirrorRef}
                  >
                    <ComposerInlineMentionMirror
                      body={inlineBody}
                      cursor={inlineWireCursor}
                      handles={mentionHandles}
                    />
                  </div>
                ) : null}
                <ComposerInlineEditor
                  activeTextRef={activeTextRef}
                  body={inlineBody}
                  className={cn(
                    "relative z-[1] max-h-48 overflow-y-auto",
                    composerStacked ? "px-3 pt-3 pb-0" : "px-3 py-2",
                    composerBlocked && "text-muted-foreground"
                  )}
                  containerRef={inlineEditorRef}
                  disabled={composerBlocked}
                  mentionHandles={mentionHandles}
                  mentionHighlightClassName={composerMentionTextareaClassName(
                    mentionHighlightActive
                  )}
                  onActiveMentionChange={handleActiveMentionChange}
                  onBodyChange={handleInlineBodyChange}
                  onKeyDown={(e) => {
                    if (mentionPickerOpen) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setMentionIndex((index) =>
                          Math.min(index + 1, mentionPickerPicks.length - 1)
                        );
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setMentionIndex((index) => Math.max(index - 1, 0));
                        return;
                      }
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        e.stopPropagation();
                        const pick = mentionPickerPicks[mentionIndex];
                        if (pick) {
                          applyMentionPickerSelection(pick);
                        }
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setMentionRange(null);
                        return;
                      }
                    }
                    if (slashOpen) {
                      const filtered = slashCommands.filter((cmd) =>
                        cmd.name.startsWith(slashQuery.toLowerCase())
                      );
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setSlashIndex((i) =>
                          Math.min(i + 1, filtered.length - 1)
                        );
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setSlashIndex((i) => Math.max(i - 1, 0));
                        return;
                      }
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        if (filtered[slashIndex]) {
                          handleSlashSelect(filtered[slashIndex]);
                        }
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setSlashOpen(false);
                        return;
                      }
                    }
                    if (e.key === "Enter") {
                      if (e.nativeEvent.isComposing) {
                        return;
                      }
                      if (e.shiftKey) {
                        return;
                      }
                      e.preventDefault();
                      e.stopPropagation();
                      const form = e.currentTarget.closest("form");
                      const submitButton = form?.querySelector(
                        'button[type="submit"]'
                      ) as HTMLButtonElement | null;
                      if (submitButton?.disabled) {
                        return;
                      }
                      form?.requestSubmit();
                    }
                  }}
                  onPaste={handleComposerPaste}
                  onWireCursorChange={setInlineWireCursor}
                  scrollMirrorRef={inlineMentionMirrorRef}
                />
              </>
            ) : (
              <>
                {mentionHighlightActive ? (
                  <div
                    aria-hidden
                    className={cn(
                      COMPOSER_MENTION_MIRROR_CLASS,
                      "field-sizing-content min-h-10 max-h-48 whitespace-pre-wrap break-words text-base leading-normal md:text-base",
                      composerStacked ? "px-3 pt-3 pb-0" : "px-3 py-2",
                      composerBlocked && "text-muted-foreground"
                    )}
                    ref={mentionMirrorRef}
                  >
                    <ComposerMentionHighlightMirror
                      cursor={composerCursor}
                      handles={mentionHandles}
                      text={input}
                    />
                  </div>
                ) : null}
                <PromptInputTextarea
                  className={cn(
                    "relative z-[1] min-h-10 max-h-48 w-full whitespace-pre-wrap break-words text-base leading-normal md:text-base placeholder:text-muted-foreground/50",
                    composerStacked ? "px-3 pt-3 pb-0" : "px-3 py-2",
                    composerBlocked
                      ? "cursor-not-allowed text-muted-foreground"
                      : "cursor-text",
                    composerMentionTextareaClassName(mentionHighlightActive)
                  )}
                  data-testid="multimodal-input"
                  disabled={composerBlocked}
                  onChange={handleInput}
                  onClick={(event) => syncComposerCursor(event.currentTarget)}
                  onKeyDown={(e) => {
                    if (speech.listening && e.key === "Escape") {
                      e.preventDefault();
                      speech.cancel();
                    }
                  }}
                  onKeyUp={(event) => syncComposerCursor(event.currentTarget)}
                  onScroll={(event) => {
                    if (mentionMirrorRef.current) {
                      mentionMirrorRef.current.scrollTop =
                        event.currentTarget.scrollTop;
                    }
                  }}
                  onSelect={(event) => syncComposerCursor(event.currentTarget)}
                  placeholder={
                    composerBlocked && composerBlockedMessage
                      ? composerBlockedMessage
                      : speech.listening
                        ? "Listening…"
                        : placeholderOverride?.trim()
                          ? placeholderOverride
                          : isMultiplayerRoom
                            ? "Message…"
                            : `Ask ${DEFAULT_COMPOSER_ASSISTANT_SLUG}…`
                  }
                  readOnly={composerBlocked}
                  ref={textareaRef}
                  value={input}
                />
              </>
            )}
          </div>
        </div>
        {composerStacked ? (
          <PromptInputFooter className="justify-end px-2 pt-0 pb-2">
            {composerTrailingControls}
          </PromptInputFooter>
        ) : (
          <InputGroupAddon align="inline-end" className="gap-0 py-0 pr-3">
            {composerTrailingControls}
          </InputGroupAddon>
        )}
      </PromptInput>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!equal(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }
    if (prevProps.reasoningEffort !== nextProps.reasoningEffort) {
      return false;
    }
    if (
      !equal(
        prevProps.modelReasoningPreferences,
        nextProps.modelReasoningPreferences
      )
    ) {
      return false;
    }
    if (!equal(prevProps.knowledgeBase, nextProps.knowledgeBase)) {
      return false;
    }
    if (!equal(prevProps.connectorFocus, nextProps.connectorFocus)) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.composerBlocked !== nextProps.composerBlocked) {
      return false;
    }
    if (prevProps.composerBlockedMessage !== nextProps.composerBlockedMessage) {
      return false;
    }
    if (prevProps.messages.length !== nextProps.messages.length) {
      return false;
    }

    return true;
  }
);

function PureAttachmentsButton({
  composerBlocked = false,
  fileInputRef,
  status,
  selectedModelId,
  tenantSlug,
  setAttachments,
}: {
  composerBlocked?: boolean;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: ChatRunStatus;
  selectedModelId: string;
  tenantSlug: string | null;
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
}) {
  const localCapabilities = getCapabilities();
  const { data: modelsResponse } = useSWR(
    tenantSlug ? chatModelsApiUrl(tenantSlug) : null,
    () => fetchChatModels(tenantSlug ?? ""),
    { dedupingInterval: 60_000, revalidateOnFocus: true }
  );

  const caps: Record<string, ModelCapabilities> | undefined =
    modelsResponse?.capabilities ?? modelsResponse;
  const hasVision =
    caps?.[selectedModelId]?.vision ??
    localCapabilities[selectedModelId]?.vision ??
    false;

  return (
    <ComposerAttachMenu
      composerBlocked={composerBlocked}
      fileInputRef={fileInputRef}
      hasVision={hasVision}
      setAttachments={setAttachments}
      status={status}
      tenantSlug={tenantSlug}
    />
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: ChatSetMessages;
}) {
  return (
    <Button
      className="h-7 w-7 cursor-pointer rounded-xl bg-foreground p-1 text-background transition-all duration-200 hover:opacity-85 active:scale-95 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground/25"
      data-testid="stop-button"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
