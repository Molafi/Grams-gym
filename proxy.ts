import createMiddleware from "next-intl/middleware";
import { routing } from "./lib/i18n/routing";

/**
 * Next.js 16 "proxy" (formerly middleware): locale negotiation + prefixing.
 * Authorization is NOT done here — every protected layout, server action and
 * route handler checks the session and role on the server (lib/auth/guards.ts).
 */
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
