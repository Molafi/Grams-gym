import { getBusiness, whatsappHref } from "@/lib/business";

/** Floating WhatsApp — restyled: dark glass pill with a green status dot, not a loud green blob. */
export async function WhatsAppButton({ locale, label }: { locale: string; label: string }) {
  const biz = await getBusiness();
  return (
    <a
      href={whatsappHref(locale, biz)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="glass group fixed bottom-5 end-5 z-40 flex h-14 items-center gap-3 rounded-full ps-4 pe-5 shadow-[0_20px_50px_-20px_rgba(0,0,0,.8)] transition-transform duration-500 hover:-translate-y-0.5"
    >
      <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/15">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-[#25D366]" aria-hidden>
          <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36A9.42 9.42 0 0 1 2.6 12.05C2.6 6.83 6.84 2.6 12.06 2.6a9.4 9.4 0 0 1 9.44 9.45c0 5.21-4.24 9.45-9.45 9.45m8.04-17.5A11.3 11.3 0 0 0 12.05.7C5.79.7.7 5.79.7 12.05c0 2 .52 3.95 1.52 5.67L.6 23.6l6.02-1.58a11.3 11.3 0 0 0 5.42 1.38h.01c6.26 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.32-8.03" />
        </svg>
        <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-[#25D366]" />
      </span>
      <span className="hidden text-sm font-medium sm:inline">{label}</span>
    </a>
  );
}
