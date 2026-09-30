"use client";

import { Loader2Icon } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { SidebarAppLogo } from "@/components/chat/sidebar-app-logo";
import { Button } from "@/components/ui/button";
import type { TenantGeneralAdminView } from "@/contracts/admin";
import { cn } from "@/shared/utils";

const ACCEPTED_LOGO_TYPES =
  "image/jpeg,image/png,image/webp,image/svg+xml,.jpg,.jpeg,.png,.webp,.svg";

export function workspaceLogoSrc(tenantSlug: string, cacheKey?: string | null) {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  const query = cacheKey ? `?v=${encodeURIComponent(cacheKey)}` : "";
  return `${basePath}/api/workspace/${tenantSlug}/logo${query}`;
}

export function WorkspaceIconControl({
  tenantSlug,
  hasLogo,
  logoVersion,
  onLogoChange,
}: {
  tenantSlug: string;
  hasLogo: boolean;
  logoVersion: string | null;
  onLogoChange: (next: TenantGeneralAdminView) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const previewSrc = hasLogo ? workspaceLogoSrc(tenantSlug, logoVersion) : null;

  async function uploadLogo(file: File) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/admin/${tenantSlug}/general/logo`, {
        body: formData,
        method: "POST",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Failed to upload logo.");
      }
      onLogoChange((await response.json()) as TenantGeneralAdminView);
      toast.success("Icon updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload logo."
      );
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function removeLogo() {
    setIsRemoving(true);
    try {
      const response = await fetch(`/api/admin/${tenantSlug}/general/logo`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Failed to remove logo.");
      }
      onLogoChange((await response.json()) as TenantGeneralAdminView);
      toast.success("Icon removed.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove logo."
      );
    } finally {
      setIsRemoving(false);
    }
  }

  const busy = isUploading || isRemoving;

  const openFilePicker = () => {
    if (!busy) {
      inputRef.current?.click();
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        aria-label="Change workspace icon"
        className={cn(
          "flex size-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/30 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          busy && "pointer-events-none opacity-60"
        )}
        disabled={busy}
        onClick={openFilePicker}
        type="button"
      >
        {isUploading ? (
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        ) : previewSrc ? (
          <Image
            alt=""
            className="size-full object-cover"
            height={40}
            src={previewSrc}
            unoptimized
            width={40}
          />
        ) : (
          <SidebarAppLogo className="size-5 text-foreground" />
        )}
      </button>
      {hasLogo ? (
        <Button
          className="text-muted-foreground hover:text-foreground"
          disabled={busy}
          onClick={() => {
            removeLogo().catch(() => null);
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          Remove
        </Button>
      ) : null}
      <input
        accept={ACCEPTED_LOGO_TYPES}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            uploadLogo(file).catch(() => null);
          }
        }}
        ref={inputRef}
        type="file"
      />
    </div>
  );
}
