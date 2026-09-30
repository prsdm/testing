import { z } from "zod";
import { NOTION_SHARE_MODES } from "@/shared/sources/notion-share-mode";

export const indexNotionBodySchema = z
  .object({
    databaseIds: z.array(z.string().min(1).max(128)).max(3).optional(),
    pageIds: z.array(z.string().min(1).max(128)).max(10).optional(),
    shareMode: z
      .enum([...NOTION_SHARE_MODES, "syncers"])
      .transform((mode) => (mode === "syncers" ? "indexers" : mode))
      .optional(),
    shareWithEmails: z.array(z.string().email().max(320)).max(50).optional(),
    shareWithTeam: z.boolean().optional(),
  })
  .refine(
    (value) =>
      (value.pageIds?.length ?? 0) + (value.databaseIds?.length ?? 0) > 0,
    { message: "Select at least one page or database." }
  )
  .refine(
    (value) =>
      value.shareMode !== "selected" ||
      (value.shareWithEmails?.length ?? 0) > 0,
    { message: "Select at least one teammate to share with." }
  );
