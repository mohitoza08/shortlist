"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Field, Input, Wordmark } from "@/components/ui/primitives";

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
    <main className="grid min-h-dvh md:grid-cols-[44fr_56fr]">
      <section className="flex flex-col justify-between border-b border-line bg-paper px-8 py-10 md:border-b-0 md:border-r md:px-14 md:py-14">
        <Wordmark size={30} />
        <div className="my-10 max-w-md md:my-0">
          <h1 className="display text-[40px] leading-[48px] md:text-[44px] md:leading-[52px]">The right CVs, first.</h1>
          <p className="mt-4 text-base text-muted">
            Upload a pile of CVs against a job and see the best first, each score backed by a line quoted from the CV.
          </p>
          <div className="my-8 h-px w-16 bg-line-strong" />
          <p className="text-[13px] text-muted">
            Demo workspace for Meridian Talent. All candidates are synthetic. AI ranks; recruiters decide.
          </p>
        </div>
        <p className="hidden text-xs text-muted md:block">Candidate data is used for hiring only.</p>
      </section>

      <section className="flex items-center bg-surface px-8 py-12 md:px-16">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="display text-[28px] leading-9">Sign in</h2>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!email || !password} disabledReason="Enter your email and password">
              Sign in
            </Button>
          </form>

          <div className="mt-8 border-t border-line pt-6">
            <p className="label mb-3">Demo accounts</p>
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
                  className="rounded-full border border-line-strong px-3.5 py-1.5 text-[13px] t-fast hover:bg-surface-2"
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Password for all demo accounts: <span className="font-medium text-ink">Demo1234!</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
