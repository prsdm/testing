import { formatMessageSectionTime } from "@/lib/chat/message-section-time";

type MessageSectionTimeProps = {
  createdAt: string;
};

export function MessageSectionTime({ createdAt }: MessageSectionTimeProps) {
  const label = formatMessageSectionTime(createdAt);
  if (!label) {
    return null;
  }

  return (
    <div className="flex justify-center py-1 md:py-2">
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  );
}
