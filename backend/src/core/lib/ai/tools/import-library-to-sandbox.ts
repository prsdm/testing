import { z } from "zod";
import { defaultSandboxPathForLibraryFile } from "@/core/lib/sandbox/import-library-file-to-sandbox";

export const importLibraryToSandboxInputSchema = z.object({
  libraryFileId: z.string().uuid(),
  sandboxPath: z
    .string()
    .max(240)
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        value.trim().replaceAll("\\", "/").startsWith("outputs/"),
      { message: "sandboxPath must be a file under outputs/." }
    ),
});

export type ImportLibraryToSandboxToolInput = z.infer<
  typeof importLibraryToSandboxInputSchema
>;

export type ImportLibraryToSandboxToolOutput = {
  libraryFileId: string;
  sandboxPath: string;
  sizeBytes: number;
  reusedExisting: boolean;
  contextForLlm: string;
};

export function importLibraryToSandboxSuccessContextForLlm(args: {
  libraryFileId: string;
  sandboxPath: string;
  reusedExisting: boolean;
}): string {
  const reuseNote = args.reusedExisting
    ? " Reused the existing sandbox copy."
    : "";
  return `Ready to edit at sandboxPath ${args.sandboxPath} (libraryFileId ${args.libraryFileId}).${reuseNote} Use sandboxExec with the appropriate skill to edit, then saveToLibrary when done.`;
}

export function normalizeImportLibraryToSandboxInput(input: unknown):
  | {
      libraryFileId: string;
      sandboxPath?: string;
    }
  | { error: string; contextForLlm: string } {
  const parsed = importLibraryToSandboxInputSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.errors
      .map((issue) => issue.message)
      .join("; ");
    return { contextForLlm: message, error: message };
  }

  return {
    libraryFileId: parsed.data.libraryFileId,
    sandboxPath: parsed.data.sandboxPath?.trim().replaceAll("\\", "/"),
  };
}

export function resolveImportSandboxPath(args: {
  name: string;
  sandboxPath?: string;
}): string {
  return args.sandboxPath ?? defaultSandboxPathForLibraryFile(args.name);
}
