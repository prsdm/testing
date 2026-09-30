import {
  useLocation,
  useNavigate,
  useSearchParams as useRouterSearchParams,
} from "react-router-dom";

type NavigateOptions = {
  replace?: boolean;
  scroll?: boolean;
  state?: unknown;
};

export function usePathname(): string {
  return useLocation().pathname;
}

export function useRouter() {
  const navigate = useNavigate();

  return {
    back: () => {
      navigate(-1);
    },
    prefetch: (_href: string) => {
      /* no-op in SPA */
    },
    push: (href: string, options?: NavigateOptions) => {
      navigate(href, {
        replace: options?.replace,
        state: options?.state,
      });
    },
    refresh: () => {
      navigate(0);
    },
    replace: (href: string, options?: NavigateOptions) => {
      navigate(href, { replace: true, state: options?.state });
    },
  };
}

export function useSearchParams() {
  const [params] = useRouterSearchParams();
  return params;
}

export function redirect(_url: string): never {
  throw new Error("redirect() is not available in the SPA runtime");
}
