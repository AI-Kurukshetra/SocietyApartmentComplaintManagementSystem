"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = slug.trim();
    if (!trimmed) {
      return;
    }

    router.push(`/society/${trimmed}/signup`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10 sm:px-10">
      <section className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-strong px-8 py-10">
          <p className="text-sm font-medium uppercase tracking-[0.26em] text-[var(--brand)]">
            Society signup
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            Find your society link.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">
            Residents sign up through a society-specific URL. Enter the slug shared
            by your society admin to continue.
          </p>
        </div>

        <form className="panel space-y-5 px-6 py-7 sm:px-8" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="society-slug">
              Society slug
            </label>
            <input
              className="field"
              id="society-slug"
              onChange={(event) => setSlug(event.target.value)}
              placeholder="demo-society"
              required
              type="text"
              value={slug}
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Example: demo-society
            </p>
          </div>

          <button className="btn-primary w-full" type="submit">
            Continue to signup
          </button>

          <p className="text-sm text-[var(--muted)]">
            Already registered?{" "}
            <Link className="font-semibold text-[var(--brand)]" href="/login">
              Login here
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
