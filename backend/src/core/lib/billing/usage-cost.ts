/**
 * Model rates ($ / 1M tokens) for usage metering.
 *
 * Sources:
 * - OpenAI: https://developers.openai.com/api/docs/pricing
 * - Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
 * - Google: https://ai.google.dev/gemini-api/docs/pricing
 *
 * Estimates for included-usage % — not invoices. Cache storage hourly fees
 * are omitted (we only meter token reads/writes reported on the request).
 */

export type PricingServiceTier = "standard" | "batch" | "flex" | "fast";
export type CacheWriteTtl = "5m" | "1h";

type CacheableRates = {
  input: number;
  output: number;
  /** Cache hit / cached input (exact list price). */
  cachedInput: number;
  /**
   * Cache write / creation. Only set when the vendor lists a write price
   * (Anthropic 5m/1h, OpenAI "cache writes"). When omitted, writes bill at
   * `input` — never invent a multiplier.
   */
  cacheWrite5m?: number;
  cacheWrite1h?: number;
};

export type TokenRateCard = CacheableRates & {
  /**
   * When total prompt input tokens exceed this, use `longContext` rates
   * for the whole request (OpenAI ~272k, Gemini Pro ~200k).
   */
  longContextInputTokens?: number;
  longContext?: CacheableRates & {
    batch?: CacheableRates;
    flex?: CacheableRates;
    fast?: CacheableRates;
  };
  /** Exact list prices for Batch / Flex / Fast|Priority — no invented halves. */
  batch?: CacheableRates;
  flex?: CacheableRates;
  fast?: CacheableRates;
};

const DEFAULT_RATES: TokenRateCard = {
  cachedInput: 0.05,
  input: 0.5,
  output: 1.5,
};

/**
 * Exact rates keyed by Kimiro chat model ids (`provider/model`).
 * Cache fields are copied from vendor tables only:
 * - OpenAI: "cached input" / "cache writes" columns (writes omitted when table shows "-")
 * - Anthropic: "Cache Hits" / "5m Cache Writes" / "1h Cache Writes" columns
 * - Gemini: "Context caching price" (no separate write column; writes → input rate)
 */
