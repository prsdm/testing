"use client";

import {
  ChevronRightIcon,
  FolderKanbanIcon,
  Loader2Icon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeBaseSummary as KnowledgeBase } from "@/contracts/knowledge-bases";
import {
  knowledgeBasesApiBase,
  readKnowledgeBasesApiError,
} from "@/lib/knowledge-bases/knowledge-base-api-client";
import { knowledgeBaseDetailPath } from "@/lib/knowledge-bases/knowledge-base-paths";

export function KnowledgeBasesPanel({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newKnowledgeBaseName, setNewKnowledgeBaseName] = useState("");
  const [newKnowledgeBaseDescription, setNewKnowledgeBaseDescription] =
    useState("");
  const [error, setError] = useState<string | null>(null);

  const loadKnowledgeBases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(knowledgeBasesApiBase(tenantSlug));
      if (!response.ok) {
        throw new Error(
          await readKnowledgeBasesApiError(
            response,
            "Failed to load knowledge bases"
          )
        );
      }
      const payload = (await response.json()) as {
        knowledgeBases: KnowledgeBase[];
      };
      setKnowledgeBases(payload.knowledgeBases);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load knowledge bases"
      );
    } finally {
      setIsLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadKnowledgeBases().catch(() => undefined);
  }, [loadKnowledgeBases]);

  async function handleCreateKnowledgeBase(event: React.FormEvent) {
    event.preventDefault();
    const name = newKnowledgeBaseName.trim();
    if (isCreating) {
      return;
    }
    if (!name) {
      setError("Enter a knowledge base name, then click Create.");
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch(knowledgeBasesApiBase(tenantSlug), {
        body: JSON.stringify({
          description: newKnowledgeBaseDescription.trim() || undefined,
          name,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(
          await readKnowledgeBasesApiError(
            response,
            "Failed to create knowledge base"
          )
        );
      }
      const payload = (await response.json()) as {
        knowledgeBase: KnowledgeBase;
      };
      setNewKnowledgeBaseName("");
      setNewKnowledgeBaseDescription("");
      toast.success(`Created "${payload.knowledgeBase.name}"`);
      router.push(knowledgeBaseDetailPath(payload.knowledgeBase.id));
    } catch (createError) {
      const message =
        createError instanceof Error
          ? createError.message
          : "Failed to create knowledge base";
      setError(message);
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-2"
        onSubmit={handleCreateKnowledgeBase}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            aria-describedby="knowledge-base-name-hint"
            aria-label="Knowledge base name"
            autoFocus
            className="sm:flex-1"
            onChange={(event) => {
              setNewKnowledgeBaseName(event.target.value);
              if (error?.includes("Enter a knowledge base name")) {
                setError(null);
              }
            }}
            placeholder="New knowledge base name"
            required
            value={newKnowledgeBaseName}
          />
          <Button disabled={isCreating} type="submit">
            {isCreating ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            Create knowledge base
          </Button>
        </div>
        <Textarea
          aria-label="Knowledge base description"
          className="min-h-20"
          onChange={(event) =>
            setNewKnowledgeBaseDescription(event.target.value)
          }
          placeholder="Description (optional) — helps Kimiro pick this knowledge base in chat"
          value={newKnowledgeBaseDescription}
        />
        <p
          className="text-muted-foreground text-xs"
          id="knowledge-base-name-hint"
        >
          Add a name and optional description, then click Create knowledge base.
        </p>
      </form>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2Icon className="size-4 animate-spin" />
          Loading knowledge bases…
        </div>
      ) : knowledgeBases.length === 0 ? (
        <div className="rounded-xl border border-border/40 border-dashed px-4 py-10 text-center">
          <FolderKanbanIcon className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-medium text-sm">No knowledge bases yet</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Create a knowledge base and add files or indexed sources for scoped
            search.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/40 rounded-xl border border-border/40">
          {knowledgeBases.map((entry) => (
            <li key={entry.id}>
              <Link
                className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                href={knowledgeBaseDetailPath(entry.id)}
                prefetch={false}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-sm">{entry.name}</p>
                    {entry.viewerRole === "owner" ? null : (
                      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                        Shared
                      </span>
                    )}
                  </div>
                  {entry.description?.trim() ? (
                    <p className="truncate text-muted-foreground text-xs">
                      {entry.description.trim()}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground text-xs">
                    Updated {new Date(entry.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { KnowledgeBaseDetailPanel } from "@/components/knowledge-bases/knowledge-base-detail-panel";
