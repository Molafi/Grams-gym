import { getTranslations } from "next-intl/server";
import { MapPin, Phone, Star } from "lucide-react";
import { FacebookIcon, InstagramIcon } from "@/components/ui/SocialIcons";
import { Link } from "@/lib/i18n/navigation";
import { site } from "@/config/site";
import { getBusiness } from "@/lib/business";
import { Container } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/Logo";
import { getMedia } from "@/lib/media";

export async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "footer" });
  const tn = await getTranslations({ locale, namespace: "nav" });
  const th = await getTranslations({ locale, namespace: "hours" });
  const tl = await getTranslations({ locale, namespace: "legal" });
  const year = new Date().getFullYear();
  const media = await getMedia();
  const biz = await getBusiness();

  return (
    <footer className="relative mt-32 border-t border-hairline bg-bg">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ember/50 to-transparent" />
      <Container className="grid gap-14 py-20 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <div className="flex items-center gap-3">
            <Logo src={media.logo.src} className="h-14 w-14" />
            <p className="font-[family-name:var(--font-latin)] text-xl font-semibold tracking-[0.12em]" dir="ltr">
              GRAMS <span className="text-ember">GYM</span>
            </p>
          </div>
          <p className="mt-6 max-w-sm text-sm text-muted">{t("about")}</p>
          <a
            href={site.maps.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm text-ink transition-colors hover:border-hairline-strong"
          >
            <Star className="h-4 w-4 fill-ember text-ember" aria-hidden />
            {t("reviews")}
          </a>
        </div>

        <nav aria-label={t("quickLinks")}>
          <h2 className="text-sm font-semibold">{t("quickLinks")}</h2>
          <ul className="mt-5 space-y-3 text-sm text-muted">
            {(["home", "about", "facilities", "packages", "shop", "contact"] as const).map((k) => (
              <li key={k}>
                <Link href={k === "home" ? "/" : `/${k}`} className="transition-colors hover:text-ink">
                  {tn(k)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t("legal")}>
          <h2 className="text-sm font-semibold">{t("legal")}</h2>
          <ul className="mt-5 space-y-3 text-sm text-muted">
            {(["terms", "privacy", "refunds", "shipping"] as const).map((k) => (
              <li key={k}>
                <Link href={`/legal/${k}`} className="transition-colors hover:text-ink">
                  {tl(k)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold">{th("title")}</h2>
          <dl className="mt-5 divide-y divide-hairline text-sm">
            {biz.hours.map((h) => (
              <div key={h.key} className="flex items-center justify-between gap-4 py-3">
                <dt className="text-muted">{th(h.key)}</dt>
                <dd className="tabular text-ember">{locale === "en" ? h.label.en : h.label.ar}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href={`tel:${biz.phone.e164}`} className="flex items-center gap-2 rounded-full border border-hairline px-3.5 py-2 text-sm" dir="ltr">
              <Phone className="h-4 w-4 text-ember" aria-hidden /> {biz.phone.display}
            </a>
            <a href={site.social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline">
              <InstagramIcon />
            </a>
            <a href={site.social.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline">
              <FacebookIcon />
            </a>
            <a href={site.maps.url} target="_blank" rel="noopener noreferrer" aria-label="Google Maps" className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline">
              <MapPin className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </Container>
      <div className="border-t border-hairline">
        <Container className="flex flex-col items-center justify-between gap-3 py-6 text-xs text-muted sm:flex-row">
          <p>
            © {year} GRAMS GYM. {t("rights")}
          </p>
          <p>
            {t("credit")} <span className="font-semibold tracking-[0.18em] text-ink" dir="ltr">{site.credit.label}</span>
          </p>
        </Container>
      </div>
    </footer>
  );
}
