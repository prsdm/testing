import type { ReactNode } from "react";
import { Component } from "react";
import { cn } from "@/shared/utils";

type State = { error: Error | null };

type AppErrorBoundaryProps = { children: ReactNode };

/** Catches fatal errors at the app root (login, routing, providers). */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  private readonly handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          variant="fullscreen"
        />
      );
    }

    return this.props.children;
  }
}

type PanelErrorBoundaryProps = {
  children: ReactNode;
  /** Short label for logs and the inline message (e.g. "Sidebar"). */
  region?: string;
  className?: string;
};

/**
 * Isolates a layout region so a render error there does not unmount the whole app.
 */
export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    const label = this.props.region ?? "panel";
    console.error(`[${label} error]`, error, info.componentStack);
  }

  private readonly handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          className={this.props.className}
          error={this.state.error}
          onRetry={this.handleRetry}
          region={this.props.region}
          variant="panel"
        />
      );
    }

    return this.props.children;
  }
}

function ErrorFallback({
  error,
  onRetry,
  variant,
  region,
  className,
}: {
  error: Error;
  onRetry: () => void;
  variant: "fullscreen" | "panel";
  region?: string;
  className?: string;
}) {
  const isDev = import.meta.env.DEV;

  if (variant === "panel") {
    return (
      <div
        className={cn(
          "flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm",
          className
        )}
        role="alert"
      >
        <p className="font-medium text-foreground">
          {region ? `${region} failed to load` : "This section failed to load"}
        </p>
        <p className="text-muted-foreground text-xs">{error.message}</p>
        <button
          className="self-start rounded-md border bg-background px-2.5 py-1 text-xs"
          onClick={onRetry}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-3 px-6 py-12 font-sans">
      <h1 className="font-semibold text-xl">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">
        The app hit an error while loading. You can try again or reload the
        page. If this keeps happening after a reload, check the browser console.
      </p>
      <pre className="overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">
        {error.message}
      </pre>
      {isDev && error.stack ? (
        <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/20 p-3 text-[10px] text-muted-foreground">
          {error.stack}
        </pre>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          className="h-10 rounded-lg bg-primary px-4 text-primary-foreground text-sm"
          onClick={onRetry}
          type="button"
        >
          Try again
        </button>
        <button
          className="h-10 rounded-lg border bg-background px-4 text-sm"
          onClick={() => window.location.reload()}
          type="button"
        >
          Reload page
        </button>
      </div>
    </main>
  );
}
