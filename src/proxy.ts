import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/** Optimistic redirect only. Real authorisation happens in route handlers and pages. */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: req.nextUrl.protocol === "https:",
  });
  const isPublic = pathname === "/login" || pathname.startsWith("/api/auth");
  if (!token && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (token && pathname === "/login") {
    return NextResponse.redirect(new URL(token.role === "CLIENT" ? "/portal" : "/requisitions", req.url));
  }
  if (token?.role === "CLIENT" && (pathname.startsWith("/requisitions") || pathname === "/")) {
    return NextResponse.redirect(new URL("/portal", req.url));
  }
  if (token?.role === "RECRUITER" && pathname.startsWith("/portal")) {
    return NextResponse.redirect(new URL("/requisitions", req.url));
  }
  if (pathname === "/") return NextResponse.redirect(new URL("/requisitions", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
