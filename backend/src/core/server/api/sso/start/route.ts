import { handleSsoStartRequest } from "@/core/lib/auth/sso-start";

export function POST(request: Request) {
  return handleSsoStartRequest(request);
}
