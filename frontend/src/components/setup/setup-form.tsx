"use client";

import { useEffect, useMemo, useState } from "react";
import {
  providerLabelById,
  type SupportedSsoProvider,
} from "@/shared/sso/providers";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type SetupFormProps = {
  token?: string;
  initialProvider?: string;
};

function normalizeProvider(value: string): SupportedSsoProvider {
  if (
    value === "okta" ||
    value === "azure_ad" ||
    value === "google_workspace"
  ) {
    return value;
  }

  return "google_workspace";
}

export function SetupForm({
  token = "",
  initialProvider = "",
}: SetupFormProps) {
  const [setupToken, setSetupToken] = useState(token);
  const [provider, setProvider] = useState<SupportedSsoProvider>(
    normalizeProvider(initialProvider)
  );
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [issuerUrl, setIssuerUrl] = useState("");
  const [adminEmailsRaw, setAdminEmailsRaw] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (setupToken) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const nextToken = params.get("token") ?? "";
    const nextProvider = params.get("provider") ?? "";
    if (nextToken) {
      setSetupToken(nextToken);
    }
    if (nextProvider) {
      setProvider(normalizeProvider(nextProvider));
    }
  }, [setupToken]);

  const requiresIssuer = provider === "okta" || provider === "azure_ad";
  const showIssuerField = provider !== "google_workspace";
  let issuerPlaceholder = "https://accounts.google.com";
  if (provider === "okta") {
    issuerPlaceholder = "https://your-org.okta.com";
  } else if (provider === "azure_ad") {
    issuerPlaceholder = "https://login.microsoftonline.com/<tenant-id>/v2.0";
  }

  const adminEmails = useMemo(
    () =>
      adminEmailsRaw
        .split(/[,\n]/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0),
    [adminEmailsRaw]
  );
  useEffect(() => {
    if (!isCompleted) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.close();
      window.location.href = "/login";
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isCompleted]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/setup", {
      body: JSON.stringify({
        adminEmails,
        clientId,
        clientSecret,
        issuerUrl: issuerUrl || undefined,
        provider,
        token: setupToken,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(
        payload?.error?.trim() ||
          "Unable to save configuration. Check your details and try again."
      );
      return;
    }

    setIsCompleted(true);
    setMessage("Setup completed. Your SSO configuration is now active.");
  }

  return (
    <section className="w-full rounded-2xl border bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Finish SSO Setup</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Provide your identity provider details and one or more admin contact
        emails.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            disabled={isSubmitting || isCompleted}
            id="provider"
            onChange={(event) =>
              setProvider(normalizeProvider(event.target.value))
            }
            value={provider}
          >
            {Object.entries(providerLabelById).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-id">Client ID</Label>
          <Input
            disabled={isSubmitting || isCompleted}
            id="client-id"
            onChange={(event) => setClientId(event.target.value)}
            required
            value={clientId}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-secret">Client Secret</Label>
          <Input
            disabled={isSubmitting || isCompleted}
            id="client-secret"
            onChange={(event) => setClientSecret(event.target.value)}
            required
            type="password"
            value={clientSecret}
          />
        </div>

        {showIssuerField ? (
          <div className="space-y-2">
            <Label htmlFor="issuer-url">
              Issuer URL{requiresIssuer ? "" : " (optional)"}
            </Label>
            <Input
              disabled={isSubmitting || isCompleted}
              id="issuer-url"
              onChange={(event) => setIssuerUrl(event.target.value)}
              placeholder={issuerPlaceholder}
              required={requiresIssuer}
              value={issuerUrl}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="admin-emails">Admin emails (one or more)</Label>
          <textarea
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={isSubmitting || isCompleted}
            id="admin-emails"
            onChange={(event) => setAdminEmailsRaw(event.target.value)}
            placeholder={"sarah@acmeinc.com\nit-admin@acmeinc.com"}
            required
            value={adminEmailsRaw}
          />
        </div>

        <Button
          disabled={isSubmitting || isCompleted || setupToken.length === 0}
          type="submit"
        >
          {isSubmitting
            ? "Setting up..."
            : isCompleted
              ? "Setup completed"
              : "Save & Validate"}
        </Button>

        {isCompleted ? (
          <Button
            onClick={() => {
              window.location.href = "/login";
            }}
            type="button"
            variant="secondary"
          >
            Go to login
          </Button>
        ) : null}
      </form>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {message ? (
        <p className="mt-4 text-sm text-emerald-600">
          {message} Redirecting to login...
        </p>
      ) : null}
    </section>
  );
}
