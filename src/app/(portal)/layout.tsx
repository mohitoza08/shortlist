import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { Wordmark } from "@/components/ui/primitives";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "CLIENT" || !session.user.clientId) redirect("/requisitions");
  const client = await db.client.findUnique({ where: { id: session.user.clientId } });
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }
  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-none">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/portal" className="min-w-0">
            <span className="display block truncate text-xl leading-6">{client?.name}</span>
          </Link>
          <div className="flex items-center gap-4 text-[13px] text-muted">
            <span className="hidden sm:inline">Shortlists by <Wordmark size={15} /> · Meridian Talent</span>
            <form action={logout}><button className="min-h-11 px-1 hover:text-ink">Sign out</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 pb-28 text-base leading-6">{children}</main>
    </div>
  );
}
