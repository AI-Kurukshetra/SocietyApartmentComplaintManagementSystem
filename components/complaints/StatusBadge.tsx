import { complaintStatusMeta } from "@/lib/constants";
import type { ComplaintStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const meta = complaintStatusMeta[status];
  const baseClasses =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]";

  return (
    <span
      className={`${baseClasses} ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

