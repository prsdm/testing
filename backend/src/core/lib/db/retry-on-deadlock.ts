const POSTGRES_DEADLOCK_CODE = "40P01";

export function isPostgresDeadlock(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === POSTGRES_DEADLOCK_CODE
  );
}

function deadlockBackoffMs(attempt: number): number {
  return 50 * attempt + Math.floor(Math.random() * 50);
}

/** Retry transient Postgres deadlocks (concurrent message + workflow run updates). */
export async function retryOnPostgresDeadlock<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isPostgresDeadlock(error) || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, deadlockBackoffMs(attempt));
      });
    }
  }

  throw lastError;
}
