import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { resolveCanonicalModelId } from "@/shared/ai/model-id-migrations";
import { allowedModelIds, chatModels, titleModel } from "@/shared/ai/models";
import type { ResolvedTenantLlmKeys } from "../db/llm-provider-queries";

const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

type LanguageModelProvider = {
  languageModel: (modelId: string) => LanguageModelV4;
};

function createProviderFromKeys(
  keys: ResolvedTenantLlmKeys
): LanguageModelProvider {
  const languageModels: Record<string, LanguageModelV4> = {};

  if (keys.openai) {
    const openai = createOpenAI({ apiKey: keys.openai });
    for (const model of chatModels) {
      if (model.provider !== "openai") {
        continue;
      }
      const apiModelId = model.id.split("/").slice(1).join("/");
      languageModels[model.id] = openai(
        apiModelId
      ) as unknown as LanguageModelV4;
    }
    const titleApiId = titleModel.id.split("/").slice(1).join("/");
    languageModels[titleModel.id] = openai(
      titleApiId
    ) as unknown as LanguageModelV4;
  }

  if (keys.anthropic) {
    const anthropic = createAnthropic({ apiKey: keys.anthropic });
    for (const model of chatModels) {
      if (model.provider !== "anthropic") {
        continue;
      }
      const apiModelId = model.id.split("/").slice(1).join("/");
      languageModels[model.id] = anthropic(
        apiModelId
      ) as unknown as LanguageModelV4;
    }
  }

  if (keys.google) {
    const google = createGoogleGenerativeAI({ apiKey: keys.google });
    for (const model of chatModels) {
      if (model.provider !== "google") {
        continue;
      }
      const apiModelId = model.id.split("/").slice(1).join("/");
      languageModels[model.id] = google(
        apiModelId
      ) as unknown as LanguageModelV4;
    }
  }

  return {
    languageModel(modelId: string) {
      const model = languageModels[modelId];
      if (!model) {
        throw new Error(`Unknown chat model: ${modelId}`);
      }
      return model;
    },
  };
}

export const myProvider: LanguageModelProvider | null = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel: mockTitleModel } =
        require("./models.mock") as typeof import("./models.mock");
      return {
        languageModel(modelId: string) {
          if (modelId === titleModel.id || modelId === "title-model") {
            return mockTitleModel as unknown as LanguageModelV4;
          }
          return chatModel as unknown as LanguageModelV4;
        },
      };
    })()
  : null;

export function createLanguageModel(
  modelId: string,
  keys: ResolvedTenantLlmKeys
) {
  const canonicalModelId = resolveCanonicalModelId(modelId);
  if (
    !allowedModelIds.has(canonicalModelId) &&
    canonicalModelId !== titleModel.id
  ) {
    throw new Error(`Unknown chat model: ${modelId}`);
  }

  const provider = createProviderFromKeys(keys);
  return provider.languageModel(canonicalModelId);
}

export function getLanguageModel(modelId: string, keys: ResolvedTenantLlmKeys) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("chat-model");
  }

  return createLanguageModel(modelId, keys);
}

export function getTitleModel(keys: ResolvedTenantLlmKeys) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }

  return createLanguageModel(titleModel.id, keys);
}
