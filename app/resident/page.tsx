"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardView } from "@/components/pages/DashboardView";

export default function ResidentHomePage() {
  return (
    <AuthGuard>
      <AppShell
        description="Your resident dashboard view."
        title="Resident Home"
      >
        <DashboardView />
      </AppShell>
    </AuthGuard>
  );
}
