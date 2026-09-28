import type { Metadata, Viewport } from "next";
import { getAllSettings } from "@/lib/db";
import { getServerLocale } from "@/lib/i18n-server";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const DEFAULT_NAME = "Aljezur - Monte Clérigo T2";
const DEFAULT_DESCRIPTION = "Alojamento local em Aljezur, perto da Costa Vicentina";

/** O Google e as pré-visualizações cortam descrições longas — evita texto truncado a meio. */
function shorten(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : max)}…`;
}

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl();

  try {
    const locale = await getServerLocale();
    const settings = await getAllSettings();
    const name = settings.site_name || DEFAULT_NAME;

    // A descrição mostrada no Google e nas partilhas é a que está no backoffice,
    // no idioma do visitante — não um texto fixo no código.
    const description = shorten(
      settings[`site_description_${locale}`] ||
        settings.site_description_pt ||
        settings.site_description ||
        DEFAULT_DESCRIPTION
    );

    const cover = settings.cover_photo_url;
    // Sem favicon próprio carregado, usa-se o logótipo: é a mesma marca e evita
    // que o browser e o ecrã principal do telemóvel fiquem com o ícone genérico.
    const iconUrl = settings.favicon_url || settings.site_logo_url;

    return {
      metadataBase: new URL(siteUrl),
      title: name,
      description,
      // "apple" é o que o iPhone usa como ícone quando se adiciona ao ecrã principal.
      icons: iconUrl ? { icon: iconUrl, apple: iconUrl } : undefined,
      appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
      alternates: { canonical: "/" },
      openGraph: {
        title: name,
        description,
        siteName: name,
        url: siteUrl,
        type: "website",
        locale: { pt: "pt_PT", en: "en_GB", de: "de_DE" }[locale] ?? "pt_PT",
        images: cover ? [{ url: cover }] : undefined,
      },
      twitter: {
        card: cover ? "summary_large_image" : "summary",
        title: name,
        description,
        images: cover ? [cover] : undefined,
      },
    };
  } catch {
    // Se a base de dados estiver momentaneamente inacessível, o site continua a
    // funcionar com o título por omissão em vez de rebentar por completo.
    return {
      metadataBase: new URL(siteUrl),
      title: DEFAULT_NAME,
      description: DEFAULT_DESCRIPTION,
    };
  }
}

export const viewport: Viewport = {
  themeColor: "#111827",
  // Instalada no ecrã principal, a app ocupa o ecrã todo, incluindo por baixo do
  // entalhe e do indicador de início — daí as margens de segurança na navegação.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
