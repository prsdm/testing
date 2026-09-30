"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { UserAvatar } from "@/components/chat/user-avatar";
import { useUpdateSessionUser } from "@/components/providers/session-user-provider";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SessionUser } from "@/shared/auth/types";
import { resolveKimiroAddressName } from "@/shared/kimiro-user-name";
import { getProfileOnboardingStatusUrl } from "@/shared/onboarding/profile-status";
import { fetcher } from "@/shared/utils";

type UserProfile = {
  name: string;
  email: string;
  image: string | null;
  jobTitle: string;
  department: string;
  preferredName: string;
};

type UserProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SessionUser;
};

function profileFormFromData(profile: UserProfile) {
  return {
    department: profile.department,
    jobTitle: profile.jobTitle,
    name: profile.name,
    preferredName: profile.preferredName ?? "",
  };
}

export function UserProfileDialog({
  open,
  onOpenChange,
  user,
}: UserProfileDialogProps) {
  const router = useRouter();
  const tenantSlug = useTenantSlug();
  const updateSessionUser = useUpdateSessionUser();
  const { mutate: mutateGlobalCache } = useSWRConfig();
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  const [values, setValues] = useState(() => ({
    department: "",
    jobTitle: "",
    name: user.name?.trim() ?? "",
    preferredName: "",
  }));
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading, mutate } = useSWR<{ profile: UserProfile }>(
    open ? `${basePath}/api/users/${tenantSlug}/profile` : null,
    fetcher
  );

  const profile = data?.profile;
  const resolvedEmail = profile?.email ?? user.email ?? "";
  const displayImage = profile?.image ?? user.image ?? null;
  const displayName = values.name || profile?.name || user.name;

  useEffect(() => {
    if (!open || !profile) {
      return;
    }
    setValues(profileFormFromData(profile));
  }, [open, profile]);

  const profileSummary = useMemo(() => {
    const parts = [resolvedEmail];
    const jobTitle = values.jobTitle.trim() || profile?.jobTitle?.trim();
    const department = values.department.trim() || profile?.department?.trim();
    if (jobTitle) {
      parts.push(jobTitle);
    }
    if (department) {
      parts.push(department);
    }
    return parts.join(" · ");
  }, [
    profile?.department,
    profile?.jobTitle,
    resolvedEmail,
    values.department,
    values.jobTitle,
  ]);

  const isDirty = useMemo(() => {
    if (!profile) {
      return false;
    }
    const baseline = profileFormFromData(profile);
    return (
      values.name.trim() !== baseline.name ||
      values.jobTitle.trim() !== baseline.jobTitle ||
      values.department.trim() !== baseline.department ||
      values.preferredName.trim() !== baseline.preferredName
    );
  }, [profile, values]);

  const kimiroAddressPreview = resolveKimiroAddressName({
    fullName: values.name.trim() || profile?.name || user.name,
    preferredName: values.preferredName,
  });

  const handleSave = async () => {
    if (!values.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (!values.preferredName.trim()) {
      toast.error("Display name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const patchResponse = await fetch(
        `${basePath}/api/users/${tenantSlug}/profile`,
        {
          body: JSON.stringify({
            department: values.department.trim() || null,
            jobTitle: values.jobTitle.trim() || null,
            name: values.name.trim(),
            preferredName: values.preferredName.trim(),
          }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        }
      );

      if (!patchResponse.ok) {
        const payload = (await patchResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(payload?.error ?? "Failed to save profile");
        return;
      }

      const payload = (await patchResponse.json()) as { profile: UserProfile };
      updateSessionUser({ name: payload.profile.name });
      await mutate({ profile: payload.profile }, { revalidate: false });
      await mutateGlobalCache(getProfileOnboardingStatusUrl(tenantSlug));
      toast.success("Profile updated");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-lg p-0 sm:max-w-md [&_button]:cursor-pointer"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="px-6 py-5">
          <div className="flex flex-col gap-3">
            <UserAvatar
              className="rounded-md"
              email={resolvedEmail}
              image={displayImage}
              name={displayName}
              size="md"
              userId={user.id}
            />
            <div className="flex flex-col gap-0">
              <DialogTitle className="font-medium text-base leading-normal">
                Profile
              </DialogTitle>
              <DialogDescription className="text-[12px] text-muted-foreground">
                {profileSummary}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mx-6 h-px bg-border/60" />

        <div className="flex flex-col px-6 py-6">
          {isLoading && !profile ? (
            <div className="flex items-center justify-center py-10">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-0">
                <h3 className="font-medium text-sm">Your details</h3>
                <p className="text-[12px] text-muted-foreground">
                  Update how you appear in Kimiro and in chat context.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <label className="font-medium text-sm" htmlFor="profile-name">
                    Name
                  </label>
                  <Input
                    autoComplete="name"
                    className="rounded-lg"
                    id="profile-name"
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="e.g. Jane Doe"
                    value={values.name}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    className="font-medium text-sm"
                    htmlFor="profile-preferred-name"
                  >
                    Display name
                  </label>
                  <Input
                    autoComplete="nickname"
                    className="rounded-lg"
                    id="profile-preferred-name"
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        preferredName: event.target.value,
                      }))
                    }
                    placeholder={
                      kimiroAddressPreview
                        ? `e.g. ${kimiroAddressPreview}`
                        : "e.g. Prasad"
                    }
                    required
                    value={values.preferredName}
                  />
                  <p className="text-[12px] text-muted-foreground">
                    How you appear in channels, threads, and when Kimiro
                    addresses you.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    className="font-medium text-sm"
                    htmlFor="profile-email"
                  >
                    Email
                  </label>
                  <Input
                    className="rounded-lg"
                    disabled
                    id="profile-email"
                    readOnly
                    value={resolvedEmail}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    className="font-medium text-sm"
                    htmlFor="profile-job-title"
                  >
                    Role
                  </label>
                  <Input
                    autoComplete="organization-title"
                    className="rounded-lg"
                    id="profile-job-title"
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        jobTitle: event.target.value,
                      }))
                    }
                    placeholder="e.g. Product Manager"
                    value={values.jobTitle}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    className="font-medium text-sm"
                    htmlFor="profile-department"
                  >
                    Department
                  </label>
                  <Input
                    autoComplete="organization"
                    className="rounded-lg"
                    id="profile-department"
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        department: event.target.value,
                      }))
                    }
                    placeholder="e.g. Engineering"
                    value={values.department}
                  />
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="mx-6 h-px bg-border/60" />

        <DialogFooter className="gap-2 px-6 py-4 sm:justify-between">
          <Button
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={
              !isDirty || isSaving || isLoading || !values.preferredName.trim()
            }
            onClick={handleSave}
            type="button"
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
