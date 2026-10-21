/**
 * The connection string Prisma Client should use.
 *
 * `npm run db:local` (`prisma dev`, powered by PGlite) runs ONE database session and shares
 * it between all connections. Two things follow, and both are fixed here for that local
 * server only (real databases are left untouched):
 * - Prisma names its prepared statements per connection (s0, s1…), so statements from
 *   different connections collide: Postgres error 42P05 "prepared statement s0 already
 *   exists". `pgbouncer=true` makes Prisma use unnamed statements, which can't collide.
 * - Transactions on different connections would run inside the same session.
 *   `connection_limit=1` keeps the app's queries on one connection, one after another.
 *
 * No "server-only" import: the seed and scripts use this too.
 */
export function prismaUrl(raw: string | undefined = process.env.DATABASE_URL): string | undefined {
  if (!raw) return raw;
  const url = raw.trim().replace(/^["']|["']$/g, "");
  if (!/@(localhost|127\.0\.0\.1):512\d\d\//.test(url)) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
    u.searchParams.set("connection_limit", "1");
    return u.toString();
  } catch {
    return url;
  }
}
