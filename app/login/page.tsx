"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { getRoleHome } from "@/lib/roleRoutes";
import { logError, toUserMessage } from "@/lib/errorMessages";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const { session, profile, loading, error: authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session && profile) {
      router.replace(getRoleHome(profile.role));
    }
  }, [loading, profile, router, session]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      setError("Supabase environment variables are missing.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = getSupabaseClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setSubmitting(false);

    if (loginError) {
      logError("login", loginError);
      setError(
        toUserMessage(loginError, "Unable to sign in. Check your credentials and try again."),
      );
      return;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10 sm:px-10">
      <section className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel-strong px-8 py-10">
          <p className="text-sm font-medium uppercase tracking-[0.26em] text-[var(--brand)]">
            Resident login
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            Continue into the complaint dashboard.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">
            Sign in with your Supabase email and password. Your session remains
            persisted in the browser until you log out.
          </p>
        </div>

        <form className="panel space-y-5 px-6 py-7 sm:px-8" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              className="field"
              id="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="resident@society.com"
              required
              type="email"
              value={email}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              className="field"
              id="password"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              type="password"
              value={password}
            />
          </div>

          {error || authError ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error ?? authError}
            </p>
          ) : null}

          <button className="btn-primary w-full" disabled={submitting} type="submit">
            {submitting ? "Signing in..." : "Login"}
          </button>

          <p className="text-sm text-[var(--muted)]">
            Need a resident account?{" "}
            <Link className="font-semibold text-[var(--brand)]" href="/signup">
              Sign up
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
