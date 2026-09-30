import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/** Must match backend `toTenantUserId` in db/queries.ts */
const utf8Encoder = new TextEncoder();

export function toTenantUserId(authUserId: string): string {
  const hex = bytesToHex(sha256(utf8Encoder.encode(authUserId))).slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20, 32)}`;
}
