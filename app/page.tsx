export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <section className="relative h-[60vh] bg-gray-900 flex items-end">
        <img
          src="https://a0.muscache.com/im/pictures/67298b26-029f-428d-8dfb-2044600ff3c5.jpg?im_w=1200"
          alt="Aljezur - Monte Clérigo"
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
        <div className="relative z-10 p-8 text-white">
          <p className="uppercase tracking-wide text-sm text-amber-300 mb-2">
            Aljezur · Monte Clérigo
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold mb-2">Casa T2 junto à Costa Vicentina</h1>
          <p className="text-white/80">6 hóspedes · 2 quartos · 5 camas · 2 casas de banho · ★ 4,72</p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-10">
        <div className="md:col-span-2 space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-3">Sobre o alojamento</h2>
            <p className="text-gray-600 leading-relaxed">
              A ligação perfeita entre a natureza, a praia e o campo. Mobília clara que dá ao
              apartamento uma aparência de verão — o espaço ideal para relaxar no Parque Nacional
              da Costa Vicentina, perto de Monte Clérigo.
            </p>
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

          <div className="text-sm text-gray-400 pt-4 border-t">
            Registo AL: 74669/AL
          </div>
        </div>

        <aside className="border rounded-xl p-6 h-fit shadow-sm sticky top-6">
          <p className="text-2xl font-semibold mb-1">
            €120 <span className="text-base font-normal text-gray-500">/ noite</span>
          </p>
          <p className="text-sm text-gray-500 mb-4">Taxa de limpeza incluída no total</p>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Check-in</label>
                <input type="date" className="w-full border rounded px-2 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Check-out</label>
                <input type="date" className="w-full border rounded px-2 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Hóspedes</label>
              <input type="number" min={1} max={6} defaultValue={2} className="w-full border rounded px-2 py-2 text-sm" />
            </div>
          </div>

          <a
            href="/reservar"
            className="mt-5 block text-center bg-gray-900 text-white rounded py-3 font-medium hover:bg-gray-800 transition"
          >
            Verificar disponibilidade
          </a>

          <p className="text-xs text-gray-400 text-center mt-3">MB WAY · Cartão de crédito</p>
        </aside>
      </section>
    </main>
  );
}
