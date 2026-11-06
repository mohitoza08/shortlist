"use client";

import * as React from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- Button ---------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  /** Shown as a tooltip and read by screen readers when the button is disabled. */
  disabledReason?: string;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, disabled, disabledReason, className, children, ...props },
  ref,
) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[9px] font-medium t-fast select-none whitespace-nowrap active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100";
  const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-11 px-5 text-[15px]" };
  const variants = {
    primary: "bg-ink text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(14,18,16,0.3)] hover:bg-accent disabled:bg-surface-3 disabled:text-muted disabled:shadow-none",
    secondary: "bg-surface text-ink border border-line-strong shadow-[var(--shadow-card)] hover:border-ink/40 disabled:text-muted disabled:bg-surface-2 disabled:shadow-none",
    ghost: "text-ink hover:bg-surface-2 disabled:text-muted",
    danger: "bg-surface text-danger border border-line-strong hover:bg-danger-soft disabled:text-muted",
  };
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      title={disabled ? disabledReason : undefined}
      aria-disabled={isDisabled}
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

/* ---------- Fields ---------- */
const fieldBase =
  "w-full rounded-[9px] border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-muted/80 t-fast hover:border-ink/40 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-bright/20 disabled:bg-surface-2 disabled:text-muted";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...p }, ref) {
    return <input ref={ref} aria-invalid={invalid} className={cn(fieldBase, "h-10", invalid && "border-danger", className)} {...p} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...p }, ref) {
    return <textarea ref={ref} className={cn(fieldBase, "py-2.5 leading-6", className)} {...p} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...p },
  ref,
) {
  return (
    <select ref={ref} className={cn(fieldBase, "h-10 appearance-none bg-[length:12px] pr-8", className)} {...p}>
      {children}
    </select>
  );
});

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="label block">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, className, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" {...p} />
      {label && <span>{label}</span>}
    </label>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full t-fast", checked ? "bg-accent" : "bg-line-strong")}
    >
      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white t-fast", checked ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

/* ---------- Surfaces ---------- */
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[14px] border border-line bg-surface shadow-[var(--shadow-card)]", className)} {...p} />;
}

export function Badge({
  tone = "neutral",
  className,
  ...p
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "accent" | "warn" | "danger" | "success" }) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line",
    accent: "bg-accent-soft text-accent ring-1 ring-inset ring-accent/15",
    warn: "bg-warn-soft text-warn ring-1 ring-inset ring-warn/20",
    danger: "bg-danger-soft text-danger ring-1 ring-inset ring-danger/15",
    success: "bg-accent-soft text-success ring-1 ring-inset ring-success/15",
  };
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap", tones[tone], className)}
      {...p}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton h-4", className)} />;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <header className="rise mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2.5 text-[13px] text-muted">{eyebrow}</div>}
        <h1 className="display text-[30px] sm:text-[40px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-xl text-[15px] leading-6 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-line-strong px-6 py-14 text-center">
      <p className="serif text-[28px]">{title}</p>
      {body && <p className="mt-2 max-w-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-4 rounded-[14px] border border-danger/30 bg-danger-soft px-4 py-3">
      <p className="text-sm text-danger">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "accent" | "danger"; children: React.ReactNode }) {
  const t = { warn: "bg-warn-soft text-warn border-warn/30", accent: "bg-accent-soft text-accent border-accent/20", danger: "bg-danger-soft text-danger border-danger/30" };
  return <div className={cn("rounded-[8px] border px-3.5 py-2.5 text-[13px]", t[tone])}>{children}</div>;
}

/* ---------- Tabs ---------- */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-6 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "-mb-px border-b-2 pb-2.5 text-sm font-medium t-fast",
            value === t.id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Drawer / Modal ---------- */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-night/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-surface shadow-[var(--shadow-pop)] md:w-[720px]"
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-md text-muted hover:bg-surface-2">
          <X className="size-5" />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line bg-surface px-5 py-3">{footer}</div>}
      </aside>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-night/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-md rounded-[14px] border border-line bg-surface p-6 shadow-[var(--shadow-pop)]">
        <h2 className="display mb-4 text-[22px]">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/* ---------- Domain atoms ---------- */
const AVATAR_TINTS = [
  ["#e6f3ee", "#0b6e55"],
  ["#eaeefb", "#3446a8"],
  ["#f6ece4", "#9a5a1f"],
  ["#f3e8f3", "#80387f"],
  ["#e4f1f4", "#176a7d"],
  ["#f1efe0", "#6b6218"],
];

