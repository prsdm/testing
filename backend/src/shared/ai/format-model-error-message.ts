export type ModelErrorPresentation = {
  title: string;
  message: string;
  code?: string;
  docsUrl?: string;
};

const DEFAULT_FALLBACK_MESSAGE =
  "Something went wrong while contacting the model. Please try again.";

const FRIENDLY_ERROR_TITLES: Record<string, string> = {
  authentication_error: "Authentication failed",
  billing_not_active: "Billing is not active",
  context_length_exceeded: "Conversation too long",
  insufficient_quota: "Quota exceeded",
  invalid_api_key: "Invalid API key",
  invalid_api_key_provided: "Invalid API key",
  not_found: "Model not found",
  overloaded_error: "Model temporarily unavailable",
  permission_denied: "Permission denied",
  rate_limit_exceeded: "Rate limit reached",
  server_error: "Model provider error",
};

const FRIENDLY_ERROR_CODE_ALIASES: Record<
  string,
  keyof typeof FRIENDLY_ERROR_TITLES
> = {
  billing_error: "insufficient_quota",
  credit_balance_exhausted: "insufficient_quota",
  quota_exceeded: "insufficient_quota",
  rate_limit_error: "rate_limit_exceeded",
  resource_exhausted: "insufficient_quota",
};

const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  context_length_exceeded:
    "Conversation too long for this model. Start a new chat or switch models.",
  insufficient_quota: "Exceeded your current quota for this provider.",
  invalid_api_key: "Invalid API key. Update it in Admin → Models.",
  overloaded_error: "Model temporarily unavailable. Try again shortly.",
  rate_limit_exceeded: "Rate limit reached. Wait a moment and try again.",
};

const FORMATTED_MODEL_ERROR_LINES = new Set<string>([
  DEFAULT_FALLBACK_MESSAGE,
  "Model request failed",
  ...Object.values(FRIENDLY_ERROR_MESSAGES),
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringField(
  value: Record<string, unknown>,
  key: string
): string | undefined {
  const field = value[key];
  if (typeof field !== "string") {
    return undefined;
  }
  const trimmed = field.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeErrorCode(code: string | undefined) {
  if (!code) {
    return;
  }
  return code.trim().toLowerCase().replaceAll(" ", "_");
}

function extractUrlFromMessage(message: string) {
  const match = message.match(/https?:\/\/\S+/);
  return match?.[0];
}

function stripDocsSuffix(message: string) {
  return message
    .replace(
      /\s*For more information on this error, read the docs:\s*\S+\.?/i,
      ""
    )
    .replace(/\s*See\s+https?:\/\/\S+\s*\.?/i, "")
    .trim();
}

function resolveFriendlyErrorCode(code: string | undefined) {
  const normalized = normalizeErrorCode(code);
  if (!normalized) {
    return;
  }
  return FRIENDLY_ERROR_CODE_ALIASES[normalized] ?? normalized;
}

function isQuotaExceededMessage(message: string) {
  return /exceeded your current quota|quota has been exceeded|resource has been exhausted|credit balance is too low|insufficient credits?|insufficient funds|purchase credits|plans?\s*&\s*billing|check your plan and billing/i.test(
    message
  );
}

function friendlyTitleForCode(code: string | undefined) {
  const resolvedCode = resolveFriendlyErrorCode(code);
  if (!resolvedCode) {
    return;
  }
  return FRIENDLY_ERROR_TITLES[resolvedCode];
}

function friendlyMessageForCode(code: string | undefined) {
  const resolvedCode = resolveFriendlyErrorCode(code);
  if (!resolvedCode) {
    return;
  }
  return FRIENDLY_ERROR_MESSAGES[resolvedCode];
}

function extractNestedProviderError(
  value: unknown
): { message?: string; code?: string } | null {
  if (!isRecord(value)) {
    return null;
  }

  const nestedError = value.error;
  if (isRecord(nestedError)) {
    return {
      code:
        readStringField(nestedError, "code") ??
        readStringField(nestedError, "type") ??
        readStringField(nestedError, "status"),
      message: readStringField(nestedError, "message"),
    };
  }

  if (typeof nestedError === "string" && nestedError.trim()) {
    return { message: nestedError.trim() };
  }

  const message =
    readStringField(value, "message") ??
    readStringField(value, "error_message");
  const code =
    readStringField(value, "code") ??
    readStringField(value, "type") ??
    readStringField(value, "status");

  if (message || code) {
    return { code, message };
  }

  return null;
}

function presentationFromProviderError(input: {
  message?: string;
  code?: string;
  fallbackTitle?: string;
}): ModelErrorPresentation | null {
  const rawMessage = input.message?.trim();
  const cleanedMessage = rawMessage ? stripDocsSuffix(rawMessage) : undefined;
  const code = normalizeErrorCode(input.code);
  const quotaFromMessage =
    !friendlyMessageForCode(code) && cleanedMessage
      ? isQuotaExceededMessage(cleanedMessage)
      : false;
  const effectiveCode = quotaFromMessage ? "insufficient_quota" : code;
  const title =
    friendlyTitleForCode(effectiveCode) ??
    input.fallbackTitle ??
    (effectiveCode ? effectiveCode.replaceAll("_", " ") : undefined);
  const message =
    friendlyMessageForCode(effectiveCode) ??
    cleanedMessage ??
    (title ? undefined : DEFAULT_FALLBACK_MESSAGE);

  if (!title && !message) {
    return null;
  }

  if (!(effectiveCode || quotaFromMessage || input.fallbackTitle)) {
    return null;
  }

  const resolvedTitle = title ?? "Model request failed";
  const resolvedMessage = message ?? DEFAULT_FALLBACK_MESSAGE;
  const docsUrl = rawMessage ? extractUrlFromMessage(rawMessage) : undefined;

  return {
    message: resolvedMessage,
    title: resolvedTitle,
    ...(code || quotaFromMessage ? { code: effectiveCode ?? code } : {}),
    ...(docsUrl ? { docsUrl } : {}),
  };
}

function parseJsonErrorPayload(text: string): ModelErrorPresentation | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parseModelErrorPresentation(parsed);
  } catch {
    return null;
  }
}

function parseApiCallError(error: unknown): ModelErrorPresentation | null {
  if (!isRecord(error)) {
    return null;
  }

  const responseBody = readStringField(error, "responseBody");
  if (responseBody) {
    const fromBody =
      parseJsonErrorPayload(responseBody) ??
      presentationFromProviderError({ message: responseBody });
    if (fromBody) {
      return fromBody;
    }
  }

  const data = error.data;
  const fromData = extractNestedProviderError(data);
  if (fromData) {
    return presentationFromProviderError(fromData);
  }

  return null;
}

export function parseModelErrorPresentation(
  error: unknown
): ModelErrorPresentation | null {
  if (error == null) {
    return null;
  }

  if (typeof error === "string") {
    return parseJsonErrorPayload(error);
  }

  if (error instanceof Error) {
    const fromMessage =
      parseJsonErrorPayload(error.message) ??
      presentationFromProviderError({
        message: stripDocsSuffix(error.message),
      });
    if (fromMessage) {
      return fromMessage;
    }
  }

  const fromApiCall = parseApiCallError(error);
  if (fromApiCall) {
    return fromApiCall;
  }

  const nested = extractNestedProviderError(error);
  if (nested) {
    return presentationFromProviderError(nested);
  }

  if (error instanceof Error) {
    return presentationFromProviderError({
      fallbackTitle: "Model request failed",
      message: error.message,
    });
  }

  if (isRecord(error)) {
    const stringified = JSON.stringify(error);
    return (
      parseJsonErrorPayload(stringified) ??
      presentationFromProviderError({ message: stringified })
    );
  }

  return null;
}

export function parseModelErrorFromText(
  text: string
): ModelErrorPresentation | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const fromJson = parseJsonErrorPayload(trimmed);
  if (fromJson) {
    return fromJson;
  }

  if (
    FORMATTED_MODEL_ERROR_LINES.has(trimmed) ||
    isQuotaExceededMessage(trimmed)
  ) {
    return presentationFromProviderError({
      fallbackTitle:
        trimmed === DEFAULT_FALLBACK_MESSAGE ||
        trimmed === "Model request failed"
          ? "Model request failed"
          : undefined,
      message: stripDocsSuffix(trimmed),
    });
  }

  return null;
}

