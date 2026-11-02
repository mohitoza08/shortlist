import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Shell } from "@/components/app/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/portal");
  return <Shell user={{ name: session.user.name ?? "", email: session.user.email ?? "" }}>{children}</Shell>;
}
