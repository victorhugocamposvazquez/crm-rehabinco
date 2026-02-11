"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Role = "admin" | "agente";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const supabase = createClient();

    const getProfile = async (authUser: User): Promise<AuthUser | null> => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authUser.id)
        .single();

      if (profile?.role) {
        return {
          id: authUser.id,
          email: authUser.email ?? "",
          role: profile.role as Role,
        };
      }

      const { error } = await supabase.from("profiles").insert({
        id: authUser.id,
        email: authUser.email,
        role: "agente",
      });

      if (!error) {
        return {
          id: authUser.id,
          email: authUser.email ?? "",
          role: "agente",
        };
      }

      return {
        id: authUser.id,
        email: authUser.email ?? "",
        role: "agente",
      };
    };

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const profileUser = await getProfile(session.user);
          setUser(profileUser);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    init();
    const safetyTimeout = window.setTimeout(() => setIsLoading(false), 5000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      const profileUser = await getProfile(session.user);
      setUser(profileUser);
      setIsLoading(false);
    });

    return () => {
      window.clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = React.useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/login";
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
