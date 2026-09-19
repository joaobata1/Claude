"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

/**
 * Botões PT/EN/DE. Funciona tanto em páginas servidas pelo servidor (força um
 * refresh para o servidor voltar a ler a cookie) como em páginas 100% client
 * (o "onChange" atualiza o estado local imediatamente).
 */
export default function LanguageSwitcher({
  active,
  onChange,
  variant = "light",
}: {
  active: Locale;
  onChange?: (locale: Locale) => void;
  variant?: "light" | "dark";
}) {
  const router = useRouter();

  function select(locale: Locale) {
    // eslint-disable-next-line react-hooks/immutability -- document.cookie é um setter da API do browser, não mutação de estado
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000`;
    onChange?.(locale);
    router.refresh();
  }

  const base = "px-2 py-1 rounded text-xs font-medium transition-colors";
  const activeClass =
    variant === "dark" ? "bg-white text-gray-900" : "bg-gray-900 text-white";
  const inactiveClass =
    variant === "dark" ? "text-white/70 hover:text-white" : "text-gray-500 hover:text-gray-900";

  return (
    <div className="inline-flex items-center gap-1">
      {LOCALES.map((l) => (
        <button
          key={l.id}
          onClick={() => select(l.id)}
          className={`${base} ${l.id === active ? activeClass : inactiveClass}`}
          aria-current={l.id === active}
        >
          {l.flag} {l.label}
        </button>
      ))}
    </div>
  );
}
