import type { MetadataRoute } from "next";
import { getAllSettings } from "@/lib/db";

const DEFAULT_NAME = "Aljezur - Monte Clérigo";

/**
 * Torna o site instalável no telemóvel ("Adicionar ao ecrã principal"): passa a abrir
 * em ecrã inteiro, com ícone próprio e sem a barra de endereço do browser — ou seja,
 * comporta-se como uma app, sem App Store nem código separado.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = DEFAULT_NAME;
  let icone: string | null = null;

  try {
    const settings = await getAllSettings();
    name = settings.site_name || DEFAULT_NAME;
    icone = settings.favicon_url || settings.site_logo_url || null;
  } catch {
    // Base de dados indisponível: o manifesto continua a ser servido com os valores por omissão.
  }

  return {
    name,
    short_name: name.length > 12 ? name.slice(0, 12) : name,
    description: "Reservas e gestão do alojamento",
    start_url: "/backoffice/reservas",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111827",
    lang: "pt-PT",
    icons: icone
      ? [
          { src: icone, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: icone, sizes: "512x512", type: "image/png", purpose: "any" },
        ]
      : [],
  };
}
