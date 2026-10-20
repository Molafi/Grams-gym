# Owner to-do — everything that is a placeholder or needs a decision

## 🔴 Payments — approval risk (read first)
Lemon Squeezy's documentation says it typically does **not** approve stores selling services or goods fulfilled
outside Lemon Squeezy (it names physical goods as an example), and its prohibited-products list includes services of
any kind. A gym membership is an in-person service and supplements are physical goods, so store review may reject
this use case. Sources: [Activate your store](https://docs.lemonsqueezy.com/help/getting-started/activate-your-store),
[Prohibited products](https://docs.lemonsqueezy.com/help/getting-started/prohibited-products).
*(Content rephrased for compliance with licensing restrictions.)*

- [ ] **Before going live, confirm in writing with Lemon Squeezy support that this store and these products are allowed.**
- What was built so this is not a dead end:
  - All payment code sits behind `PaymentProvider` (`lib/payments/types.ts`). Swapping the gateway touches one file.
  - Supplements default to the **manual** provider (pay at the gym / cash on delivery) — no gateway needed.
  - `lib/payments/regional-gateway.stub.ts` documents exactly where a Jordanian card gateway plugs in.
  - Front-desk memberships work today without any gateway (`/admin/subscriptions` → Add / extend).

## Business facts to confirm (`config/site.ts`)
- [ ] **Opening hours — the old site had two versions.** Footer: Sat–Wed 7:00–11:00, Thu 7:00–9:00, Fri 6:00–9:00
      (no AM/PM). Contact page: Sat–Wed 7 AM–11 AM, Thu 7 PM–9 PM, Fri 6 PM–9 PM. As instructed, the site uses the
      **Contact-page version**. Note "7 AM – 11 AM" for Sat–Wed looks like it may be meant as 11 PM — please confirm.
- [ ] **Street address** (Arabic + English). The original text was not in the files received; currently "Amman, Jordan".
- [ ] **WhatsApp prefilled consultation message.** Original text not received; a placeholder is used.
- [ ] Company legal name / registration number for the legal pages.

## Plans & prices (`/admin/plans`, seeded from `config/plans.ts`)
- [ ] Real tier names (currently Starter / Pro / Elite), benefits, and monthly / quarterly / yearly prices
      (placeholders: 30/80/280, 45/120/420, 75/210/750 JOD). Saving a plan in the admin clears its "placeholder" flag.
- [ ] Personal-training add-on (placeholder "8 sessions — 120 JOD").
- [ ] Create matching products/variants in Lemon Squeezy and paste the 9 variant IDs into env.
- [ ] Delivery fee inside Amman (`DELIVERY_FEE_MINOR`, placeholder 2.000 JOD) and grace period (`MEMBERSHIP_GRACE_DAYS`, 3).

## Products
- [ ] Replace the 12 **demo** products (fake brands "DEMO FORGE", "DEMO TITAN"… and placeholder prices).
- [ ] Nutrition facts / ingredients per product, without medical or unverifiable claims.
- [ ] JFDA registration number per product where applicable (field "Registration no.").
- [ ] Optional: real 3D models (`.glb`, Draco-compressed) for hero products.

## Assets (received — replace any of them in `/admin/media`)
- [x] Logo (`public/images/logo.png`, 447 × 447, transparent) — used in the navbar, footer, sign-in, member card.
      The 3D hero monogram is still a geometric rebuild; a vector (SVG/AI/PDF) logo would let it match exactly.
- [x] Hero photo of the navy GG wall (1944 × 1296) — home page background.
- [ ] **Higher-resolution photos.** Coach portraits, gym interior, machines and cardio are only **206 × 206 px** and
      look soft at the sizes shown. Re-upload at ≥ 1200 px wide in `/admin/media`.
- [ ] **Machines photo is the same file as the gym-interior photo** — upload a real machines photo.
- [ ] Coach Ahmad's photo is a promotional graphic with text on it; a plain portrait would match the others better.

## Legal
- [ ] Lawyer review of Terms, Privacy, Refunds, Delivery (`content/legal.ts`), then remove the DRAFT banner.
- [ ] Privacy contact email; check-in log retention period.

## Copy
- [ ] Services and Facilities descriptions were re-written in the brand voice because the originals were not in the
      files received — replace with the old site's text if preferred (`messages/ar.json`, `messages/en.json`).
