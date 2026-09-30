import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { backendRoot } from "@/migration/paths";
import { getVespaConfigUrl } from "./config";

const execFileAsync = promisify(execFile);

const APPLICATION_DIR = resolve(backendRoot, "vespa/application");
let deployPromise: Promise<void> | null = null;

async function createApplicationZip(tempDir: string) {
  const zipPath = join(tempDir, "application.zip");
  await execFileAsync("zip", ["-qr", zipPath, "."], {
    cwd: APPLICATION_DIR,
  });
  return zipPath;
}

async function waitForConfigServer(maxAttempts = 60) {
  const configUrl = getVespaConfigUrl();
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${configUrl}/state/v1/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Vespa config server still starting.
    }
    await new Promise((resolveWait) => {
      setTimeout(resolveWait, 1000);
    });
  }
  throw new Error(
    `Vespa config server not ready at ${configUrl}. Start docker compose vespa service first.`
  );
}

async function deployApplicationPackage() {
  await waitForConfigServer();
  const tempDir = await mkdtemp(join(tmpdir(), "kimiro-vespa-"));
  try {
    const zipPath = await createApplicationZip(tempDir);
    const zipBuffer = await readFile(zipPath);
    const configUrl = getVespaConfigUrl();
    const response = await fetch(
      `${configUrl}/application/v2/tenant/default/prepareandactivate`,
      {
        body: zipBuffer,
        headers: {
          "content-type": "application/zip",
        },
        method: "POST",
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Vespa application deploy failed (${response.status}): ${body}`
      );
    }
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

export async function ensureVespaApplication() {
  if (!deployPromise) {
    deployPromise = deployApplicationPackage().catch((error) => {
      deployPromise = null;
      throw error;
    });
  }
  await deployPromise;
}

export async function waitForVespaQueryReady(maxAttempts = 90) {
  const { getVespaUrl } = await import("./config");
  const vespaUrl = getVespaUrl();
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${vespaUrl}/state/v1/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Query container still starting.
    }
    await new Promise((resolveWait) => {
      setTimeout(resolveWait, 1000);
    });
  }
  throw new Error(
    `Vespa query endpoint not ready at ${vespaUrl}. Deploy may still be activating.`
  );
}
