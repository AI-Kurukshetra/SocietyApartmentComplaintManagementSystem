"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { fetchSocietyBySlug } from "@/lib/data";
import { logError, toUserMessage } from "@/lib/errorMessages";
import { getRoleHome } from "@/lib/roleRoutes";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Society } from "@/lib/types";

export default function SocietySignupPage() {
  const router = useRouter();
  const params = useParams();
  const slugParam = params?.slug;
  const slug = useMemo(
    () => (Array.isArray(slugParam) ? slugParam[0] : slugParam) ?? "",
    [slugParam],
  );
  const { session, profile, loading } = useAuth();
  const [society, setSociety] = useState<Society | null>(null);
  const [societyLoading, setSocietyLoading] = useState(true);
  const [societyError, setSocietyError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [apartmentNumber, setApartmentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session && profile) {
      router.replace(getRoleHome(profile.role));
    }
  }, [loading, profile, router, session]);

  useEffect(() => {
    if (!slug) {
      setSocietyLoading(false);
      setSociety(null);
      setSocietyError("Missing society slug in the URL.");
      return;
    }

    if (!isSupabaseConfigured) {
      setSocietyLoading(false);
      setSociety(null);
      setSocietyError("Supabase environment variables are missing.");
      return;
    }

    let isMounted = true;

    async function loadSociety() {
      setSocietyLoading(true);
      setSocietyError(null);

      try {
        const supabase = getSupabaseClient();
        const societyRow = await fetchSocietyBySlug(supabase, slug);

        if (!isMounted) {
          return;
        }

        if (!societyRow) {
          setSociety(null);
          setSocietyError("No society was found for this signup link.");
          return;
        }

        setSociety(societyRow);
      } catch (loadError) {
        if (isMounted) {
          logError("society-signup.load-society", loadError);
          setSocietyError(
            toUserMessage(loadError, "Failed to load the society details."),
          );
        }
      } finally {
        if (isMounted) {
          setSocietyLoading(false);
        }
      }
    }

    void loadSociety();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      setError("Supabase environment variables are missing.");
      return;
    }

    if (!society) {
      setError("Society details are not available for this signup link.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const supabase = getSupabaseClient();
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          society_id: society.id,
          apartment_number: apartmentNumber.trim(),
          role: "resident",
        },
      },
    });

    setSubmitting(false);

    if (signupError) {
      logError("society-signup.submit", signupError);
      setError(
        toUserMessage(signupError, "Unable to create account. Please try again."),
      );
      return;
    }

    if (data.session) {
      router.replace("/resident");
      return;
    }

    setSuccess(
      "Account created. If email confirmation is enabled in Supabase, verify your inbox before logging in.",
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10 sm:px-10">
      <section className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="panel-strong px-8 py-10">
          <p className="text-sm font-medium uppercase tracking-[0.26em] text-[var(--brand)]">
            Society signup
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            {society?.name ? `Join ${society.name}.` : "Create your account."}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">
            Use this society-specific link to register your resident account. Your
            apartment number will be locked after signup.
          </p>
          {societyLoading ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Loading society?</p>
          ) : societyError ? (
            <p className="mt-4 text-sm text-rose-600">{societyError}</p>
          ) : society ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              Society slug: <span className="font-semibold">{society.slug}</span>
            </p>
          ) : null}
        </div>

        <form className="panel space-y-5 px-6 py-7 sm:px-8" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="full-name">
              Full name
            </label>
            <input
              className="field"
              id="full-name"
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Aarav Mehta"
              required
              type="text"
              value={fullName}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="signup-email">
              Email
            </label>
            <input
              className="field"
              id="signup-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="resident@society.com"
              required
              type="email"
              value={email}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="signup-apartment">
              Apartment number
            </label>
            <input
              className="field"
              id="signup-apartment"
              onChange={(event) => setApartmentNumber(event.target.value)}
              placeholder="A-1204"
              required
              type="text"
              value={apartmentNumber}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="signup-password">
              Password
            </label>
            <input
              className="field"
              id="signup-password"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 6 characters"
              required
              type="password"
              value={password}
            />
          </div>

          {error ? (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </p>
          ) : null}

          <button
            className="btn-primary w-full"
            disabled={submitting || societyLoading || Boolean(societyError)}
            type="submit"
          >
            {submitting ? "Creating account..." : "Sign up"}
          </button>

          <p className="text-sm text-[var(--muted)]">
            Already registered?{" "}
            <Link className="font-semibold text-[var(--brand)]" href="/login">
              Login here
            </Link>
          </p>
          <p className="text-sm text-[var(--muted)]">
            Need a different society?{" "}
            <Link className="font-semibold text-[var(--brand)]" href="/signup">
              Find your society link
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
