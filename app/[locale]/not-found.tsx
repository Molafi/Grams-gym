import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { media } from "@/config/media";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <section className="atmosphere flex min-h-[80vh] items-center pt-28">
      <Container className="text-center">
        {/* not-found can render without request context, so it uses the default logo file. */}
        <Logo src={media.logo.src} className="mx-auto h-24 w-24 opacity-60" />
        <p className="display tabular mt-8 text-7xl text-ember" dir="ltr">
          404
        </p>
        <h1 className="display mt-4 text-3xl">{t("title")}</h1>
        <p className="mt-3 text-muted">{t("body")}</p>
        <ButtonLink href="/" className="mt-8">
          {t("home")}
        </ButtonLink>
      </Container>
    </section>
  );
}
