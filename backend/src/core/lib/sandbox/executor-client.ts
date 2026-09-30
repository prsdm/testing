import { getSandboxExecutorUrl } from "@/core/lib/sandbox/config";

export type SandboxExecOutputFile = {
  path: string;
  sizeBytes: number;
  contentType: string;
};

export type SandboxExecResponse = {
  ok: boolean;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  stdoutTruncated?: boolean;
  stderrTruncated?: boolean;
  outputFiles?: SandboxExecOutputFile[];
  durationMs?: number;
  error?: string;
};

export type SandboxExecRequest = {
  tenantId: string;
  userId: string;
  chatId: string;
  command: "python" | "bash";
  args: string[];
  cwd: string;
  timeoutMs: number;
};

export async function callSandboxExecutor(
  request: SandboxExecRequest
): Promise<SandboxExecResponse> {
  const baseUrl = getSandboxExecutorUrl();
  if (!baseUrl) {
    return {
      error: "Sandbox executor URL is not configured.",
      ok: false,
    };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/exec`, {
      body: JSON.stringify(request),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Sandbox executor unreachable: ${error.message}`
          : "Sandbox executor unreachable.",
      ok: false,
    };
  }

  let payload: SandboxExecResponse;
  try {
    payload = (await response.json()) as SandboxExecResponse;
  } catch {
    return {
      error: "Sandbox executor returned invalid JSON.",
      ok: false,
    };
  }

  if (!response.ok && !payload.error) {
    return {
      ...payload,
      error: payload.error ?? `Sandbox executor HTTP ${response.status}.`,
      ok: false,
    };
  }

  return payload;
}
