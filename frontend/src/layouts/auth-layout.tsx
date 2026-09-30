import { Outlet } from "react-router-dom";
import { SidebarAppLogo } from "@/components/chat/sidebar-app-logo";

export function AuthLayout() {
  return (
    <div className="flex min-h-dvh w-screen items-center justify-center bg-background p-8 md:p-16">
      <div className="mx-auto flex w-full max-w-md flex-col gap-2">
        <SidebarAppLogo className="mb-2 size-9 text-foreground" />
        <Outlet />
      </div>
    </div>
  );
}