function isModelErrorPresentation(
  value: unknown
): value is ModelErrorPresentation {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    typeof value.message === "string"
  );
}

export function formatModelErrorLine(
  error: ModelErrorPresentation | unknown,
  fallback = DEFAULT_FALLBACK_MESSAGE
): string {
  const presentation = isModelErrorPresentation(error)
    ? error
    : parseModelErrorPresentation(error);

  if (!presentation) {
    return fallback;
  }

  const friendlyLine = friendlyMessageForCode(presentation.code);
  if (friendlyLine) {
    return friendlyLine;
  }

  if (presentation.message === presentation.title) {
    return presentation.message || presentation.title || fallback;
  }

  if (
    presentation.title &&
    presentation.message.startsWith(presentation.title)
  ) {
    return presentation.message;
  }

  if (presentation.message.length <= 96) {
    return presentation.message;
  }

  return presentation.title || presentation.message || fallback;
}

export function formatModelErrorMessage(
  error: unknown,
  fallback = DEFAULT_FALLBACK_MESSAGE
): string {
  return formatModelErrorLine(error, fallback);
}

export function formatLlmProviderErrorMessage(
  body: string,
  fallback: string
): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return formatModelErrorMessage(trimmed, fallback);
  }

  return trimmed;
}

export function isChatRequestCancelledError(error: unknown): boolean {
  if (error == null) {
    return false;
  }

  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (record.isAborted === true) {
      return true;
    }
    if (record.name === "AbortError") {
      return true;
    }
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return true;
    }
    const message = error.message.toLowerCase();
    if (
      message.includes("aborted") ||
      message.includes("cancelled") ||
      message.includes("canceled")
    ) {
      return true;
    }
  }

  return false;
}
