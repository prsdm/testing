# Sandbox v1 — Cloud Run + GCS (Kimiro `craft`)

Planning doc for porting kimi-craft sandbox concepts to production GCP.  
**Do not merge to `craft` until locally tested.** Work on feature branch `sandbox-cloud-run`.

---

## Goals

- Agent can run **Python/shell** in an isolated environment for multi-step work (CSV, scripts, file transforms).
- **Per-chat file workspace** — same mental model as kimi-craft (`/workspace/sessions/{chatId}/`).
- **Stateless compute** — Cloud Run scales to zero; files live in **GCS**, not inside long-lived containers.
- One **`sandboxExec`-style tool path** wired into existing chat harness (serial mutating tools, idempotent ledger, billing later).

## Non-goals (v1)

- Per-user long-lived Docker containers (kimi-craft model).
- Egress proxy / mitm gate / connector skills in sandbox.
- Live approval UI (`sandbox/approvals/*`).
- Presentation pipeline (`presentation_*`, pptx templates).
- Bundled connector skill scripts (Gmail, Confluence, etc.).
- Skills marketplace UI (comes after sandbox + skills v2).

---

## Deployment model (Cloud Run)

| Asset | Count | Notes |
|-------|-------|-------|
| **Docker image** | **1** | `kimiro/sandbox-executor` — Python 3, Node (optional v1), bash, pandas, ffmpeg (optional v1) |
| **Cloud Run service** | **1** | Internal HTTPS API; not public internet |
| **Running instances** | **0 → N** | Auto-scaled by Cloud Run per request; scale to zero when idle |
| **GCS bucket** | **1** (existing or new prefix) | Session workspaces + sync with Library where needed |
| **Kimiro app** | unchanged | Calls sandbox service; never runs untrusted code in Next.js process |

**Not** one Cloud Run service per user. **Not** one deploy per chat.

```
                    ┌─────────────────────┐
  User chat turn    │  Kimiro app (craft) │
        │           │  sandboxExec tool   │
        └──────────►└──────────┬──────────┘
                                 │ POST /v1/exec (IAM auth)
                                 ▼
                    ┌─────────────────────┐
                    │ Cloud Run service   │  ← 1 service, ephemeral instances
                    │ sandbox-executor    │
                    └──────────┬──────────┘
                               │ sync before/after
                               ▼
                    ┌─────────────────────┐
                    │ GCS session prefix  │  ← durable per chat
                    └─────────────────────┘
```

---

## Session model (same as kimi-craft)

Two layers:

1. **Tenant + user** — auth boundary (who can access which GCS prefix).
2. **Chat** — workspace folder (files from chat A never mix with chat B).

### GCS layout

Reuse existing bucket pattern (Library already uses path prefixes):

```
{sandboxRoot}/{tenantId}/{userId}/sessions/{chatId}/
  uploads/      ← chat attachments (sync from chat uploads)
  staging/      ← intermediate files
  outputs/      ← deliverables (agent promotes to Library)
  scripts/      ← saved scripts (optional v1)
  .meta/        ← chat-id, last sync (optional)
```

**Library** stays separate (`library/{tenantId}/{userId}/...`). v1: copy or link outputs into Library via existing `saveToLibrary` / `writeLibraryFile` — do not merge buckets blindly.

### Exec flow (one tool call)

1. Kimiro resolves `{ tenantId, userId, chatId }` from chat context.
2. **Sync down**: GCS prefix → temp dir in Cloud Run instance (`/workspace/session`).
3. Run command (python/bash) with **cwd = session root**, path jail like kimi `path-jail.ts`.
4. **Sync up**: changed files under `uploads|staging|outputs|scripts` → GCS.
5. Return `{ stdout, stderr, exitCode, outputFiles[] }` to agent.

Cold start: accept 2–5s on first exec after idle; optimize later with min instances if needed.

---

## Sandbox executor API (v1)

Internal service only. Authenticate with **Cloud Run IAM** (Kimiro runtime SA → sandbox service invoker).

### `POST /v1/exec`

```json
{
  "tenantId": "uuid",
  "userId": "uuid",
  "chatId": "uuid",
  "command": "python",
  "args": ["-c", "print('hello')"],
  "cwd": ".",
  "timeoutMs": 60000,
  "sync": { "direction": "both" }
}
```

Response:

```json
{
  "ok": true,
  "exitCode": 0,
  "stdout": "...",
  "stderr": "",
  "outputFiles": [
    { "path": "outputs/report.csv", "sizeBytes": 1234, "contentType": "text/csv" }
  ],
  "durationMs": 842
}
```

Limits (env-configurable):

