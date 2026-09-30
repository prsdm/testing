import { materializeXlsxFormulas } from "@/core/lib/artifacts/sheet-xlsx-exceljs";
import {
  resolveDriveImportPlan,
  wrapDriveBytesAsArtifactContent,
} from "@/shared/artifacts/drive-import";
import {
  DOCX_DRIVE_MIME,
  XLSX_DRIVE_MIME,
} from "@/shared/artifacts/prepare-drive-export";
import {
  type LibraryPreviewKind,
  libraryPreviewKindFromMeta,
} from "@/shared/library/library-preview-kind";

export type LibraryPreviewPayload =
  | {
      kind: "sheet";
      title: string;
      content: string;
    }
  | {
      kind: "text";
      title: string;
      content: string;
    }
  | {
      kind: "slides";
      title: string;
    }
  | {
      kind: "image" | "pdf";
      title: string;
    }
  | {
      kind: "unsupported";
      title: string;
    };

function titleFromFileName(fileName: string) {
  const trimmed = fileName.trim() || "Untitled";
  return trimmed.replace(/\.(docx|xlsx|pptx|pdf)$/i, "") || "Untitled";
}

export async function buildLibraryPreviewPayload(args: {
  name: string;
  contentType: string;
  bytes: Buffer;
}): Promise<LibraryPreviewPayload> {
  const kind = libraryPreviewKindFromMeta({
    contentType: args.contentType,
    name: args.name,
  });
  const title = titleFromFileName(args.name);

  if (kind === "sheet") {
    const plan = resolveDriveImportPlan(XLSX_DRIVE_MIME);
    if (!plan) {
      return { kind: "unsupported", title };
    }
    const wrapped = wrapDriveBytesAsArtifactContent(plan, args.bytes);
    const content = await materializeXlsxFormulas(wrapped);
    return { content, kind: "sheet", title };
  }

  if (kind === "text") {
    const plan = resolveDriveImportPlan(DOCX_DRIVE_MIME);
    if (!plan) {
      return { kind: "unsupported", title };
    }
    const content = wrapDriveBytesAsArtifactContent(plan, args.bytes);
    return { content, kind: "text", title };
  }

  if (kind === "slides") {
    return { kind: "slides", title };
  }

  if (kind === "image" || kind === "pdf") {
    return { kind, title };
  }

  return { kind: "unsupported", title };
}

export function libraryPreviewKindLabel(kind: LibraryPreviewKind): string {
  switch (kind) {
    case "sheet":
      return "Spreadsheet";
    case "text":
      return "Document";
    case "slides":
      return "Presentation";
    case "image":
      return "Image";
    case "pdf":
      return "PDF";
    default:
      return "File";
  }
}
