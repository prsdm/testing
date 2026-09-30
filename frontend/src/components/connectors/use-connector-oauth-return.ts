"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function useConnectorOAuthReturn(args: {
  connectedParam?: string;
  connectedMessage?: string;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const toastedRef = useRef(false);

  useEffect(() => {
    if (
      args.connectedParam &&
      searchParams.get(args.connectedParam) === "1" &&
      args.connectedMessage &&
      !toastedRef.current
    ) {
      toastedRef.current = true;
      toast.success(args.connectedMessage);
      const params = new URLSearchParams(searchParams.toString());
      params.delete(args.connectedParam);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    }

    const oauthError = searchParams.get("error");
    if (oauthError) {
      setError(oauthError);
    }
  }, [
    args.connectedMessage,
    args.connectedParam,
    pathname,
    router,
    searchParams,
  ]);

  return { error, setError };
}
