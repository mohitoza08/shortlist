"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/requisitions", label: "Requisitions", icon: FileText, match: /^\/requisitions(\/new)?$/ },
  { href: "/review", label: "Review", icon: ListChecks, match: /^\/review/ },
];

export function NavLinks({ variant }: { variant: "side" | "bottom" }) {
  const path = usePathname();
  const active = (m: RegExp, href: string) => m.test(path) || (href === "/requisitions" && /^\/requisitions\/[^/]+/.test(path));
  if (variant === "bottom") {
    return (
      <ul className="grid grid-cols-2">
        {items.map(({ href, label, icon: Icon, match }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={active(match, href) ? "page" : undefined}
              className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]", active(match, href) ? "text-accent" : "text-muted")}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="space-y-1">
      {items.map(({ href, label, icon: Icon, match }) => (
        <li key={href}>
          <Link
            href={href}
            aria-current={active(match, href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm t-fast lg:px-3",
              active(match, href) ? "bg-surface font-medium text-ink shadow-[var(--shadow-card)] ring-1 ring-line" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden />
            <span className="hidden lg:inline">{label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
