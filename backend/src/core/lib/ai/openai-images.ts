import { Buffer } from "node:buffer";

export const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-2";

export type OpenAiImageGenerationInput = {
  apiKey: string;
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536";
  model?: string;
};

export type OpenAiImageGenerationResult = {
  buffer: Buffer;
  contentType: "image/png";
  revisedPrompt?: string;
};

type OpenAiImageResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
  };
};

export async function generateOpenAiImage(
  args: OpenAiImageGenerationInput
): Promise<OpenAiImageGenerationResult | { error: string }> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    body: JSON.stringify({
      model: args.model?.trim() || DEFAULT_OPENAI_IMAGE_MODEL,
      output_format: "png",
      prompt: args.prompt,
      quality: "medium",
      size: args.size ?? "1024x1024",
    }),
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  let payload: OpenAiImageResponse;
  try {
    payload = (await response.json()) as OpenAiImageResponse;
  } catch {
    return { error: "Image generation returned an invalid response" };
  }

  if (!response.ok) {
    const message =
      payload.error?.message?.trim() ||
      `Image generation failed (${response.status})`;
    return { error: message };
  }

  const b64 = payload.data?.[0]?.b64_json;
  if (!b64) {
    return { error: "Image generation returned no image data" };
  }

  const revisedPrompt = payload.data?.[0]?.revised_prompt;
  return {
    buffer: Buffer.from(b64, "base64"),
    contentType: "image/png",
    revisedPrompt:
      typeof revisedPrompt === "string" && revisedPrompt.trim()
        ? revisedPrompt.trim()
        : undefined,
  };
}
