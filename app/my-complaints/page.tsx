"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ComplaintCard } from "@/components/complaints/ComplaintCard";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { StatsCard } from "@/components/ui/StatsCard";
import { fetchComplaintsByScope } from "@/lib/data";
import { logError, toUserMessage } from "@/lib/errorMessages";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { ComplaintCardData } from "@/lib/types";

export default function MyComplaintsPage() {
  const { session, profile, loading: authLoading } = useAuth();
  const [complaints, setComplaints] = useState<ComplaintCardData[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!session || !profile || !isSupabaseConfigured) {
      setLoadingData(false);
      return;
    }

    let isMounted = true;

    async function loadComplaints() {
      if (!session || !profile) {
        return;
      }

      const userId = session.user.id;
      setLoadingData(true);
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const rows = await fetchComplaintsByScope(supabase, {
          kind: "user",
          userId: userId,
          societyId: profile.society_id,
        });

        if (isMounted) {
          setComplaints(rows);
        }
      } catch (loadError) {
        if (isMounted) {
          logError("my-complaints.load", loadError);
          setError(toUserMessage(loadError, "Failed to load complaints."));
        }
      } finally {
        if (isMounted) {
          setLoadingData(false);
        }
      }
    }

    void loadComplaints();

    return () => {
      isMounted = false;
    };
  }, [authLoading, refreshKey, session, profile]);

  const counts = {
    total: complaints.length,
    active: complaints.filter((item) => item.status !== "resolved").length,
    onHold: complaints.filter((item) => item.status === "on_hold").length,
    resolved: complaints.filter((item) => item.status === "resolved").length,
  };

  return (
    <AuthGuard>
      <AppShell
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={() => setRefreshKey((value) => value + 1)}
              type="button"
            >
              Refresh
            </button>
            <Link className="btn-primary" href="/resident/submit-complaint">
              Submit Another
            </Link>
          </>
        }
        description="A resident-facing view of every complaint you have filed, with service routing, assigned staff, and the latest status in one place."
        title="My Complaints"
      >
        {error ? <div className="alert-error">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatsCard hint="All complaints you raised" label="Submitted" value={counts.total} />
          <StatsCard hint="Open, in progress, or on hold" label="Active" value={counts.active} />
          <StatsCard hint="Waiting on follow-up" label="On Hold" value={counts.onHold} />
          <StatsCard hint="Closed successfully" label="Resolved" value={counts.resolved} />
        </section>

        <section className="mt-6 rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                Resident Timeline
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Complaint history for {profile?.society?.name ?? "your society"}
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-500">
              This page is limited to the complaints submitted from your account,
              even though the tenant model keeps all data isolated at the society level.
            </p>
          </div>

          {loadingData ? (
            <div className="mt-6 rounded-3xl bg-slate-50 px-5 py-6 text-sm text-slate-500">
              Loading complaint history...
            </div>
          ) : complaints.length ? (
            <div className="mt-6 grid gap-4">
              {complaints.map((complaint) => (
                <ComplaintCard key={complaint.id} complaint={complaint} metaLabel="My complaint" />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-3xl bg-slate-50 px-5 py-6 text-sm text-slate-500">
              You have not submitted any complaints yet.
            </div>
          )}
        </section>
      </AppShell>
    </AuthGuard>
  );
}