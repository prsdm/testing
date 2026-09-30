export type ProfileOnboardingStatus = {
  needsProfileSetup: boolean;
  profile: {
    name: string;
    jobTitle: string;
    department: string;
    preferredName?: string;
  } | null;
};

export function getProfileOnboardingStatusUrl(tenantSlug: string) {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  return `${basePath}/api/users/${tenantSlug}/onboarding-status`;
}
