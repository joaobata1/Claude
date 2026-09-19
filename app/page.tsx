import Link from "next/link";
import { getAllSettings } from "@/lib/db";
import { getServerLocale } from "@/lib/i18n-server";
import { getDictionary } from "@/lib/i18n";
import BookingSearchWidget from "@/app/components/BookingSearchWidget";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";

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

const AMENITY_ICONS: { key: keyof ReturnType<typeof getDictionary>["home"]; icon: string }[] = [
  { key: "amenityKitchen", icon: "🍳" },
  { key: "amenityWifi", icon: "📶" },
  { key: "amenityParking", icon: "🚗" },
  { key: "amenityTv", icon: "📺" },
  { key: "amenitySelfCheckin", icon: "🔑" },
  { key: "amenityElevator", icon: "🛗" },
];

export default async function Home() {
  const [settings, locale] = await Promise.all([getAllSettings(), getServerLocale()]);
  const dict = getDictionary(locale);

  const coverPhoto = settings.cover_photo_url || FALLBACK_COVER;
  const description =
    settings[`site_description_${locale}`] || settings.site_description_pt || settings.site_description || DEFAULT_DESCRIPTION;
  const about = settings[`site_about_${locale}`] || settings.site_about_pt || settings.site_about || "";
  const siteName = settings.site_name || DEFAULT_NAME;
  const alNumber = settings.al_registration_number || DEFAULT_AL_NUMBER;
  const price = parseFloat(settings.price_per_night ?? "0") || 0;
  const cleaningFee = parseFloat(settings.cleaning_fee ?? "0") || 0;
  const galleryPhotos = (() => {
    try {
      const parsed = JSON.parse(settings.gallery_photo_urls || "[]");
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  })();

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            {settings.site_logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.site_logo_url} alt={siteName} className="h-14 object-contain" />
            ) : (
              <span>{siteName}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher active={locale} />
            <a
              href="#reservar"
              className="hidden sm:inline-block bg-gray-900 text-white text-sm px-4 py-2 rounded-full hover:bg-gray-800 transition"
            >
              {dict.home.ctaBook}
            </a>
          </div>
        </div>
      </header>

      <section className="relative h-[65vh] bg-gray-900 flex items-end overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverPhoto}
          alt={siteName}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="relative z-10 p-8 md:p-12 text-white max-w-3xl">
          <p className="inline-block uppercase tracking-widest text-xs font-medium text-amber-300 mb-3 border border-amber-300/40 rounded-full px-3 py-1">
            {siteName}
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold mb-3 leading-tight">{dict.home.tagline}</h1>
          <p className="text-white/85 text-lg">{dict.home.stats}</p>
          <a
            href="#reservar"
            className="mt-6 inline-block bg-white text-gray-900 text-sm font-medium px-6 py-3 rounded-full hover:bg-amber-300 transition"
          >
            {dict.home.ctaBook}
          </a>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-14 grid md:grid-cols-3 gap-10">
        <div className="md:col-span-2 space-y-10">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-2xl font-semibold">{dict.home.about}</h2>
              {galleryPhotos.length > 0 && (
                <Link href="/fotos" className="text-sm text-gray-500 hover:text-gray-900 underline">
                  {dict.home.seePhotos}
                </Link>
              )}
            </div>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{description}</p>
          </div>

          {galleryPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {galleryPhotos.slice(0, 3).map((url, i) => (
                <Link key={url + i} href="/fotos" className="block aspect-square overflow-hidden rounded-lg group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </Link>
              ))}
            </div>
          )}

          <div>
            <h3 className="text-lg font-medium mb-4">{dict.home.amenities}</h3>
            <ul className="grid grid-cols-2 gap-3">
              {AMENITY_ICONS.map(({ key, icon }) => (
                <li
                  key={key}
                  className="flex items-center gap-3 border rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-gray-50/60"
                >
                  <span className="text-xl" aria-hidden>
                    {icon}
                  </span>
                  {dict.home[key]}
                </li>
              ))}
            </ul>
          </div>

          {about && (
            <div>
              <h3 className="text-lg font-medium mb-3">{dict.home.aboutUs}</h3>
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{about}</p>
            </div>
          )}

          {(settings.contact_phone || settings.contact_email || settings.contact_address) && (
            <div>
              <h3 className="text-lg font-medium mb-3">{dict.home.contact}</h3>
              <ul className="text-gray-600 text-sm space-y-1.5">
                {settings.contact_phone && (
                  <li>
                    {dict.home.contactPhone}:{" "}
                    <a href={`tel:${settings.contact_phone.replace(/\s/g, "")}`} className="hover:text-gray-900 underline">
                      {settings.contact_phone}
                    </a>
                  </li>
                )}
                {settings.contact_email && (
                  <li>
                    {dict.home.contactEmail}:{" "}
                    <a href={`mailto:${settings.contact_email}`} className="hover:text-gray-900 underline">
                      {settings.contact_email}
                    </a>
                  </li>
                )}
                {settings.contact_address && <li>{settings.contact_address}</li>}
              </ul>
            </div>
          )}
        </div>

        <div id="reservar" className="scroll-mt-24">
          <BookingSearchWidget price={price} cleaningFee={cleaningFee} locale={locale} />
        </div>
      </section>

      <footer className="border-t bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
          <p>
            {dict.home.alRegistration}: {alNumber} · © {new Date().getFullYear()} {siteName} · {dict.home.footerRights}
          </p>
          <LanguageSwitcher active={locale} />
        </div>
      </footer>
    </main>
  );
}
