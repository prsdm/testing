import { cn } from "@/shared/utils";

type OnboardingSectionCardProps = {
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  description?: string;
  title?: string;
};

export function OnboardingSectionCard({
  action,
  children,
  className,
  description,
  title,
}: OnboardingSectionCardProps) {
  const showHeader = Boolean(title || description || action);

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 rounded-lg border border-border/50 bg-background/80 px-3 py-3",
        className
      )}
    >
      {showHeader ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {title ? <p className="font-medium text-sm">{title}</p> : null}
            {description ? (
              <p className="text-[12px] text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
