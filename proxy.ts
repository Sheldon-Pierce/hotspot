import { NextRequest, NextResponse } from "next/server";

// NOTE: In Next.js 16, Middleware is renamed "Proxy" (proxy.ts at the project
// root). This is an OPTIMISTIC auth gate only — it checks for the presence of
// a Better Auth session cookie to pre-filter requests. The authoritative check
// lives in the Data Access Layer (lib/dal.ts requireSession), which every
// page/route/action that reads user data calls.

// The whole app sits behind auth: every page requires a session EXCEPT the
// auth screens. (The `api`, static-asset, and `_next` paths are excluded by
// the matcher below, so `/api/auth/*` and `/api/bars` stay reachable.)
const authRoutes = ["/login", "/signup"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Better Auth session cookie is `better-auth.session_token`, with a
  // `__Secure-` prefix in secure (https) contexts — match both.
  const hasSession = req.cookies
    .getAll()
    .some((c) => c.name.endsWith("better-auth.session_token"));
  const isAuthRoute = authRoutes.some((r) => pathname.startsWith(r));

  // Not logged in + not on an auth screen → send to login.
  if (!hasSession && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  // Logged in + on an auth screen → send into the app.
  if (hasSession && isAuthRoute) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\.(?:png|ico|svg|jpg|jpeg|webp|gif|woff2?|txt|xml|json)$).*)",
  ],
};
