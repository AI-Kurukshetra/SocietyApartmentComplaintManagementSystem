"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ComplaintCard } from "@/components/complaints/ComplaintCard";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { StatsCard } from "@/components/ui/StatsCard";
import { complaintStatusOptions } from "@/lib/constants";
import { logError, toUserMessage } from "@/lib/errorMessages";
import { createComment, fetchComplaintsByScope, updateComplaintStatus } from "@/lib/data";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import { getRoleHome } from "@/lib/roleRoutes";
import type { ComplaintCardData, ComplaintStatus } from "@/lib/types";

export default function MaintenancePanelPage() {
  const { session, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [complaints, setComplaints] = useState<ComplaintCardData[]>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [commentingId, setCommentingId] = useState<string | null>(null);
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
          kind: "assigned",
          userId: userId,
          societyId: profile.society_id,
        });

        if (isMounted) {
          setComplaints(rows);
        }
      } catch (loadError) {
        if (isMounted) {
          logError("maintenance.load", loadError);
          setError(toUserMessage(loadError, "Failed to load assigned complaints."));
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
  }, [authLoading, profile, refreshKey, session]);

  async function handleStatusChange(complaintId: string, status: ComplaintStatus) {
    setUpdatingId(complaintId);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      await updateComplaintStatus(supabase, complaintId, status);

      setComplaints((current) =>
        current.map((item) => (item.id === complaintId ? { ...item, status } : item)),
      );
    } catch (updateError) {
      logError("maintenance.update-status", updateError);
      setError(toUserMessage(updateError, "Failed to update complaint status."));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleAddComment(complaintId: string) {
    if (!session || !profile) {
      setError("You must be logged in to comment.");
      return;
    }

    const message = commentDrafts[complaintId]?.trim();

    if (!message) {
      return;
    }

    setCommentingId(complaintId);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const newComment = await createComment(supabase, {
        complaintId,
        userId: session.user.id,
        comment: message,
      });

      setComplaints((current) =>
        current.map((item) =>
          item.id === complaintId
            ? {
                ...item,
                comments: [
                  ...(item.comments ?? []),
                  { ...newComment, author: profile },
                ],
              }
            : item,
        ),
      );
      setCommentDrafts((current) => ({ ...current, [complaintId]: "" }));
    } catch (commentError) {
      logError("maintenance.add-comment", commentError);
      setError(toUserMessage(commentError, "Failed to add comment."));
    } finally {
      setCommentingId(null);
    }
  }

  useEffect(() => {
    if (!authLoading && profile && profile.role !== "maintenance_staff") {
      router.replace(getRoleHome(profile.role));
    }
  }, [authLoading, profile, router]);

  if (!authLoading && profile?.role !== "maintenance_staff") {
    return (
      <AuthGuard>
        <AppShell
          description="Only maintenance staff can access this queue."
          title="Maintenance Panel"
        >
          <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-8 text-sm text-slate-600 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
            Your current role does not include access to the maintenance queue.
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  const counts = {
    assigned: complaints.length,
    open: complaints.filter((item) => item.status === "open").length,
    onHold: complaints.filter((item) => item.status === "on_hold").length,
    resolved: complaints.filter((item) => item.status === "resolved").length,
  };

  return (
    <AuthGuard>
      <AppShell
        actions={
          <button
            className="btn-secondary"
            onClick={() => setRefreshKey((value) => value + 1)}
            type="button"
          >
            Refresh
          </button>
        }
        description="Maintenance staff see only complaints routed to them from service-based assignment and can update statuses directly from this panel."
        title="Maintenance Panel"
      >
        {error ? <div className="alert-error">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatsCard hint="Total assigned to you" label="Assigned" value={counts.assigned} />
          <StatsCard hint="New issues to start" label="Open" value={counts.open} />
          <StatsCard hint="Waiting on dependencies" label="On Hold" value={counts.onHold} />
          <StatsCard hint="Closed work orders" label="Resolved" value={counts.resolved} />
        </section>

        <section className="mt-6 rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                Work Queue
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Assigned complaints
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-500">
              Update progress directly from each card. All writes remain scoped by
              Supabase RLS to the complaints assigned to your maintenance user.
            </p>
          </div>

          {loadingData ? (
            <div className="mt-6 rounded-3xl bg-slate-50 px-5 py-6 text-sm text-slate-500">
              Loading assigned complaints...
            </div>
          ) : complaints.length ? (
            <div className="mt-6 grid gap-4">
              {complaints.map((complaint) => (
                <ComplaintCard
                  key={complaint.id}
                  complaint={complaint}
                  footer={
                    <div className="grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm">
                      <label className="block">
                        <span className="mb-2 block font-medium text-slate-700">
                          Update Status
                        </span>
                        <select
                          className="field"
                          disabled={updatingId === complaint.id}
                          onChange={(event) =>
                            void handleStatusChange(
                              complaint.id,
                              event.target.value as ComplaintStatus,
                            )
                          }
                          value={complaint.status}
                        >
                          {complaintStatusOptions.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block font-medium text-slate-700">
                          Add Comment
                        </span>
                        <textarea
                          className="field min-h-[90px] resize-y"
                          onChange={(event) =>
                            setCommentDrafts((current) => ({
                              ...current,
                              [complaint.id]: event.target.value,
                            }))
                          }
                          placeholder="Share progress updates or next steps."
                          value={commentDrafts[complaint.id] ?? ""}
                        />
                        <button
                          className="btn-secondary mt-3 w-full"
                          disabled={commentingId === complaint.id}
                          onClick={() => void handleAddComment(complaint.id)}
                          type="button"
                        >
                          {commentingId === complaint.id ? "Posting..." : "Post Comment"}
                        </button>
                      </label>
                    </div>
                  }
                  metaLabel="Assigned"
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-3xl bg-slate-50 px-5 py-6 text-sm text-slate-500">
              No complaints are assigned to you right now.
            </div>
          )}
        </section>
      </AppShell>
    </AuthGuard>
  );
}