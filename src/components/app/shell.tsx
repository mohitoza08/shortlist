import Link from "next/link";
import { signOut } from "@/lib/auth";
import { Wordmark, AvatarInitials } from "@/components/ui/primitives";
import { NavLinks } from "./nav-links";

export function Shell({ user, children }: { user: { name: string; email: string }; children: React.ReactNode }) {
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[72px_1fr] lg:grid-cols-[232px_1fr]">
      <aside className="hidden border-r border-line bg-paper md:flex md:flex-col md:justify-between md:px-3 md:py-6 lg:px-4">
        <div>
          <Link href="/requisitions" className="mb-8 block px-2" aria-label="Shortlist home">
            <span className="hidden lg:block">
              <Wordmark size={26} />
            </span>
            <span className="lg:hidden"><Wordmark size={22} markOnly /></span>
          </Link>
          <NavLinks variant="side" />
        </div>
        <div className="space-y-3 px-1">
          <div className="hidden items-center gap-2.5 lg:flex">
            <AvatarInitials name={user.name} size={32} />
            <div className="min-w-0 text-[13px] leading-4">
              <p className="truncate font-medium">{user.name}</p>
              <p className="truncate text-muted">Meridian Talent</p>
            </div>
          </div>
          <form action={logout}>
            <button className="w-full rounded-md px-2 py-2 text-left text-[13px] text-muted t-fast hover:bg-surface-2 hover:text-ink">
              <span className="lg:hidden">Out</span>
              <span className="hidden lg:inline">Sign out</span>
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b border-line bg-paper px-4 py-3 md:hidden">
          <Wordmark size={22} />
          <form action={logout}>
            <button className="text-[13px] text-muted">Sign out</button>
          </form>
        </header>
        <main className="mx-auto max-w-[1320px] px-4 py-8 md:px-8 md:py-10">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper md:hidden" aria-label="Primary">
        <NavLinks variant="bottom" />
      </nav>
    </div>
  );
}
