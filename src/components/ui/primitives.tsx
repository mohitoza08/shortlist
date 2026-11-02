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
    "inline-flex items-center justify-center gap-2 rounded-[6px] font-medium t-fast select-none whitespace-nowrap disabled:cursor-not-allowed";
  const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-11 px-5 text-[15px]" };
  const variants = {
    primary: "bg-accent text-white hover:bg-accent-hover disabled:bg-line-strong disabled:text-muted",
    secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-2 disabled:text-muted disabled:bg-surface-2",
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
  "w-full rounded-[6px] border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-muted t-fast hover:border-ink/40 disabled:bg-surface-2 disabled:text-muted";

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
  return <div className={cn("rounded-[10px] border border-line bg-surface shadow-[var(--shadow-card)]", className)} {...p} />;
}

export function Badge({
  tone = "neutral",
  className,
  ...p
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "accent" | "warn" | "danger" | "success" }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    success: "bg-accent-soft text-success",
  };
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}
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
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-[13px] text-muted">{eyebrow}</div>}
        <h1 className="display text-[28px] leading-9 sm:text-[32px] sm:leading-10">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-line-strong px-6 py-14 text-center">
      <p className="display text-xl">{title}</p>
      {body && <p className="mt-1 max-w-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-4 rounded-[10px] border border-danger/30 bg-danger-soft px-4 py-3">
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
            value === t.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
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
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-surface shadow-[var(--shadow-hover)] md:w-[720px]"
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
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-md rounded-[10px] border border-line bg-surface p-6 shadow-[var(--shadow-hover)]">
        <h2 className="display mb-3 text-2xl">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/* ---------- Domain atoms ---------- */
export function AvatarInitials({ name, size = 36 }: { name: string; size?: number }) {
  const t = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="inline-grid shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent"
    >
      {t || "?"}
    </span>
  );
}

export function ScoreBar({ score, showNumber = true }: { score: number | null; showNumber?: boolean }) {
  if (score == null) return <span className="text-muted">—</span>;
  const tone = score >= 85 ? "bg-success" : score >= 65 ? "bg-accent" : score >= 40 ? "bg-warn" : "bg-line-strong";
  return (
    <div className="flex items-center gap-2.5" role="img" aria-label={`Score ${Math.round(score)} out of 100`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(2, Math.min(100, score))}%` }} />
      </div>
      {showNumber && <span className="w-8 text-sm font-semibold tabular-nums">{Math.round(score)}</span>}
    </div>
  );
}

export function ConfidenceDot({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted">—</span>;
  const band = value >= 0.8 ? "High" : value >= 0.6 ? "Medium" : "Low";
  const color = band === "High" ? "bg-success" : band === "Medium" ? "bg-warn" : "bg-danger";
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]" title={`Confidence ${value.toFixed(2)}`}>
      <span className={cn("size-2 rounded-full", color)} aria-hidden />
      {band}
    </span>
  );
}

export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <span className="display inline-flex items-baseline" style={{ fontSize: size }}>
      Shortlist
      <span aria-hidden className="ml-0.5 inline-block size-1.5 rounded-full bg-accent" />
    </span>
  );
}
