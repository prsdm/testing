import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AdminListChevronButton({
  href,
  onClick,
  label,
}: {
  href?: string;
  onClick?: () => void;
  label: string;
}) {
  const className = "bg-transparent hover:bg-muted/50";

  if (href) {
    return (
      <Button
        asChild
        className={className}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        <Link aria-label={label} href={href}>
          <ChevronRightIcon className="size-3.5" />
        </Link>
      </Button>
    );
  }

  return (
    <Button
      aria-label={label}
      className={className}
      onClick={onClick}
      size="icon-sm"
      type="button"
      variant="outline"
    >
      <ChevronRightIcon className="size-3.5" />
    </Button>
  );
}