export function AvatarInitials({ name, size = 36 }: { name: string; size?: number }) {
  const t = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  // Stable tint per person so a row is recognisable at a glance (recognition over recall).
  const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TINTS.length;
  const [bg, fg] = AVATAR_TINTS[h];
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.36, background: bg, color: fg }}
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold ring-1 ring-inset ring-black/5"
    >
      {t || "?"}
    </span>
  );
}

function scoreColor(score: number) {
  return score >= 85 ? "var(--accent-bright)" : score >= 65 ? "var(--accent)" : score >= 40 ? "var(--warn)" : "var(--line-strong)";
}

/** Circular score: the number is the hero, the ring is the proof. Draws itself once on load. */
export function ScoreRing({ score, size = 52, index = 0 }: { score: number | null; size?: number; index?: number }) {
  if (score == null) return <span className="text-muted">—</span>;
  const v = Math.max(0, Math.min(100, score));
  const stroke = size >= 64 ? 5 : 4;
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const off = len * (1 - v / 100);
  return (
    <div className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`Score ${Math.round(v)} out of 100`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={scoreColor(v)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={off}
          className="ring-arc"
          style={{ ["--ring-len" as string]: len, ["--ring-off" as string]: off, ["--i" as string]: index }}
        />
      </svg>
      <span className="serif absolute text-ink" style={{ fontSize: size * 0.42 }}>
        {Math.round(v)}
      </span>
    </div>
  );
}

export function ScoreBar({ score, showNumber = true }: { score: number | null; showNumber?: boolean }) {
  if (score == null) return <span className="text-muted">—</span>;
  return (
    <div className="flex items-center gap-2.5" role="img" aria-label={`Score ${Math.round(score)} out of 100`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, score))}%`, background: scoreColor(score) }} />
      </div>
      {showNumber && <span className="mono w-8 text-sm font-medium">{Math.round(score)}</span>}
    </div>
  );
}

export function ConfidenceDot({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted">—</span>;
  const band = value >= 0.8 ? "High" : value >= 0.6 ? "Medium" : "Low";
  const color = band === "High" ? "bg-accent-bright" : band === "Medium" ? "bg-warn" : "bg-danger";
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2" title={`Confidence ${value.toFixed(2)}`}>
      <span className={cn("size-2 rounded-full", color)} aria-hidden />
      {band}
    </span>
  );
}

/** A quoted CV line with a verified stamp. The reason this product can be trusted, so it gets its own visual. */
export function Receipt({ children, label, className }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <div className={cn("receipt", className)}>
      {label && (
        <span className="label mb-0.5 flex items-center gap-1.5 text-accent">
          <span aria-hidden className="size-1.5 rounded-full bg-accent-bright" />
          {label}
        </span>
      )}
      <span className="mono block text-[12.5px] leading-5 text-ink-2">{children}</span>
    </div>
  );
}

/** Where am I in the flow? Shown on the multi-step screens so nobody wonders what comes next. */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px]" aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={s} className="flex items-center gap-2" aria-current={on ? "step" : undefined}>
            <span
              className={cn(
                "mono grid size-6 place-items-center rounded-full text-[11px] font-medium ring-1 ring-inset t-fast",
                done ? "bg-accent text-white ring-accent" : on ? "bg-ink text-white ring-ink" : "bg-surface text-muted ring-line-strong",
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={cn("font-medium", on ? "text-ink" : "text-muted")}>{s}</span>
            {i < steps.length - 1 && <span aria-hidden className={cn("mx-1 h-px w-8 sm:w-12", done ? "bg-accent" : "bg-line-strong")} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Thin determinate bar. Used for batch progress and per-requisition scored share. */
export function Progress({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-surface-3", className)} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-bright transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Wordmark({ size = 24, light = false, markOnly = false }: { size?: number; light?: boolean; markOnly?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-[-0.04em]", light ? "text-white" : "text-ink")} style={{ fontSize: size }}>
      <span aria-hidden className="grid place-items-center rounded-[28%] bg-night text-accent-bright" style={{ width: size * 1.08, height: size * 1.08 }}>
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h8M2 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      {markOnly ? <span className="sr-only">Shortlist</span> : "Shortlist"}
    </span>
  );
}
