import { FolderOpenIcon } from "lucide-react";
import { LibraryPanel } from "@/components/library/library-panel";
import { useTenant } from "@/components/providers/tenant-provider";
import {
  WorkspacePageHeader,
  WorkspacePageMain,
  workspacePageHeaderIconClassName,
} from "@/components/workspace/workspace-page-layout";

export function LibraryPage() {
  const { tenantSlug } = useTenant();

  return (
    <WorkspacePageMain>
      <WorkspacePageHeader
        description="Your private file library — uploads and agent-generated exports."
        icon={<FolderOpenIcon className={workspacePageHeaderIconClassName} />}
        title="Library"
      />
      <LibraryPanel tenantSlug={tenantSlug} />
    </WorkspacePageMain>
  );
}
