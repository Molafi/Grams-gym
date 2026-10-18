/**
 * Seed: plans, test accounts, 12 DEMO products, and demo members with
 * memberships ending at different times (so the admin "days left" view has data).
 * Safe to re-run (upserts). Run: npm run db:seed
 */
import { PrismaClient, type ProductCategory, type ProductShape } from "@prisma/client";
import { PLAN_SEEDS } from "../config/plans";

const db = new PrismaClient();
const DAY = 86_400_000;

type DemoProduct = {
  slug: string;
  category: ProductCategory;
  brand: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  shape: ProductShape;
  labelColor: string;
  accentColor: string;
  featured?: boolean;
  variants: { sku: string; flavorAr?: string; flavorEn?: string; sizeLabel: string; priceMinor: number; compareAtMinor?: number; stock: number }[];
};

// Obviously fake brands, placeholder prices. No health claims.
const PRODUCTS: DemoProduct[] = [
  {
    slug: "demo-forge-whey",
    category: "protein",
    brand: "DEMO FORGE",
    nameAr: "واي بروتين فورج (تجريبي)",
    nameEn: "Forge Whey (Demo)",
    descriptionAr: "منتج تجريبي لعرض المتجر. مسحوق بروتين مصل الحليب بنكهات متعددة. المعلومات الغذائية النهائية تُضاف من قبل الإدارة.",
    descriptionEn: "Demo product for the store preview. Whey protein powder in several flavors. Final nutrition facts are added by the admin.",
    shape: "tub",
    labelColor: "#101318",
    accentColor: "#FF7D09",
    featured: true,
    variants: [
      { sku: "DF-WHEY-CHO-2LB", flavorAr: "شوكولاتة", flavorEn: "Chocolate", sizeLabel: "2 lb", priceMinor: 32000, compareAtMinor: 36000, stock: 14 },
      { sku: "DF-WHEY-VAN-2LB", flavorAr: "فانيلا", flavorEn: "Vanilla", sizeLabel: "2 lb", priceMinor: 32000, stock: 9 },
      { sku: "DF-WHEY-CHO-5LB", flavorAr: "شوكولاتة", flavorEn: "Chocolate", sizeLabel: "5 lb", priceMinor: 62000, stock: 5 },
    ],
  },
  {
    slug: "demo-ironclad-isolate",
    category: "protein",
    brand: "DEMO IRONCLAD",
    nameAr: "آيزوليت آيرون كلاد (تجريبي)",
    nameEn: "Ironclad Isolate (Demo)",
    descriptionAr: "منتج تجريبي. بروتين معزول بقوام خفيف. بيانات المنتج للعرض فقط.",
    descriptionEn: "Demo product. A light-textured isolate protein. Product data is for display only.",
    shape: "tub",
    labelColor: "#E8EAED",
    accentColor: "#0B2A4A",
    featured: true,
    variants: [
      { sku: "DI-ISO-STR-2LB", flavorAr: "فراولة", flavorEn: "Strawberry", sizeLabel: "2 lb", priceMinor: 42000, stock: 8 },
      { sku: "DI-ISO-CKS-2LB", flavorAr: "كوكيز", flavorEn: "Cookies & Cream", sizeLabel: "2 lb", priceMinor: 42000, stock: 0 },
    ],
  },
  {
    slug: "demo-gram-creatine",
    category: "creatine",
    brand: "DEMO GRAM LAB",
    nameAr: "كرياتين مونوهيدرات (تجريبي)",
    nameEn: "Creatine Monohydrate (Demo)",
    descriptionAr: "منتج تجريبي. كرياتين مونوهيدرات بدون نكهة.",
    descriptionEn: "Demo product. Unflavored creatine monohydrate.",
    shape: "tub",
    labelColor: "#0B2A4A",
    accentColor: "#E8EAED",
    featured: true,
    variants: [
      { sku: "DG-CRE-300", sizeLabel: "300 g", priceMinor: 18000, stock: 25 },
      { sku: "DG-CRE-500", sizeLabel: "500 g", priceMinor: 26000, stock: 12 },
    ],
  },
  {
    slug: "demo-ember-preworkout",
    category: "pre_workout",
    brand: "DEMO EMBER",
    nameAr: "بري وورك أوت إمبر (تجريبي)",
    nameEn: "Ember Pre-Workout (Demo)",
    descriptionAr: "منتج تجريبي. مشروب قبل التمرين. يحتوي على الكافيين — اقرأ الملصق واستشر طبيبك.",
    descriptionEn: "Demo product. Pre-workout drink mix. Contains caffeine — read the label and consult your doctor.",
    shape: "tub",
    labelColor: "#FF7D09",
    accentColor: "#07080A",
    variants: [
      { sku: "DE-PRE-MAN-30", flavorAr: "مانجا", flavorEn: "Mango", sizeLabel: "30 servings", priceMinor: 24000, stock: 10 },
      { sku: "DE-PRE-BLU-30", flavorAr: "توت أزرق", flavorEn: "Blue Raspberry", sizeLabel: "30 servings", priceMinor: 24000, stock: 6 },
    ],
  },
  {
    slug: "demo-steel-eaa",
    category: "amino_acids",
    brand: "DEMO STEEL",
    nameAr: "أحماض أمينية EAA (تجريبي)",
    nameEn: "EAA Aminos (Demo)",
    descriptionAr: "منتج تجريبي. خلطة أحماض أمينية أساسية.",
    descriptionEn: "Demo product. Essential amino acid blend.",
    shape: "tub",
    labelColor: "#14171D",
    accentColor: "#9BA1AB",
    variants: [{ sku: "DS-EAA-LEM-30", flavorAr: "ليمون", flavorEn: "Lemon", sizeLabel: "30 servings", priceMinor: 22000, stock: 11 }],
  },
  {
    slug: "demo-calibrate-multi",
    category: "vitamins",
    brand: "DEMO CALIBRATE",
    nameAr: "فيتامينات متعددة (تجريبي)",
    nameEn: "Daily Multi (Demo)",
    descriptionAr: "منتج تجريبي. مكمل فيتامينات يومي. لا يغني عن نظام غذائي متوازن.",
    descriptionEn: "Demo product. Daily vitamin supplement. Not a substitute for a balanced diet.",
    shape: "box",
    labelColor: "#F4F2EE",
    accentColor: "#FF7D09",
    variants: [{ sku: "DC-MULTI-60", sizeLabel: "60 tablets", priceMinor: 12000, stock: 30 }],
  },
  {
    slug: "demo-calibrate-omega",
    category: "vitamins",
    brand: "DEMO CALIBRATE",
    nameAr: "أوميغا 3 (تجريبي)",
    nameEn: "Omega-3 (Demo)",
    descriptionAr: "منتج تجريبي. كبسولات زيت السمك.",
    descriptionEn: "Demo product. Fish oil softgels.",
    shape: "box",
    labelColor: "#0B2A4A",
    accentColor: "#FF9B3D",
    variants: [{ sku: "DC-OMEGA-90", sizeLabel: "90 softgels", priceMinor: 14000, stock: 18 }],
  },
  {
    slug: "demo-titan-mass",
    category: "gainers",
    brand: "DEMO TITAN",
    nameAr: "ماس جينر تايتن (تجريبي)",
    nameEn: "Titan Mass Gainer (Demo)",
    descriptionAr: "منتج تجريبي. مسحوق عالي السعرات لزيادة الوزن.",
    descriptionEn: "Demo product. High-calorie powder for weight gain programs.",
    shape: "tub",
    labelColor: "#07080A",
    accentColor: "#FF9B3D",
    featured: true,
    variants: [
      { sku: "DT-MASS-CHO-6LB", flavorAr: "شوكولاتة", flavorEn: "Chocolate", sizeLabel: "6 lb", priceMinor: 45000, stock: 7 },
      { sku: "DT-MASS-BAN-6LB", flavorAr: "موز", flavorEn: "Banana", sizeLabel: "6 lb", priceMinor: 45000, stock: 3 },
    ],
  },
  {
    slug: "demo-gg-shaker",
    category: "accessories",
    brand: "GRAMS GYM",
    nameAr: "شيكر جرامز جيم (تجريبي)",
    nameEn: "GRAMS GYM Shaker (Demo)",
    descriptionAr: "منتج تجريبي. شيكر بشعار GG.",
    descriptionEn: "Demo product. Shaker bottle with the GG mark.",
    shape: "shaker",
    labelColor: "#07080A",
    accentColor: "#FF7D09",
    featured: true,
    variants: [
      { sku: "GG-SHAKER-BLK", flavorAr: "أسود", flavorEn: "Black", sizeLabel: "700 ml", priceMinor: 6000, stock: 40 },
      { sku: "GG-SHAKER-ORG", flavorAr: "برتقالي", flavorEn: "Orange", sizeLabel: "700 ml", priceMinor: 6000, stock: 22 },
    ],
  },
  {
    slug: "demo-gg-straps",
    category: "accessories",
    brand: "GRAMS GYM",
    nameAr: "أحزمة رفع (تجريبي)",
    nameEn: "Lifting Straps (Demo)",
    descriptionAr: "منتج تجريبي. زوج أحزمة رفع قطنية.",
    descriptionEn: "Demo product. A pair of cotton lifting straps.",
    shape: "box",
    labelColor: "#14171D",
    accentColor: "#FF7D09",
    variants: [{ sku: "GG-STRAPS", sizeLabel: "One size", priceMinor: 8000, stock: 15 }],
  },
  {
    slug: "demo-forge-bar-box",
    category: "protein",
    brand: "DEMO FORGE",
    nameAr: "ألواح بروتين — علبة (تجريبي)",
    nameEn: "Protein Bars — Box (Demo)",
    descriptionAr: "منتج تجريبي. علبة ألواح بروتين.",
    descriptionEn: "Demo product. A box of protein bars.",
    shape: "box",
    labelColor: "#FF9B3D",
    accentColor: "#07080A",
    variants: [{ sku: "DF-BAR-12", flavorAr: "كراميل", flavorEn: "Caramel", sizeLabel: "12 × 60 g", priceMinor: 20000, stock: 9 }],
  },
  {
    slug: "demo-steel-glutamine",
    category: "amino_acids",
    brand: "DEMO STEEL",
    nameAr: "جلوتامين (تجريبي)",
    nameEn: "Glutamine (Demo)",
    descriptionAr: "منتج تجريبي. مسحوق جلوتامين بدون نكهة.",
    descriptionEn: "Demo product. Unflavored glutamine powder.",
    shape: "tub",
    labelColor: "#9BA1AB",
    accentColor: "#0B2A4A",
    variants: [{ sku: "DS-GLU-300", sizeLabel: "300 g", priceMinor: 16000, stock: 13 }],
  },
];

