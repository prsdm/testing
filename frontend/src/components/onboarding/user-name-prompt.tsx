"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { OnboardingSectionCard } from "@/components/onboarding/onboarding-card";
import { useUpdateSessionUser } from "@/components/providers/session-user-provider";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveKimiroAddressName } from "@/shared/kimiro-user-name";

type ProfileSetupFieldsProps = {
  initialName?: string;
  initialJobTitle?: string;
  initialDepartment?: string;
  initialPreferredName?: string;
  onBack?: () => void;
  onSaved: () => void;
  saveLabel?: string;
  showBack?: boolean;
};

function ProfileSetupFields({
  initialName = "",
  initialJobTitle = "",
  initialDepartment = "",
  initialPreferredName = "",
  onBack,
  onSaved,
  saveLabel = "Save and continue",
  showBack = false,
}: ProfileSetupFieldsProps) {
  const router = useRouter();
  const tenantSlug = useTenantSlug();
  const updateSessionUser = useUpdateSessionUser();
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  const [name, setName] = useState(initialName);
  const [preferredName, setPreferredName] = useState(initialPreferredName);
  const [jobTitle, setJobTitle] = useState(initialJobTitle);
  const [department, setDepartment] = useState(initialDepartment);
  const [isSaving, setIsSaving] = useState(false);
  const [preferredNameTouched, setPreferredNameTouched] = useState(
    Boolean(initialPreferredName.trim())
  );

  useEffect(() => {
    if (preferredNameTouched) {
      return;
    }
    const suggestion = resolveKimiroAddressName({
      fullName: name,
      preferredName: "",
    });
    if (suggestion) {
      setPreferredName(suggestion);
    }
  }, [name, preferredNameTouched]);

  async function saveProfile() {
    const trimmedName = name.trim();
    const trimmedPreferredName = preferredName.trim();
    const trimmedJobTitle = jobTitle.trim();
    const trimmedDepartment = department.trim();
    if (!trimmedName) {
      toast.error("Please enter your name.");
      return;
    }
    if (!trimmedPreferredName) {
      toast.error("Please enter your display name.");
      return;
    }
    if (!trimmedJobTitle) {
      toast.error("Please enter your role.");
      return;
    }
    if (!trimmedDepartment) {
      toast.error("Please enter your department.");
      return;
    }

    setIsSaving(true);
    const response = await fetch(
      `${basePath}/api/users/${tenantSlug}/profile`,
      {
        body: JSON.stringify({
          completeProfileOnboarding: true,
          department: trimmedDepartment,
          jobTitle: trimmedJobTitle,
          name: trimmedName,
          preferredName: trimmedPreferredName,
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(payload?.error ?? "Failed to save your profile.");
      setIsSaving(false);
      return;
    }

    const payload = (await response.json()) as {
      profile: { name: string; jobTitle: string; department: string };
    };
    updateSessionUser({ name: payload.profile.name });
    setIsSaving(false);
    router.refresh();
    onSaved();
  }

  const canSave =
    Boolean(name.trim()) &&
    Boolean(preferredName.trim()) &&
    Boolean(jobTitle.trim()) &&
    Boolean(department.trim());

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <label className="font-medium text-sm" htmlFor="profile-setup-name">
              Name
            </label>
            <p className="text-[12px] text-muted-foreground">
              How Kimiro greets you.
            </p>
          </div>
          <Input
            autoComplete="name"
            className="rounded-lg"
            id="profile-setup-name"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveProfile().catch(() => undefined);
              }
            }}
            placeholder="e.g. Jane Doe"
            value={name}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <label
              className="font-medium text-sm"
              htmlFor="profile-setup-preferred-name"
            >
              Display name
            </label>
            <p className="text-[12px] text-muted-foreground">
              How you appear in channels and threads.
            </p>
          </div>
          <Input
            autoComplete="nickname"
            className="rounded-lg"
            id="profile-setup-preferred-name"
            onChange={(event) => {
              setPreferredNameTouched(true);
              setPreferredName(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveProfile().catch(() => undefined);
              }
            }}
            placeholder="e.g. Prasad"
            value={preferredName}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <label className="font-medium text-sm" htmlFor="profile-setup-role">
              Role
            </label>
            <p className="text-[12px] text-muted-foreground">
              Helps tailor responses.
            </p>
          </div>
          <Input
            autoComplete="organization-title"
            className="rounded-lg"
            id="profile-setup-role"
            onChange={(event) => setJobTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveProfile().catch(() => undefined);
              }
            }}
            placeholder="e.g. Product Manager"
            value={jobTitle}
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <div className="flex flex-col gap-0.5">
            <label
              className="font-medium text-sm"
              htmlFor="profile-setup-department"
            >
              Department
            </label>
            <p className="text-[12px] text-muted-foreground">
              Helps teammates find you in chat.
            </p>
          </div>
          <Input
            autoComplete="organization"
            className="rounded-lg"
            id="profile-setup-department"
            onChange={(event) => setDepartment(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveProfile().catch(() => undefined);
              }
            }}
            placeholder="e.g. Engineering"
            value={department}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {showBack && onBack ? (
          <Button onClick={onBack} type="button" variant="outline">
            Back
          </Button>
        ) : null}
        <Button
          disabled={isSaving || !canSave}
          onClick={() => {
            saveProfile().catch(() => undefined);
          }}
          type="button"
        >
          {isSaving ? "Saving…" : saveLabel}
        </Button>
      </div>
    </div>
  );
}

type UserNamePromptProps = {
  initialName?: string;
  initialJobTitle?: string;
  initialDepartment?: string;
  initialPreferredName?: string;
  onSaved: () => void;
};

export function UserNamePrompt({
  initialName = "",
  initialJobTitle = "",
  initialDepartment = "",
  initialPreferredName = "",
  onSaved,
}: UserNamePromptProps) {
  return (
    <OnboardingSectionCard>
      <ProfileSetupFields
        initialDepartment={initialDepartment}
        initialJobTitle={initialJobTitle}
        initialName={initialName}
        initialPreferredName={initialPreferredName}
        onSaved={onSaved}
        saveLabel="Save and finish"
      />
    </OnboardingSectionCard>
  );
}

export { ProfileSetupFields };
