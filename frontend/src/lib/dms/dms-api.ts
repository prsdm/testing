import type { DmMemberPickerOption, DmSummary } from "@/contracts/dms";

export function dmsApiBase(tenantSlug: string) {
  return `${process.env.KIMIRO_BASE_PATH ?? ""}/api/dms/${tenantSlug}`;
}

export function dmsListSwrKey(tenantSlug: string) {
  return dmsApiBase(tenantSlug);
}

export function dmsPickerSwrKey(tenantSlug: string) {
  return `${dmsApiBase(tenantSlug)}?picker=1`;
}

export async function readDmsApiError(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // ignore
  }
  return fallback;
}

export async function createOrOpenDm(
  tenantSlug: string,
  peerUserId: string
): Promise<{ id: string }> {
  const response = await fetch(dmsApiBase(tenantSlug), {
    body: JSON.stringify({ peerUserId }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await readDmsApiError(response, "Failed to open DM"));
  }
  const payload = (await response.json()) as { dm: { id: string } };
  return payload.dm;
}

export async function createGroupDm(
  tenantSlug: string,
  memberUserIds: string[]
): Promise<{ id: string }> {
  const response = await fetch(dmsApiBase(tenantSlug), {
    body: JSON.stringify({ memberUserIds }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      await readDmsApiError(response, "Failed to create group message")
    );
  }
  const payload = (await response.json()) as { dm: { id: string } };
  return payload.dm;
}

export type DmListResponse = { dms: DmSummary[] };
export type DmPickerResponse = { members: DmMemberPickerOption[] };
