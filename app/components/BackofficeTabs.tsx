"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/app/components/LogoutButton";

const TABS = [
  { href: "/backoffice/reservas", label: "Reservas" },
  { href: "/backoffice/nova-reserva", label: "Nova reserva" },
  { href: "/backoffice/calendario", label: "Calendário" },
  { href: "/backoffice/precos", label: "Preços" },
  { href: "/backoffice/limpeza", label: "Limpeza" },
  { href: "/backoffice", label: "Definições" },
];

export default function BackofficeTabs() {
  const pathname = usePathname();

  if (pathname === "/backoffice/login") return null;

  return (
    <header className="border-b bg-white sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-8 flex items-center justify-between">
        <nav className="flex items-center gap-1 -mb-px overflow-x-auto">
          {TABS.map((tab) => {
            const active = tab.href === "/backoffice" ? pathname === "/backoffice" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`whitespace-nowrap px-4 py-3 text-sm border-b-2 transition-colors ${
                  active
                    ? "border-gray-900 text-gray-900 font-medium"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <LogoutButton />
      </div>
    </header>
  );
}
