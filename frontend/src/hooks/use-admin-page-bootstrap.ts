import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useSWR from "swr";
import { useTenant } from "@/components/providers/tenant-provider";
import type { AdminBootstrapPage } from "@/shared/admin/admin-bootstrap-pages";

type AdminBootstrapParams = {
  page: AdminBootstrapPage;
  integrationKey?: string;
  groupId?: string;
};

async function fetchAdminBootstrap(
  tenantSlug: string,
  params: AdminBootstrapParams
) {
  const search = new URLSearchParams({ page: params.page });
  if (params.integrationKey) {
    search.set("integrationKey", params.integrationKey);
  }
  if (params.groupId) {
    search.set("groupId", params.groupId);
  }

  const response = await fetch(
    `/api/admin/${tenantSlug}/bootstrap?${search.toString()}`,
    { credentials: "include" }
  );

  if (response.status === 403) {
    return { forbidden: true as const };
  }

  if (response.status === 404) {
    return { notFound: true as const };
  }

  if (!response.ok) {
    throw new Error(`Failed to load admin page (${response.status})`);
  }

  return response.json();
}

export function useAdminPageBootstrap<T>(params: AdminBootstrapParams) {
  const { tenantSlug } = useTenant();
  const navigate = useNavigate();
  const key = ["admin-bootstrap", tenantSlug, params] as const;

  const swr = useSWR(key, () => fetchAdminBootstrap(tenantSlug, params));

  useEffect(() => {
    if (!swr.data) {
      return;
    }
    if ("forbidden" in swr.data) {
      navigate("/admin/general", { replace: true });
      return;
    }
    if ("notFound" in swr.data) {
      navigate("/admin/integrations", { replace: true });
    }
  }, [swr.data, navigate]);

  const ready = Boolean(
    swr.data && !("forbidden" in swr.data) && !("notFound" in swr.data)
  );

  if (ready) {
    return {
      ...swr,
      data: swr.data as T,
      isReady: true as const,
    };
  }

  return {
    ...swr,
    data: undefined,
    isReady: false as const,
  };
}
