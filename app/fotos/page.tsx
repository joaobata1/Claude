import Link from "next/link";
import { getAllSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Fotos() {
  const settings = await getAllSettings();
  let photos: string[] = [];
  try {
    const parsed = JSON.parse(settings.gallery_photo_urls || "[]");
    if (Array.isArray(parsed)) photos = parsed;
  } catch {
    photos = [];
  }

  return (
    <main className="min-h-screen bg-white text-gray-900 max-w-5xl mx-auto px-6 py-12">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
        ← Voltar
      </Link>
      <h1 className="text-3xl font-semibold mt-3 mb-8">Fotos — Casa T2 junto à Costa Vicentina</h1>

      {photos.length === 0 ? (
        <p className="text-gray-500">Ainda não há fotos disponíveis.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url + i}
              src={url}
              alt={`Foto ${i + 1} do alojamento`}
              className="w-full h-56 object-cover rounded-lg"
            />
          ))}
        </div>
      )}
    </main>
  );
}
