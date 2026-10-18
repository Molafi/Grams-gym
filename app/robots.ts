import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/ar/admin", "/en/admin", "/ar/account", "/en/account", "/ar/checkout", "/en/checkout", "/ar/cart", "/en/cart"] }],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
