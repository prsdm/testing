"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SessionUser } from "@/shared/auth/types";

type SessionUserContextValue = {
  user: SessionUser;
  updateSessionUser: (
    patch: Partial<Pick<SessionUser, "name" | "image">>
  ) => void;
};

const SessionUserContext = createContext<SessionUserContextValue | null>(null);

export function SessionUserProvider({
  children,
  user: initialUser,
}: {
  children: React.ReactNode;
  user: SessionUser;
}) {
  const [user, setUser] = useState(initialUser);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  const updateSessionUser = useCallback(
    (patch: Partial<Pick<SessionUser, "name" | "image">>) => {
      setUser((current) => ({ ...current, ...patch }));
    },
    []
  );

  const value = useMemo(
    () => ({ updateSessionUser, user }),
    [user, updateSessionUser]
  );

  return (
    <SessionUserContext.Provider value={value}>
      {children}
    </SessionUserContext.Provider>
  );
}

export function useSessionUser() {
  return useContext(SessionUserContext)?.user ?? null;
}

export function useUpdateSessionUser() {
  const context = useContext(SessionUserContext);
  if (!context) {
    throw new Error(
      "useUpdateSessionUser must be used within SessionUserProvider"
    );
  }
  return context.updateSessionUser;
}