const MODEL_RATES: Record<string, TokenRateCard> = {
  // —— Anthropic —— https://platform.claude.com/docs/en/about-claude/pricing
  // Cache columns from model pricing table. Batch cache = official multipliers
  // (0.1× / 1.25× / 2×) on listed batch base input (docs: multipliers stack).
  // Sonnet 5 intro through 2026-08-31.
  "anthropic/claude-fable-5": {
    batch: {
      cachedInput: 0.5,
      cacheWrite1h: 10,
      cacheWrite5m: 6.25,
      input: 5,
      output: 25,
    },
    cachedInput: 1,
    cacheWrite1h: 20,
    cacheWrite5m: 12.5,
    input: 10,
    output: 50,
  },
  "anthropic/claude-haiku-4-5": {
    batch: {
      cachedInput: 0.05,
      cacheWrite1h: 1,
      cacheWrite5m: 0.625,
      input: 0.5,
      output: 2.5,
    },
    cachedInput: 0.1,
    cacheWrite1h: 2,
    cacheWrite5m: 1.25,
    input: 1,
    output: 5,
  },
  "anthropic/claude-opus-4-8": {
    batch: {
      cachedInput: 0.25,
      cacheWrite1h: 5,
      cacheWrite5m: 3.125,
      input: 2.5,
      output: 12.5,
    },
    cachedInput: 0.5,
    cacheWrite1h: 10,
    cacheWrite5m: 6.25,
    fast: {
      cachedInput: 1,
      cacheWrite1h: 20,
      cacheWrite5m: 12.5,
      input: 10,
      output: 50,
    },
    input: 5,
    output: 25,
  },
  "anthropic/claude-opus-5": {
    batch: {
      cachedInput: 0.25,
      cacheWrite1h: 5,
      cacheWrite5m: 3.125,
      input: 2.5,
      output: 12.5,
    },
    cachedInput: 0.5,
    cacheWrite1h: 10,
    cacheWrite5m: 6.25,
    // Fast mode lists $10/$50; cache = 0.1× / 1.25× / 2× of fast input
    fast: {
      cachedInput: 1,
      cacheWrite1h: 20,
      cacheWrite5m: 12.5,
      input: 10,
      output: 50,
    },
    input: 5,
    output: 25,
  },
  "anthropic/claude-sonnet-5": {
    batch: {
      cachedInput: 0.1,
      cacheWrite1h: 2,
      cacheWrite5m: 1.25,
      input: 1,
      output: 5,
    },
    cachedInput: 0.2,
    cacheWrite1h: 4,
    cacheWrite5m: 2.5,
    input: 2,
    output: 10,
  },
  "google/gemini-3-flash-preview": {
    // Batch/Flex docs: cache same as Standard $0.05
    batch: { cachedInput: 0.05, input: 0.25, output: 1.5 },
    cachedInput: 0.05,
    fast: { cachedInput: 0.09, input: 0.9, output: 5.4 },
    flex: { cachedInput: 0.05, input: 0.25, output: 1.5 },
    input: 0.5,
    output: 3,
  },
  "google/gemini-3.1-flash-lite": {
    batch: { cachedInput: 0.0125, input: 0.125, output: 0.75 },
    cachedInput: 0.025,
    fast: { cachedInput: 0.045, input: 0.45, output: 2.7 },
    flex: { cachedInput: 0.0125, input: 0.125, output: 0.75 },
    input: 0.25,
    output: 1.5,
  },
  "google/gemini-3.1-pro-preview": {
    batch: { cachedInput: 0.2, input: 1, output: 6 },
    cachedInput: 0.2,
    fast: { cachedInput: 0.36, input: 3.6, output: 21.6 },
    flex: { cachedInput: 0.2, input: 1, output: 6 },
    input: 2,
    longContext: {
      batch: { cachedInput: 0.4, input: 2, output: 9 },
      cachedInput: 0.4,
      fast: { cachedInput: 0.72, input: 7.2, output: 32.4 },
      flex: { cachedInput: 0.4, input: 2, output: 9 },
      input: 4,
      output: 18,
    },
    longContextInputTokens: 200_000,
    output: 12,
  },

  // —— Google Gemini —— https://ai.google.dev/gemini-api/docs/pricing
  // cachedInput = "Context caching price" (token use). No write column.
  "google/gemini-3.5-flash": {
    batch: { cachedInput: 0.075, input: 0.75, output: 4.5 },
    cachedInput: 0.15,
    fast: { cachedInput: 0.27, input: 2.7, output: 16.2 },
    flex: { cachedInput: 0.08, input: 0.75, output: 4.5 },
    input: 1.5,
    output: 9,
  },
  "openai/gpt-4.1": {
    batch: { cachedInput: 0.5, input: 1, output: 4 },
    cachedInput: 0.5,
    fast: { cachedInput: 0.875, input: 3.5, output: 14 },
    input: 2,
    output: 8,
  },
  "openai/gpt-4o": {
    batch: { cachedInput: 1.25, input: 1.25, output: 5 },
    cachedInput: 1.25,
    fast: { cachedInput: 2.125, input: 4.25, output: 17 },
    input: 2.5,
    output: 10,
  },
  // —— OpenAI —— https://developers.openai.com/api/docs/pricing
  "openai/gpt-4o-mini": {
    // Batch table lists no cached input for 4o-mini → keep standard cachedInput
    batch: { cachedInput: 0.075, input: 0.075, output: 0.3 },
    cachedInput: 0.075,
    fast: { cachedInput: 0.125, input: 0.25, output: 1 },
    input: 0.15,
    output: 0.6,
  },
  "openai/gpt-5": {
    batch: { cachedInput: 0.0625, input: 0.625, output: 5 },
    cachedInput: 0.125,
    // cache writes: "-" on OpenAI table
    fast: { cachedInput: 0.25, input: 2.5, output: 20 },
    flex: { cachedInput: 0.0625, input: 0.625, output: 5 },
    input: 1.25,
    output: 10,
  },
  "openai/gpt-5.1": {
    batch: { cachedInput: 0.0625, input: 0.625, output: 5 },
    cachedInput: 0.125,
    fast: { cachedInput: 0.25, input: 2.5, output: 20 },
    flex: { cachedInput: 0.0625, input: 0.625, output: 5 },
    input: 1.25,
    output: 10,
  },
  "openai/gpt-5.2": {
    batch: { cachedInput: 0.0875, input: 0.875, output: 7 },
    cachedInput: 0.175,
    fast: { cachedInput: 0.35, input: 3.5, output: 28 },
    flex: { cachedInput: 0.0875, input: 0.875, output: 7 },
    input: 1.75,
    output: 14,
  },
  "openai/gpt-5.4": {
    batch: { cachedInput: 0.13, input: 1.25, output: 7.5 },
    cachedInput: 0.25,
    fast: { cachedInput: 0.5, input: 5, output: 30 },
    flex: { cachedInput: 0.13, input: 1.25, output: 7.5 },
    input: 2.5,
    longContext: {
      batch: { cachedInput: 0.25, input: 2.5, output: 11.25 },
      cachedInput: 0.5,
      flex: { cachedInput: 0.25, input: 2.5, output: 11.25 },
      input: 5,
      output: 22.5,
    },
    longContextInputTokens: 272_000,
    output: 15,
  },
  "openai/gpt-5.4-mini": {
    batch: { cachedInput: 0.0375, input: 0.375, output: 2.25 },
    cachedInput: 0.075,
    fast: { cachedInput: 0.15, input: 1.5, output: 9 },
    flex: { cachedInput: 0.0375, input: 0.375, output: 2.25 },
    input: 0.75,
    output: 4.5,
  },
  "openai/gpt-5.4-nano": {
    batch: { cachedInput: 0.01, input: 0.1, output: 0.625 },
    cachedInput: 0.02,
    flex: { cachedInput: 0.01, input: 0.1, output: 0.625 },
    input: 0.2,
    output: 1.25,
  },
  "openai/gpt-5.5": {
    batch: { cachedInput: 0.25, input: 2.5, output: 15 },
    cachedInput: 0.5,
    fast: { cachedInput: 1.25, input: 12.5, output: 75 },
    flex: { cachedInput: 0.25, input: 2.5, output: 15 },
    input: 5,
    longContext: {
      batch: { cachedInput: 0.5, input: 5, output: 22.5 },
      cachedInput: 1,
      flex: { cachedInput: 0.5, input: 5, output: 22.5 },
      input: 10,
      output: 45,
    },
    longContextInputTokens: 272_000,
    output: 30,
  },
  "openai/gpt-5.6": {
    batch: {
      cachedInput: 0.25,
      cacheWrite5m: 3.125,
      input: 2.5,
      output: 15,
    },
    cachedInput: 0.5,
    cacheWrite5m: 6.25,
    fast: {
      cachedInput: 1,
      cacheWrite5m: 12.5,
      input: 10,
      output: 60,
    },
    flex: {
      cachedInput: 0.25,
      cacheWrite5m: 3.125,
      input: 2.5,
      output: 15,
    },
    input: 5,
    longContext: {
      batch: {
        cachedInput: 0.5,
        cacheWrite5m: 6.25,
        input: 5,
        output: 22.5,
      },
      cachedInput: 1,
      cacheWrite5m: 12.5,
      flex: {
        cachedInput: 0.5,
        cacheWrite5m: 6.25,
        input: 5,
        output: 22.5,
      },
      input: 10,
      output: 45,
    },
    longContextInputTokens: 272_000,
    output: 30,
  },
  "openai/gpt-5.6-luna": {
    batch: {
      cachedInput: 0.01,
      cacheWrite5m: 0.125,
      input: 0.1,
      output: 0.6,
    },
    cachedInput: 0.02,
    cacheWrite5m: 0.25,
    fast: {
      cachedInput: 0.04,
      cacheWrite5m: 0.5,
      input: 0.4,
      output: 2.4,
    },
    flex: {
      cachedInput: 0.01,
      cacheWrite5m: 0.125,
      input: 0.1,
      output: 0.6,
    },
    input: 0.2,
    longContext: {
      batch: {
        cachedInput: 0.02,
        cacheWrite5m: 0.25,
        input: 0.2,
        output: 0.9,
      },
      cachedInput: 0.04,
      cacheWrite5m: 0.5,
      flex: {
        cachedInput: 0.02,
        cacheWrite5m: 0.25,
        input: 0.2,
        output: 0.9,
      },
      input: 0.4,
      output: 1.8,
    },
    longContextInputTokens: 272_000,
    output: 1.2,
  },
  "openai/gpt-5.6-sol": {
    batch: {
      cachedInput: 0.25,
      cacheWrite5m: 3.125,
      input: 2.5,
      output: 15,
    },
    cachedInput: 0.5,
    cacheWrite5m: 6.25,
    fast: {
      cachedInput: 1,
      cacheWrite5m: 12.5,
      input: 10,
      output: 60,
    },
    flex: {
      cachedInput: 0.25,
      cacheWrite5m: 3.125,
      input: 2.5,
      output: 15,
    },
    input: 5,
    longContext: {
      batch: {
        cachedInput: 0.5,
        cacheWrite5m: 6.25,
        input: 5,
        output: 22.5,
      },
      cachedInput: 1,
      cacheWrite5m: 12.5,
      flex: {
        cachedInput: 0.5,
        cacheWrite5m: 6.25,
        input: 5,
        output: 22.5,
      },
      input: 10,
      output: 45,
    },
    longContextInputTokens: 272_000,
    output: 30,
  },
  "openai/gpt-5.6-terra": {
    batch: {
      cachedInput: 0.1,
      cacheWrite5m: 1.25,
      input: 1,
      output: 6,
    },
    cachedInput: 0.2,
    cacheWrite5m: 2.5,
    fast: { cachedInput: 0.4, cacheWrite5m: 5, input: 4, output: 24 },
    flex: {
      cachedInput: 0.1,
      cacheWrite5m: 1.25,
      input: 1,
      output: 6,
    },
    input: 2,
    longContext: {
      batch: {
        cachedInput: 0.2,
        cacheWrite5m: 2.5,
        input: 2,
        output: 9,
      },
      cachedInput: 0.4,
      cacheWrite5m: 5,
      flex: {
        cachedInput: 0.2,
        cacheWrite5m: 2.5,
        input: 2,
        output: 9,
      },
      input: 4,
      output: 18,
    },
    longContextInputTokens: 272_000,
    output: 12,
  },
};

