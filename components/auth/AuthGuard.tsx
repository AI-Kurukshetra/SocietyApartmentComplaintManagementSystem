"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { useAuth } from "@/components/providers/AuthProvider";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isSupabaseConfigured && !session) {
      router.replace("/login");
    }
  }, [loading, router, session]);

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white px-6 py-8 text-sm text-slate-600 shadow-sm">
        Supabase environment variables are missing. Add
        <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
          NEXT_PUBLIC_SUPABASE_URL
        </code>
        and
        <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        </code>
        to <code>.env.local</code>.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white px-6 py-8 text-sm text-slate-600 shadow-sm">
        Loading your workspace...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white px-6 py-8 text-sm text-slate-600 shadow-sm">
        Redirecting to login...
      </div>
    );
  }

  return <>{children}</>;
}
