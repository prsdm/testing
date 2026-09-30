import Image from "next/image";
import type { Attachment } from "@/shared/types";
import { Spinner } from "../ui/spinner";
import { CrossSmallIcon } from "./icons";

function attachmentLabel(
  contentType: string | undefined,
  name: string | undefined
) {
  if (contentType?.startsWith("image/")) {
    return null;
  }
  if (contentType === "application/pdf") {
    return "PDF";
  }
  if (
    contentType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "DOC";
  }
  if (
    contentType ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "XLS";
  }
  if (contentType === "text/markdown") {
    return "MD";
  }
  if (contentType?.startsWith("text/")) {
    return "TXT";
  }
  const ext = name?.split(".").pop()?.toUpperCase();
  return ext && ext.length <= 4 ? ext : "File";
}

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onRemove?: () => void;
}) => {
  const { name, url, contentType } = attachment;
  const label = attachmentLabel(contentType, name);

  return (
    <div
      className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted"
      data-testid="input-attachment-preview"
    >
      {contentType?.startsWith("image") ? (
        <Image
          alt={name ?? "attachment"}
          className="size-full object-cover"
          height={96}
          src={url}
          width={96}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 px-1.5 text-center text-muted-foreground">
          <span className="font-medium text-[11px] tracking-wide">
            {label ?? "File"}
          </span>
          {name ? (
            <span className="line-clamp-2 w-full text-[10px] leading-tight">
              {name}
            </span>
          ) : null}
        </div>
      )}

      {isUploading && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-sm"
          data-testid="input-attachment-loader"
        >
          <Spinner className="size-5" />
        </div>
      )}

      {onRemove && !isUploading && (
        <button
          className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 group-hover:opacity-100"
          onClick={onRemove}
          type="button"
        >
          <CrossSmallIcon size={10} />
        </button>
      )}
    </div>
  );
};
