"use client";

import { ArrowLeftRight, ChevronDown, MailPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SidebarAppLogo } from "@/components/chat/sidebar-app-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  isValidInviteEmail,
  parseInviteEmails,
} from "@/lib/users/parse-invite-emails";
import type { TenantMemberRole } from "@/shared/users/tenant-member-role";

const INVITE_EMAIL_PLACEHOLDER =
  "Example: user@example.com user2@example.com so on";

const ROLE_OPTIONS: Array<{ value: TenantMemberRole; label: string }> = [
  { label: "Basic", value: "basic" },
  { label: "Admin", value: "admin" },
];

export function TenantInviteButton({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [emailsText, setEmailsText] = useState("");
  const [role, setRole] = useState<TenantMemberRole>("basic");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function sendInvites() {
    setFormError(null);
    const parsed = parseInviteEmails(emailsText);
    if (parsed.length === 0) {
      setFormError("Enter at least one email.");
      return;
    }

    const invalid = parsed.filter((email) => !isValidInviteEmail(email));
    if (invalid.length > 0) {
      setFormError(`Invalid email: ${invalid.at(0)}`);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/users/${tenantSlug}/invites`, {
        body: JSON.stringify({ emails: parsed, role }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        invited?: Array<{ email: string }>;
        failed?: Array<{ email: string; error: string }>;
      };

      const invitedCount = data.invited?.length ?? 0;
      const failed = data.failed ?? [];
      const failureMessage =
        data.error || failed.at(0)?.error || "Could not send invites";

      if (!response.ok && invitedCount === 0) {
        setFormError(failureMessage);
        toast.error(failureMessage);
        return;
      }

      if (invitedCount > 0 && failed.length === 0) {
        toast.success(
          invitedCount === 1
            ? `Invite sent to ${data.invited?.at(0)?.email}`
            : `Invited ${invitedCount} people`
        );
      } else if (invitedCount > 0) {
        toast.success(
          `Invited ${invitedCount} of ${invitedCount + failed.length}. ${failed.at(0)?.error}`
        );
      }

      setEmailsText("");
      setRole("basic");
      setFormError(null);
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        className="h-8 cursor-pointer"
        onClick={() => {
          setFormError(null);
          setOpen(true);
        }}
        size="sm"
        type="button"
      >
        <MailPlus className="size-3.5" />
        Invite users
      </Button>

      <Dialog
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setFormError(null);
          }
        }}
        open={open}
      >
        <DialogContent
          className="gap-0 overflow-hidden rounded-lg p-0 sm:max-w-xl [&_button]:cursor-pointer"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader className="px-6 py-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <MailPlus
                  aria-hidden="true"
                  className="size-6 shrink-0 text-foreground"
                />
                <ArrowLeftRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <SidebarAppLogo className="size-6! text-foreground" />
              </div>
              <div className="flex flex-col gap-0.5">
                <DialogTitle className="font-medium text-base leading-normal">
                  Invite teammates
                </DialogTitle>
                <DialogDescription className="text-[13px] text-muted-foreground">
                  They&apos;ll get an email and join when they sign in.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="mx-6 h-px bg-border/60" />

          <div className="flex flex-col gap-8 px-6 py-6">
            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-medium text-sm">Email</h3>
                <p className="text-[13px] text-muted-foreground">
                  Separate multiple emails with spaces or commas.
                </p>
              </div>
              <Textarea
                autoComplete="off"
                className="min-h-16 resize-y rounded-lg"
                id="invite-emails"
                onChange={(event) => {
                  setEmailsText(event.target.value);
                  if (formError) {
                    setFormError(null);
                  }
                }}
                placeholder={INVITE_EMAIL_PLACEHOLDER}
                rows={3}
                value={emailsText}
              />
            </section>

            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="font-medium text-sm">Role</h3>
                <p className="text-[13px] text-muted-foreground leading-snug">
                  Choose what they can access in this workspace.
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="bg-transparent hover:bg-muted/50 aria-expanded:bg-muted/50"
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {ROLE_OPTIONS.find((option) => option.value === role)
                      ?.label ?? "Basic"}
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-36">
                  <DropdownMenuRadioGroup
                    onValueChange={(value) =>
                      setRole(value as TenantMemberRole)
                    }
                    value={role}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {formError ? (
              <p
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm"
                role="alert"
              >
                {formError}
                {/seat|subscribe|billing/i.test(formError) ? (
                  <>
                    {" "}
                    <Link
                      className="font-medium underline underline-offset-2"
                      href="/admin/billing"
                      onClick={() => setOpen(false)}
                    >
                      Buy seats
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>

          <div className="mx-6 h-px bg-border/60" />
          <DialogFooter className="gap-2 px-6 py-4 sm:justify-between">
            <Button
              disabled={submitting}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={submitting}
              onClick={() => {
                sendInvites().catch(() => undefined);
              }}
              type="button"
            >
              {submitting ? "Sending..." : "Send invites"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
