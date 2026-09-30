import { z } from "zod";
import {
  getChatParticipantRole,
  isRoomChat,
} from "@/core/lib/chat/chat-access";
import {
  listLibraryFiles,
  listLibraryFilesForChannelChat,
} from "@/core/lib/db/library-queries";
import {
  getChatById,
  toTenantUserId,
  withTenantId,
} from "@/core/lib/db/queries";
import { ApiResponse } from "@/core/lib/http/api-response";
import {
  toLibraryFileResponse,
  writeLibraryFile,
} from "@/core/lib/library/library-storage";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";
import {
  CHAT_ATTACHABLE_MEDIA_TYPES,
  chatAttachableMimeFromFileName,
} from "@/shared/artifacts/drive-import";
import {
  LIBRARY_ALLOWED_CONTENT_TYPES,
  MAX_LIBRARY_FILE_BYTES,
  sanitizeLibraryFileName,
} from "@/shared/library/constants";

const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= MAX_LIBRARY_FILE_BYTES, {
      message: `File size should be less than ${MAX_LIBRARY_FILE_BYTES} bytes`,
    }),
});

function resolveUploadContentType(file: Blob, filename: string) {
  if (
    (LIBRARY_ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type)
  ) {
    return file.type;
  }
  if ((CHAT_ATTACHABLE_MEDIA_TYPES as readonly string[]).includes(file.type)) {
    return file.type;
  }
  return chatAttachableMimeFromFileName(filename);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const url = new URL(request.url);
  const chatId = url.searchParams.get("chatId")?.trim() || undefined;

  const tenantUserId = toTenantUserId(authResult.userId);

  const files = await withTenantId(authResult.tenant.id, async () => {
    if (chatId) {
      const chat = await getChatById({ id: chatId });
      if (chat && isRoomChat(chat)) {
        const role = await getChatParticipantRole({
          authUserId: authResult.userId,
          chatId,
        });
        if (!role) {
          return null;
        }
        return listLibraryFilesForChannelChat({
          chatId,
          limit: 50,
          tenantId: authResult.tenant.id,
        });
      }
    }

    return listLibraryFiles({
      chatId,
      limit: 50,
      tenantId: authResult.tenant.id,
      userId: tenantUserId,
    });
  });

  if (files === null) {
    return ApiResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return ApiResponse.json({
    files: files.map(toLibraryFileResponse),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  if (request.body === null) {
    return ApiResponse.json(
      { error: "Request body is empty" },
      { status: 400 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob | null;
    if (!file) {
      return ApiResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });
    if (!validatedFile.success) {
      return ApiResponse.json(
        {
          error: validatedFile.error.errors
            .map((issue) => issue.message)
            .join(", "),
        },
        { status: 400 }
      );
    }

    const filename = (formData.get("file") as File).name;
    const contentType = resolveUploadContentType(file, filename);
    if (!contentType) {
      return ApiResponse.json(
        { error: "Unsupported file type" },
        { status: 400 }
      );
    }

    const chatId = formData.get("chatId")?.toString().trim() || undefined;
    const safeName = sanitizeLibraryFileName(filename);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const saved = await withTenantId(authResult.tenant.id, () =>
      writeLibraryFile({
        body: fileBuffer,
        chatId,
        contentType,
        name: safeName,
        source: "upload",
        tenantId: authResult.tenant.id,
        userId: toTenantUserId(authResult.userId),
      })
    );

    return ApiResponse.json(saved, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    console.error("[library upload]", error);
    const hint = message.includes("Could not load the default credentials")
      ? "Run: gcloud auth application-default login"
      : message;
    return ApiResponse.json({ error: hint }, { status: 500 });
  }
}
