"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n";

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : undefined;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Para Client Components: lê o idioma da cookie no arranque e permite mudá-lo. */
export function useLocale(): [Locale, (locale: Locale) => void] {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    // A cookie só existe no browser — corrige o idioma logo após a primeira
    // renderização (que usa sempre DEFAULT_LOCALE, igual à do servidor, para
    // não causar um mismatch de hidratação).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(readCookieLocale());
  }, []);

  function setLocale(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`;
    setLocaleState(next);
  }

  return [locale, setLocale];
}
