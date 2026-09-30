"use client";

import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { AdminListItemLogoFrame } from "@/components/admin/admin-list-item-logo-frame";
import type { ConnectorProvider } from "@/contracts/connectors";
import { cn } from "@/shared/utils";

export type { ConnectorProvider } from "@/contracts/connectors";

const LABELS: Record<ConnectorProvider, string> = {
  confluence: "Confluence",
  gmail: "Gmail",
  "google-calendar": "Google Calendar",
  "google-drive": "Google Drive",
  jira: "Jira",
  notion: "Notion",
  sharepoint: "SharePoint",
  slack: "Slack",
};

const PROVIDER_ICON_MAP: Record<string, ConnectorProvider> = {
  confluence: "confluence",
  "confluence-cloud": "confluence",
  gmail: "gmail",
  "google-calendar": "google-calendar",
  "google-drive": "google-drive",
  jira: "jira",
  notion: "notion",
  sharepoint: "sharepoint",
  slack: "slack",
};

export function resolveConnectorProviderIcon(
  providerId: string
): ConnectorProvider | null {
  return PROVIDER_ICON_MAP[providerId] ?? null;
}

type ConnectorProviderIconProps = ComponentProps<"svg"> & {
  provider: ConnectorProvider;
};

function GmailIcon({ className }: { className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden
      className={cn("size-6 shrink-0 object-contain", className)}
      height={24}
      src="/logos/gmail.png"
      width={24}
    />
  );
}

function GoogleDriveIcon({ className }: { className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden
      className={cn("size-6 shrink-0 object-contain", className)}
      height={24}
      src="/logos/google-drive.png"
      width={24}
    />
  );
}

function GoogleCalendarIcon({ className }: { className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden
      className={cn("size-6 shrink-0 object-contain", className)}
      height={24}
      src="/logos/google-calendar.png"
      width={24}
    />
  );
}

function ConfluenceIcon({ className }: { className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden
      className={cn("size-6 shrink-0 object-contain", className)}
      height={24}
      src="/logos/confluence.png"
      width={24}
    />
  );
}

function NotionIcon({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden
      className={cn("size-6 shrink-0", className)}
      fill="none"
      viewBox="0 0 52 52"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>Notion</title>
      <path
        d="M6.7659 5.89814L32.203 4.10003C35.3274 3.84336 36.1304 4.01643 38.0949 5.38335L46.2148 10.8583C47.5541 11.7999 48 12.0566 48 13.0818V43.1085C48 44.9902 47.2859 46.1034 44.7867 46.2735L15.2475 47.9851C13.3719 48.0702 12.4785 47.8135 11.4963 46.6153L5.51703 39.1735C4.44438 37.8036 4 36.7785 4 35.5802V8.89011C4 7.35159 4.71408 6.06827 6.7659 5.89814Z"
        fill="#FFFFFF"
        stroke="#E5E5E5"
        strokeWidth="1"
      />
      <path
        d="M32.203 4.10003L6.7659 5.89814C4.71408 6.06827 4 7.35159 4 8.89011V35.5802C4 36.7785 4.44438 37.8036 5.51703 39.1735L11.4963 46.6153C12.4785 47.8135 13.3719 48.0702 15.2475 47.9851L44.7867 46.2735C47.2844 46.1034 48 44.9902 48 43.1085V13.0818C48 12.1094 47.5985 11.8293 46.4171 10.9991C46.3491 10.9523 46.2812 10.9053 46.2133 10.8583L38.0949 5.38335C36.1304 4.01643 35.3274 3.84336 32.203 4.10003ZM15.9156 12.5905C13.5037 12.7459 12.9566 12.7811 11.5867 11.7149L8.10364 9.06317C7.74967 8.71997 7.92742 8.29171 8.81925 8.20665L33.2726 6.49653C35.3259 6.32493 36.3955 7.00986 37.1984 7.60825L41.3925 10.5166C41.5718 10.6032 42.0177 11.115 41.4814 11.115L16.2282 12.5699L15.9156 12.5905ZM13.1037 42.8518V17.3615C13.1037 16.2483 13.4608 15.735 14.5303 15.6484L43.5347 14.0234C44.5185 13.9383 44.9629 14.5367 44.9629 15.6484V40.9687C44.9629 42.0819 44.7836 43.0234 43.1777 43.1085L15.4222 44.6485C13.8163 44.7336 13.1037 44.2217 13.1037 42.8518ZM40.5022 18.7284C40.6799 19.4984 40.5022 20.2684 39.6977 20.3564L38.36 20.6101V39.4302C37.1984 40.0285 36.1289 40.3703 35.2355 40.3703C33.8073 40.3703 33.4503 39.942 32.3807 38.6602L23.6325 25.4867V38.2319L26.3999 38.8318C26.3999 38.8318 26.3999 40.3717 24.1673 40.3717L18.0118 40.7135C17.8326 40.3703 18.0118 39.5152 18.6355 39.3451L20.2429 38.9183V22.0665L18.0118 21.8934C17.8326 21.1234 18.2785 20.0117 19.5289 19.9252L26.1333 19.4998L35.2355 32.8434V21.0384L32.9155 20.7832C32.7362 19.8401 33.4503 19.1552 34.3421 19.0716L40.5022 18.7284Z"
        fill="#000000"
      />
    </svg>
  );
}

