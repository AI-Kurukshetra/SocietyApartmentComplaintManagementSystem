import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-10 sm:px-10 lg:px-12">
      <section className="panel-strong animate-rise-in grid gap-10 overflow-hidden px-7 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1.25fr_0.95fr]">
        <div className="space-y-8">
          <div className="inline-flex items-center rounded-full border border-[rgba(20,33,61,0.14)] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
            Next.js 14 - Supabase - Vercel
          </div>
          <div className="space-y-4">
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-[var(--brand)]">
              Society Complaint Management System
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              A focused resident portal for raising issues and giving admins a
              clean operating view.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
              Residents can log in, file complaints, and track updates.
              Administrators get an audit-friendly dashboard with all submitted
              cases in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="btn-primary" href="/signup">
              Create account
            </Link>
            <Link className="btn-secondary" href="/login">
              Resident login
            </Link>
            <Link className="btn-secondary" href="/dashboard">
              Open dashboard
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="panel px-6 py-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              Resident flow
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Submit complaints fast</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Use a dedicated complaint page, save sessions across reloads, and
              review your complaint history in the dashboard.
            </p>
          </div>
          <div className="panel px-6 py-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              Admin flow
            </p>
            <h2 className="mt-3 text-2xl font-semibold">See everything clearly</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Admin profiles can review all complaints and update status from
              the same dashboard surface.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        {[
          {
            title: "Supabase auth",
            copy: "Email and password signup, login, logout, and browser-side session persistence are wired in.",
          },
          {
            title: "Role-aware dashboard",
            copy: "Residents see their own complaints. Admins can inspect all complaints and adjust statuses.",
          },
          {
            title: "Deployment-ready",
            copy: "Environment variables, SQL schema, seed script, and README instructions are included for Vercel deployment.",
          },
        ].map((item) => (
          <article key={item.title} className="panel px-6 py-6">
            <h3 className="text-xl font-semibold">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              {item.copy}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}

