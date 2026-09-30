import { z } from "zod";
import { MAX_LIBRARY_FILE_BYTES } from "@/shared/library/constants";

export const GENERATE_IMAGE_SIZES = [
  "1024x1024",
  "1536x1024",
  "1024x1536",
] as const;

export type GenerateImageSize = (typeof GENERATE_IMAGE_SIZES)[number];

export const MAX_IMAGE_PROMPT_LENGTH = 4000;

export const generateImageInputSchema = z.object({
  filename: z.string().min(1).max(180).optional(),
  prompt: z.string().min(1).max(MAX_IMAGE_PROMPT_LENGTH),
  size: z.enum(GENERATE_IMAGE_SIZES).optional(),
});

export type GenerateImageToolInput = z.infer<typeof generateImageInputSchema>;

export type GenerateImageToolOutput = {
  id: string;
  name: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  prompt: string;
  revisedPrompt?: string;
  contextForLlm: string;
};

export function imageFileNameFromPrompt(prompt: string): string {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${slug || "generated-image"}.png`;
}

export function normalizeGenerateImageInput(
  input: GenerateImageToolInput
): GenerateImageToolInput | { error: string; contextForLlm: string } {
  const parsed = generateImageInputSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.errors
      .map((issue) => issue.message)
      .join("; ");
    return { contextForLlm: message, error: message };
  }

  const prompt = parsed.data.prompt.trim();
  if (!prompt) {
    const message = "Prompt is required";
    return { contextForLlm: message, error: message };
  }

  const filename = parsed.data.filename?.trim();
  return {
    filename: filename && filename.length > 0 ? filename : undefined,
    prompt,
    size: parsed.data.size,
  };
}

export function toGenerateImageModelText(_output: GenerateImageToolOutput) {
  return "Image ready. Shown inline in chat. Describe the visual in your message if helpful — no download link, filename, or markdown image syntax.";
}

export const GENERATE_IMAGE_RETRY_BLOCKED_MESSAGE =
  "Image generation already failed in this turn. Do not retry automatically — explain the failure to the user and ask them to send a new message with a revised prompt.";

export function isFailedGenerateImageResult(result: unknown): boolean {
  if (!result || typeof result !== "object") {
    return false;
  }
  const record = result as { error?: unknown };
  return typeof record.error === "string" && record.error.trim().length > 0;
}

export function isSuccessfulGenerateImageOutput(
  output: unknown
): output is GenerateImageToolOutput {
  if (!output || typeof output !== "object") {
    return false;
  }
  const record = output as GenerateImageToolOutput & { error?: string };
  if (typeof record.error === "string" && record.error.trim()) {
    return false;
  }
  return typeof record.url === "string" && record.url.trim().length > 0;
}

export function assertGeneratedImageWithinLibraryLimit(sizeBytes: number) {
  if (sizeBytes > MAX_LIBRARY_FILE_BYTES) {
    return {
      contextForLlm: `Generated image exceeds ${MAX_LIBRARY_FILE_BYTES} bytes`,
      error: `Generated image exceeds ${MAX_LIBRARY_FILE_BYTES} bytes`,
    };
  }
  return null;
}
