# Slack-style workspace phases

Product target: **DMs**, **channels**, **threads**, **@Kimiro** like the Slack bot. **No dedicated KB on DMs** (channels keep per-channel KB).

## Phase 1 — 1:1 DMs (shipped)

- `chat.kind = dm`, two `ChatParticipant`s, workspace members only
- Sidebar **Direct messages**, start DM from member picker
- Live feel: revalidate messages after send (websocket in Phase 3)
- Human messages without `@Kimiro` persist only; `@Kimiro` runs assistant (no DM KB)

## Phase 2 — Threads (shipped)

- `Message_v2.threadRootMessageId` (thread root)
- Reply in thread UI (panel + counts)
- `@Kimiro` in thread → Kimiro replies in thread

## Phase 3 — Realtime (shipped)

- WebSocket room subscription per `chatId` (`WS /api/chat/:id/ws`)
- `messages.changed` events after human saves and assistant turn finalize → SWR refetch for other participants
- In-process bus (Redis fan-out optional later for multi-instance)

## Phase 4 — Kimiro = Slack bot rules (shipped)

- Top-level `@Kimiro` in channel/DM → **open thread**, Kimiro answers in thread (user root stays on main timeline)
- Thread-scoped model history (`getMessagesByChatId` for thread root id)
- **UX:** resizable split — channel/DM peek (left), thread + composer (center); References / PDF / artifact stay in the **single** right panel
- Display `composerText` on user bubbles (highlight `@Kimiro`); chronological sort when timestamps tie

## Phase 5 — Polish (shipped)

### 5a — Unread badges (shipped)

- `ChatParticipant.lastReadAt`; unread = messages after read cursor excluding your own
- `unreadCount` on channel/DM list APIs; `POST /api/chat/:id/read` when viewing a room
- Workspace inbox WebSocket (`/api/workspace/:tenantSlug/inbox/ws`) refreshes sidebar counts

### 5b — Typing indicators (shipped)

- Ephemeral `typing.start` / `typing.stop` on the room WebSocket; server fan-out `typing.changed`
- Composer pulses while typing; indicator above main and thread composers (scoped by `threadRootMessageId`)

### 5c — Search in conversation (shipped)

- `GET /api/chat/:id/messages/search?q=` across main timeline and threads
- Search icon in channel/DM headers; jump to message with highlight (opens thread when needed)

### 5d — Group DMs (3+) (shipped)

- `chat.kind = group_dm`; migration `0113_group_dms.sql`
- Sidebar **New message** → **Direct** (1:1) or **Group** (pick ≥2 others; you’re added automatically)
- `POST /api/dms/:tenantSlug` with `{ memberUserIds: [...] }` or `{ peerUserId }`
- Group title from participant first names; avatar stack in sidebar and header
- Threads, @Kimiro, unread, typing, and in-conversation search behave like 1:1 DMs (`isRoomChat` includes `group_dm`)

## Phase 6 — Room-aware @Kimiro (shipped)

- Member roster in system prompt for channel/DM/group DM `@Kimiro` (cap inline list; show total count for large channels)
- Model history uses `[Display name]:` prefixes on human lines and `[Kimiro]:` on assistant lines
- Instruct Kimiro to address people by display name in shared replies (no @-mention notifications yet)

## Phase 7 — @ mention autocomplete (shipped)

- Typing `@` in channel/DM/group DM composer opens a Slack-style picker (Kimiro agent + room members)
- Keyboard navigation (arrows, Enter/Tab, Escape); inserts `@kimiro` or `@FirstName` token
- Member list from channel members API or DM participant context (no @channel / @here yet)

## Phase 8 — Message reactions (shipped)

- `MessageReaction` table + `GET/PATCH /api/reactions`; migration `0114_message_reactions.sql`
- Emoji reactions on room messages (channels, DMs, group DMs, threads); replaces thumbs up/down on assistant messages in rooms
- Quick reactions + picker on message hover; reaction chips under messages (blue tint when you reacted)
- Realtime: `reactions.changed` on room WebSocket → SWR refetch (same pattern as messages)
- Run `pnpm migrate` in `backend` before testing locally