/** Serper / Brave-class search ~$0.002–0.005; use low end for included pool. */
export const WEB_SEARCH_COST_USD_PER_QUERY = 0.002;

/**
 * gpt-image-2 estimated $/image at medium quality (OpenAI pricing calculator).
 * @see https://developers.openai.com/api/docs/pricing
 */
export const IMAGE_GENERATION_COST_USD_BY_SIZE = {
  "1024x1024": 0.053,
  "1024x1536": 0.041,
  "1536x1024": 0.041,
} as const;

export type BillableImageGenerationSize =
  keyof typeof IMAGE_GENERATION_COST_USD_BY_SIZE;

export const DEFAULT_IMAGE_GENERATION_SIZE: BillableImageGenerationSize =
  "1024x1024";

export function resolveImageGenerationCostUsd(size: string | null | undefined) {
  if (size && Object.hasOwn(IMAGE_GENERATION_COST_USD_BY_SIZE, size)) {
    return IMAGE_GENERATION_COST_USD_BY_SIZE[
      size as BillableImageGenerationSize
    ];
  }
  return IMAGE_GENERATION_COST_USD_BY_SIZE[DEFAULT_IMAGE_GENERATION_SIZE];
}

export function estimateImageGenerationCostUsdMicros(
  generations: ReadonlyArray<{ size?: string | null | undefined }>
) {
  let usd = 0;
  for (const generation of generations) {
    usd += resolveImageGenerationCostUsd(generation.size);
  }
  return usdToMicros(usd);
}

