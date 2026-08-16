import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut, Mail, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Movie Afterparty" },
      {
        name: "description",
        content:
          "Sign in to Movie Afterparty to reach the data ingestion tools. Browsing, filters and lists work without an account.",
      },
      { property: "og:title", content: "Sign in — Movie Afterparty" },
      {
        property: "og:description",
        content: "Optional sign-in for Movie Afterparty admin tools.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, userId, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setStatus(
          data.session ? "You're signed in." : "Check your email to confirm your account.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setStatus(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if ("error" in result && result.error) setStatus(result.error.message);
  }

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-md px-5 pb-16 pt-8">
        <h1 className="font-display text-3xl font-bold">Account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything you use day to day — services, filters, lists, watch history — is stored on
          this device and needs no account. Sign in only to reach the data ingestion tools.
        </p>

        {loading ? (
          <div className="mt-6 h-40 animate-pulse rounded-2xl bg-muted" />
        ) : userId ? (
          <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-teal" aria-hidden />
              Signed in as {user?.email ?? "your account"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/admin/ingest"
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground neon"
              >
                Open ingestion tools
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  void navigate({ to: "/", replace: true });
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </button>
            </div>
          </section>
        ) : (
          <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
            <button
              type="button"
              onClick={google}
              className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground neon"
            >
              Continue with Google
            </button>

            <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={submit} className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Password
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
              >
                <Mail className="size-4" aria-hidden />
                {mode === "signup" ? "Create account" : "Sign in with email"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="mt-3 text-xs font-semibold text-coral"
            >
              {mode === "signup" ? "I already have an account" : "Create an account instead"}
            </button>

            {status ? <p className="mt-3 text-xs text-muted-foreground">{status}</p> : null}
          </section>
        )}
      </main>
    </AppShell>
  );
}
