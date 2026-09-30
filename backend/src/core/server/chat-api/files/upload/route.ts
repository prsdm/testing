import { z } from "zod";
import { auth } from "@/core/lib/auth/server-session";
import { assertChatApiAccess } from "@/core/lib/chat/assert-chat-api-access";
import { putChatUpload } from "@/core/lib/chat/chat-upload";
import { ApiResponse } from "@/core/lib/http/api-response";
import {
  CHAT_ATTACHABLE_MEDIA_TYPES,
  chatAttachableMimeFromFileName,
  MAX_CHAT_ATTACH_BYTES,
} from "@/shared/artifacts/drive-import";

const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= MAX_CHAT_ATTACH_BYTES, {
      message: "File size should be less than 5MB",
    }),
});

function resolveUploadContentType(file: Blob, filename: string) {
  if ((CHAT_ATTACHABLE_MEDIA_TYPES as readonly string[]).includes(file.type)) {
    return file.type;
  }
  return chatAttachableMimeFromFileName(filename);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return ApiResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.email) {
    return ApiResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    (await assertChatApiAccess({
      userEmail: session.user.email,
      userId: session.user.id,
    })) === "forbidden"
  ) {
    return ApiResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return ApiResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return ApiResponse.json({ error: errorMessage }, { status: 400 });
    }

    const filename = (formData.get("file") as File).name;
    const contentType = resolveUploadContentType(file, filename);
    if (!contentType) {
      return ApiResponse.json(
        {
          error:
            "File type should be JPEG, PNG, PDF, DOCX, XLSX, TXT, or Markdown",
        },
        { status: 400 }
      );
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileBuffer = await file.arrayBuffer();

    try {
      const data = await putChatUpload({
        body: fileBuffer,
        contentType,
        safeName,
        userId: session.user.id,
      });

      return ApiResponse.json(data);
    } catch (_error) {
      return ApiResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (_error) {
    return ApiResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