/** Default included API + web usage **per seat** per billing period ($18). */
export const DEFAULT_MONTHLY_ALLOWANCE_USD_CENTS = 1800;
export const DEFAULT_PER_SEAT_ALLOWANCE_USD_CENTS =
  DEFAULT_MONTHLY_ALLOWANCE_USD_CENTS;

export function usdToMicros(usd: number) {
  return Math.max(0, Math.round(usd * 1_000_000));
}

export function microsToUsd(micros: number) {
  return micros / 1_000_000;
}

export function centsToMicros(cents: number) {
  return Math.max(0, cents) * 10_000;
}

function pickTierRates(card: CacheableRates): {
  input: number;
  output: number;
  cachedInput: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
} {
  // When vendor has no write column ("-"), bill writes at uncached input.
  const cacheWrite5m = card.cacheWrite5m ?? card.input;
  const cacheWrite1h = card.cacheWrite1h ?? card.cacheWrite5m ?? card.input;
  return {
    cachedInput: card.cachedInput,
    cacheWrite1h,
    cacheWrite5m,
    input: card.input,
    output: card.output,
  };
}

function resolveBaseCard(modelId: string | null | undefined): TokenRateCard {
  if (!modelId) {
    return DEFAULT_RATES;
  }
  const exact = MODEL_RATES[modelId];
  if (exact) {
    return exact;
  }
  const lower = modelId.toLowerCase();
  if (lower.includes("flash-lite")) {
    return MODEL_RATES["google/gemini-3.1-flash-lite"];
  }
  if (lower.includes("gemini-3.5-flash") || lower.includes("3.5-flash")) {
    return MODEL_RATES["google/gemini-3.5-flash"];
  }
  if (lower.includes("gemini-3-flash") || lower.includes("3-flash-preview")) {
    return MODEL_RATES["google/gemini-3-flash-preview"];
  }
  if (lower.includes("gemini") && lower.includes("pro")) {
    return MODEL_RATES["google/gemini-3.1-pro-preview"];
  }
  if (lower.includes("luna") || lower.includes("nano")) {
    return MODEL_RATES["openai/gpt-5.6-luna"];
  }
  if (lower.includes("mini")) {
    return {
      cachedInput: 0.02,
      input: 0.2,
      output: 1.2,
    };
  }
  if (lower.includes("terra")) {
    return MODEL_RATES["openai/gpt-5.6-terra"];
  }
  if (lower.includes("fable") || lower.includes("mythos")) {
    return MODEL_RATES["anthropic/claude-fable-5"];
  }
  if (lower.includes("opus")) {
    return MODEL_RATES["anthropic/claude-opus-4-8"];
  }
  if (lower.includes("sonnet")) {
    return MODEL_RATES["anthropic/claude-sonnet-5"];
  }
  if (lower.includes("haiku")) {
    return MODEL_RATES["anthropic/claude-haiku-4-5"];
  }
  if (lower.includes("sol") || lower.includes("gpt-5.5")) {
    return MODEL_RATES["openai/gpt-5.5"];
  }
  if (lower.includes("gpt-5.6")) {
    return MODEL_RATES["openai/gpt-5.6-sol"];
  }
  if (lower.includes("gpt-5.4")) {
    return MODEL_RATES["openai/gpt-5.4"];
  }
  if (lower.includes("gpt-5.2")) {
    return MODEL_RATES["openai/gpt-5.2"];
  }
  if (lower.includes("gpt-5.1") || /gpt-5(?!\.\d)/.test(lower)) {
    return MODEL_RATES["openai/gpt-5"];
  }
  if (lower.includes("flash")) {
    return MODEL_RATES["google/gemini-3-flash-preview"];
  }
  return DEFAULT_RATES;
}

