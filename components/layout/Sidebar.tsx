"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { roleLabel } from "@/lib/constants";
import type { Profile } from "@/lib/types";

interface SidebarProps {
  profile: Profile | null;
}

function getNavigation(role: Profile["role"] | undefined) {
  if (role === "society_admin") {
    return [
      { href: "/admin", label: "Admin Home" },
      { href: "/admin/complaints", label: "Complaints" },
      { href: "/admin/residents", label: "Residents" },
      { href: "/admin/staff", label: "Staff" },
    ];
  }

  if (role === "maintenance_staff") {
    return [
      { href: "/maintenance", label: "Maintenance Home" },
      { href: "/maintenance/my-tasks", label: "My Tasks" },
    ];
  }

  if (role === "resident") {
    return [
      { href: "/resident", label: "Resident Home" },
      { href: "/resident/submit-complaint", label: "Submit Complaint" },
      { href: "/resident/my-complaints", label: "My Complaints" },
    ];
  }

  return [{ href: "/dashboard", label: "Dashboard" }];
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const items = getNavigation(profile?.role);

  return (
    <aside className="sticky top-6 h-fit rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="rounded-3xl bg-slate-950 px-4 py-4 text-white">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-300">
          SocietyFlow
        </p>
        <h2 className="mt-3 text-xl font-semibold">
          {profile?.society?.name ?? "Complaint SaaS"}
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          {profile ? roleLabel[profile.role] : "Workspace"}
        </p>
      </div>

      <nav className="mt-6 space-y-1.5">
        {items.map((item) => {
          const isActive = pathname === item.href;

          const baseClasses = "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition";
          const activeClasses = "bg-slate-900 text-white shadow-sm";
          const inactiveClasses = "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
          const className = isActive
            ? `${baseClasses} ${activeClasses}`
            : `${baseClasses} ${inactiveClasses}`;

          return (
            <Link key={item.href} className={className} href={item.href}>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 rounded-3xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Multi-tenant controls</p>
        <p className="mt-2 leading-6">
          Complaint data, apartments, services, and staff stay scoped to the
          active society.
        </p>
      </div>
    </aside>
  );
}