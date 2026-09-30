"use client";

import { toast } from "sonner";
import { Artifact } from "@/components/chat/create-artifact";
import {
  DownloadIcon,
  LineChartIcon,
  RedoIcon,
  SparklesIcon,
  UndoIcon,
  UploadIcon,
} from "@/components/chat/icons";
import { SpreadsheetEditor } from "@/components/chat/sheet-editor";
import { exportArtifactToDrive } from "@/lib/artifacts/export-artifact-to-drive";
import { downloadSheetAsXlsx } from "@/shared/artifacts/sheet-xlsx";

type Metadata = Record<string, never>;

export const sheetArtifact = new Artifact<"sheet", Metadata>({
  actions: [
    {
      description: "View previous version",
      icon: <UndoIcon size={18} />,
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
    },
    {
      description: "View next version",
      icon: <RedoIcon size={18} />,
      isDisabled: ({ isCurrentVersion }) => isCurrentVersion,
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
    },
    {
      description: "Download as .xlsx",
      icon: <DownloadIcon size={18} />,
      onClick: ({ title, content }) => {
        try {
          downloadSheetAsXlsx(title || "Spreadsheet", content);
          toast.success("Downloaded .xlsx");
        } catch {
          toast.error("Failed to download spreadsheet");
        }
      },
    },
    {
      description: "Save to Google Drive",
      icon: <UploadIcon size={18} />,
      isDisabled: ({ content }) => !content.trim(),
      onClick: async ({ title, content, tenantSlug }) => {
        try {
          const uploaded = await exportArtifactToDrive({
            content,
            kind: "sheet",
            tenantSlug,
            title: title || "Spreadsheet",
          });
          if (uploaded.webViewLink) {
            toast.success("Saved to Google Drive", {
              action: {
                label: "Open",
                onClick: () => {
                  window.open(uploaded.webViewLink, "_blank", "noopener");
                },
              },
            });
            return;
          }
          toast.success(`Saved to Google Drive as ${uploaded.name}`);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to save to Google Drive"
          );
        }
      },
    },
  ],
  content: ({
    title,
    content,
    currentVersionIndex,
    isCurrentVersion,
    onSaveContent,
    status,
  }) => (
    <SpreadsheetEditor
      content={content}
      currentVersionIndex={currentVersionIndex}
      isCurrentVersion={isCurrentVersion}
      saveContent={onSaveContent}
      sheetName={title}
      status={status}
    />
  ),
  description: "Useful for working with spreadsheets",
  initialize: () => null,
  kind: "sheet",
  onStreamPart: ({ setArtifact, streamPart }) => {
    if (streamPart.type === "data-sheetDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
  toolbar: [
    {
      description: "Format and clean data",
      icon: <SparklesIcon size={14} />,
      onClick: ({ sendMessage }) => {
        sendMessage({
          parts: [
            {
              text: "Can you please format and clean the data?",
              type: "text",
            },
          ],
          role: "user",
        });
      },
    },
    {
      description: "Analyze and visualize data",
      icon: <LineChartIcon size={14} />,
      onClick: ({ sendMessage }) => {
        sendMessage({
          parts: [
            {
              text: "Can you please analyze and visualize the data by creating a new code artifact in python?",
              type: "text",
            },
          ],
          role: "user",
        });
      },
    },
  ],
});
