/** Tenant member data used by Notion sharing controls. */
export type NotionShareMemberOption = {
  id: string;
  email: string;
  displayName: string;
};

export type SourceConnectorType =
  | "manual"
  | "drive"
  | "upload"
  | "confluence"
  | "notion"
  | "sharepoint"
  | "slack";
