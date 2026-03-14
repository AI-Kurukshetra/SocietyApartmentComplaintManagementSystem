"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { roleLabel } from "@/lib/constants";
import { useAuth } from "@/components/providers/AuthProvider";

interface HeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  const router = useRouter();
  const { profile, session, signOut } = useAuth();

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="rounded-[28px] border border-slate-200 bg-white/90 px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.05)] backdrop-blur sm:px-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {profile ? roleLabel[profile.role] : "Workspace"}
            </span>
            {profile?.society?.name ? <span>{profile.society.name}</span> : null}
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2.1rem]">
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
              {description}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 sm:items-end">
          <div className="text-left sm:text-right">
            <p className="text-sm font-semibold text-slate-900">
              {profile?.full_name || session?.user.email || "Authenticated user"}
            </p>
            <p className="text-sm text-slate-500">{session?.user.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {actions}
            <button className="btn-secondary" onClick={handleLogout} type="button">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
