# Go-live checklist

## Switches
- [ ] `ENABLE_TEST_ACCOUNT=false` — **this one switch removes test login everywhere**: the buttons, the Credentials
      provider, the TEST MODE ribbon and the payment simulator. Existing test-account sessions stop working on their
      next request, and memberships created by the simulator stop granting access.
- [ ] `ALLOW_TEST_ACCOUNT_IN_PROD=false`
- [ ] `LEMONSQUEEZY_TEST_MODE=false` (the default in production), live API key, live store, **live** variant IDs,
      live webhook + new secret. Once live, test-mode webhooks are ignored and test-card memberships grant nothing.
- [ ] Decide `SUPPLEMENT_PAYMENT_MODE` (keep `manual` unless a card gateway has approved physical goods). For
      `lemonsqueezy`, set `LS_STORE_CURRENCY` and `LS_JOD_EXCHANGE_RATE` — orders are refused until the rate is set.
- [ ] `NEXT_PUBLIC_SITE_URL` and `AUTH_URL` = production domain; fresh `AUTH_SECRET`

## Confirm with the owner (see OWNER-TODO.md)
- [ ] Written confirmation from Lemon Squeezy support that this store and these products are allowed
- [ ] Real plan names, benefits and prices (`/admin/plans`) — and identical prices in Lemon Squeezy
- [ ] Opening hours (the old site had two versions)
- [ ] Street address and the exact WhatsApp consultation message
- [ ] Real products replace the demo products (or delete/deactivate demos); JFDA registration numbers where applicable
- [ ] Legal pages reviewed by a Jordanian lawyer; company name/registration filled in; "DRAFT" banner removed
      (`app/[locale]/legal/[doc]/page.tsx`)
- [ ] High-resolution photos added (`config/media.ts`, `config/site.ts` coaches) and a vector logo

## Data
- [ ] Commit `prisma/migrations/` (created by your first `npx prisma migrate dev`), then `npx prisma migrate deploy`
      on production; seed plans only (or edit seed to skip demo members/products)
- [ ] Delete seeded test and demo users (`isTestAccount` / `isDemo`) from production
- [ ] Promote the real owner account to ADMIN (sign in with Google once, then change the role in the DB or via
      another admin in `/admin/members`)

## Verify
- [ ] Google sign-in works on the production domain (redirect URI registered)
- [ ] Live purchase with a real card (then refund) → webhook processed in `/admin/webhooks`
- [ ] `/admin/checkin` with a real member card
- [ ] Lighthouse mobile on `/ar` and `/en` (target ≥ 90 performance, LCP < 2.5 s, CLS < 0.05)
- [ ] Security headers present (`curl -I`), CSP has no violations in the console
- [ ] Backups enabled on the database