function SharePointIcon({ className, ...props }: ComponentProps<"svg">) {
  const id = useId().replace(/:/g, "");

  return (
    <svg
      aria-hidden
      className={cn("size-6 shrink-0", className)}
      fill="none"
      viewBox="0 0 52 52"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>SharePoint</title>
      <path
        d="M22.5 30.6666C30.232 30.6666 36.5 24.3986 36.5 16.6666C36.5 8.93464 30.232 2.66663 22.5 2.66663C14.768 2.66663 8.5 8.93464 8.5 16.6666C8.5 24.3986 14.768 30.6666 22.5 30.6666Z"
        fill={`url(#${id}-sp0)`}
      />
      <path
        d="M35.2696 40C41.713 40 46.9362 34.7766 46.9362 28.3333C46.9362 21.89 41.713 16.6666 35.2696 16.6666C28.8263 16.6666 23.6029 21.89 23.6029 28.3333C23.6029 34.7766 28.8263 40 35.2696 40Z"
        fill={`url(#${id}-sp1)`}
      />
      <path
        d="M24.25 49.3333C29.7268 49.3333 34.1667 44.8935 34.1667 39.4167C34.1667 33.9399 29.7268 29.5 24.25 29.5C18.7732 29.5 14.3334 33.9399 14.3334 39.4167C14.3334 44.8935 18.7732 49.3333 24.25 49.3333Z"
        fill={`url(#${id}-sp2)`}
      />
      <path
        d="M19.875 24.3846H8.79167C6.69758 24.3846 5 26.0823 5 28.1763V39.2596C5 41.3537 6.69758 43.0513 8.79167 43.0513H19.875C21.969 43.0513 23.6667 41.3537 23.6667 39.2596V28.1763C23.6667 26.0823 21.969 24.3846 19.875 24.3846Z"
        fill={`url(#${id}-sp3)`}
      />
      <path
        d="M10.3121 36.952L12.3358 35.8955C12.5638 36.3567 12.8615 36.6966 13.2285 36.9147C13.6004 37.133 14.0071 37.2421 14.4486 37.2421C14.9396 37.2421 15.3141 37.1429 15.572 36.9445C15.8299 36.7411 15.9588 36.4362 15.9588 36.0295C15.9588 35.712 15.8348 35.4442 15.5869 35.2259C15.3389 35.0027 14.9 34.8341 14.2701 34.72C13.0697 34.5018 12.1968 34.1199 11.6512 33.5743C11.1106 33.0287 10.8403 32.3492 10.8403 31.5358C10.8403 30.524 11.1974 29.7156 11.9116 29.1104C12.6259 28.5053 13.5682 28.2028 14.7387 28.2028C15.5274 28.2028 16.2217 28.364 16.8219 28.6864C17.4221 29.0087 17.8982 29.47 18.2503 30.0701L16.2714 31.0895C16.0531 30.7522 15.8176 30.5092 15.5646 30.3603C15.3116 30.2065 14.9942 30.1296 14.6123 30.1296C14.156 30.1296 13.8088 30.2289 13.5707 30.4273C13.3376 30.6257 13.221 30.8835 13.221 31.201C13.221 31.4738 13.3327 31.7143 13.5559 31.9227C13.7839 32.126 14.2403 32.2922 14.9247 32.4211C16.0754 32.6394 16.9335 33.0362 17.499 33.6116C18.0693 34.1818 18.3545 34.9035 18.3545 35.7764C18.3545 36.8379 18.0147 37.6786 17.3353 38.2985C16.6557 38.9185 15.6861 39.2285 14.4263 39.2285C13.5136 39.2285 12.6903 39.0301 11.9563 38.6334C11.2272 38.2316 10.6791 37.6711 10.3121 36.952Z"
        fill="white"
      />
      <defs>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={`${id}-sp0`}
          x1={12}
          x2={30.6667}
          y1={6.166_63}
          y2={30.6666}
        >
          <stop stopColor="#00E3DF" />
          <stop offset={0.410_156} stopColor="#0097A8" />
          <stop offset={1} stopColor="#007791" />
        </linearGradient>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={`${id}-sp1`}
          x1={26.5196}
          x2={42.0751}
          y1={19.5833}
          y2={40}
        >
          <stop stopColor="#00E3DF" />
          <stop offset={0.476_427} stopColor="#00A2B8" />
          <stop offset={0.945_063} stopColor="#00637C" />
        </linearGradient>
        <linearGradient
          gradientUnits="userSpaceOnUse"
          id={`${id}-sp2`}
          x1={17.3084}
          x2={27.225}
          y1={30.4917}
          y2={50.325}
        >
          <stop offset={0.053_498_9} stopColor="#75FFF6" />
          <stop offset={0.511_44} stopColor="#00C7D1" />
          <stop offset={0.960_02} stopColor="#0096AD" />
        </linearGradient>
        <radialGradient
          cx={0}
          cy={0}
          gradientTransform="translate(5 24.3846) rotate(45) scale(26.3986)"
          gradientUnits="userSpaceOnUse"
          id={`${id}-sp3`}
          r={1}
        >
          <stop offset={0.0625} stopColor="#00B6BD" />
          <stop offset={0.890_131} stopColor="#00495C" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function SlackIcon({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden
      className={cn("size-6 shrink-0", className)}
      fill="none"
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>Slack</title>
      <path
        d="M26.8925 80.886C26.8925 88.2866 20.8469 94.3323 13.4463 94.3323C6.04561 94.3323 0 88.2866 0 80.886C0 73.4853 6.04561 67.4397 13.4463 67.4397H26.8925V80.886Z"
        fill="#E01E5A"
      />
      <path
        d="M33.6675 80.886C33.6675 73.4853 39.7131 67.4397 47.1137 67.4397C54.5144 67.4397 60.56 73.4853 60.56 80.886V114.554C60.56 121.954 54.5144 128 47.1137 128C39.7131 128 33.6675 121.954 33.6675 114.554V80.886Z"
        fill="#E01E5A"
      />
      <path
        d="M47.1137 26.8925C39.7131 26.8925 33.6675 20.8469 33.6675 13.4463C33.6675 6.0456 39.7131 0 47.1137 0C54.5144 0 60.56 6.0456 60.56 13.4463V26.8925H47.1137Z"
        fill="#36C5F0"
      />
      <path
        d="M47.114 33.6678C54.5147 33.6678 60.5603 39.7134 60.5603 47.114C60.5603 54.5147 54.5147 60.5603 47.114 60.5603H13.4463C6.0456 60.5603 0 54.5147 0 47.114C0 39.7134 6.0456 33.6678 13.4463 33.6678H47.114Z"
        fill="#36C5F0"
      />
      <path
        d="M101.107 47.114C101.107 39.7134 107.153 33.6678 114.554 33.6678C121.954 33.6678 128 39.7134 128 47.114C128 54.5147 121.954 60.5603 114.554 60.5603H101.107V47.114Z"
        fill="#2EB67D"
      />
      <path
        d="M94.3322 47.114C94.3322 54.5147 88.2866 60.5603 80.8859 60.5603C73.4853 60.5603 67.4397 54.5147 67.4397 47.114V13.4463C67.4397 6.0456 73.4853 0 80.8859 0C88.2866 0 94.3322 6.0456 94.3322 13.4463V47.114Z"
        fill="#2EB67D"
      />
      <path
        d="M80.8859 101.107C88.2866 101.107 94.3322 107.153 94.3322 114.554C94.3322 121.954 88.2866 128 80.8859 128C73.4853 128 67.4397 121.954 67.4397 114.554V101.107H80.8859Z"
        fill="#ECB22E"
      />
      <path
        d="M80.8859 94.3323C73.4853 94.3323 67.4397 88.2866 67.4397 80.886C67.4397 73.4853 73.4853 67.4397 80.8859 67.4397H114.554C121.954 67.4397 128 73.4853 128 80.886C128 88.2866 121.954 94.3323 114.554 94.3323H80.8859Z"
        fill="#ECB22E"
      />
    </svg>
  );
}

function JiraIcon({ className }: { className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden
      className={cn("size-6 shrink-0 object-contain", className)}
      height={24}
      src="/logos/jira.png"
      width={24}
    />
  );
}

export function ConnectorProviderIcon({
  provider,
  className,
}: ConnectorProviderIconProps) {
  switch (provider) {
    case "google-drive":
      return <GoogleDriveIcon className={className} />;
    case "gmail":
      return <GmailIcon className={className} />;
    case "google-calendar":
      return <GoogleCalendarIcon className={className} />;
    case "confluence":
      return <ConfluenceIcon className={className} />;
    case "notion":
      return <NotionIcon className={className} />;
    case "sharepoint":
      return <SharePointIcon className={className} />;
    case "slack":
      return <SlackIcon className={className} />;
    case "jira":
      return <JiraIcon className={className} />;
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

export function getConnectorLabel(provider: ConnectorProvider) {
  return LABELS[provider];
}

export function ConnectorCardHeading({
  provider,
  description,
  children,
}: {
  provider: ConnectorProvider;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <AdminListItemLogoFrame>
        <ConnectorProviderIcon
          className="size-full max-h-6 max-w-6 shrink-0 object-contain"
          provider={provider}
        />
      </AdminListItemLogoFrame>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="font-medium text-sm">{children ?? LABELS[provider]}</h2>
        <p className="truncate text-[13px] text-muted-foreground leading-snug">
          {description}
        </p>
      </div>
    </div>
  );
}

export function ConnectorCardTitle({
  provider,
  children,
}: {
  provider: ConnectorProvider;
  children?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <ConnectorProviderIcon provider={provider} />
      <h2 className="font-medium text-sm">{children ?? LABELS[provider]}</h2>
    </div>
  );
}

const GOOGLE_APPS_PROVIDERS = [
  "google-drive",
  "gmail",
  "google-calendar",
] as const satisfies readonly ConnectorProvider[];

export function GoogleAppsCardTitle({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center">
        {GOOGLE_APPS_PROVIDERS.map((provider) => (
          <ConnectorProviderIcon
            className="-ml-1 first:ml-0 size-5 ring-2 ring-background"
            key={provider}
            provider={provider}
          />
        ))}
      </div>
      <h2 className="font-medium text-sm">{children}</h2>
    </div>
  );
}
