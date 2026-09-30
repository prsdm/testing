import type { LanguageModelUsage } from "@/core/lib/billing/language-model-usage";
import {
  countWebSearchesFromSteps,
  countWebSearchesFromToolParts,
  listBillableImageGenerationsFromToolParts,
  listMeteredSandboxExecsFromToolParts,
  type MeteredToolPart,
} from "@/core/lib/billing/meter-tool-parts";
import type {
  CacheWriteTtl,
  PricingServiceTier,
} from "@/core/lib/billing/usage-cost";
import {
  recordTenantUsageEvent,
  type UsageSource,
  updateTenantUsageEvent,
} from "@/core/lib/db/usage-queries";

export {
  countWebSearchesFromSteps,
  countWebSearchesFromToolParts,
  listBillableImageGenerationsFromToolParts,
  listMeteredSandboxExecsFromToolParts,
} from "@/core/lib/billing/meter-tool-parts";

function readTokenCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (value && typeof value === "object" && "total" in value) {
    const total = (value as { total?: unknown }).total;
    if (typeof total === "number" && Number.isFinite(total)) {
      return Math.max(0, Math.round(total));
    }
  }
  return 0;
}

export function tokensFromLanguageModelUsage(
  usage: LanguageModelUsage | undefined | null
) {
  if (!usage) {
    return {
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      inputTokens: 0,
      noCacheTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
  }
  const inputTokens = readTokenCount(usage.inputTokens);
  const outputTokens = readTokenCount(usage.outputTokens);
  const totalTokens =
    readTokenCount(usage.totalTokens) || inputTokens + outputTokens;

  const details = usage.inputTokenDetails;
  const cacheReadTokens = readTokenCount(details?.cacheReadTokens);
  const cacheWriteTokens = readTokenCount(details?.cacheWriteTokens);
  const noCacheFromDetails = readTokenCount(details?.noCacheTokens);
  const noCacheTokens =
    noCacheFromDetails > 0
      ? noCacheFromDetails
      : Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens);

  return {
    cacheReadTokens,
    cacheWriteTokens,
    inputTokens,
    noCacheTokens,
    outputTokens,
    totalTokens,
  };
}

export type StreamBillingContext = {
  tenantId: string;
  authUserId: string;
  chatId: string;
  source?: UsageSource;
  /** Update an existing row when resuming after tool approval. */
  usageEventId?: string | null;
};

async function resolveLanguageModelUsage(
  usagePromise?: Promise<LanguageModelUsage | undefined | null>
): Promise<LanguageModelUsage | null> {
  if (!usagePromise) {
    return null;
  }
  try {
    const usage = await Promise.race([
      usagePromise,
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 2500);
      }),
    ]);
    return usage ?? null;
  } catch {
    return null;
  }
}

/**
 * Persist estimated usage for a finished agent stream.
 * Never throws to the caller — metering must not break chat.
 */
