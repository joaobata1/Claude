"use client";

import { useEffect } from "react";

/**
 * Marca que o React arrancou. O guarda em app/backoffice/layout.tsx procura esta marca —
 * se ela não aparecer, é porque a aplicação não chegou a correr no browser.
 */
export default function HydrationMarker() {
  useEffect(() => {
    document.documentElement.setAttribute("data-hidratado", "1");
  }, []);

  return null;
}
