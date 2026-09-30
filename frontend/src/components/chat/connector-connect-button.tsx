import Link from "next/link";
import {
  type ConnectorProvider,
  ConnectorProviderIcon,
} from "@/components/connectors/connector-provider-icon";
import { cn } from "@/shared/utils";

export function ConnectorConnectButton({
  href,
  label,
  provider,
  className,
}: {
  href: string;
  label: string;
  provider: ConnectorProvider;
  className?: string;
}) {
  return (
    <Link
      className={cn(
        "inline-flex h-8 w-fit shrink-0 items-center gap-2 self-start rounded-lg border border-border/60 bg-background px-3 font-medium text-foreground text-sm transition-colors hover:bg-muted",
        className
      )}
      href={href}
    >
      <ConnectorProviderIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground"
        provider={provider}
      />
      <span>{label}</span>
    </Link>
  );
}
