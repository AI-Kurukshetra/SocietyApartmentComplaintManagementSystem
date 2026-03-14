"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { fetchProfile } from "@/lib/data";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Profile } from "@/lib/types";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile(userId: string) {
    try {
      const supabase = getSupabaseClient();
      const data = await fetchProfile(supabase, userId);
      setProfile(data);
      setError(null);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load user profile.",
      );
    }
  }

  async function refreshProfile() {
    if (!session?.user) {
      setProfile(null);
      return;
    }

    await loadProfile(session.user.id);
  }

  async function signOut() {
    if (!isSupabaseConfigured) {
      return;
    }

    const supabase = getSupabaseClient();
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      return;
    }

    setProfile(null);
    setSession(null);
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    let isMounted = true;

    async function bootstrap() {
      const {
        data: { session: activeSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
      }

      setSession(activeSession);

      if (activeSession?.user) {
        await loadProfile(activeSession.user.id);
      }

      if (isMounted) {
        setLoading(false);
      }
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession?.user) {
        setLoading(true);
        void loadProfile(nextSession.user.id).finally(() => {
          if (isMounted) {
            setLoading(false);
          }
        });
        return;
      }

      setProfile(null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, error, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}

