"use client";

import { createContext, useContext, useMemo } from "react";
import {
  type CapabilityId,
  hasAnyAdminCapability,
  hasCapability,
} from "@/shared/auth/capabilities";

type TenantContextValue = {
  tenantSlug: string;
  /** Built-in full Admin (or admin contact). */
  isAdmin: boolean;
  /** Any admin-console capability (full admin or custom role). */
  hasAdminAccess: boolean;
  capabilities: CapabilityId[];
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  tenantSlug,
  isAdmin = false,
  capabilities = [],
  children,
}: {
  tenantSlug: string;
  isAdmin?: boolean;
  capabilities?: CapabilityId[];
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({
      capabilities,
      hasAdminAccess: isAdmin || hasAnyAdminCapability(capabilities),
      isAdmin,
      tenantSlug,
    }),
    [capabilities, isAdmin, tenantSlug]
  );

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenantSlug() {
  return useTenant().tenantSlug;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within TenantProvider");
  }
  return context;
}

export function useHasCapability(capability: CapabilityId) {
  const { isAdmin, capabilities } = useTenant();
  if (isAdmin) {
    return true;
  }
  return hasCapability(capabilities, capability);
}
