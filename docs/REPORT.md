# Build report

## ⚠️ Verification status
This build was written in a sandbox **without access to the npm registry**, so `npm install`, `lint`, `typecheck`,
`build` and Playwright could **not** be run here. What *was* verified:
- All 27 unit tests (webhook signature, membership state machine / days-left, money math) pass against the real
  source, executed with Node's TypeScript stripping and a minimal test shim.
- Strict `tsc` passes on the dependency-free modules (`lib/money`, `lib/membership`, `lib/gg-geometry`,
  `components/3d/label`, `config/plans`, `content/legal`).
- AR/EN message catalogs have identical keys (458 each).
- The GG monogram geometry was rasterised and checked.

**First thing to do:** `npm install && npm run ci` and fix whatever the real compilers report (most likely: minor
type mismatches against exact library versions). Dependency ranges are carets; `npm install` creates the lockfile —
commit it to pin versions.

## Real (fully implemented)
- Bilingual site (`/ar` default RTL, `/en`), all strings in message catalogs, hreflang, per-locale metadata, sitemap,
  robots, JSON-LD (SportsActivityLocation with hours/address, Product with offers).
- "Obsidian & Ember" design system, Space Grotesk + Noto Kufi Arabic + IBM Plex Sans Arabic, Arabic-specific
  typography rules, Lenis, masked reveals, magnetic CTA, ⌘K palette (pages + products), soft cursor, toasts, skeletons.
- 3D: single shared canvas + drei Views, lazy after idle, quality tiers, PerformanceMonitor DPR, pause off-screen,
  posters for reduced motion / no WebGL. Hero GG monogram (extruded, brushed silver, ember rim, orbiting calibration
  weights, pointer parallax, scroll exit, RTL mirror). Each-Gram-Matters pinned story (weight → kettlebell → plate →
  barbell, 1 g → 20,000 g counter, 8+/2000+ stats). Procedural supplement packs with CanvasTexture labels from
  product data, optional GLB override, full-screen draggable viewer, fly-to-cart.
- Auth.js: Google + test member/admin (env-gated, prod hard-block), JWT with role refresh, RBAC MEMBER/STAFF/ADMIN.
- Memberships: plan cards (tilt + flip + animated interval toggle), Lemon Squeezy hosted checkout, verified idempotent
  webhook for all 12 events, "confirming payment" polling, self-service cancel/resume, portal + update-card links,
  member card with QR, staff check-in (camera via BarcodeDetector or typed code).
- **Admin dashboard**: KPIs (active, ending in 7 days, past due, expired, MRR estimate, 30-day revenue, open orders,
  check-ins today), **"Ending soon" list with days left**, subscriptions table with colour-coded days-left bars,
  filters (status, ending within 3/7/14/30 days, search), add/extend front-desk memberships, members with roles,
  orders with status updates (auto-restock on cancel/refund), products CRUD with live AR/EN label preview and stock,
  plans editor with LS variant status, webhook log with retry, audit log, CSV exports.
- Shop: catalog with categories, search, sort, in-stock filter, variants (flavor/size, SKU, compare-at, stock), guest
  cart → DB merge on sign-in, server-side pricing and atomic stock reservation, pickup / Amman delivery, manual payment
  mode (default) and optional Lemon Squeezy mode, order confirmation page + bilingual email template (Resend or console).
- Legal pages (terms, privacy, refunds, delivery) — real bilingual drafts, marked DRAFT.
- Security headers + CSP, rate limiting, zod validation, audit log.

## Mocked / simulated
- **Payment simulator** (`/checkout/simulate`) replaces Lemon Squeezy while its keys are absent *and* test mode is on.
  It feeds LS-shaped events through the real webhook ingestion code, so the membership activates exactly as it will live.
- Demo products, demo members, placeholder plans and prices (all labelled).
- Photos: art-directed placeholders (originals not received).

## Known limitations / deviations
- **Post-processing (Bloom/Vignette/grain) is not used**: `EffectComposer` operates on the whole canvas and does not
  work with drei View scissoring. Glow comes from emissive/tone-mapped-off accents, the ember rim light and Sparkles;
  card grain is CSS. If you want bloom on the hero only, give the hero its own canvas.
- Membership cards are CSS-3D (tilt, flip, edge light), not WebGL — keeps text/prices accessible and fast.
- Rendering pause uses `frameloop` never/always driven by IntersectionObserver rather than `demand`.
- The monogram is a geometric rebuild (no vector logo received).
- Rate limiter is in-memory (per instance).
- No database migrations are committed (could not run Prisma here) — `prisma migrate dev --name init` creates them.
- OG images use the site metadata only; no generated localized OG image yet.
- Lighthouse / WCAG / cross-browser checks have not been run.
