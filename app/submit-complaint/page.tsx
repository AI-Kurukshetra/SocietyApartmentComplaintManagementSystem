"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { ServiceIcon } from "@/components/complaints/ServiceIcon";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { logError, toUserMessage } from "@/lib/errorMessages";
import {
  createComplaint,
  fetchServicesForSociety,
  fetchStaffForCategory,
} from "@/lib/data";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Profile, Service } from "@/lib/types";

type StaffSummary = Pick<Profile, "id" | "full_name" | "email" | "role" | "society_id">;

export const dynamic = "force-dynamic";

export default function SubmitComplaintPage() {
  const { session, profile, loading: authLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffSummary[]>([]);
  const [assignedStaffId, setAssignedStaffId] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffMessage, setStaffMessage] = useState<string | null>(null);
  const [serviceMenuOpen, setServiceMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const serviceMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedService = services.find((item) => item.id === serviceId) ?? null;
  const assignedStaff = staffOptions.find((item) => item.id === assignedStaffId) ?? null;
  const staffSelectOptions = staffOptions.map((staff) => ({
    value: staff.id,
    label: staff.full_name || staff.email || "Maintenance Staff",
  }));
  const staffNames = staffOptions
    .map((staff) => staff.full_name || staff.email || "maintenance staff")
    .filter(Boolean)
    .join(", ");
  const noServicesConfigured = !loadingOptions && services.length === 0;
  const noStaffForService = !staffLoading && serviceId && staffOptions.length === 0;

  useEffect(() => {
    console.log("societyId", profile?.society_id);
  }, [profile?.society_id]);

  useEffect(() => {
    console.log("services", services);
  }, [services]);

  useEffect(() => {
    console.log("staff", staffOptions);
  }, [staffOptions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!serviceMenuRef.current) {
        return;
      }

      if (!serviceMenuRef.current.contains(event.target as Node)) {
        setServiceMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!session || !profile || !isSupabaseConfigured) {
      setLoadingOptions(false);
      return;
    }

    if (!profile?.society_id) {
      return;
    }

    let isMounted = true;

    async function loadOptions() {
      if (!profile) {
        return;
      }

      const societyId = profile.society_id;
      setLoadingOptions(true);
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const serviceRows = await fetchServicesForSociety(supabase, societyId);

        if (!isMounted) {
          return;
        }

        const activeServices = serviceRows.filter((item) => item.is_active);

        setServices(activeServices);

        if (!serviceId) {
          setServiceId(activeServices[0]?.id ?? "");
        }
      } catch (loadError) {
        if (isMounted) {
          logError("complaint.load-options", loadError);
          setError(toUserMessage(loadError, "Failed to load services."));
        }
      } finally {
        if (isMounted) {
          setLoadingOptions(false);
        }
      }
    }

    void loadOptions();

    return () => {
      isMounted = false;
    };
  }, [authLoading, profile, serviceId, session]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!session || !profile || !isSupabaseConfigured || !serviceId) {
      setStaffOptions([]);
      setAssignedStaffId("");
      setStaffMessage(null);
      return;
    }

    let isMounted = true;

    async function loadStaff() {
      if (!profile) {
        return;
      }

      const societyId = profile.society_id;
      setStaffLoading(true);
      setStaffMessage(null);

      try {
        const supabase = getSupabaseClient();
        const staffRows = await fetchStaffForCategory(
          supabase,
          societyId,
          serviceId
        );

        if (!isMounted) {
          return;
        }

        setStaffOptions(staffRows);

        if (staffRows.length === 1) {
          setAssignedStaffId(staffRows[0].id);
          setStaffMessage(
            `Assigned to ${
              staffRows[0].full_name || staffRows[0].email || "maintenance staff"
            } automatically.`,
          );
        } else if (staffRows.length > 1) {
          setAssignedStaffId("");
          setStaffMessage("Select the maintenance staff who should handle this request.");
        } else {
          setAssignedStaffId("");
          setStaffMessage("No maintenance staff mapped to this service yet.");
        }
      } catch (loadError) {
        if (isMounted) {
          setStaffOptions([]);
          setAssignedStaffId("");
          logError("complaint.load-staff", loadError);
          setStaffMessage(
            toUserMessage(loadError, "Failed to load maintenance staff."),
          );
        }
      } finally {
        if (isMounted) {
          setStaffLoading(false);
        }
      }
    }

    void loadStaff();

    return () => {
      isMounted = false;
    };
  }, [authLoading, profile, serviceId, session]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    console.log("Submit handler invoked", { serviceId, assignedStaffId, profile });
    event.preventDefault();

    if (!session || !profile || !isSupabaseConfigured) {
      setError("You must be logged in with a valid society profile.");
      return;
    }

    let apartmentId = profile.apartment_id ?? profile.apartment?.id ?? "";

    if (!apartmentId) {
      const apartmentNumber = profile.apartment_number ?? profile.apartment?.apartment_number;

      if (!apartmentNumber) {
        setError("Your profile does not have an apartment assigned yet.");
        return;
      }

      const supabase = getSupabaseClient();
      let apartment;

      try {
        const result = await supabase
          .from("apartments")
          .select("id")
          .eq("society_id", profile.society_id)
          .eq("apartment_number", apartmentNumber)
          .maybeSingle();

        apartment = result.data;

        if (result.error) {
          throw result.error;
        }
      } catch (err) {
        // Some existing schemas may not have a society_id column on apartments.
        // Fallback to matching only by apartment_number.
        console.warn("Apartment lookup by society_id failed, falling back to apartment_number only", err);

        const result = await supabase
          .from("apartments")
          .select("id")
          .eq("apartment_number", apartmentNumber)
          .maybeSingle();

        if (result.error) {
          setError("Failed to resolve your apartment. Please contact your society admin.");
          return;
        }

        apartment = result.data;
      }

      if (!apartment?.id) {
        setError("Your profile does not have an apartment assigned yet.");
        return;
      }

      apartmentId = apartment.id;
    }

    if (!serviceId) {
      setError("Select a service category before submitting.");
      return;
    }

    if (!assignedStaffId) {
      setError(
        staffOptions.length
          ? "Select a maintenance staff member for this service."
          : "No maintenance staff are mapped to this service yet.",
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseClient();
      await createComplaint(supabase, {
        apartmentId,
        description: description.trim(),
        residentUserId: session.user.id,
        categoryId: serviceId,
        societyId: profile.society_id,
        assignedStaffId,
        title: title.trim(),
      });

      setTitle("");
      setDescription("");
      setSuccess(
        "Complaint submitted successfully. The assigned maintenance staff have been notified.",
      );
    } catch (submitError) {
      logError("complaint.submit", submitError);
      setError(toUserMessage(submitError, "Failed to submit complaint."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthGuard>
      <AppShell
        description="Residents can raise new issues against their apartment and route them to the right maintenance stream automatically through service-based assignment."
        title="Submit Complaint"
      >
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <form
            className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-8"
            onSubmit={handleSubmit}
          >
            {noServicesConfigured ? (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                No service categories are configured yet. Ask your society admin to add
                service categories before filing a complaint.
              </div>
            ) : null}

            {!staffLoading && staffOptions.length > 0 ? (
              <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Assigned maintenance staff: {staffNames}
              </div>
            ) : noStaffForService ? (
              <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                This service has no maintenance staff assigned yet. Please select a
                different service or ask your society admin to add coverage.
              </div>
            ) : null}

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="complaint-title">
                  Complaint title
                </label>
                <input
                  className="field"
                  id="complaint-title"
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Water leak in kitchen ceiling"
                  required
                  type="text"
                  value={title}
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-medium text-slate-700"
                  htmlFor="apartment-number"
                >
                  Apartment
                </label>
                <input
                  className="field"
                  id="apartment-number"
                  placeholder="Apartment number"
                  readOnly
                  value={profile?.apartment_number ?? profile?.apartment?.apartment_number ?? ""}
                />
                {profile && !(profile.apartment_number ?? profile.apartment?.apartment_number) ? (
                  <p className="mt-2 text-xs text-amber-600">
                    Your profile does not have an apartment number yet. Contact your
                    society admin before submitting a complaint.
                  </p>
                ) : null}
              </div>

              <div ref={serviceMenuRef} className="relative">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Service category
                </label>
                <button
                  className="field flex w-full items-center justify-between gap-3"
                  disabled={loadingOptions || services.length === 0}
                  onClick={() => setServiceMenuOpen((open) => !open)}
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={serviceMenuOpen}
                >
                  <span className="flex items-center gap-2 text-sm">
                    {selectedService ? (
                      <ServiceIcon name={selectedService.name} />
                    ) : (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <span className="text-xs">--</span>
                      </span>
                    )}
                    <span className="text-slate-700">
                      {selectedService?.name ?? "Select service"}
                    </span>
                  </span>
                  <span className="text-slate-400">?</span>
                </button>

                {serviceMenuOpen ? (
                  <div
                    className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_50px_rgba(15,23,42,0.12)]"
                    role="listbox"
                  >
                    {services.length ? (
                      services.map((item) => (
                        <button
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                          key={item.id}
                          onClick={() => {
                            setServiceId(item.id);
                            setServiceMenuOpen(false);
                          }}
                          role="option"
                          type="button"
                          aria-selected={item.id === serviceId}
                        >
                          <ServiceIcon name={item.name} />
                          <span className="flex flex-col">
                            <span className="font-medium text-slate-900">{item.name}</span>
                            <span className="text-xs text-slate-500">
                              {item.description || "No description provided."}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-sm text-slate-500">
                        No service categories available.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Assigned maintenance staff
                </label>

                {staffLoading ? (
                  <div className="field flex items-center justify-between text-sm text-slate-500">
                    Loading maintenance staff...
                  </div>
                ) : staffOptions.length > 1 ? (
                  <select
                    className="field"
                    onChange={(event) => setAssignedStaffId(event.target.value)}
                    required
                    value={assignedStaffId}
                  >
                    <option value="">Select staff member</option>
                    {staffSelectOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : staffOptions.length === 1 ? (
                  <div className="field flex items-center justify-between text-sm text-slate-600">
                    <span>
                      {assignedStaff?.full_name ||
                        assignedStaff?.email ||
                        "Assigned maintenance staff"}
                    </span>
                    <span className="text-xs uppercase tracking-[0.16em] text-emerald-600">
                      Auto assigned
                    </span>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    No maintenance staff are mapped to this service yet.
                  </div>
                )}

                {staffMessage ? (
                  <p className="mt-2 text-xs text-slate-500">{staffMessage}</p>
                ) : null}
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="complaint-description">
                  Details
                </label>
                <textarea
                  className="field min-h-[220px] resize-y"
                  id="complaint-description"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe the issue clearly, include location, urgency, and any context that helps the maintenance team arrive prepared."
                  required
                  value={description}
                />
              </div>
            </div>

            {error ? <p className="alert-error mt-5">{error}</p> : null}
            {success ? <p className="alert-success mt-5">{success}</p> : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="btn-primary"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "Submitting..." : "Create Complaint"}
              </button>
              <Link className="btn-secondary" href="/resident/my-complaints">
                View My Complaints
              </Link>
            </div>
          </form>

          <aside className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
              Submission Rules
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Route requests to the right team
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              <p>
                Pick the correct service so the platform can assign the complaint
                to the right maintenance coverage.
              </p>
              <p>
                If multiple staff members handle a service, choose the best match
                from the roster before submitting.
              </p>
              <p>
                If your society has no active services or staff mappings yet, a
                society admin needs to configure them from the admin panel.
              </p>
            </div>
          </aside>
        </section>
      </AppShell>
    </AuthGuard>
  );
}