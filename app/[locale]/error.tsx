"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="flex min-h-[70vh] items-center justify-center px-6 pt-28 text-center">
      <div>
        <p className="display text-3xl">{t("error")}</p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-muted" dir="ltr">
            {error.digest}
          </p>
        ) : null}
        <Button className="mt-8" onClick={reset}>
          ↻
        </Button>
      </div>
    </section>
  );
}
