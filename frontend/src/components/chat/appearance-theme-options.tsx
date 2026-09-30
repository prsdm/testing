"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

export const appearanceThemeOptions = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const;

export type AppearanceTheme = (typeof appearanceThemeOptions)[number]["value"];

function useAppearanceTheme() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme: AppearanceTheme = (() => {
    if (!mounted) {
      return "system";
    }
    if (theme === "light") {
      return "light";
    }
    if (theme === "dark") {
      return "dark";
    }
    return "system";
  })();

  return {
    activeTheme,
    mounted,
    setTheme,
  };
}

export function AppearanceThemeMenuItems({
  className,
  onSelect,
}: {
  className?: string;
  onSelect?: () => void;
}) {
  const { activeTheme, mounted, setTheme } = useAppearanceTheme();

  return (
    <DropdownMenuRadioGroup
      className={className}
      onValueChange={(value) => {
        setTheme(value);
        onSelect?.();
      }}
      value={mounted ? activeTheme : "system"}
    >
      {appearanceThemeOptions.map((option) => (
        <DropdownMenuRadioItem
          className="cursor-pointer text-[14px]"
          data-testid={`appearance-theme-${option.value}`}
          key={option.value}
          value={option.value}
        >
          {option.label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}
