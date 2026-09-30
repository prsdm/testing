"use client";

import useSWR from "swr";

export type WorkspaceListItem = {
  id: string;
  slug: string;
  companyName: string;
  primaryDomain: string;
  logoUrl: string | null;
};

export type WorkspaceResponse = {
  companyName: string;
  slug: string;
  logoUrl: string | null;
  activeTenantSlug?: string | null;
  planLabel?: string | null;
  workspaces?: WorkspaceListItem[];
};

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as WorkspaceResponse;
};

export function useWorkspace() {
  const { data, isLoading, mutate } = useSWR("/api/workspace", fetcher, {
    revalidateOnFocus: false,
  });

  return {
    isLoading,
    mutate,
    workspace: data,
  };
}
