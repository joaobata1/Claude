import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

/** As três páginas públicas do site. O backoffice fica de fora, de propósito. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/reservar`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/fotos`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
