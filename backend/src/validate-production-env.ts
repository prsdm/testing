/** Fail fast when required production configuration is missing. */
export function validateProductionEnv() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const missing: string[] = [];

  if (
    !process.env.BETTER_AUTH_SECRET?.trim() &&
    !process.env.AUTH_SECRET?.trim()
  ) {
    missing.push("BETTER_AUTH_SECRET (or AUTH_SECRET)");
  }
  if (!process.env.BETTER_AUTH_URL?.trim()) {
    missing.push("BETTER_AUTH_URL");
  }
  if (!process.env.POSTGRES_URL?.trim()) {
    missing.push("POSTGRES_URL");
  }

  if (missing.length > 0) {
    throw new Error(`Production startup blocked — set: ${missing.join(", ")}`);
  }
}