| Limit | Default |
|-------|---------|
| `timeoutMs` | 60_000 (work: 300_000 later) |
| max stdout/stderr | 256 KB each |
| max output file size | 15 MB (match Library) |
| max files synced up | 20 per exec |

---

## Kimiro agent tools (v1 — minimal)

Start with **one tool**; expand after it works.

### `sandboxExec` (v1)

- **Input**: `command` (`python` | `bash`), `code` or `script`, optional `cwd` (jailed).
- **Behavior**: call executor API; on success with files in `outputs/`, optionally auto-save to Library (product decision: v1 manual via agent calling `saveToLibrary` is simpler).
- **Mutating**: yes — serial with other write tools.
- **Gated**: tenant flag `SANDBOX_ENABLED` + admin toggle later.

### Deferred tools (port from kimi later)

| kimi tool | v2+ |
|-----------|-----|
| `work_run_python` | fold into `sandboxExec` or thin wrapper |
| `work_read_file` / `work_list_files` | read from GCS via app API or exec `cat`/`ls` |
| `work_complete` | deliverable UX; v1 agent uses prose + Library |
| `presentation_*` | skills phase |
| `agent_read_file` / `agent_write_file` | kimi agent-file tools; evaluate need |

---

## Security checklist

- [ ] Sandbox Cloud Run: **no** access to Postgres, Redis, internal VPC services.
- [ ] Sandbox Cloud Run: **no** public ingress; IAM invoker only from Kimiro service account.
- [ ] GCS: prefix scoped to `{tenantId}/{userId}/`; Kimiro validates before every exec.
- [ ] Path jail: no `..`, no absolute paths outside session root (port `path-jail.ts`).
- [ ] Network egress: **deny by default** in v1 (no pip install, no curl). Add allowlist in v2 if needed.
- [ ] Resource limits: CPU/memory cap on Cloud Run; kill process on timeout.
- [ ] No secrets in sandbox env except short-lived signed GCS access if needed.

---

## Port map: kimi-craft / `sandbox` branch → prod v1

| Source (kimi / `sandbox` branch) | v1 action |
|----------------------------------|-----------|
| `lib/work-sandbox/session-workspace.ts` | **Reuse** layout + setup script logic → GCS keys |
| `lib/work-sandbox/path-jail.ts` | **Reuse** (tests included) |
| `lib/work-sandbox/docker-work-sandbox-manager.ts` | **Replace** with GCS sync + Cloud Run client |
| `lib/work-sandbox/tools/ai-sdk-tools.ts` | **Defer**; single `sandboxExec` first |
| `lib/sandbox/*` approvals, egress, proxy | **Defer** |
| `docker/work-sandbox/Dockerfile` | **Adapt** → `backend/docker/sandbox-executor/Dockerfile` for Cloud Run |
| `AgentSandbox` DB table | **Defer** (no per-user container row in v1) |
| `lib/chat/chat-system-prompt.ts` WORK_SANDBOX_INSTRUCTIONS | **Trim** for v1; add to `agent.md` when tools ship |

---

## Implementation phases

Work on **`sandbox-cloud-run`** (or local branch). **No commit/push to `craft` until manual test pass.**

### Phase 0 — Local dev (no GCP required) ✅

1. `backend/docker/sandbox-executor/` — image + HTTP server (`/v1/exec`, `/health`).
2. Local volume at `./.sandbox-sessions/{tenantId}/{userId}/sessions/{chatId}/`.
3. `docker compose -f backend/docker-compose.sandbox.yml up -d` — port **8089**.
4. `pnpm --dir backend sandbox:test` — curl exec + path-jail check.

### Phase 1 — Kimiro wiring ✅

1. `lib/sandbox/` — GCS sync helpers, executor client, path jail, run orchestration.
2. `sandboxExec` chat tool + executor in `chat-tool-executors.ts`.
3. GCS sync optional (`SANDBOX_SKIP_GCS_SYNC=true` for local dev with shared volume).
4. `agent.md` sandbox section.

**Local chat test env:**

```bash
SANDBOX_ENABLED=true
SANDBOX_EXECUTOR_URL=http://127.0.0.1:8089
SANDBOX_SKIP_GCS_SYNC=true
npm run sandbox:up
```

### Phase 2 — GCP

1. Push image to Artifact Registry.
2. Deploy Cloud Run service (internal + IAM).
3. Wire env vars in Kimiro: `SANDBOX_EXECUTOR_URL`, `SANDBOX_GCS_PREFIX`.
4. End-to-end test on staging project.

### Phase 3 — Polish ✅

