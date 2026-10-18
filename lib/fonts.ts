import { IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic, Space_Grotesk } from "next/font/google";

/**
 * Pairing:
 * - Space Grotesk — precise, engineered Latin grotesque (display + UI).
 * - Noto Kufi Arabic — geometric Kufi with heavy weights; its angular construction
 *   echoes the chamfered GG monogram. Used for Arabic headlines.
 * - IBM Plex Sans Arabic — calm, highly legible Arabic text face for body/billing/legal.
 */
export const fontLatin = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});

export const fontArDisplay = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-ar-display",
  display: "swap",
});

export const fontArBody = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ar-body",
  display: "swap",
});

export const fontVariables = `${fontLatin.variable} ${fontArDisplay.variable} ${fontArBody.variable}`;
