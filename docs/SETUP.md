# Setup

## 1. Local (testing mode: no Docker, no Lemon Squeezy needed)

Two terminals, both in the project folder:

```bash
# Terminal 1: the database. Keep it open while you work.
npm run db:local              # local Postgres (Prisma), prints its DATABASE_URL

# Terminal 2
cp .env.example .env          # its DATABASE_URL already matches `npm run db:local`
npm install                   # also runs `prisma generate`
npm run db:setup              # creates the tables + plans, test users, demo products/members
npm run dev                   # http://localhost:3000, redirects to /ar
```

Prefer Docker? `npm run db:up` starts Postgres from docker-compose.yml; set `DATABASE_URL` to the Docker address
noted in `.env.example`.

Then:
- `/ar/signin` → **Continue as test member** or **Continue as test admin** (TEST MODE ribbon is visible).
- As the member: `/packages` → Join → the **payment simulator** (stands in for Lemon Squeezy) → Pay →
  `/account/membership` confirms via the webhook pipeline → member card with QR.
- As the admin: `/admin` dashboard (KPIs + "Ending soon" with days left), `/admin/subscriptions`
  (filter "ending within 7 days", add/extend front-desk memberships, CSV), `/admin/checkin` (paste the member code
  from the card's back, or scan with the camera on Chrome/Android).
- Shop: `/shop` → product → Add to cart → `/cart` → Checkout (pickup or Amman delivery, pay at gym / cash on delivery).

> `next start` and Vercel run with `NODE_ENV=production`, which **hard-blocks** test accounts unless
> `ALLOW_TEST_ACCOUNT_IN_PROD=true` is also set. Use that only for a private preview.

Quality checks: `npm run lint && npm run typecheck && npm test && npm run build` (or `npm run ci`).
E2E: `npx playwright install chromium && npm run test:e2e` (needs the DB seeded and no LS keys in `.env`).

## 2. Member sign-in (membership number + password)
There is no Google sign-in. Everyone signs in at `/signin` with a **membership number** (shown as `GG-00042`)
and a password.
- **New members online:** "Create account" on the sign-in page (name, phone, optional email, password). The
  membership number is shown right away on their account page.
- **New members at the desk:** `/admin/subscriptions` → Add membership → **New member**. Staff get the membership
  number and a **temporary password** to hand over; the member is asked to choose their own after signing in.
- **Forgotten password:** `/admin/members` → **Reset password** gives a new temporary password.
- **First admin:** `npm run admin:create -- "Owner Name" 0791234567` prints a membership number and temporary
  password. Run it once against the production database (`DATABASE_URL`). Further staff/admins: change their role in
  `/admin/members`.

### Demo accounts
| Account | Membership number | Password | Can |
|---|---|---|---|
| Test member | `GG-99001` | `TEST_MEMBER_PASSWORD` | everything a member can (test mode only) |
| Guest admin | `GG-99002` | `GUEST_ADMIN_PASSWORD` (local default `guest-preview`) | **view** every admin page; saves, uploads, exports and check-ins are blocked |

Both are created by `npm run db:seed` (or on first one-click sign-in) and listed on `/signin` in test mode. The guest
admin works on a deployed site only with `ENABLE_GUEST_ADMIN=true` and is signed out as soon as that is turned off.

## 3. Lemon Squeezy (test mode)

> Read the approval risk in `docs/OWNER-TODO.md` first.

1. Create a store; keep the dashboard **Test mode** toggle ON.
2. **Products**: create one subscription product per tier (Starter, Pro, Elite) with three **variants** each:
   monthly, every 3 months, yearly. Copy each **variant ID** into `LS_VARIANT_<TIER>_<INTERVAL>`.
   (`/admin/plans` shows which variant IDs are still missing.)
3. **Settings → API**: create an API key → `LEMONSQUEEZY_API_KEY`. Store ID (Settings → Stores) → `LEMONSQUEEZY_STORE_ID`.
4. **Settings → Webhooks → +**: URL `https://YOUR-DOMAIN/api/webhooks/lemonsqueezy`, a long random signing secret
   → `LEMONSQUEEZY_WEBHOOK_SECRET`. Tick: `order_created`, `order_refunded`, `subscription_created`,
   `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`,
   `subscription_paused`, `subscription_unpaused`, `subscription_payment_success`, `subscription_payment_failed`,
   `subscription_payment_recovered`.
5. Keep `LEMONSQUEEZY_TEST_MODE=true`. Once all three LS variables are set, the simulator switches off automatically.
6. Test: Join a plan → hosted checkout → card **4242 4242 4242 4242**, any future expiry, any CVC → you return to
   `/account/membership?checkout=success`, which waits for the webhook. Check `/admin/webhooks` for the events.
   Use the LS dashboard to cancel / pause / fail a payment and watch the status change.

### Testing webhooks locally
Lemon Squeezy must reach your machine. Use a tunnel, e.g. `npx cloudflared tunnel --url http://localhost:3000`
(or `ngrok http 3000`), and register `https://<tunnel-host>/api/webhooks/lemonsqueezy` as a second webhook in test mode.
Set `NEXT_PUBLIC_SITE_URL`/`AUTH_URL` to the tunnel URL while testing so redirects come back through it.
Failed events are stored with the error and can be retried from `/admin/webhooks`.

### Currency
Prices on the site are stored in JOD minor units (3 decimals). **The currency actually charged at checkout is
determined by the payment provider's store configuration**, not by this app. Make sure the variant prices in Lemon
Squeezy match the plan prices shown on the site (edit them in `/admin/plans`).

## 4. Deploy (Vercel)
- Create a Postgres database (Neon or Supabase) → `DATABASE_URL` (use the pooled URL; add `?sslmode=require`).
- Set all env vars from `.env.example` in Vercel. Build command: `npm run build`. Then run
  `npx prisma migrate deploy && npm run db:seed` once against production.
- Webhook and Prisma routes run on the Node runtime (`export const runtime = "nodejs"`).
- Other hosts: any Node 20.9+ host works with `npm run build && npm start`; set `AUTH_TRUST_HOST=true` behind a proxy.
  The in-memory rate limiter is per instance — use Redis/Upstash for multi-instance deployments.

## 5. Optional
- Real product models: upload a Draco-compressed `.glb`, set the product's GLB URL in the admin, and copy the Draco
  decoder into `public/draco/` (see that folder's README).
- Email: set `RESEND_API_KEY` and `EMAIL_FROM` (verified domain) for order confirmations; otherwise they are logged.
- Posters: `npm run posters` captures PNG posters of the 3D scenes from a running server.
