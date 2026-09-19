import Link from "next/link";
import { getAllSettings } from "@/lib/db";
import BookingSearchWidget from "@/app/components/BookingSearchWidget";

// Lê definições (preço, fotos, descrição) diretamente da base de dados a cada pedido —
// sem isto, o Next.js pré-renderizava a página no build e ficava presa aos valores
// dessa altura, ignorando alterações feitas depois no backoffice.
export const dynamic = "force-dynamic";

const FALLBACK_COVER = "https://a0.muscache.com/im/pictures/67298b26-029f-428d-8dfb-2044600ff3c5.jpg?im_w=1200";
const DEFAULT_DESCRIPTION =
  "A ligação perfeita entre a natureza, a praia e o campo. Mobília clara que dá ao apartamento uma aparência " +
  "de verão — o espaço ideal para relaxar no Parque Nacional da Costa Vicentina, perto de Monte Clérigo.";
const DEFAULT_NAME = "Aljezur · Monte Clérigo";
const DEFAULT_AL_NUMBER = "74669/AL";

export default async function Home() {
  const settings = await getAllSettings();
  const coverPhoto = settings.cover_photo_url || FALLBACK_COVER;
  const description = settings.site_description || DEFAULT_DESCRIPTION;
  const about = settings.site_about || "";
  const siteName = settings.site_name || DEFAULT_NAME;
  const alNumber = settings.al_registration_number || DEFAULT_AL_NUMBER;
  const price = parseFloat(settings.price_per_night ?? "0") || 0;
  const cleaningFee = parseFloat(settings.cleaning_fee ?? "0") || 0;
  const hasGallery = (() => {
    try {
      return JSON.parse(settings.gallery_photo_urls || "[]").length > 0;
    } catch {
      return false;
    }
  })();

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <section className="relative h-[60vh] bg-gray-900 flex items-end">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverPhoto}
          alt="Aljezur - Monte Clérigo"
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="relative z-10 p-8 text-white">
          {settings.site_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.site_logo_url} alt={siteName} className="h-12 mb-3 object-contain" />
          )}
          <p className="uppercase tracking-wide text-sm text-amber-300 mb-2">{siteName}</p>
          <h1 className="text-4xl md:text-5xl font-semibold mb-2">Casa T2 junto à Costa Vicentina</h1>
          <p className="text-white/80">6 hóspedes · 2 quartos · 5 camas · 2 casas de banho · ★ 4,72</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-10">
        <div className="md:col-span-2 space-y-8">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-semibold">Sobre o alojamento</h2>
              {hasGallery && (
                <Link href="/fotos" className="text-sm text-gray-500 hover:text-gray-900 underline">
                  Ver fotos →
                </Link>
              )}
            </div>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{description}</p>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3">Comodidades</h3>
            <ul className="grid grid-cols-2 gap-2 text-gray-600 text-sm">
              <li>Cozinha equipada</li>
              <li>Wi-Fi</li>
              <li>Estacionamento gratuito</li>
              <li>HDTV 43&quot; com cabo</li>
              <li>Check-in autónomo</li>
              <li>Elevador</li>
            </ul>
          </div>

          {about && (
            <div>
              <h3 className="text-lg font-medium mb-3">Sobre nós</h3>
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{about}</p>
            </div>
          )}

          {alNumber && (
            <div className="text-sm text-gray-400 pt-4 border-t">
              Registo AL: {alNumber}
            </div>
          )}
        </div>

        <BookingSearchWidget price={price} cleaningFee={cleaningFee} />
      </section>
    </main>
  );
}