/**
 * Resolve effective per-MTok rates after service tier + long-context.
 * Uses only listed card rates — never invents 1.25× / 50% fallbacks.
 */
export function resolveEffectiveRates(args: {
  modelId: string | null | undefined;
  inputTokens?: number;
  serviceTier?: PricingServiceTier;
}): {
  input: number;
  output: number;
  cachedInput: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
} {
  const card = resolveBaseCard(args.modelId);
  const inputTokens = Math.max(0, args.inputTokens ?? 0);
  const long = card.longContext;
  const useLong =
    long != null &&
    card.longContextInputTokens != null &&
    inputTokens > card.longContextInputTokens;

  const tier = args.serviceTier ?? "standard";
  let active: CacheableRates = card;

  if (useLong && long) {
    if (tier === "batch" && long.batch) {
      active = long.batch;
    } else if (tier === "flex" && (long.flex || long.batch)) {
      active = long.flex ?? long.batch ?? long;
    } else if (tier === "fast" && (long.fast || card.fast)) {
      active = long.fast ?? card.fast ?? long;
    } else {
      active = long;
    }
  } else if (tier === "batch" && card.batch) {
    active = card.batch;
  } else if (tier === "flex" && (card.flex || card.batch)) {
    active = card.flex ?? card.batch ?? card;
  } else if (tier === "fast" && card.fast) {
    active = card.fast;
  }

  return pickTierRates(active);
}

