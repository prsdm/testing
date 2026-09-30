import type { NotionShareMemberOption } from "@/contracts/sources";

type TenantMemberRow = {
  id: string;
  email: string;
  isActive: boolean;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
};

export function toNotionShareMemberOptions(
  members: TenantMemberRow[]
): NotionShareMemberOption[] {
  return members
    .filter((member) => member.isActive)
    .map((member) => ({
      displayName:
        member.displayName?.trim() ||
        `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() ||
        member.email.split("@")[0] ||
        member.email,
      email: member.email,
      id: member.id,
    }));
}
