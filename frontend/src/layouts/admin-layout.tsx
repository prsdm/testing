import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useTenant } from "@/components/providers/tenant-provider";
import { hasAnyAdminCapability } from "@/shared/auth/capabilities";
import { CHAT_HOME } from "@/shared/chat/routes";

export function AdminLayout() {
  const { isAdmin, capabilities } = useTenant();
  const navigate = useNavigate();

  const allowed = isAdmin || hasAnyAdminCapability(capabilities);

  useEffect(() => {
    if (!allowed) {
      navigate(CHAT_HOME, { replace: true });
    }
  }, [allowed, navigate]);

  if (!allowed) {
    return null;
  }

  return <Outlet />;
}
