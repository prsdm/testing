import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LoginForm } from "@/components/auth/login-form";
import { isPreviewMode } from "@/lib/preview/is-preview-mode";

const DEFAULT_SIGN_IN_OPTIONS = {
  googleEnabled: false,
  microsoftEnabled: false,
};

export function LoginPage() {
  const navigate = useNavigate();
  const [options, setOptions] = useState(DEFAULT_SIGN_IN_OPTIONS);

  useEffect(() => {
    if (isPreviewMode()) {
      navigate("/", { replace: true });
      return;
    }
    fetch("/api/auth/get-session", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload?.user) {
          navigate("/", { replace: true });
        }
      })
      .catch(() => undefined);
  }, [navigate]);

  useEffect(() => {
    fetch("/api/sign-in-options", { credentials: "include" })
      .then((response) => {
        if (!response.ok) {
          return DEFAULT_SIGN_IN_OPTIONS;
        }
        return response.json() as Promise<typeof DEFAULT_SIGN_IN_OPTIONS>;
      })
      .then(setOptions)
      .catch(() => setOptions(DEFAULT_SIGN_IN_OPTIONS));
  }, []);

  return (
    <LoginForm
      googleEnabled={options.googleEnabled}
      microsoftEnabled={options.microsoftEnabled}
      onNavigate={(path) => navigate(path)}
    />
  );
}