async function seedPlans() {
  for (const p of PLAN_SEEDS) {
    await db.plan.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        taglineAr: p.taglineAr,
        taglineEn: p.taglineEn,
        featuresAr: p.featuresAr,
        featuresEn: p.featuresEn,
        priceMonthly: p.prices.monthly,
        priceQuarterly: p.prices.quarterly,
        priceYearly: p.prices.yearly,
        recommended: p.recommended,
        sortOrder: p.sortOrder,
        isPlaceholder: true,
      },
    });
  }
  await db.plan.upsert({
    where: { slug: "pt-pack-8" },
    update: {},
    create: {
      slug: "pt-pack-8",
      kind: "addon",
      nameAr: "باقة 8 جلسات تدريب شخصي",
      nameEn: "8 Personal-Training Sessions",
      taglineAr: "إضافة لمرة واحدة",
      taglineEn: "One-time add-on",
      featuresAr: ["8 جلسات مع مدرب", "صالحة لمدة شهرين"],
      featuresEn: ["8 sessions with a coach", "Valid for two months"],
      priceMonthly: 0,
      priceQuarterly: 0,
      priceYearly: 0,
      priceOnce: 120000,
      sortOrder: 10,
      isPlaceholder: true,
    },
  });
}

async function seedTestUsers() {
  const member = process.env.TEST_MEMBER_EMAIL;
  const admin = process.env.TEST_ADMIN_EMAIL;
  if (member) {
    await db.user.upsert({
      where: { email: member },
      update: { isTestAccount: true },
      create: { email: member, name: "Test Member", role: "MEMBER", isTestAccount: true },
    });
  }
  if (admin) {
    await db.user.upsert({
      where: { email: admin },
      update: { isTestAccount: true, role: "ADMIN" },
      create: { email: admin, name: "Test Admin", role: "ADMIN", isTestAccount: true },
    });
  }
  if (!member || !admin) console.warn("⚠ TEST_MEMBER_EMAIL / TEST_ADMIN_EMAIL not set — test users skipped.");
}

