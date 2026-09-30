import { z } from "zod";
import {
  getToolParams,
  type ToolParam,
} from "@/core/lib/connectors/providers/params-registry";
import {
  getProviderById,
  getToolsForProvider,
} from "@/core/lib/connectors/providers/registry";

function paramToZod(p: ToolParam): z.ZodTypeAny {
  const t = (p.type ?? "string").toLowerCase();
  if (t.includes("string") && t.includes("string[]")) {
    return z.union([z.string(), z.array(z.string())]);
  }
  if (t === "number" || t === "integer") {
    return z.number();
  }
  if (t === "boolean") {
    return z.boolean();
  }
  return z.string();
}

export function buildZodSchemaForTool(
  _providerId: string,
  toolId: string
): z.ZodTypeAny {
  const params = getToolParams(toolId);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of params) {
    const base = paramToZod(p);
    const described = p.description ? base.describe(p.description) : base;
    shape[p.name] = p.required ? described : described.optional();
  }
  return z.object(shape);
}

export function toolDescription(providerId: string, toolId: string): string {
  const provider = getProviderById(providerId);
  const tools = getToolsForProvider(providerId, provider);
  const t = tools.find((x) => x.id === toolId);
  return t?.description ?? `Tool: ${toolId}`;
}