/** @deprecated Prefer resolveEffectiveRates — kept for simple input/output lookups. */
export function resolveModelRatesUsdPerMillion(
  modelId: string | null | undefined
) {
  const rates = resolveEffectiveRates({ modelId });
  return { input: rates.input, output: rates.output };
}

export function estimateModelCostUsdMicros(args: {
  modelId: string | null | undefined;
  inputTokens: number;
  outputTokens: number;
  /** Uncached input tokens. If omitted, derived from input − cache. */
  noCacheTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  cacheWriteTtl?: CacheWriteTtl;
  serviceTier?: PricingServiceTier;
}) {
  const inputTokens = Math.max(0, args.inputTokens);
  const outputTokens = Math.max(0, args.outputTokens);
  const cacheRead = Math.max(0, args.cacheReadTokens ?? 0);
  const cacheWrite = Math.max(0, args.cacheWriteTokens ?? 0);
  const noCache =
    args.noCacheTokens == null
      ? Math.max(0, inputTokens - cacheRead - cacheWrite)
      : Math.max(0, args.noCacheTokens);

  const rates = resolveEffectiveRates({
    inputTokens,
    modelId: args.modelId,
    serviceTier: args.serviceTier,
  });
  const writeRate =
    args.cacheWriteTtl === "1h" ? rates.cacheWrite1h : rates.cacheWrite5m;

  const usd =
    (noCache / 1_000_000) * rates.input +
    (cacheRead / 1_000_000) * rates.cachedInput +
    (cacheWrite / 1_000_000) * writeRate +
    (outputTokens / 1_000_000) * rates.output;

  return usdToMicros(usd);
}

export function estimateWebSearchCostUsdMicros(queryCount: number) {
  return usdToMicros(Math.max(0, queryCount) * WEB_SEARCH_COST_USD_PER_QUERY);
}

export function estimateUsageCostUsdMicros(args: {
  modelId: string | null | undefined;
  inputTokens: number;
  outputTokens: number;
  webSearchCount: number;
  imageGenerations?: ReadonlyArray<{ size?: string | null | undefined }>;
  noCacheTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  cacheWriteTtl?: CacheWriteTtl;
  serviceTier?: PricingServiceTier;
}) {
  return (
    estimateModelCostUsdMicros(args) +
    estimateWebSearchCostUsdMicros(args.webSearchCount) +
    estimateImageGenerationCostUsdMicros(args.imageGenerations ?? [])
  );
}

export function usagePercentUsed(args: {
  usedUsdMicros: number;
  allowanceUsdCents: number;
}) {
  const allowanceMicros = centsToMicros(args.allowanceUsdCents);
  if (allowanceMicros <= 0) {
    return 100;
  }
  return Math.min(
    100,
    Math.round((args.usedUsdMicros / allowanceMicros) * 100)
  );
}
