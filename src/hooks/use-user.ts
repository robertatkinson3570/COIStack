"use client";

import { useEffect, useState } from "react";
import type { UserProfile, Organization, UserRole } from "@/lib/types/database";

interface UserContext {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  org: Organization | null;
  role: UserRole | null;
  loading: boolean;
}

export function useUser(): UserContext {
  const [state, setState] = useState<UserContext>({
    user: null,
    profile: null,
    org: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/user/me");
        if (!res.ok) {
          setState({ user: null, profile: null, org: null, role: null, loading: false });
          return;
        }
        const data = await res.json();
        setState({
          user: data.user ?? null,
          profile: data.profile ?? null,
          org: data.org ?? null,
          role: (data.role as UserRole) ?? null,
          loading: false,
        });
      } catch {
        setState({ user: null, profile: null, org: null, role: null, loading: false });
      }
    }

    load();
  }, []);

  return state;
}
