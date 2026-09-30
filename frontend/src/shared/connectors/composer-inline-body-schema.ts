import { z } from "zod";
import { composerConnectorFocusSchema } from "@/shared/connectors/composer-connector-focus-schema";

const composerInlineTextSegmentSchema = z.object({
  id: z.string(),
  kind: z.literal("text"),
  text: z.string(),
});

const composerInlineConnectorSegmentSchema = z.object({
  focus: composerConnectorFocusSchema,
  id: z.string(),
  kind: z.literal("connector"),
});

export const composerInlineBodySchema = z.object({
  segments: z.array(
    z.union([
      composerInlineTextSegmentSchema,
      composerInlineConnectorSegmentSchema,
    ])
  ),
});
