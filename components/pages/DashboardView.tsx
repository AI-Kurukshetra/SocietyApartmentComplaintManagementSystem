"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ComplaintCard } from "@/components/complaints/ComplaintCard";
import { useAuth } from "@/components/providers/AuthProvider";
import { StatsCard } from "@/components/ui/StatsCard";
import { fetchComplaintsByScope } from "@/lib/data";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { ComplaintCardData } from "@/lib/types";

export function DashboardView() {
  const { session, profile, loading: authLoading, error: authError } = useAuth();
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

    async function loadDashboard() {
      if (!profile || !session) {
        return;
      }

      const role = profile.role;
      const societyId = profile.society_id;
      const userId = session.user.id;

      setLoadingData(true);
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const nextComplaints = await fetchComplaintsByScope(
          supabase,
          role === "society_admin"
            ? { kind: "society", societyId: societyId, limit: 8 }
            : role === "maintenance_staff"
              ? { kind: "assigned", userId: userId, societyId }
              : { kind: "user", userId: userId, societyId },
        );

        if (isMounted) {
          setComplaints(nextComplaints);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load dashboard.",
          );
        }
      } finally {
        if (isMounted) {
          setLoadingData(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [authLoading, profile, refreshKey, session]);

  const counts = {
    total: complaints.length,
    open: complaints.filter((item) => item.status === "open").length,
    inProgress: complaints.filter((item) => item.status === "in_progress").length,
    resolved: complaints.filter((item) => item.status === "resolved").length,
  };

  const description =
    profile?.role === "society_admin"
      ? "Monitor the society-wide queue, active service categories, and the latest resident complaints from one clean operating view."
      : profile?.role === "maintenance_staff"
        ? "Review the work assigned to you, move tasks through each status, and keep the service queue moving."
        : "Track what you have raised, see where it is in the workflow, and submit new issues without leaving your society workspace.";

  return (
    <>
      {authError ? <div className="alert-error">{authError}</div> : null}
      {error ? <div className="alert-error">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard hint="Current complaint volume" label="Total" value={counts.total} />
        <StatsCard hint="Needs attention" label="Open" value={counts.open} />
        <StatsCard hint="Actively being worked" label="In Progress" value={counts.inProgress} />
        <StatsCard hint="Completed successfully" label="Resolved" value={counts.resolved} />
      </section>

      <section className="mt-6 rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
              Live Queue
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {profile?.role === "society_admin"
                ? "Latest society complaints"
                : profile?.role === "maintenance_staff"
                  ? "Assigned work orders"
                  : "Your recent complaints"}
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-slate-500">
            {profile?.role === "society_admin"
              ? "Admins see tenant-scoped complaints only, so every card below belongs to your society workspace."
              : profile?.role === "maintenance_staff"
                ? "Assignments are routed from the selected service category and surfaced here for execution."
                : "Residents only operate inside their own society workspace and can review submitted issues here."}
          </p>
        </div>

        {loadingData ? (
          <div className="mt-6 rounded-3xl bg-slate-50 px-5 py-6 text-sm text-slate-500">
            Loading complaints...
          </div>
        ) : complaints.length ? (
          <div className="mt-6 grid gap-4">
            {complaints.map((complaint) => (
              <ComplaintCard
                key={complaint.id}
                complaint={complaint}
                metaLabel={profile?.role === "resident" ? "My complaint" : "Complaint"}
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl bg-slate-50 px-5 py-6 text-sm text-slate-500">
            No complaints are available for this dashboard view yet.
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="btn-secondary"
          onClick={() => setRefreshKey((value) => value + 1)}
          type="button"
        >
          Refresh
        </button>
        <Link className="btn-primary" href="/resident/submit-complaint">
          New Complaint
        </Link>
      </div>

      {description ? (
        <p className="mt-6 text-sm text-slate-500">{description}</p>
      ) : null}
    </>
  );
}