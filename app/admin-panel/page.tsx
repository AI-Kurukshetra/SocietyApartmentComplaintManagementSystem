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
import { getRoleHome } from "@/lib/roleRoutes";
import {
  createApartment,
  createComment,
  createService,
  createStaffCategoryMapping,
  fetchApartmentsForSociety,
  fetchComplaintsByScope,
  fetchServicesForSociety,
  fetchStaffCategoriesForSociety,
  fetchUsersForSociety,
  updateComplaintStatus,
  updateServiceStatus,
  updateUserProfile,
} from "@/lib/data";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import type {
  Apartment,
  ComplaintCardData,
  ComplaintStatus,
  Profile,
  Service,
  StaffCategory,
  UserRole,
} from "@/lib/types";

interface UserDraft {
  apartment_id: string;
  role: UserRole;
}

type StaffCategoryDetail = StaffCategory & {
  staff: Profile | null;
  category: Service | null;
};

export default function AdminPanelPage() {
  const { session, profile, loading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<Profile[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffMappings, setStaffMappings] = useState<StaffCategoryDetail[]>([]);
  const [complaints, setComplaints] = useState<ComplaintCardData[]>([]);
  const [userDrafts, setUserDrafts] = useState<Record<string, UserDraft>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [serviceBusyId, setServiceBusyId] = useState<string | null>(null);
  const [updatingComplaintId, setUpdatingComplaintId] = useState<string | null>(null);
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [apartmentForm, setApartmentForm] = useState({
    apartment_number: "",
    block_name: "",
    floor_label: "",
  });
  const [serviceForm, setServiceForm] = useState({ name: "", description: "" });
  const [mappingForm, setMappingForm] = useState({
    staff_user_id: "",
    category_id: "",
  });

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!profile || !isSupabaseConfigured) {
      setLoadingData(false);
      return;
    }

    let isMounted = true;

    async function loadAdminData() {
      if (!profile) {
        return;
      }

      const societyId = profile.society_id;
      setLoadingData(true);
      setError(null);
      setSuccess(null);

      try {
        const supabase = getSupabaseClient();
        const [userRows, apartmentRows, serviceRows, mappingRows, complaintRows] =
          await Promise.all([
            fetchUsersForSociety(supabase, societyId),
            fetchApartmentsForSociety(supabase, societyId),
            fetchServicesForSociety(supabase, societyId),
            fetchStaffCategoriesForSociety(supabase, societyId),
            fetchComplaintsByScope(supabase, { kind: "society", societyId }),
          ]);

        if (!isMounted) {
          return;
        }

        setUsers(userRows);
        setApartments(apartmentRows);
        setServices(serviceRows);
        setStaffMappings(mappingRows);
        setComplaints(complaintRows);
        setUserDrafts(
          Object.fromEntries(
            userRows.map((item) => [
              item.id,
              {
                apartment_id: item.apartment_id ?? "",
                role: item.role,
              },
            ]),
          ),
        );
      } catch (loadError) {
        if (isMounted) {
          logError("admin.load", loadError);
          setError(toUserMessage(loadError, "Failed to load admin workspace."));
        }
      } finally {
        if (isMounted) {
          setLoadingData(false);
        }
      }
    }

    void loadAdminData();

    return () => {
      isMounted = false;
    };
  }, [authLoading, profile, refreshKey]);

  async function handleSaveUser(userId: string) {
    const draft = userDrafts[userId];

    if (!draft) {
      return;
    }

    setSavingUserId(userId);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseClient();
      await updateUserProfile(supabase, userId, {
        apartmentId: draft.apartment_id || null,
        role: draft.role,
      });

      setUsers((current) =>
        current.map((item) =>
          item.id === userId
            ? {
                ...item,
                apartment_id: draft.apartment_id || null,
                role: draft.role,
              }
            : item,
        ),
      );

      if (profile?.id === userId) {
        await refreshProfile();
      }

      setSuccess("User updated successfully.");
    } catch (updateError) {
      logError("admin.update-user", updateError);
      setError(toUserMessage(updateError, "Failed to update user."));
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleCreateApartment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseClient();
      await createApartment(supabase, {
        apartmentNumber: apartmentForm.apartment_number.trim(),
        blockName: apartmentForm.block_name.trim() || null,
        floorLabel: apartmentForm.floor_label.trim() || null,
        societyId: profile.society_id,
      });

      setApartmentForm({ apartment_number: "", block_name: "", floor_label: "" });
      setRefreshKey((value) => value + 1);
      setSuccess("Apartment added successfully.");
    } catch (insertError) {
      logError("admin.add-apartment", insertError);
      setError(toUserMessage(insertError, "Failed to add apartment."));
    }
  }

  async function handleCreateService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseClient();
      await createService(supabase, {
        description: serviceForm.description.trim() || null,
        name: serviceForm.name.trim(),
        societyId: profile.society_id,
      });

      setServiceForm({ name: "", description: "" });
      setRefreshKey((value) => value + 1);
      setSuccess("Service added successfully.");
    } catch (insertError) {
      logError("admin.add-service", insertError);
      setError(toUserMessage(insertError, "Failed to add service."));
    }
  }

  async function handleToggleService(service: Service) {
    setServiceBusyId(service.id);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseClient();
      await updateServiceStatus(supabase, service.id, !service.is_active);

      setServices((current) =>
        current.map((item) =>
          item.id === service.id ? { ...item, is_active: !item.is_active } : item,
        ),
      );
      setSuccess("Service status updated.");
    } catch (updateError) {
      logError("admin.update-service", updateError);
      setError(toUserMessage(updateError, "Failed to update service."));
    } finally {
      setServiceBusyId(null);
    }
  }

  async function handleCreateMapping(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseClient();
      await createStaffCategoryMapping(supabase, {
        categoryId: mappingForm.category_id,
        staffUserId: mappingForm.staff_user_id,
      });

      setMappingForm({ category_id: "", staff_user_id: "" });
      setRefreshKey((value) => value + 1);
      setSuccess("Staff category mapping created.");
    } catch (insertError) {
      logError("admin.create-mapping", insertError);
      setError(toUserMessage(insertError, "Failed to create staff category mapping."));
    }
  }

  async function handleComplaintStatusChange(
    complaintId: string,
    status: ComplaintStatus,
  ) {
    setUpdatingComplaintId(complaintId);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      await updateComplaintStatus(supabase, complaintId, status);

      setComplaints((current) =>
        current.map((item) => (item.id === complaintId ? { ...item, status } : item)),
      );
    } catch (updateError) {
      logError("admin.update-complaint", updateError);
      setError(toUserMessage(updateError, "Failed to update complaint status."));
    } finally {
      setUpdatingComplaintId(null);
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
      logError("admin.add-comment", commentError);
      setError(toUserMessage(commentError, "Failed to add comment."));
    } finally {
      setCommentingId(null);
    }
  }

  useEffect(() => {
    if (!authLoading && profile && profile.role !== "society_admin") {
      router.replace(getRoleHome(profile.role));
    }
  }, [authLoading, profile, router]);

  if (!authLoading && profile?.role !== "society_admin") {
    return (
      <AuthGuard>
        <AppShell description="Only society admins can access this workspace." title="Admin Panel">
          <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-8 text-sm text-slate-600 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
            Your current role does not include society administration permissions.
          </div>
        </AppShell>
      </AuthGuard>
    );
  }

  const maintenanceCandidates = users.filter(
    (item) => item.role === "maintenance_staff",
  );

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
        description="Manage tenant-scoped users, apartments, service categories, and staff routing without crossing society boundaries."
        title="Admin Panel"
      >
        {error ? <div className="alert-error">{error}</div> : null}
        {success ? <div className="alert-success">{success}</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatsCard hint="Profiles in this society" label="Users" value={users.length} />
          <StatsCard hint="Managed units" label="Apartments" value={apartments.length} />
          <StatsCard hint="Complaint routing categories" label="Services" value={services.length} />
          <StatsCard hint="Active staff mappings" label="Mappings" value={staffMappings.length} />
          <StatsCard hint="Total complaints" label="Complaints" value={complaints.length} />
        </section>

        {loadingData ? (
          <div className="mt-6 rounded-[32px] border border-slate-200 bg-white px-6 py-8 text-sm text-slate-500 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
            Loading admin workspace...
          </div>
        ) : (
          <div className="mt-6 grid gap-6">
            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-8">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                    User Management
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    Manage society users
                  </h2>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-slate-500">
                  Residents self-register with Supabase auth. Admins use this table
                  to assign apartments and promote users into admin or maintenance roles.
                </p>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead>
                    <tr className="text-left text-slate-400">
                      <th className="pb-3 pr-4 font-medium">User</th>
                      <th className="pb-3 pr-4 font-medium">Role</th>
                      <th className="pb-3 pr-4 font-medium">Apartment</th>
                      <th className="pb-3 pr-4 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="py-4 pr-4">
                          <p className="font-medium text-slate-900">
                            {user.full_name || user.email}
                          </p>
                          <p className="text-slate-500">{user.email}</p>
                        </td>
                        <td className="py-4 pr-4">
                          <select
                            className="field min-w-[170px]"
                            onChange={(event) =>
                              setUserDrafts((current) => ({
                                ...current,
                                [user.id]: {
                                  apartment_id: current[user.id]?.apartment_id ?? "",
                                  role: event.target.value as UserRole,
                                },
                              }))
                            }
                            value={userDrafts[user.id]?.role ?? user.role}
                          >
                            <option value="resident">Resident</option>
                            <option value="society_admin">Society Admin</option>
                            <option value="maintenance_staff">Maintenance Staff</option>
                          </select>
                        </td>
                        <td className="py-4 pr-4">
                          <select
                            className="field min-w-[200px]"
                            onChange={(event) =>
                              setUserDrafts((current) => ({
                                ...current,
                                [user.id]: {
                                  apartment_id: event.target.value,
                                  role: current[user.id]?.role ?? user.role,
                                },
                              }))
                            }
                            value={userDrafts[user.id]?.apartment_id ?? user.apartment_id ?? ""}
                          >
                            <option value="">No apartment</option>
                            {apartments.map((apartment) => (
                              <option key={apartment.id} value={apartment.id}>
                                {apartment.apartment_number}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-4 pr-4">
                          <button
                            className="btn-secondary"
                            disabled={savingUserId === user.id}
                            onClick={() => void handleSaveUser(user.id)}
                            type="button"
                          >
                            {savingUserId === user.id ? "Saving..." : "Save"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <form
                className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-8"
                onSubmit={handleCreateApartment}
              >
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                  Apartments
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Add apartments
                </h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <input
                    className="field"
                    onChange={(event) =>
                      setApartmentForm((current) => ({
                        ...current,
                        apartment_number: event.target.value,
                      }))
                    }
                    placeholder="A-1204"
                    required
                    value={apartmentForm.apartment_number}
                  />
                  <input
                    className="field"
                    onChange={(event) =>
                      setApartmentForm((current) => ({
                        ...current,
                        block_name: event.target.value,
                      }))
                    }
                    placeholder="Tower A"
                    value={apartmentForm.block_name}
                  />
                  <input
                    className="field md:col-span-2"
                    onChange={(event) =>
                      setApartmentForm((current) => ({
                        ...current,
                        floor_label: event.target.value,
                      }))
                    }
                    placeholder="12th Floor"
                    value={apartmentForm.floor_label}
                  />
                </div>
                <button className="btn-primary mt-5" type="submit">
                  Add Apartment
                </button>

                <div className="mt-6 grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                  {apartments.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
                      <span className="font-medium text-slate-900">{item.apartment_number}</span>
                      <span>{item.block_name || item.floor_label || "Apartment"}</span>
                    </div>
                  ))}
                </div>
              </form>

              <form
                className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-8"
                onSubmit={handleCreateService}
              >
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                  Services
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Manage complaint categories
                </h2>
                <div className="mt-5 grid gap-4">
                  <input
                    className="field"
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Electrical"
                    required
                    value={serviceForm.name}
                  />
                  <textarea
                    className="field min-h-[120px] resize-y"
                    onChange={(event) =>
                      setServiceForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Service scope, response expectations, or team notes"
                    value={serviceForm.description}
                  />
                </div>
                <button className="btn-primary mt-5" type="submit">
                  Add Service
                </button>

                <div className="mt-6 grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                  {services.map((service) => (
                    <div key={service.id} className="rounded-2xl bg-white px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-900">{service.name}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {service.description || "No service description yet."}
                          </p>
                        </div>
                        <button
                          className="btn-secondary"
                          disabled={serviceBusyId === service.id}
                          onClick={() => void handleToggleService(service)}
                          type="button"
                        >
                          {serviceBusyId === service.id
                            ? "Updating..."
                            : service.is_active
                              ? "Disable"
                              : "Enable"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </form>
            </section>

            <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
              <form
                className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-8"
                onSubmit={handleCreateMapping}
              >
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                  Staff Routing
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Map staff to categories
                </h2>
                <div className="mt-5 grid gap-4">
                  <select
                    className="field"
                    onChange={(event) =>
                      setMappingForm((current) => ({
                        ...current,
                        staff_user_id: event.target.value,
                      }))
                    }
                    required
                    value={mappingForm.staff_user_id}
                  >
                    <option value="">Select maintenance user</option>
                    {maintenanceCandidates.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name || item.email}
                      </option>
                    ))}
                  </select>
                  <select
                    className="field"
                    onChange={(event) =>
                      setMappingForm((current) => ({
                        ...current,
                        category_id: event.target.value,
                      }))
                    }
                    required
                    value={mappingForm.category_id}
                  >
                    <option value="">Select service category</option>
                    {services
                      .filter((item) => item.is_active)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </div>
                <button className="btn-primary mt-5" type="submit">
                  Create Mapping
                </button>
              </form>

              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-8">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                  Active Routing
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Service-to-staff mappings
                </h2>
                <div className="mt-6 grid gap-3 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                  {staffMappings.length ? (
                    staffMappings.map((item) => (
                      <div key={item.id} className="rounded-2xl bg-white px-4 py-4">
                        <p className="font-medium text-slate-900">
                          {item.category?.name ?? "Service"}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {item.staff?.full_name || item.staff?.email || "Maintenance user"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-white px-4 py-4 text-slate-500">
                      No staff category mappings have been created yet.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-8">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                    Complaints
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    Society complaint queue
                  </h2>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-slate-500">
                  Admins see every complaint in their society. Add notes, follow up,
                  and update statuses when needed.
                </p>
              </div>

              {complaints.length ? (
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
                              disabled={updatingComplaintId === complaint.id}
                              onChange={(event) =>
                                void handleComplaintStatusChange(
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
                              Add Admin Comment
                            </span>
                            <textarea
                              className="field min-h-[90px] resize-y"
                              onChange={(event) =>
                                setCommentDrafts((current) => ({
                                  ...current,
                                  [complaint.id]: event.target.value,
                                }))
                              }
                              placeholder="Share updates, approvals, or escalation notes."
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
                      metaLabel="Admin View"
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-3xl bg-slate-50 px-5 py-6 text-sm text-slate-500">
                  No complaints have been submitted yet.
                </div>
              )}
            </section>
          </div>
        )}
      </AppShell>
    </AuthGuard>
  );
}