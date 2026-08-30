import { NextRequest, NextResponse } from "next/server";

/**
 * Password-gates the entire dashboard with HTTP Basic Auth, enforced at the
 * edge before any page or API route runs. This works on any Vercel plan
 * (Vercel's own "Password Protection" is a paid Pro-team feature; this
 * doesn't depend on that).
 *
 * Configure in Vercel: Project → Settings → Environment Variables
 *   DASHBOARD_PASSWORD   (required)
 *   DASHBOARD_USER        (optional, defaults to "registrar")
 *
 * Fails CLOSED: if DASHBOARD_PASSWORD isn't set, every request is rejected
 * with a 500 rather than silently left open. That's deliberate — a missing
 * env var should never mean "public dashboard."
 */
export function middleware(req: NextRequest) {
  const expectedUser = process.env.DASHBOARD_USER || "registrar";
  const expectedPass = process.env.DASHBOARD_PASSWORD;

  if (!expectedPass) {
    return new NextResponse(
      "This dashboard is not yet configured for access. Set DASHBOARD_PASSWORD " +
        "in the Vercel project's Environment Variables, then redeploy.",
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
    const sepIndex = decoded.indexOf(":");
    const suppliedUser = decoded.slice(0, sepIndex);
    const suppliedPass = decoded.slice(sepIndex + 1);
    if (suppliedUser === expectedUser && suppliedPass === expectedPass) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="ICMHS Registrar Dashboard", charset="UTF-8"',
    },
  });
}

// Protect every route (pages + API) except Next's own static asset files,
// which carry no student data and don't need to be gated.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