export async function recordAgentStreamUsage(args: {
  billing: StreamBillingContext;
  modelId: string;
  usagePromise?: Promise<LanguageModelUsage | undefined | null>;
  toolParts?: Array<{ type?: string; input?: unknown; output?: unknown }>;
  /** Counts toward free trial even when token usage is zero. */
  billChatTurn?: boolean;
}): Promise<string | null> {
  if (!args.billing.tenantId) {
    return null;
  }
  try {
    const totalUsage = await resolveLanguageModelUsage(args.usagePromise);
    const tokens = tokensFromLanguageModelUsage(totalUsage);
    const webSearchCount = countWebSearchesFromToolParts(args.toolParts ?? []);
    const imageGenerations = listBillableImageGenerationsFromToolParts(
      args.toolParts ?? []
    );
    const imageGenerationCount = imageGenerations.length;
    const sandboxExecs = listMeteredSandboxExecsFromToolParts(
      args.toolParts ?? []
    );
    const sandboxExecCount = sandboxExecs.length;
    const sandboxExecDurationMs = sandboxExecs.reduce(
      (total, entry) => total + entry.durationMs,
      0
    );

    if (args.billing.usageEventId) {
      const updated = await updateTenantUsageEvent({
        id: args.billing.usageEventId,
        modelId: args.modelId,
        tenantId: args.billing.tenantId,
        ...tokens,
        imageGenerationCount,
        imageGenerations,
        sandboxExecCount,
        sandboxExecDurationMs,
        webSearchCount,
      });
      if (!updated) {
        return args.billing.usageEventId;
      }
      if (updated.costDeltaMicros > 0) {
        const { debitTopUpForOverageEvent } = await import(
          "@/core/lib/db/topup-queries"
        );
        await debitTopUpForOverageEvent({
          eventCostUsdMicros: updated.costDeltaMicros,
          tenantId: args.billing.tenantId,
        });
      }
      return updated.row.id;
    }

    const hasMeteredActivity =
      tokens.inputTokens > 0 ||
      tokens.outputTokens > 0 ||
      webSearchCount > 0 ||
      imageGenerationCount > 0 ||
      sandboxExecCount > 0 ||
      args.billChatTurn;

    if (!hasMeteredActivity) {
      return null;
    }

    const row = await recordTenantUsageEvent({
      authUserId: args.billing.authUserId,
      chatId: args.billing.chatId,
      modelId: args.modelId,
      source: args.billing.source ?? "chat",
      tenantId: args.billing.tenantId,
      ...tokens,
      imageGenerationCount,
      imageGenerations,
      sandboxExecCount,
      sandboxExecDurationMs,
      webSearchCount,
    });
    if (row && row.estimatedCostUsdMicros > 0) {
      const { debitTopUpForOverageEvent } = await import(
        "@/core/lib/db/topup-queries"
      );
      await debitTopUpForOverageEvent({
        eventCostUsdMicros: row.estimatedCostUsdMicros,
        tenantId: args.billing.tenantId,
        usageEventId: row.id,
      });
    }
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Persist estimated usage for a finished streamText turn.
 * Never throws to the caller — metering must not break chat.
 */
export async function recordStreamTextUsage(args: {
  tenantId: string | null | undefined;
  authUserId?: string | null;
  chatId?: string | null;
  source?: UsageSource;
  modelId: string;
  totalUsage?: LanguageModelUsage | null;
  steps?: Parameters<typeof countWebSearchesFromSteps>[0];
  toolParts?: MeteredToolPart[];
  serviceTier?: PricingServiceTier;
  cacheWriteTtl?: CacheWriteTtl;
}) {
  if (!args.tenantId) {
    return;
  }
  try {
    const tokens = tokensFromLanguageModelUsage(args.totalUsage);
    const webSearchCount = args.steps?.length
      ? countWebSearchesFromSteps(args.steps)
      : countWebSearchesFromToolParts(args.toolParts ?? []);
    const imageGenerations = listBillableImageGenerationsFromToolParts(
      args.toolParts ?? []
    );
    const imageGenerationCount = imageGenerations.length;
    const sandboxExecs = listMeteredSandboxExecsFromToolParts(
      args.toolParts ?? []
    );
    const sandboxExecCount = sandboxExecs.length;
    const sandboxExecDurationMs = sandboxExecs.reduce(
      (total, entry) => total + entry.durationMs,
      0
    );
    const row = await recordTenantUsageEvent({
      authUserId: args.authUserId,
      chatId: args.chatId,
      modelId: args.modelId,
      source: args.source ?? "chat",
      tenantId: args.tenantId,
      ...tokens,
      cacheWriteTtl: args.cacheWriteTtl,
      imageGenerationCount,
      imageGenerations,
      sandboxExecCount,
      sandboxExecDurationMs,
      serviceTier: args.serviceTier,
      webSearchCount,
    });
    if (row && row.estimatedCostUsdMicros > 0) {
      const { debitTopUpForOverageEvent } = await import(
        "@/core/lib/db/topup-queries"
      );
      await debitTopUpForOverageEvent({
        eventCostUsdMicros: row.estimatedCostUsdMicros,
        tenantId: args.tenantId,
        usageEventId: row.id,
      });
    }
  } catch {
    // Non-critical: never fail the user-facing stream.
  }
}
