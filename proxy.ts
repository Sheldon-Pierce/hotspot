import { NextRequest, NextResponse } from "next/server";

// NOTE: In Next.js 16, Middleware is renamed "Proxy" (proxy.ts at the project
// root). This is an OPTIMISTIC auth gate only — it checks for the presence of
// a Better Auth session cookie to pre-filter requests. The authoritative check
// lives in the Data Access Layer (lib/dal.ts requireSession), which every
// protected page/route/action calls.

const protectedRoutes = ["/profile", "/friends", "/feed", "/leaderboard", "/onboarding"];
const authRoutes = ["/login", "/signup"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Better Auth session cookie is `better-auth.session_token`, with a
  // `__Secure-` prefix in secure contexts — match both.
  const hasSession = req.cookies
    .getAll()
    .some((c) => c.name.endsWith("better-auth.session_token"));

  if (protectedRoutes.some((r) => pathname.startsWith(r)) && !hasSession) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (authRoutes.some((r) => pathname.startsWith(r)) && hasSession) {
    return NextResponse.redirect(new URL("/profile", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\.(?:png|ico|svg|jpg|jpeg|webp|gif|woff2?|txt|xml|json)$).*)",
  ],
};
