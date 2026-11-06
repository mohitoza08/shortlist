"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Field, Input, Receipt, ScoreRing, Wordmark } from "@/components/ui/primitives";

const DEMO = [
  { label: "Recruiter", email: "recruiter@meridian.example" },
  { label: "Ashford client", email: "hiring@ashfordbank.example" },
  { label: "Vela client", email: "hiring@velaretail.example" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (!res || res.error) {
      setError("That email and password don’t match. Check them and try again.");
      return;
    }
    router.replace("/requisitions");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh md:grid-cols-[1.15fr_1fr]">
      {/* The product is the hero: one real-looking candidate with its proof, on a dark field. */}
      <section className="aurora grain relative flex flex-col justify-between gap-12 overflow-hidden px-8 py-10 text-white md:px-14 md:py-14">
        <Wordmark size={24} light />

        <div className="relative z-10 my-12 max-w-xl md:my-0">
          <p className="label mb-5 text-accent-bright">CV screening for staffing teams</p>
          <h1 className="serif text-[52px] leading-[0.98] sm:text-[68px] md:text-[76px]">
            The right CVs,
            <br />
            <em className="text-accent-bright">first.</em>
          </h1>
          <p className="mt-6 max-w-md text-[16px] leading-7 text-white/65">
            Every score comes with a line quoted straight from the CV. Open it, check it, then decide. Nobody is rejected by a machine.
          </p>

          <div className="rise mt-10 max-w-md rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] backdrop-blur-md" style={{ ["--i" as string]: 3 }}>
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-white p-1">
                <ScoreRing score={92} size={56} />
              </div>
              <div className="min-w-0">
                <p className="text-[15px] font-medium tracking-[-0.01em]">Ritika Bansal</p>
                <p className="text-[13px] text-white/55">Senior Java Developer · 7 yrs · Pune</p>
              </div>
              <span className="label ml-auto hidden whitespace-nowrap rounded-full border border-white/15 px-2.5 py-1 !text-white/70 sm:block">4/4 must-haves</span>
            </div>
            <Receipt label="Verified in CV" className="mt-4 !bg-none !bg-white/[0.06]">
              <span className="text-white/80">“Led migration of 14 payment services to Spring Boot, cutting p95 latency by 38%”</span>
            </Receipt>
          </div>
        </div>

        <p className="relative z-10 hidden text-[12px] text-white/40 md:block">Demo workspace · every candidate is synthetic · AI ranks, people decide</p>
      </section>

      <section className="flex items-center bg-surface px-8 py-12 md:px-16">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="display text-[30px]">Welcome back</h2>
          <p className="mt-2 text-muted">Sign in to your workspace.</p>
          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11" />
            </Field>
            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email || !password} disabledReason="Enter your email and password">
              Sign in
            </Button>
          </form>

          {/* One tap to a working demo: removes the biggest first-run friction. */}
          <div className="mt-10 rounded-xl border border-dashed border-line-strong bg-paper p-4">
            <p className="label mb-3">Try it as</p>
            <div className="flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword("Demo1234!");
                    setError(null);
                  }}
                  className="rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-[13px] t-fast hover:border-ink hover:shadow-[var(--shadow-card)]"
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Password for all demo accounts: <span className="mono text-ink">Demo1234!</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
