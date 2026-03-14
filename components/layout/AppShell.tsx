"use client";

import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/components/providers/AuthProvider";

interface AppShellProps {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function AppShell({
  title,
  description,
  children,
  actions,
}: AppShellProps) {
  const { profile } = useAuth();

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1520px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Sidebar profile={profile} />
        <div className="space-y-6">
          <Header actions={actions} description={description} title={title} />
          <section>{children}</section>
        </div>
      </div>
    </main>
  );
}
