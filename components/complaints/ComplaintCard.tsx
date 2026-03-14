import type { ReactNode } from "react";
import { StatusBadge } from "@/components/complaints/StatusBadge";
import { ServiceIcon } from "@/components/complaints/ServiceIcon";
import type { ComplaintCardData } from "@/lib/types";

interface ComplaintCardProps {
  complaint: ComplaintCardData;
  footer?: ReactNode;
  metaLabel?: string;
}

export function ComplaintCard({
  complaint,
  footer,
  metaLabel,
}: ComplaintCardProps) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.05)] sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={complaint.status} />
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
              <ServiceIcon name={complaint.service?.name} />
              {complaint.service?.name ?? "Service"}
            </span>
            <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
              {metaLabel ?? "Complaint"}
            </span>
          </div>

          <div>
            <h3 className="text-xl font-semibold tracking-tight text-slate-950">
              {complaint.title}
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-[0.96rem]">
              {complaint.description}
            </p>
          </div>

          <div className="grid gap-3 text-sm text-slate-500 sm:grid-cols-2 xl:grid-cols-5">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Apartment
              </p>
              <p className="mt-1 font-medium text-slate-700">
                {complaint.apartment?.apartment_number ?? "Unassigned"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Resident
              </p>
              <p className="mt-1 font-medium text-slate-700">
                {complaint.resident?.full_name || complaint.resident?.email || "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Service Category
              </p>
              <div className="mt-1 flex items-center gap-2 font-medium text-slate-700">
                <ServiceIcon name={complaint.service?.name} />
                <span>{complaint.service?.name ?? "Service"}</span>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Assigned Staff
              </p>
              <p className="mt-1 font-medium text-slate-700">
                {complaint.assignedStaff?.full_name ||
                  complaint.assignedStaff?.email ||
                  "Awaiting assignment"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Created
              </p>
              <p className="mt-1 font-medium text-slate-700">
                {new Date(complaint.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          {complaint.comments && complaint.comments.length ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Comments
              </p>
              <div className="mt-3 grid gap-3">
                {complaint.comments.map((comment) => (
                  <div key={comment.id} className="rounded-xl bg-white px-3 py-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>
                        {comment.author?.full_name || comment.author?.email || "User"}
                      </span>
                      <span>{new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{comment.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {footer ? <div className="w-full max-w-[240px]">{footer}</div> : null}
      </div>
    </article>
  );
}