import path from "node:path";
import { backendRoot } from "@/migration/paths";

/** Standalone backend root, independent of the caller's working directory. */
export function getRepoRoot(): string {
  const configured = process.env.KIMIRO_REPO_ROOT?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return backendRoot;
}
