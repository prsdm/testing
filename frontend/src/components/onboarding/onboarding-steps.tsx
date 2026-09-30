"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { StatusBanner } from "@/components/admin/status-banner";
import { OnboardingSectionCard } from "@/components/onboarding/onboarding-card";
import { OnboardingLlmStep } from "@/components/onboarding/onboarding-llm-step";
import { ProfileSetupFields } from "@/components/onboarding/user-name-prompt";
import { Button } from "@/components/ui/button";

type OnboardingWelcomeStepProps = {
  onContinue: () => void;
  description?: string;
};

export function OnboardingWelcomeStep({
  onContinue,
  description = "Set up your profile to start chatting.",
}: OnboardingWelcomeStepProps) {
  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/80 px-3 py-3">
      <div className="min-w-0">
        <p className="font-medium text-sm">Welcome to Kimiro</p>
        <p className="text-[12px] text-muted-foreground">{description}</p>
      </div>
      <Button
        className="shrink-0 gap-1.5"
        onClick={onContinue}
        size="sm"
        type="button"
      >
        Get started
        <ArrowRight className="size-3.5" />
      </Button>
    </div>
  );
}

type OnboardingNameStepProps = {
  initialDepartment?: string;
  initialJobTitle?: string;
  initialName?: string;
  initialPreferredName?: string;
  onBack?: () => void;
  onSaved: () => void;
  saveLabel?: string;
  showBack?: boolean;
};

export function OnboardingNameStep({
  initialDepartment = "",
  initialJobTitle = "",
  initialName = "",
  initialPreferredName = "",
  onBack,
  onSaved,
  saveLabel = "Save and continue",
  showBack = false,
}: OnboardingNameStepProps) {
  return (
    <OnboardingSectionCard>
      <ProfileSetupFields
        initialDepartment={initialDepartment}
        initialJobTitle={initialJobTitle}
        initialName={initialName}
        initialPreferredName={initialPreferredName}
        onBack={onBack}
        onSaved={onSaved}
        saveLabel={saveLabel}
        showBack={showBack}
      />
    </OnboardingSectionCard>
  );
}

type OnboardingLlmSetupStepProps = {
  hasProviders: boolean;
  onBack: () => void;
  onFinish: () => void;
  onProvidersUpdated: () => void;
};

export function OnboardingLlmSetupStep({
  hasProviders,
  onBack,
  onFinish,
  onProvidersUpdated,
}: OnboardingLlmSetupStepProps) {
  return (
    <OnboardingSectionCard
      description="Connect at least one provider with a valid API key to enable chat."
      title="Connect a model provider"
    >
      <div className="flex flex-col gap-3">
        <OnboardingLlmStep active onProvidersUpdated={onProvidersUpdated} />
        <StatusBanner variant="info">
          Set up integrations and web search in Admin when you&apos;re ready.
        </StatusBanner>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onBack} type="button" variant="outline">
            Back
          </Button>
          <Button
            className="gap-1.5"
            disabled={!hasProviders}
            onClick={onFinish}
            type="button"
          >
            Finish setup
            <CheckCircle2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </OnboardingSectionCard>
  );
}