async function seedProducts() {
  for (const p of PRODUCTS) {
    const { variants, ...data } = p;
    const product = await db.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: { ...data, featured: p.featured ?? false, isDemo: true, images: [] },
    });
    for (const v of variants) {
      await db.productVariant.upsert({
        where: { sku: v.sku },
        update: {},
        create: { ...v, productId: product.id },
      });
    }
  }
}

/** Demo members with manual (pay-at-desk) memberships ending on different days. */
async function seedDemoMembers() {
  const plans = await db.plan.findMany({ where: { kind: "membership" } });
  const bySlug = Object.fromEntries(plans.map((p) => [p.slug, p]));
  const now = Date.now();
  const demo: { n: number; plan: string; endsInDays: number; status?: "active" | "cancelled" | "past_due" | "expired" }[] = [
    { n: 1, plan: "pro", endsInDays: 2 },
    { n: 2, plan: "starter", endsInDays: 5 },
    { n: 3, plan: "elite", endsInDays: 12 },
    { n: 4, plan: "pro", endsInDays: 27 },
    { n: 5, plan: "starter", endsInDays: 61 },
    { n: 6, plan: "elite", endsInDays: 180 },
    { n: 7, plan: "starter", endsInDays: -4, status: "expired" },
    { n: 8, plan: "pro", endsInDays: 9, status: "cancelled" },
  ];
  for (const d of demo) {
    const email = `demo.member${d.n}@example.com`;
    const user = await db.user.upsert({
      where: { email },
      update: {},
      create: { email, name: `Demo Member ${d.n}`, isDemo: true, phone: `0790000${String(d.n).padStart(3, "0")}` },
    });
    const existing = await db.subscription.findFirst({ where: { userId: user.id } });
    if (existing) continue;
    const plan = bySlug[d.plan];
    if (!plan) continue;
    const endsAt = new Date(now + d.endsInDays * DAY);
    await db.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        interval: "monthly",
        provider: "manual",
        status: d.status ?? "active",
        startsAt: new Date(endsAt.getTime() - 30 * DAY),
        endsAt,
        cancelled: d.status === "cancelled",
        notes: "Seeded demo membership",
      },
    });
  }
}

async function main() {
  await seedPlans();
  await seedTestUsers();
  await seedProducts();
  await seedDemoMembers();
  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
