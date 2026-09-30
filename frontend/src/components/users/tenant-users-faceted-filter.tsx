"use client";

import { Check, Filter } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/shared/utils";

export type FacetedFilterOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

function FilterCheckbox({
  checked,
  label,
  icon,
  onToggle,
}: {
  checked: boolean;
  label: string;
  icon?: ReactNode;
  onToggle: () => void;
}) {
  return (
    <button
      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm hover:bg-muted/50"
      onClick={onToggle}
      type="button"
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-sm border",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input opacity-50 [&_svg]:invisible"
        )}
      >
        <Check className="size-3" />
      </span>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function FilterSection<T extends string>({
  title,
  options,
  selectedValues,
  onSelectedValuesChange,
}: {
  title: string;
  options: FacetedFilterOption<T>[];
  selectedValues: Set<T>;
  onSelectedValuesChange: (values: Set<T>) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-1 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
        {title}
      </p>
      {options.map((option) => {
        const isSelected = selectedValues.has(option.value);

        return (
          <FilterCheckbox
            checked={isSelected}
            icon={option.icon}
            key={option.value}
            label={option.label}
            onToggle={() => {
              const next = new Set(selectedValues);
              if (isSelected) {
                next.delete(option.value);
              } else {
                next.add(option.value);
              }
              onSelectedValuesChange(next);
            }}
          />
        );
      })}
    </div>
  );
}

export function TenantUsersCombinedFilter<
  TRole extends string,
  TStatus extends string,
>({
  roleOptions,
  statusOptions,
  selectedRoles,
  selectedStatuses,
  onSelectedRolesChange,
  onSelectedStatusesChange,
}: {
  roleOptions: FacetedFilterOption<TRole>[];
  statusOptions: FacetedFilterOption<TStatus>[];
  selectedRoles: Set<TRole>;
  selectedStatuses: Set<TStatus>;
  onSelectedRolesChange: (values: Set<TRole>) => void;
  onSelectedStatusesChange: (values: Set<TStatus>) => void;
}) {
  const totalSelected = selectedRoles.size + selectedStatuses.size;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label="Filter users"
          className={cn(
            "size-8 shrink-0 cursor-pointer bg-transparent hover:bg-muted/50 aria-expanded:bg-muted/50",
            totalSelected > 0 && "bg-muted/50"
          )}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <Filter />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-0">
        <div className="flex flex-col gap-3 p-3">
          <FilterSection
            onSelectedValuesChange={onSelectedRolesChange}
            options={roleOptions}
            selectedValues={selectedRoles}
            title="Role"
          />
          <Separator />
          <FilterSection
            onSelectedValuesChange={onSelectedStatusesChange}
            options={statusOptions}
            selectedValues={selectedStatuses}
            title="Status"
          />
        </div>
        {totalSelected > 0 ? (
          <div className="border-border/60 border-t px-3 py-2">
            <button
              className="cursor-pointer text-muted-foreground text-sm underline underline-offset-2 hover:text-foreground"
              onClick={() => {
                onSelectedRolesChange(new Set());
                onSelectedStatusesChange(new Set());
              }}
              type="button"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function TenantUsersFacetedFilter<T extends string>({
  title,
  options,
  selectedValues,
  onSelectedValuesChange,
}: {
  title: string;
  options: FacetedFilterOption<T>[];
  selectedValues: Set<T>;
  onSelectedValuesChange: (values: Set<T>) => void;
}) {
  const selectedOptions = options.filter((option) =>
    selectedValues.has(option.value)
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className="h-8 cursor-pointer bg-transparent hover:bg-muted/50 aria-expanded:bg-muted/50"
          size="sm"
          type="button"
          variant="outline"
        >
          <Filter />
          {title}
          {selectedOptions.length > 0 ? (
            <>
              <Separator className="mx-1 h-4" orientation="vertical" />
              <div className="flex items-center gap-1">
                {selectedOptions.length > 2 ? (
                  <Badge
                    className="rounded-sm px-1 font-normal"
                    variant="secondary"
                  >
                    {selectedOptions.length} selected
                  </Badge>
                ) : (
                  selectedOptions.map((option) => (
                    <Badge
                      className="rounded-sm px-1 font-normal"
                      key={option.value}
                      variant="secondary"
                    >
                      {option.label}
                    </Badge>
                  ))
                )}
              </div>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto min-w-0 p-0 **:data-[slot=command-item]:cursor-pointer"
      >
        <Command>
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);

                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      const next = new Set(selectedValues);
                      if (isSelected) {
                        next.delete(option.value);
                      } else {
                        next.add(option.value);
                      }
                      onSelectedValuesChange(next);
                    }}
                  >
                    <div
                      className={cn(
                        "flex size-4 items-center justify-center rounded-sm border",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="size-3" />
                    </div>
                    {option.icon}
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
