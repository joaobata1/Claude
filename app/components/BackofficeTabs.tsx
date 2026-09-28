"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoutButton from "@/app/components/LogoutButton";

interface Item {
  href: string;
  label: string;
  short: string;
  icon: React.ReactNode;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden {...stroke}>
      {children}
    </svg>
  );
}

const RESERVAS: Item = {
  href: "/backoffice/reservas",
  label: "Reservas",
  short: "Reservas",
  icon: (
    <Icon>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M7.5 9.5h9M7.5 13h9M7.5 16.5h5" />
    </Icon>
  ),
};

const CALENDARIO: Item = {
  href: "/backoffice/calendario",
  label: "Calendário",
  short: "Calendário",
  icon: (
    <Icon>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </Icon>
  ),
};

const NOVA: Item = {
  href: "/backoffice/nova-reserva",
  label: "Nova reserva",
  short: "Nova",
  icon: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </Icon>
  ),
};

const PRECOS: Item = {
  href: "/backoffice/precos",
  label: "Preços",
  short: "Preços",
  icon: (
    <Icon>
      <path d="M15.5 8.5A4.5 4.5 0 0 0 8 11.8M8 11.8A4.5 4.5 0 0 0 15.5 15" />
      <path d="M6 10.5h6M6 13.5h6" />
      <circle cx="12" cy="12" r="9" />
    </Icon>
  ),
};

const LIMPEZA: Item = {
  href: "/backoffice/limpeza",
  label: "Limpeza",
  short: "Limpeza",
  icon: (
    <Icon>
      <path d="M12 3.5v8M8.5 11.5h7l1 9h-9z" />
      <path d="M9.5 15.5h5" />
    </Icon>
  ),
};

const DEFINICOES: Item = {
  href: "/backoffice",
  label: "Definições",
  short: "Definições",
  icon: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.5 1.5M7.5 16.5 6 18M18 18l-1.5-1.5M7.5 7.5 6 6" />
    </Icon>
  ),
};

const DIAGNOSTICO: Item = {
  href: "/backoffice/diagnostico",
  label: "Diagnóstico",
  short: "Diagnóstico",
  icon: (
    <Icon>
      <path d="M3.5 12h4l2.5-6 4 12 2.5-6h4" />
    </Icon>
  ),
};

const TODOS = [RESERVAS, NOVA, CALENDARIO, PRECOS, LIMPEZA, DEFINICOES, DIAGNOSTICO];
/** No telemóvel só cabem quatro na barra de baixo — o resto vai para "Mais". */
const PRINCIPAIS = [RESERVAS, CALENDARIO, NOVA, PRECOS];
const NO_MAIS = [LIMPEZA, DEFINICOES, DIAGNOSTICO];

function isActive(pathname: string, href: string): boolean {
  return href === "/backoffice" ? pathname === "/backoffice" : pathname.startsWith(href);
}

export default function BackofficeTabs() {
  const pathname = usePathname();
  const [maisAberto, setMaisAberto] = useState(false);

  if (pathname === "/backoffice/login") return null;

  const maisAtivo = NO_MAIS.some((i) => isActive(pathname, i.href));

  return (
    <>
      {/* Computador: barra no topo, como antes */}
      <header className="hidden sm:block border-b bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-2 flex-wrap">
          <nav className="flex flex-wrap items-center gap-1 -mb-px">
            {TODOS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`whitespace-nowrap px-3 py-3 text-sm border-b-2 transition-colors ${
                  isActive(pathname, tab.href)
                    ? "border-gray-900 text-gray-900 font-medium"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
          <LogoutButton />
        </div>
      </header>

      {/* Telemóvel: barra de navegação em baixo, como numa app */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {PRINCIPAIS.map((item) => {
            const ativo = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMaisAberto(false)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${
                  ativo ? "text-gray-900 font-medium" : "text-gray-400"
                }`}
              >
                {item.icon}
                {item.short}
              </Link>
            );
          })}
          <button
            onClick={() => setMaisAberto((v) => !v)}
            aria-expanded={maisAberto}
            className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${
              maisAtivo || maisAberto ? "text-gray-900 font-medium" : "text-gray-400"
            }`}
          >
            <Icon>
              <circle cx="5.5" cy="12" r="1.2" />
              <circle cx="12" cy="12" r="1.2" />
              <circle cx="18.5" cy="12" r="1.2" />
            </Icon>
            Mais
          </button>
        </div>
      </nav>

      {maisAberto && (
        <div className="sm:hidden fixed inset-0 z-20" onClick={() => setMaisAberto(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-2 pb-6"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto my-2" />
            {NO_MAIS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMaisAberto(false)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] ${
                  isActive(pathname, item.href) ? "bg-gray-100 font-medium" : "hover:bg-gray-50"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <div className="px-4 py-3">
              <LogoutButton />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
