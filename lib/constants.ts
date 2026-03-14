import type { ComplaintStatus, UserRole } from "@/lib/types";

export const roleLabel: Record<UserRole, string> = {
  resident: "Resident",
  society_admin: "Society Admin",
  maintenance_staff: "Maintenance Staff",
};

export const complaintStatusMeta: Record<
  ComplaintStatus,
  { label: string; className: string }
> = {
  open: {
    label: "Open",
    className: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
  },
  on_hold: {
    label: "On Hold",
    className: "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200",
  },
  resolved: {
    label: "Resolved",
    className: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  },
};

export const complaintStatusOptions = Object.entries(complaintStatusMeta).map(
  ([value, item]) => ({
    label: item.label,
    value: value as ComplaintStatus,
  }),
);
