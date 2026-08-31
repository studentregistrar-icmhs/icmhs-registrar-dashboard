/**
 * Fail-closed on purpose: if RESOLVE_PASSWORD isn't set in the environment,
 * every resolve request is rejected rather than silently allowed through
 * unauthenticated. Set it in .env.local for local dev and in your Vercel
 * project's Environment Variables for production.
 */
export function checkResolvePassword(password: unknown): boolean {
  const expected = process.env.RESOLVE_PASSWORD;
  if (!expected) return false;
  return typeof password === "string" && password === expected;
}
