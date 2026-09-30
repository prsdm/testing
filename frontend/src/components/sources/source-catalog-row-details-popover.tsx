"use client";

import { InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { buildKbCatalogRowDetails } from "@/lib/sources/source-catalog-row-details";
import type { KbCatalogRow } from "@/shared/sources/source-catalog-types";

export function KbCatalogRowDetailsPopover({
  row,
  viewerUserId,
}: {
  row: KbCatalogRow;
  viewerUserId: string;
}) {
  const details = buildKbCatalogRowDetails(row, viewerUserId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={`Details for ${row.title}`}
          className="cursor-pointer"
          onClick={(event) => event.stopPropagation()}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <InfoIcon className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0"
        onClick={(event) => event.stopPropagation()}
      >
        <dl className="divide-y divide-border/60">
          {details.map((detail) => (
            <div
              className="grid grid-cols-[minmax(0,5.5rem)_1fr] gap-x-3 px-4 py-2.5"
              key={detail.label}
            >
              <dt className="text-muted-foreground text-xs">{detail.label}</dt>
              <dd className="text-right text-foreground text-xs">
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
