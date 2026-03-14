"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { getRoleHome } from "@/lib/roleRoutes";

export default function DashboardRedirectPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile) {
      router.replace(getRoleHome(profile.role));
    }
  }, [loading, profile, router]);

  return (
    <AuthGuard>
      <AppShell
        description="Redirecting to your role dashboard."
        title="Dashboard"
      >
        <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-8 text-sm text-slate-600 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
          Redirecting to your role home...
        </div>
      </AppShell>
    </AuthGuard>
  );
}
