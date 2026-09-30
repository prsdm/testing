import { cn } from "@/lib/cn";

export const APP_BRAND_NAME = "Kimiro";

const kimiroKMarkUrl = `${process.env.KIMIRO_BASE_PATH ?? ""}/logos/kimiro-k-mark.png`;

function KimiroKMarkImage({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <img
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      className={className}
      decoding="async"
      draggable={false}
      src={kimiroKMarkUrl}
    />
  );
}

/** K mark only (sidebar, auth, settings headers — no square tile). */
export function KimiroLogoMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <KimiroKMarkImage
      className={cn(
        "aspect-square shrink-0 object-contain dark:invert",
        className
      )}
      title={title}
    />
  );
}

/**
 * K in a square tile (message avatars, composer, mentions).
 * Light UI: black tile, white mark. Dark UI: white tile, black mark.
 */
export function KimiroLogoTile({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <div
      aria-hidden={title ? undefined : true}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden",
        "bg-black dark:bg-white",
        "ring-1 ring-black/10 ring-inset dark:ring-white/15",
        className
      )}
    >
      <KimiroKMarkImage
        className="size-full object-contain p-[18%] invert dark:invert-0"
        title={title}
      />
    </div>
  );
}

export function SidebarAppLogo({ className }: { className?: string }) {
  return (
    <KimiroLogoMark
      className={cn("shrink-0", className)}
      title={APP_BRAND_NAME}
    />
  );
}

const assistantCloudTitleId = "kimiro-assistant-cloud-title";

/** Legacy cloud mark for custom agents (not the Kimiro app icon). */
export function AssistantCloudMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      aria-hidden={title ? undefined : true}
      aria-labelledby={title ? assistantCloudTitleId : undefined}
      className={cn("aspect-[695.56/637.84] shrink-0 text-current", className)}
      role={title ? "img" : undefined}
      viewBox="0 0 695.56 637.84"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title id={assistantCloudTitleId}>{title}</title> : null}
      <g fill="currentColor">
        <path d="M600.25,569.7c-52.44,58.34-132.51,67.3-199.43,27.08-36.87,33.63-86.31,47.15-135.39,38.53-65.11-12.82-117.06-62.27-128.34-129.02-45.3-8.78-84.24-35.51-109.66-73.97C10.74,407.06,1.22,379.05.29,348.59c-2.81-47.52,14.64-93.15,46.9-128.04,26.22-28.55,66.11-51.4,105.85-53.22,2.69-45.13,23.08-85.91,55.87-117.09C243.68,16.64,290.13-.94,338.68.04c72.31,2.08,131.66,46.54,157.8,113.22,61.01-15.41,118.34,5.02,158.63,51.4,13.91,16.17,25.07,33.54,32.02,53.91,15.21,44.56,9.49,93.02-14.45,133.48-10.57,17.87-23.52,33.16-38.94,47.25,20.81,58.47,7.25,123.55-33.5,170.4ZM402.85,542.59c24.01,18.08,52.5,27.58,82.82,25.88,53.04-2.98,92.26-45.27,104.09-95.95,6.05-25.93,2.37-52.59-9.66-75.97-4.67-9.07-1.56-16.31,6.09-21.92,18.93-13.86,33.77-32.61,43.82-53.86,11.42-24.15,14.93-50.95,7.42-76.8-9.83-33.8-33.59-62.16-64.79-77.97-30.29-15.35-64.43-14.24-94.88-.59-9.08,4.07-16.11-4.17-17.89-12.26-5.82-26.45-20.46-49.68-40.39-67.58-20.96-18.83-46.44-29.84-74.62-31.94-80.96-6.02-150.12,58.47-147.07,138.71.4,10.58-7.24,16.29-17.08,16.22-30.85-.22-59.49,11.82-82.5,32.35-35.82,31.95-52.52,82.74-39.85,129.59,13.42,49.65,56.26,85.43,106.55,92.56,9.05,1.28,15.55,6.01,16.02,15.58.8,16.45,6.05,31.61,14.08,45.86,18.85,33.48,51.87,55.34,90.23,59.39,23.94,2.53,47.23-1.8,67.97-13.75,12.19-7.02,22.65-15.07,32.08-25.44,4.24-4.67,12.38-6.03,17.57-2.12Z" />
        <path d="M405.58,424.38c-49.96-12.62-58.34-129.99-10.88-166.58,13.17-10.15,29.66-9.22,41.83,2.51,27.51,26.51,30.13,79.17,20.95,115.93-6.37,25.51-24.37,55.1-51.9,48.14Z" />
        <path d="M291.08,418.5c-13.66,10.43-31.08,8.6-43.35-2.93-10.2-9.59-16.82-22.12-20.74-36.09-9.74-34.71-6.47-80.03,14.56-109.89,11.48-16.31,30-24.89,47-13.56,8.52,5.68,14.55,13.55,19.15,22.87,15.95,32.28,16.39,80.06,2.45,113.17-4.33,10.28-9.9,19.44-19.07,26.45-4.33,10.28-9.9,19.44-19.07,26.45Z" />
      </g>
    </svg>
  );
}
