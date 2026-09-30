import { z } from "zod";
import { WORK_SKILL_IDS } from "@/shared/sandbox/work-skill-catalog";

export const composerConnectorFocusSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("work-skill"),
    name: z.string(),
    skillId: z.enum(WORK_SKILL_IDS),
  }),
  z.object({
    appId: z.string(),
    kind: z.literal("google-app"),
    name: z.string(),
    provider: z.string(),
  }),
  z.object({
    kind: z.literal("provider"),
    name: z.string(),
    provider: z.string(),
  }),
  z.object({
    kind: z.literal("mcp"),
    name: z.string(),
    serverId: z.string(),
  }),
]);

export const composerConnectorFocusesSchema = z
  .array(composerConnectorFocusSchema)
  .optional();
