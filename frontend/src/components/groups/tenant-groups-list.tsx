"use client";

import {
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TenantUsersPagination } from "@/components/users/tenant-users-pagination";

const GROUPS_PAGE_SIZE = 6;

export type GroupListRow = {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
};

function MemberCountBadge({ count }: { count: number }) {
  return (
    <span className="shrink-0 rounded-md bg-muted/60 px-2 py-0.5 text-[12px] text-muted-foreground">
      {count} {count === 1 ? "member" : "members"}
    </span>
  );
}

export function TenantGroupsList({
  initialGroups,
}: {
  tenantSlug: string;
  initialGroups: GroupListRow[];
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);

  const filteredGroups = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) {
      return groups;
    }
    return groups.filter((group) =>
      group.name.toLowerCase().includes(normalized)
    );
  }, [groups, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredGroups.length / GROUPS_PAGE_SIZE)
  );
  const showPagination = filteredGroups.length > GROUPS_PAGE_SIZE;

  const paginatedGroups = useMemo(() => {
    if (!showPagination) {
      return filteredGroups;
    }
    const start = (page - 1) * GROUPS_PAGE_SIZE;
    return filteredGroups.slice(start, start + GROUPS_PAGE_SIZE);
  }, [filteredGroups, page, showPagination]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 rounded-lg bg-transparent pl-9"
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search groups…"
            value={searchQuery}
          />
        </div>
        <Button asChild className="cursor-pointer" size="sm">
          <Link href="/admin/groups/new">
            <PlusIcon />
            Create group
          </Link>
        </Button>
      </div>

      {filteredGroups.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground text-sm">
          {groups.length === 0
            ? "No groups yet. Create one to organize members."
            : "No groups match your search."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {paginatedGroups.map((group) => (
            <Link
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3 transition-colors hover:bg-muted/20"
              href={`/admin/groups/${group.id}`}
              key={group.id}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                <UsersIcon className="size-7 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium text-sm">{group.name}</span>
                  <span className="block truncate text-[13px] text-muted-foreground leading-snug">
                    Manage members and access for this group.
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <MemberCountBadge count={group.memberCount} />
                <ChevronRightIcon
                  aria-hidden
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
              </span>
            </Link>
          ))}
        </div>
      )}

      {showPagination ? (
        <TenantUsersPagination
          align="center"
          currentPage={page}
          onPageChange={setPage}
          totalPages={totalPages}
        />
      ) : null}
    </div>
  );
}
