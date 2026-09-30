"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { ConnectorProviderIcon } from "@/components/connectors/connector-provider-icon";
import { Button } from "@/components/ui/button";
import { exportLibraryFileToDrive } from "@/lib/library/export-library-to-drive-client";
import type { LibraryCloudExportStatusResponse } from "@/shared/library/cloud-export-types";
import { fetcher } from "@/shared/utils";

const driveButtonClassName = "bg-transparent hover:bg-muted/50";

function cloudExportStatusUrl(tenantSlug: string) {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  const returnTo =
    typeof window === "undefined"
      ? "/connectors"
      : `${window.location.pathname}${window.location.search}`;
  return `${basePath}/api/library/${tenantSlug}/cloud-export-status?returnTo=${encodeURIComponent(returnTo)}`;
}

function driveOpenLinkCacheKey(tenantSlug: string, fileId: string) {
  return `library-drive-open:${tenantSlug}:${fileId}`;
}

function readCachedDriveOpenLink(tenantSlug: string, fileId: string) {
  try {
    return sessionStorage.getItem(driveOpenLinkCacheKey(tenantSlug, fileId));
  } catch {
    return null;
  }
}

function writeCachedDriveOpenLink(
  tenantSlug: string,
  fileId: string,
  webViewLink: string
) {
  try {
    sessionStorage.setItem(
      driveOpenLinkCacheKey(tenantSlug, fileId),
      webViewLink
    );
  } catch {
    // Ignore storage failures — upload path still works.
  }
}

function openDriveLink(webViewLink: string) {
  window.open(webViewLink, "_blank", "noopener,noreferrer");
}

export function LibraryCloudExportMenu({
  tenantSlug,
  fileId,
  driveWebViewLink,
  disabled = false,
}: {
  tenantSlug: string;
  fileId: string;
  driveWebViewLink?: string;
  disabled?: boolean;
}) {
  const [isOpening, setIsOpening] = useState(false);
  const statusUrl = useMemo(
    () => (tenantSlug ? cloudExportStatusUrl(tenantSlug) : null),
    [tenantSlug]
  );

  const { data, isLoading } = useSWR<LibraryCloudExportStatusResponse>(
    statusUrl,
    fetcher,
    { revalidateOnFocus: false }
  );

  const openInDrive = useCallback(async () => {
    if (!tenantSlug || !fileId || isOpening) {
      return;
    }

    const cachedLink =
      driveWebViewLink?.trim() || readCachedDriveOpenLink(tenantSlug, fileId);
    if (cachedLink) {
      openDriveLink(cachedLink);
      return;
    }

    setIsOpening(true);
    try {
      const uploaded = await exportLibraryFileToDrive({ fileId, tenantSlug });
      const webViewLink = uploaded.webViewLink?.trim();
      if (!webViewLink) {
        throw new Error("Google Drive did not return an open link.");
      }

      writeCachedDriveOpenLink(tenantSlug, fileId, webViewLink);
      openDriveLink(webViewLink);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to open in Google Drive"
      );
    } finally {
      setIsOpening(false);
    }
  }, [driveWebViewLink, fileId, isOpening, tenantSlug]);

  if (isLoading && !data) {
    return null;
  }

  if (!data?.oauthConfigured) {
    return null;
  }

  if (!data.connected) {
    if (!data.connectUrl) {
      return null;
    }

    return (
      <Button
        asChild
        className={driveButtonClassName}
        disabled={disabled}
        size="icon-sm"
        variant="outline"
      >
        <Link aria-label="Connect Google Drive" href={data.connectUrl}>
          <ConnectorProviderIcon
            aria-hidden
            className="size-4 shrink-0"
            provider="google-drive"
          />
        </Link>
      </Button>
    );
  }

  return (
    <Button
      aria-label="Open in Google Drive"
      className={driveButtonClassName}
      disabled={disabled || isOpening}
      onClick={() => {
        openInDrive().catch(() => undefined);
      }}
      size="icon-sm"
      type="button"
      variant="outline"
    >
      <ConnectorProviderIcon
        aria-hidden
        className="size-4 shrink-0"
        provider="google-drive"
      />
    </Button>
  );
}
