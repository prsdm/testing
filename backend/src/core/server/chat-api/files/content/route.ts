import {
  readChatUploadByPathname,
  readChatUploadForSession,
} from "@/core/lib/chat/chat-upload";
import { ApiResponse } from "@/core/lib/http/api-response";
import { readLibraryFileByPathname } from "@/core/lib/library/library-storage";
import { isLibraryPathname } from "@/shared/library/constants";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pathname = searchParams.get("pathname")?.trim();
  const bearer = request.headers.get("authorization");
  const bearerToken = bearer?.toLowerCase().startsWith("bearer ")
    ? bearer.slice(7).trim()
    : null;
  const queryToken = searchParams.get("token")?.trim();
  const token = bearerToken || queryToken;

  if (!(pathname || token)) {
    return ApiResponse.json(
      { error: "pathname or token required" },
      { status: 400 }
    );
  }

  const result = pathname
    ? isLibraryPathname(pathname)
      ? await readLibraryFileByPathname(pathname)
      : await readChatUploadByPathname(pathname)
    : await readChatUploadForSession(token ?? "");

  if ("error" in result) {
    return ApiResponse.json({ error: result.error }, { status: result.status });
  }

  const headers: Record<string, string> = {
    "Cache-Control": "private, max-age=3600",
    "Content-Type": result.contentType,
    "Referrer-Policy": "no-referrer",
  };
  if (
    "fileName" in result &&
    typeof result.fileName === "string" &&
    result.fileName.trim()
  ) {
    headers["Content-Disposition"] =
      `inline; filename="${result.fileName.replace(/"/g, "")}"`;
  }

  return new Response(result.stream, {
    headers,
    status: 200,
  });
}
