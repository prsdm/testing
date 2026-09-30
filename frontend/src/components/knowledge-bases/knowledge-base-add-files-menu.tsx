"use client";

import { FileIcon, PaperclipIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  type ConnectorProvider,
  ConnectorProviderIcon,
} from "@/components/connectors/connector-provider-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/shared/utils";

const PROJECT_ADD_PROVIDERS: Array<{
  id: string;
  label: string;
  provider?: ConnectorProvider;
  ready: boolean;
  onSelect?: "drive";
}> = [
  {
    id: "google-drive",
    label: "Google Drive",
    onSelect: "drive",
    provider: "google-drive",
    ready: true,
  },
  {
    id: "confluence",
    label: "Confluence",
    provider: "confluence",
    ready: false,
  },
  {
    id: "sharepoint",
    label: "SharePoint",
    provider: "sharepoint",
    ready: false,
  },
  { id: "onedrive", label: "OneDrive", ready: false },
];

function comingSoonProvider(label: string) {
  toast.message(`${label} is coming soon for knowledgeBases`);
}

export function KnowledgeBaseAddFilesMenu({
  isUploading,
  onUploadClick,
  onSelectFromDrive,
}: {
  isUploading: boolean;
  onUploadClick: () => void;
  onSelectFromDrive: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
      <DropdownMenuTrigger asChild>
        <Button disabled={isUploading} size="sm" type="button">
          {isUploading ? "Uploading…" : "Add file"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-100 min-w-48 rounded-xl border border-border/60 bg-card/95 p-1 shadow-(--shadow-float) backdrop-blur-xl"
        sideOffset={8}
      >
        <DropdownMenuItem
          className="gap-2 rounded-lg px-2.5 py-2"
          disabled={isUploading}
          onSelect={() => {
            onUploadClick();
          }}
        >
          <PaperclipIcon className="size-3.5 text-muted-foreground" />
          Upload file
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            className="gap-2 rounded-lg px-2.5 py-2"
            disabled={isUploading}
          >
            <FileIcon className="size-3.5 text-muted-foreground" />
            Select file
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent
            className="z-100 min-w-48 rounded-xl border border-border/60 bg-card/95 p-1 shadow-(--shadow-float) backdrop-blur-xl"
            sideOffset={8}
          >
            {PROJECT_ADD_PROVIDERS.map((item) => (
              <DropdownMenuItem
                className={cn(
                  "gap-2 rounded-lg px-2.5 py-2",
                  !item.ready && "text-muted-foreground"
                )}
                key={item.id}
                onSelect={() => {
                  if (item.onSelect === "drive") {
                    setMenuOpen(false);
                    onSelectFromDrive();
                    return;
                  }
                  comingSoonProvider(item.label);
                }}
              >
                {item.provider ? (
                  <ConnectorProviderIcon
                    className="size-4 shrink-0"
                    provider={item.provider}
                  />
                ) : null}
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
