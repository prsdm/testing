import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let cachedAgentInstructions: string | null = null;

/** Loads `lib/ai/agent.md` — the single source of truth for chat agent instructions. */
export function loadAgentInstructions(): string {
  if (cachedAgentInstructions && process.env.NODE_ENV === "production") {
    return cachedAgentInstructions;
  }

  const path = join(dirname(fileURLToPath(import.meta.url)), "agent.md");
  const instructions = readFileSync(path, "utf8").trim();
  cachedAgentInstructions = instructions;
  return instructions;
}
