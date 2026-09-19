import type { Metadata } from "next";
import { getAllSettings } from "@/lib/db";
import "./globals.css";

const DEFAULT_NAME = "Aljezur - Monte Clérigo T2";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getAllSettings();
    const name = settings.site_name || DEFAULT_NAME;
    return {
      title: name,
      description: "Alojamento local em Aljezur, perto da Costa Vicentina",
      icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
    };
  } catch {
    // Se a base de dados estiver momentaneamente inacessível, o site continua a
    // funcionar com o título por omissão em vez de rebentar por completo.
    return {
      title: DEFAULT_NAME,
      description: "Alojamento local em Aljezur, perto da Costa Vicentina",
    };
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
