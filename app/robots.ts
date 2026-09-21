import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

/**
 * O site público pode e deve ser indexado; o backoffice e as rotas de API, não.
 * (Isto não é segurança — é só para não aparecerem no Google. Quem protege o
 * backoffice é a sessão, ver proxy.ts.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/backoffice", "/backoffice/", "/api/"],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
