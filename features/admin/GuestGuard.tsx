"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/Toaster";

/**
 * Guest admin (view only): stops every save/upload form in the admin before it's sent and
 * explains why. Search and filter forms (method="get") still work. The server refuses the
 * changes anyway (assertRole); this just avoids an error page.
 */
export function GuestGuard({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const t = useTranslations("admin");
  if (!enabled) return <>{children}</>;
  return (
    <div
      onSubmitCapture={(e) => {
        const form = e.target as HTMLFormElement;
        // Only search/filter forms declare method="get"; save forms (server actions, uploads) don't.
        if (form.getAttribute("method")?.toLowerCase() === "get") return;
        e.preventDefault();
        e.stopPropagation();
        toast(t("guestBlocked"), "info");
      }}
    >
      {children}
    </div>
  );
}
