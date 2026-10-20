# Architecture (one page)

## Stack
Next.js 16 (App Router, Server Components by default) · React 19 · TypeScript strict · Tailwind CSS 4 ·
next-intl 4 (`/ar`, `/en`, Arabic default, RTL) · Auth.js v5 (membership number + password, build-phase test accounts, JWT sessions) ·
Prisma 6 + PostgreSQL · Lemon Squeezy (memberships) behind a `PaymentProvider` interface · three.js / R3F 9 / drei 10 ·
motion + Lenis · zod everywhere · Vitest + Playwright.

## Folders
```
app/[locale]/…            routes (server components); admin/ and account/ are role-gated layouts
app/api/…                 auth, Lemon Squeezy webhook, membership status poll, admin CSV export
components/ui|layout|home|shop|admin|motion|3d
features/auth|billing|shop|admin|account   server actions + feature components
lib/                      env (zod, fail-fast), db, auth, i18n, payments, money, membership, rate-limit, email, seo
config/                   site.ts (business facts), plans.ts (placeholder tiers), media.ts (photo registry)
content/legal.ts          bilingual legal drafts
messages/ar.json en.json  every UI string
prisma/                   schema + seed
tests/unit, tests/e2e
```

## Key flows
**Membership:** Join → (sign-in + return) → server action → `PaymentProvider.createCheckout` → hosted Lemon Squeezy
checkout → webhook `/api/webhooks/lemonsqueezy` (raw body, HMAC-SHA256 `X-Signature`, timing-safe compare) →
`WebhookEvent` (idempotent by sha256) → `Subscription` upsert. **Only the webhook grants access.** The return page
polls `/api/membership/status` until it lands. In test mode without LS keys, `/checkout/simulate` emits LS-shaped
events through the *same* ingestion pipeline.

**Front-desk memberships:** staff add/extend manual memberships in `/admin/subscriptions`; same `Subscription`
table (`provider = manual`, hard `endsAt`). The dashboard shows days left for everyone, colour-coded.

**Shop:** guest cart in localStorage → merged into DB cart on sign-in → checkout re-prices everything server-side,
reserves stock atomically (`updateMany … stock >= qty`), creates the order, then the order provider
(`manual` by default; `lemonsqueezy` optional) returns either "confirmed" or a redirect URL.

**Access rule** (`lib/membership.ts`, unit-tested): active/on_trial (manual → until `endsAt`); cancelled → until
`endsAt`; past_due → within `MEMBERSHIP_GRACE_DAYS`; paused/unpaid/expired → no.

## 3D
One fixed, transparent `<Canvas>` (`components/3d/SharedCanvas.tsx`) with drei `<View.Port/>`. Each page region is a
`<SceneSlot>`: it always renders an SVG poster (LCP, crawlers, reduced motion, no WebGL) and, after
`requestIdleCallback` + capability check, a drei `<View>` that is tunnelled into the shared canvas. The canvas is only
mounted when a slot exists, renders only while a slot is on screen (`frameloop` never/always), clamps DPR per tier and
lowers it via `PerformanceMonitor`. Scroll/pointer values flow through mutable stores read in `useFrame` (no re-renders).
Tiers: off / low / medium / high (`?quality=` overrides for testing).

## Security
Server-side authorization in every protected layout, action and route (`lib/auth/guards.ts`); JWT re-reads role from
the DB on each evaluation and kills test-account sessions when test mode is off; same-origin `callbackUrl` only;
CSP + HSTS + frame-ancestors none; zod on all inputs; rate limits on sign-in, checkout and webhook; audit log for every
admin mutation and export; CSV formula-injection guard; no secrets in client bundles (`server-only` on env/db).
