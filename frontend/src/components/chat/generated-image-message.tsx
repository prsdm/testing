"use client";

import { DownloadIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GenerateImageToolOutput } from "@/shared/ai/tools/generate-image";
import { cn } from "@/shared/utils";

const imageOverlayButtonClassName =
  "inline-flex size-9 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition hover:bg-black/65";

/** Max width for the lightbox — smaller than full viewport, image scales down proportionally. */
const LIGHTBOX_MAX_WIDTH_CLASS = "max-w-[min(90vw,720px)]";

export function GeneratedImageMessage({
  image,
  className,
}: {
  image: GenerateImageToolOutput;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "group relative my-2 w-full max-w-xl overflow-hidden rounded-2xl",
          className
        )}
      >
        <button
          aria-label="View full image"
          className="block w-full cursor-pointer text-left"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Image
            alt={image.prompt}
            className="h-auto w-full bg-muted/30"
            height={1024}
            loading="eager"
            src={image.url}
            unoptimized
            width={1024}
          />
        </button>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-end bg-gradient-to-t from-black/45 via-black/15 to-transparent px-3 pt-16 pb-3">
          <a
            aria-label="Download image"
            className={cn(imageOverlayButtonClassName, "pointer-events-auto")}
            download={image.name}
            href={image.url}
            onClick={(event) => event.stopPropagation()}
          >
            <DownloadIcon className="size-4" />
          </a>
        </div>
      </div>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent
          className={cn(
            "w-fit gap-0 border-0 bg-transparent p-0 shadow-none ring-0",
            LIGHTBOX_MAX_WIDTH_CLASS,
            "sm:max-w-[min(90vw,720px)]"
          )}
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">{image.prompt}</DialogTitle>
          <DialogDescription className="sr-only">
            Full-size preview of the generated image
          </DialogDescription>
          <div className="relative">
            <Image
              alt={image.prompt}
              className={cn(
                "h-auto w-auto rounded-2xl object-contain",
                LIGHTBOX_MAX_WIDTH_CLASS,
                "max-h-[90vh]"
              )}
              height={1024}
              loading="lazy"
              src={image.url}
              unoptimized
              width={1024}
            />
            <DialogClose
              className={cn(
                imageOverlayButtonClassName,
                "absolute top-2.5 right-2.5"
              )}
            >
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
            <a
              aria-label="Download image"
              className={cn(
                imageOverlayButtonClassName,
                "absolute right-2.5 bottom-2.5"
              )}
              download={image.name}
              href={image.url}
            >
              <DownloadIcon className="size-4" />
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
