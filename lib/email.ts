import "server-only";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { site } from "@/config/site";

export type EmailMessage = { to: string; subject: string; html: string; text: string };

export interface EmailProvider {
  send(msg: EmailMessage): Promise<void>;
}

/** Resend over plain HTTPS (no SDK dependency). */
const resend: EmailProvider = {
  async send(msg) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM ?? "GRAMS GYM <no-reply@example.com>", ...msg }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  },
};

const consoleProvider: EmailProvider = {
  async send(msg) {
    console.info(`[email] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
  },
};

export const email: EmailProvider = env.RESEND_API_KEY ? resend : consoleProvider;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Bilingual, email-client-safe order confirmation (tables + inline styles). */
export function orderConfirmationEmail(order: {
  number: string;
  customerName: string;
  totalMinor: number;
  currency: string;
  fulfillment: "pickup" | "delivery";
  items: { productNameAr: string; productNameEn: string; variantLabel: string; quantity: number; lineTotalMinor: number }[];
}, locale: string): Omit<EmailMessage, "to"> {
  const ar = locale !== "en";
  const total = formatMoney(order.totalMinor, order.currency, locale);
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #222">${esc(ar ? i.productNameAr : i.productNameEn)}<br><span style="color:#9aa0aa;font-size:12px">${esc(i.variantLabel)} × ${i.quantity}</span></td><td style="padding:8px 0;border-bottom:1px solid #222;text-align:${ar ? "left" : "right"}">${formatMoney(i.lineTotalMinor, order.currency, locale)}</td></tr>`,
    )
    .join("");
  const subject = ar ? `تأكيد الطلب ${order.number} — جرامز جيم` : `Order ${order.number} confirmed — GRAMS GYM`;
  const intro = ar
    ? `مرحباً ${esc(order.customerName)}، تم استلام طلبك ${order.fulfillment === "pickup" ? "وسيكون جاهزاً للاستلام من النادي قريباً" : "وسيتم توصيله داخل عمّان"}.`
    : `Hi ${esc(order.customerName)}, we've received your order. ${order.fulfillment === "pickup" ? "We'll let you know when it's ready to pick up at the gym." : "It will be delivered within Amman."}`;
  const html = `<!doctype html><html dir="${ar ? "rtl" : "ltr"}" lang="${ar ? "ar" : "en"}"><body style="margin:0;background:#07080a;color:#f4f2ee;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0e1014;border:1px solid #1d2027;border-radius:20px;padding:28px">
<tr><td style="font-size:20px;font-weight:bold;letter-spacing:.04em">GRAMS <span style="color:#ff7d09">GYM</span></td></tr>
<tr><td style="padding-top:18px;font-size:15px;line-height:1.7">${intro}</td></tr>
<tr><td style="padding-top:18px"><table role="presentation" width="100%" style="font-size:14px">${rows}
<tr><td style="padding-top:12px;font-weight:bold">${ar ? "الإجمالي" : "Total"}</td><td style="padding-top:12px;font-weight:bold;text-align:${ar ? "left" : "right"};color:#ff7d09">${total}</td></tr></table></td></tr>
<tr><td style="padding-top:22px;color:#9aa0aa;font-size:12px">${site.phone.display} · ${site.social.instagramHandle}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${subject}\n\n${intro}\n\n${order.items.map((i) => `- ${ar ? i.productNameAr : i.productNameEn} (${i.variantLabel}) × ${i.quantity}`).join("\n")}\n\n${ar ? "الإجمالي" : "Total"}: ${total}`;
  return { subject, html, text };
}
