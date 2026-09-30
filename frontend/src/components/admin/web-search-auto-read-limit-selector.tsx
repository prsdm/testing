"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WebSearchAutoReadLimit } from "@/contracts/admin";
import { WEB_SEARCH_AUTO_READ_LIMITS } from "@/shared/web-search/settings";

const settingsDropdownRadioItemClassName =
  "rounded-lg pr-3 [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden data-[state=checked]:bg-muted/50 data-[state=checked]:text-foreground data-[state=checked]:focus:bg-muted/50 data-[state=checked]:focus:text-foreground data-[state=checked]:[&_svg]:text-foreground";

export function WebSearchAutoReadLimitSelector({
  value,
  disabled = false,
  onChange,
}: {
  value: WebSearchAutoReadLimit;
  disabled?: boolean;
  onChange: (limit: WebSearchAutoReadLimit) => void;
}) {
  const valueString = String(value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="bg-transparent hover:bg-muted/50 aria-expanded:bg-muted/50"
          disabled={disabled}
          size="sm"
          type="button"
          variant="outline"
        >
          {value} pages
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-32 **:data-[slot=dropdown-menu-radio-item]:cursor-pointer"
      >
        <DropdownMenuRadioGroup
          onValueChange={(nextValue) => {
            onChange(Number(nextValue) as WebSearchAutoReadLimit);
          }}
          value={valueString}
        >
          {WEB_SEARCH_AUTO_READ_LIMITS.map((limit) => (
            <DropdownMenuRadioItem
              className={settingsDropdownRadioItemClassName}
              key={limit}
              value={String(limit)}
            >
              {limit} pages
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
