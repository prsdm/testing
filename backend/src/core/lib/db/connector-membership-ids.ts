/** Space-scoped Confluence rows are managed separately from group membership sync. */
export const CONNECTOR_SPACE_GROUP_PREFIX = "space:";

export function isConnectorSpaceGroupId(externalGroupId: string) {
  return externalGroupId
    .trim()
    .toLowerCase()
    .startsWith(CONNECTOR_SPACE_GROUP_PREFIX);
}
