import crypto from "node:crypto";

export function verifySlackRequestSignature(args: {
  signingSecret: string;
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
  maxAgeSeconds?: number;
}): boolean {
  const signature = args.signature?.trim();
  const timestamp = args.timestamp?.trim();
  if (!(signature && timestamp && args.signingSecret)) {
    return false;
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (
    !Number.isFinite(ageSeconds) ||
    ageSeconds > (args.maxAgeSeconds ?? 300)
  ) {
    return false;
  }

  const base = `v0:${timestamp}:${args.rawBody}`;
  const digest = `v0=${crypto
    .createHmac("sha256", args.signingSecret)
    .update(base)
    .digest("hex")}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}
