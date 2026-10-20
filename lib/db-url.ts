/**
 * The connection string Prisma Client should use.
 *
 * `npm run db:local` (`prisma dev`, powered by PGlite) runs ONE database session and shares
 * it between all connections. Prisma names its prepared statements per connection (s0, s1…),
 * so concurrent queries collide: Postgres error 42P05 "prepared statement s0 already exists".
 * `pgbouncer=true` makes Prisma use unnamed statements, which can't collide. Only applied to
 * that local server; real databases are left untouched.
 *
 * No "server-only" import: the seed and scripts use this too.
 */
export function prismaUrl(raw: string | undefined = process.env.DATABASE_URL): string | undefined {
  if (!raw) return raw;
  const url = raw.trim().replace(/^["']|["']$/g, "");
  const localPrismaDev = /@(localhost|127\.0\.0\.1):512\d\d\//.test(url);
  if (!localPrismaDev || /[?&]pgbouncer=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}pgbouncer=true`;
}
