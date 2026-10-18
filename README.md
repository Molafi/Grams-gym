# GRAMS GYM — كل غرام بيفرق / Each Gram Matters

Premium bilingual (Arabic/English) gym platform for GRAMS GYM, Amman: cinematic 3D site, Google sign-in,
membership subscriptions (Lemon Squeezy, test mode), supplement store, member cards with QR check-in, and an
admin dashboard that shows every member's **days left**.

## Quick start (testing mode)
```bash
cp .env.example .env
npm install
npm run db:up && npx prisma migrate dev --name init && npm run db:seed
npm run dev   # → http://localhost:3000/ar
```
Sign in at `/ar/signin` with **Continue as test member** / **Continue as test admin**. No Google or Lemon Squeezy
account is needed: a payment simulator stands in for checkout until real keys are added.

## Scripts
| | |
|---|---|
| `npm run dev` | dev server |
| `npm run ci` | lint + typecheck + unit tests + build |
| `npm test` / `npm run test:e2e` | Vitest / Playwright |
| `npm run db:seed` | plans, test users, demo products, demo members |
| `npm run posters` | capture static posters of the 3D scenes |

## Docs
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — one-page architecture
- [docs/SETUP.md](docs/SETUP.md) — local setup, Google OAuth, Lemon Squeezy test mode, webhooks, deploy
- [docs/GO-LIVE-CHECKLIST.md](docs/GO-LIVE-CHECKLIST.md)
- [docs/OWNER-TODO.md](docs/OWNER-TODO.md) — every placeholder, missing asset, the hours conflict, the payment approval risk
- [docs/REPORT.md](docs/REPORT.md) — what's real, what's mocked, known limitations, verification status

Footer credit: SAY AI AGENCY.
