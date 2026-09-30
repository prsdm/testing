export function channelsApiBase(tenantSlug: string) {
  return `${process.env.KIMIRO_BASE_PATH ?? ""}/api/channels/${tenantSlug}`;
}

export function channelsListSwrKey(tenantSlug: string) {
  return channelsApiBase(tenantSlug);
}
