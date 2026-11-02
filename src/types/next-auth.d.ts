import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "RECRUITER" | "CLIENT";
      clientId: string | null;
      name?: string | null;
      email?: string | null;
    };
  }
}
