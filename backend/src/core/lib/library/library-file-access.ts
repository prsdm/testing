import {
  assertChatReadable,
  getChatParticipantRole,
  isRoomChat,
} from "@/core/lib/chat/chat-access";
import type { LibraryFileRow } from "@/core/lib/db/library-queries";
import { getLibraryFileByIdInTenant } from "@/core/lib/db/library-queries";
import {
  getChatById,
  getTenantAccessContextByEmail,
} from "@/core/lib/db/queries";
import { isUserLibraryPathname } from "@/shared/library/constants";

async function isRoomSharedLibraryFileReadable(args: {
  authUserId: string;
  file: LibraryFileRow;
  tenantUserId: string;
}): Promise<boolean> {
  const chatId = args.file.chatId?.trim();
  if (!chatId) {
    return false;
  }

  const chat = await getChatById({ id: chatId });
  if (!chat || !isRoomChat(chat)) {
    return false;
  }

  try {
    await assertChatReadable({
      authUserId: args.authUserId,
      chat,
      tenantUserId: args.tenantUserId,
    });
  } catch {
    return false;
  }

  return true;
}

/** Personal library file owned by the viewer (pathname + row userId). */
function isPersonalLibraryFileOwnedByViewer(args: {
  email: string;
  file: LibraryFileRow;
  tenantUserId: string;
}): boolean {
  if (args.file.userId !== args.tenantUserId) {
    return false;
  }
  return isUserLibraryPathname(args.file.pathname, args.tenantUserId);
}

export async function canReadLibraryFile(args: {
  authUserId: string;
  email: string;
  file: LibraryFileRow;
  tenantUserId: string;
}): Promise<boolean> {
  const access = await getTenantAccessContextByEmail(args.email);
  if (!access || access.tenantId !== args.file.tenantId) {
    return false;
  }

  if (await isRoomSharedLibraryFileReadable(args)) {
    return true;
  }

  return isPersonalLibraryFileOwnedByViewer(args);
}

export async function canDeleteLibraryFile(args: {
  authUserId: string;
  email: string;
  file: LibraryFileRow;
  tenantUserId: string;
}): Promise<boolean> {
  if (await canReadLibraryFile(args)) {
    if (isPersonalLibraryFileOwnedByViewer(args)) {
      return true;
    }

    const chatId = args.file.chatId?.trim();
    if (!chatId) {
      return false;
    }

    const role = await getChatParticipantRole({
      authUserId: args.authUserId,
      chatId,
    });
    return role === "owner" || role === "member";
  }

  return false;
}

export async function getReadableLibraryFile(args: {
  authUserId: string;
  email: string;
  fileId: string;
  tenantId: string;
  tenantUserId: string;
}): Promise<LibraryFileRow | null> {
  const file = await getLibraryFileByIdInTenant({
    fileId: args.fileId,
    tenantId: args.tenantId,
  });
  if (!file) {
    return null;
  }

  if (
    !(await canReadLibraryFile({
      authUserId: args.authUserId,
      email: args.email,
      file,
      tenantUserId: args.tenantUserId,
    }))
  ) {
    return null;
  }

  return file;
}

export async function getDeletableLibraryFile(args: {
  authUserId: string;
  email: string;
  fileId: string;
  tenantId: string;
  tenantUserId: string;
}): Promise<LibraryFileRow | null> {
  const file = await getLibraryFileByIdInTenant({
    fileId: args.fileId,
    tenantId: args.tenantId,
  });
  if (!file) {
    return null;
  }

  if (
    !(await canDeleteLibraryFile({
      authUserId: args.authUserId,
      email: args.email,
      file,
      tenantUserId: args.tenantUserId,
    }))
  ) {
    return null;
  }

  return file;
}