1. **Sandbox UI** — `ToolCallCard` with shimmer, expandable stdout/files, duration
2. **Usage tracking** — `sandboxExecCount` + `sandboxExecDurationMs` on usage events (admin visibility only, not customer billing)
3. **Admin toggle** — `sandboxEnabled` per tenant in **Admin → General → Agent sandbox**
4. **GCP deploy** — deferred to last phase

**After migration:** enable sandbox in **Admin → General** for your tenant (defaults off).

### Phase 4 — Skills (in progress)

Skills are **packages** (not markdown-only): instructions plus bundled helpers the agent runs via `sandboxExec`.

#### Skill layout (repo → session)

```
lib/sandbox/skills/builtin/{skillId}/
  SKILL.md              ← required — workflow + when to use
  *.md                  ← optional reference docs
  scripts/              ← optional bundled Python/JS helpers (e.g. slides/scripts/office/)

→ synced read-only into session at .kimiro/skills/{skillId}/...
```

Port file-walk + template rendering from kimi `lib/sandbox/sandbox-skills-files.ts`. Skills are **not** written under per-chat `uploads|staging|outputs|scripts/` — they live in `.kimiro/skills/` and are read-only in the executor.

#### Session `scripts/` vs skill `scripts/`

| Path | Purpose |
|------|---------|
| `scripts/run-{id}.py` | Agent-generated runners for **this chat** (already works) |
| `.kimiro/skills/{id}/scripts/*` | **Bundled** read-only helpers shipped with a skill (Phase 4) |

#### v1 scope (work skills — scripts included)

Port kimi **work** bundles first (no network egress), aligned with [Anthropic pptx skill](https://github.com/anthropics/skills/tree/main/skills/pptx):

- `slides` — decks, `.pptx` edit/create (`scripts/thumbnail.py`, `scripts/office/validate.py`, etc.)
- `xlsx` — spreadsheet helpers

Agent flow: read `SKILL.md` → call bundled script or write session code → put deliverables in `outputs/` → `saveToLibrary` when asked.

#### Deferred (connector skills)

Gmail, Slack, Jira, Confluence, etc. also ship as skill folders with API scripts — but they need egress proxy + connector auth in sandbox. Stay deferred until after work skills (see non-goals above).

#### Optional (separate spec)

Skill picker in chat — **not planned**. Skills are agent-routed like image generation and web search; admin toggles + read-only skill cards only.

#### Implementation status

1. ✅ `lib/sandbox/skills/builtin/{slides,xlsx}/` — vendored slide + spreadsheet skills
2. ✅ `lib/sandbox/sandbox-skills-files.ts` + `sandbox-skills-sync.ts` — hash-cached sync into `.kimiro/skills/`
3. ✅ `run-sandbox-exec.ts` — ensures enabled skills before each exec
4. ✅ Executor image — Node, LibreOffice, markitdown, pptxgenjs for skill scripts
5. ✅ Admin per-skill toggles + user skill cards on Connectors (no chat picker)
6. ✅ Agent loads skills on demand via sandboxExec (no per-turn skill list in system prompt); activity shows skill chip when detected

---

## Testing before `craft`

| Test | Pass criteria |
|------|----------------|
| Local compose exec | Python writes `outputs/hello.txt` |
| Path jail | `../etc/passwd` rejected |
| Chat integration | Agent calls `sandboxExec`, user sees output in thread |
| GCS round-trip | File survives second exec in same chat |
| Cross-chat isolation | Chat B cannot read Chat A prefix |
| Timeout | Long loop killed, clear error |
| No sandbox when disabled | Tool not in active tool list |

---

## Billing (v1.1)

- Meter: exec count + duration × CPU/RAM tier (Cloud Run cost + margin).
- Store on `TenantUsageEvent`: `sandboxExecCount`, estimated micros (same pattern as `imageGenerationCount`).
- Not required for first local prototype.

---

## Decisions (locked — defaults)

1. **Library:** agent calls `saveToLibrary` with `sandboxPath` (e.g. `outputs/deck.pptx`) for binary deliverables, or `content` for text exports.
2. **Storage:** same GCS bucket as Library/chat uploads; sandbox files under `sandbox/{tenantId}/{userId}/sessions/{chatId}/`.
3. **Commands:** Python + bash in v1.
4. **Cloud Run:** min instances **0** (scale to zero; accept cold-start latency).

---

## References

- kimi-craft: `lib/work-sandbox/`, `lib/sandbox/`, `docker/work-sandbox/`
- prod branch: `sandbox-cloud-run` (Cloud Run + GCS path; old `sandbox` branch removed)
- kimi skills source: `lib/sandbox/skills/builtin/`, `lib/sandbox/sandbox-skills-files.ts`
- ChatGPT pattern: tools + optional skills + `sandbox_exec` for heavy work
