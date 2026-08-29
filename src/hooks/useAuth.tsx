"use client";

import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface AuthContextValue {
  user: { id: string; email?: string } | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<Omit<AuthContextValue, "signOut">>({
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (!data.user) {
        setState({ user: null, profile: null, loading: false });
        return;
      }
      let { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!active) return;

      // Safety net: if profile is missing (trigger failed), create it now
      if (!profileData) {
        console.warn(`[AUTH] Profile missing for user ${data.user.id}, creating...`);
        const { data: created } = await supabase
          .from("profiles")
          .insert({
            id: data.user.id,
            full_name: data.user.user_metadata?.full_name || "Professor",
            email: data.user.email,
            school: data.user.user_metadata?.school || null,
            role: "professor",
          })
          .select("*")
          .single();
        if (created) profileData = created;
      }

      setState({
        user: { id: data.user.id, email: data.user.email },
        profile: (profileData as Profile) ?? null,
        loading: false,
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setState({ user: null, profile: null, loading: false });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ ...state, signOut }}>{children}</AuthContext.Provider>
  );
}
