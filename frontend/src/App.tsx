import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PreviewLandingRedirect } from "@/lib/preview/preview-landing-redirect";
import { AuthLayout } from "./layouts/auth-layout";
import { CheckEmailPage } from "./pages/check-email-page";
import { LoginPage } from "./pages/login-page";
import { SetupPage } from "./pages/setup-page";

const WorkspaceRoutes = lazy(() => import("./workspace-routes"));

function RouteLoadingFallback() {
  return <div className="min-h-dvh bg-background" />;
}

export default function App() {
  return (
    <>
      <PreviewLandingRedirect />
      <Routes>
      <Route element={<AuthLayout />}>
        <Route element={<LoginPage />} path="/login" />
        <Route element={<CheckEmailPage />} path="/login/check-email" />
      </Route>
      <Route element={<Navigate replace to="/login" />} path="/register" />
      <Route element={<SetupPage />} path="/setup" />
      <Route
        element={
          <Suspense fallback={<RouteLoadingFallback />}>
            <WorkspaceRoutes />
          </Suspense>
        }
        path="/*"
      />
      </Routes>
    </>
  );
}
