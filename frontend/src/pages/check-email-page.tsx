import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function CheckEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email")?.trim() ?? "";

  return (
    <>
      <h1 className="font-semibold text-2xl tracking-tight">
        Check your email
      </h1>
      <p className="text-muted-foreground text-sm">
        Click the link in the email to sign in and continue.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
          <p className="text-[13px] text-muted-foreground">Email sent to</p>
          <p className="truncate font-medium text-sm">
            {email || "your inbox"}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1" type="button" variant="outline">
            <a href="https://mail.google.com" rel="noreferrer" target="_blank">
              Open Gmail
            </a>
          </Button>
          <Button asChild className="flex-1" type="button" variant="outline">
            <a
              href="https://outlook.live.com/mail"
              rel="noreferrer"
              target="_blank"
            >
              Open Outlook
            </a>
          </Button>
        </div>

        <p className="text-center text-[13px] text-muted-foreground">
          <Link className="underline underline-offset-2" to="/login">
            Try a different email
          </Link>
        </p>
      </div>
    </>
  );
}
