"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/cn";
import { CHAT_HOME } from "@/shared/chat/routes";

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      height="16"
      viewBox="0 0 24 24"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Google</title>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      height="16"
      viewBox="0 0 23 23"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Microsoft</title>
      <path d="M1 1h10v10H1V1Z" fill="#F25022" />
      <path d="M12 1h10v10H12V1Z" fill="#7FBA00" />
      <path d="M1 12h10v10H1V12Z" fill="#00A4EF" />
      <path d="M12 12h10v10H12V12Z" fill="#FFB900" />
    </svg>
  );
}

export function LoginForm({
  googleEnabled,
  microsoftEnabled,
  onNavigate,
}: {
  googleEnabled: boolean;
  microsoftEnabled: boolean;
  onNavigate: (path: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<
    "google" | "microsoft" | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteEmail = params.get("email")?.trim();
    if (inviteEmail) {
      setEmail(inviteEmail);
    }
    if (params.get("invite")) {
      setErrorMessage(null);
    }
    if (params.get("error") === "access_denied") {
      setErrorMessage(
        "Access denied. Your account is outside your organization's allowed access policy."
      );
      return;
    }
    if (params.get("error") === "no_workspace") {
      setErrorMessage(
        "Your workspace access was removed. Contact your admin, or accept an invite to continue."
      );
      fetch("/api/auth/sign-out", {
        body: "{}",
        headers: { "content-type": "application/json" },
        method: "POST",
      }).catch(() => undefined);
      return;
    }
    if (params.get("error") === "sso_failed") {
      setErrorMessage("Sign-in failed or was cancelled. Try again.");
      return;
    }
    if (params.get("error") === "magic_link") {
      setErrorMessage("That sign-in link is invalid or expired. Try again.");
      return;
    }
    if (params.get("reason") === "inactivity") {
      setErrorMessage("You were signed out after a period of inactivity.");
      return;
    }
    if (params.get("reason") === "reauth") {
      setErrorMessage("Please sign in again to finish that action.");
    }
  }, []);

  async function continueWithEmail() {
    const nextEmail = email.trim().toLowerCase();
    setErrorMessage(null);

    if (!BASIC_EMAIL_REGEX.test(nextEmail)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setIsLoading(true);

    const ssoStart = await fetch("/api/sso/start", {
      body: JSON.stringify({ email: nextEmail }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    if (ssoStart.ok) {
      const data = (await ssoStart.json()) as {
        callbackURL?: string;
        googleHostedDomain?: string;
      };

      const ssoResponse = await fetch("/api/auth/sign-in/sso", {
        body: JSON.stringify({
          callbackURL: data.callbackURL ?? CHAT_HOME,
          email: nextEmail,
          errorCallbackURL: "/login?error=sso_failed",
          scopes: ["openid", "email", "profile"],
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (ssoResponse.ok) {
        const ssoData = (await ssoResponse.json()) as { url?: string };
        if (ssoData.url) {
          const authorizeUrl = new URL(ssoData.url);
          authorizeUrl.searchParams.set("prompt", "select_account");
          if (data.googleHostedDomain) {
            authorizeUrl.searchParams.set("hd", data.googleHostedDomain);
          }
          window.location.assign(authorizeUrl.toString());
          return;
        }
      }
    }

    const { error } = await authClient.signIn.magicLink({
      callbackURL: CHAT_HOME,
      email: nextEmail,
      errorCallbackURL: "/login?error=magic_link",
      newUserCallbackURL: CHAT_HOME,
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage(error.message || "Unable to send sign-in link.");
      return;
    }

    onNavigate(`/login/check-email?email=${encodeURIComponent(nextEmail)}`);
  }

  async function continueWithSocial(provider: "google" | "microsoft") {
    setErrorMessage(null);
    setSocialLoading(provider);
    const { error } = await authClient.signIn.social({
      callbackURL: CHAT_HOME,
      errorCallbackURL: "/login?error=sso_failed",
      provider,
    });
    if (error) {
      setSocialLoading(null);
      setErrorMessage(error.message || `Unable to continue with ${provider}.`);
    }
  }

  return (
    <>
      <h1 className="font-semibold text-2xl tracking-tight">
        Welcome to Kimiro
      </h1>
      <p className="text-muted-foreground text-sm">
        Sign up or sign in to continue
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {errorMessage ? (
          <p
            aria-live="polite"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label className="font-medium text-sm" htmlFor="email">
            Your work email
          </Label>
          <Input
            autoComplete="email"
            autoFocus
            className="h-10 rounded-lg"
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                continueWithEmail().catch(() => undefined);
              }
            }}
            placeholder="me@example.com"
            type="email"
            value={email}
          />
        </div>

        <Button
          className="h-10 w-full"
          disabled={isLoading || socialLoading !== null}
          onClick={() => {
            continueWithEmail().catch(() => undefined);
          }}
          type="button"
        >
          {isLoading ? "Sending link…" : "Continue with email"}
        </Button>

        {googleEnabled || microsoftEnabled ? (
          <>
            <div className="relative my-1 py-2 text-center">
              <div className="absolute inset-x-0 top-1/2 h-px bg-border/60" />
              <span className="relative bg-background px-3 text-[13px] text-muted-foreground">
                Or
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {googleEnabled ? (
                <Button
                  className={cn("h-10 w-full justify-center gap-2")}
                  disabled={isLoading || socialLoading !== null}
                  onClick={() => {
                    continueWithSocial("google").catch(() => undefined);
                  }}
                  type="button"
                  variant="outline"
                >
                  <GoogleIcon className="size-4" />
                  {socialLoading === "google"
                    ? "Redirecting…"
                    : "Continue with Google"}
                </Button>
              ) : null}
              {microsoftEnabled ? (
                <Button
                  className="h-10 w-full justify-center gap-2"
                  disabled={isLoading || socialLoading !== null}
                  onClick={() => {
                    continueWithSocial("microsoft").catch(() => undefined);
                  }}
                  type="button"
                  variant="outline"
                >
                  <MicrosoftIcon className="size-4" />
                  {socialLoading === "microsoft"
                    ? "Redirecting…"
                    : "Continue with Microsoft"}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
