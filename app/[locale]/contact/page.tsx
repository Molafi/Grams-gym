import { getTranslations, setRequestLocale } from "next-intl/server";
import { Clock, MapPin, MessageCircle, Phone } from "lucide-react";
import { FacebookIcon, InstagramIcon } from "@/components/ui/SocialIcons";
import { pageMetadata, type PageProps } from "@/lib/metadata";
import { site, whatsappLink } from "@/config/site";
import { Container, SectionHeading } from "@/components/ui/primitives";
import { ExternalButton } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return pageMetadata(locale, "contact", "/contact");
}

export default async function ContactPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "contact" });
  const th = await getTranslations({ locale, namespace: "hours" });

  return (
    <section className="atmosphere min-h-[80vh] pb-24 pt-40">
      <Container>
        <SectionHeading as="h1" eyebrow={t("eyebrow")} title={t("title")} className="mb-16" />
        <div className="grid gap-5 lg:grid-cols-3">
          <Reveal index={0} className="card p-8">
            <Phone className="h-5 w-5 text-ember" aria-hidden />
            <h2 className="mt-5 text-sm text-muted">{t("phone")}</h2>
            <a href={`tel:${site.phone.e164}`} className="display tabular mt-2 block text-3xl" dir="ltr">
              {site.phone.display}
            </a>
            <ExternalButton href={whatsappLink(locale)} className="mt-8" variant="glass">
              <MessageCircle className="h-4 w-4" aria-hidden /> {t("whatsapp")}
            </ExternalButton>
          </Reveal>

          <Reveal index={1} className="card p-8">
            <MapPin className="h-5 w-5 text-ember" aria-hidden />
            <h2 className="mt-5 text-sm text-muted">{t("address")}</h2>
            <address className="mt-2 text-xl not-italic">{locale === "en" ? site.address.en : site.address.ar}</address>
            <ExternalButton href={site.maps.url} className="mt-8" variant="glass">
              {t("directions")}
            </ExternalButton>
            <div className="mt-8 border-t border-hairline pt-6">
              <h2 className="text-sm text-muted">{t("social")}</h2>
              <div className="mt-3 flex gap-2">
                <a href={site.social.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm" dir="ltr">
                  <InstagramIcon /> {site.social.instagramHandle}
                </a>
                <a href={site.social.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm">
                  <FacebookIcon /> Facebook
                </a>
              </div>
            </div>
          </Reveal>

          <Reveal index={2} className="card p-8">
            <Clock className="h-5 w-5 text-ember" aria-hidden />
            <h2 className="mt-5 text-sm text-muted">{t("hours")}</h2>
            <dl className="mt-4 divide-y divide-hairline">
              {site.hours.map((h) => (
                <div key={h.key} className="flex items-center justify-between py-4">
                  <dt>{th(h.key)}</dt>
                  <dd className="tabular text-ember">{locale === "en" ? h.label.en : h.label.ar}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
