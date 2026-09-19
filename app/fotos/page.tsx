import Link from "next/link";
import { getAllSettings } from "@/lib/db";
import { getServerLocale } from "@/lib/i18n-server";
import { getDictionary, interpolate } from "@/lib/i18n";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";

export const dynamic = "force-dynamic";

export default async function Fotos() {
  const [settings, locale] = await Promise.all([getAllSettings(), getServerLocale()]);
  const t = getDictionary(locale).fotos;
  let photos: string[] = [];
  try {
    const parsed = JSON.parse(settings.gallery_photo_urls || "[]");
    if (Array.isArray(parsed)) photos = parsed;
  } catch {
    photos = [];
  }

  return (
    <main className="min-h-screen bg-white text-gray-900 max-w-5xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
          {t.back}
        </Link>
        <LanguageSwitcher active={locale} />
      </div>
      <h1 className="text-3xl font-semibold mt-3 mb-8">{t.heading}</h1>

      {photos.length === 0 ? (
        <p className="text-gray-500">{t.empty}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url + i}
              src={url}
              alt={interpolate(t.alt, { number: i + 1 })}
              className="w-full h-56 object-cover rounded-lg"
            />
          ))}
        </div>
      )}
    </main>
  );
}
