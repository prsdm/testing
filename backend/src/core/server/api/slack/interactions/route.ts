import { handleSlackInteractionRequest } from "@/core/lib/slack-integration/interactions";

export const maxDuration = 300;

export function POST(request: Request) {
  return handleSlackInteractionRequest(request);
}
