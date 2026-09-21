/**
 * Endereço público do site, para os casos em que é preciso um URL absoluto:
 * pré-visualização ao partilhar o link (Open Graph), sitemap e robots.
 *
 * Ordem: o domínio próprio (NEXT_PUBLIC_SITE_URL), depois o domínio de produção da
 * Vercel, depois o endereço da pré-visualização, e por fim o local de desenvolvimento.
 * Assim funciona em qualquer ambiente sem ter o domínio escrito no código.
 */
export function getSiteUrl(): string {
  const explicito = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicito) return explicito.startsWith("http") ? explicito : `https://${explicito}`;

  const producao = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (producao) return `https://${producao}`;

  const preview = process.env.VERCEL_URL;
  if (preview) return `https://${preview}`;

  return "http://localhost:3000";
}
