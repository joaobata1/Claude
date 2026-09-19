import BackofficeTabs from "@/app/components/BackofficeTabs";
import HydrationMarker from "@/app/components/HydrationMarker";

/**
 * Guarda de arranque, em JavaScript simples dentro do HTML.
 *
 * As páginas do backoffice são pré-renderizadas com o "A carregar..." já no HTML. Se o
 * React não conseguir arrancar (ex: uma função que o browser do telemóvel não suporta),
 * nenhum código da aplicação chega a correr e esse spinner ficava no ecrã para sempre,
 * sem explicação nenhuma. Este script corre enquanto a página é lida, antes e
 * independentemente do React, por isso sobrevive a essa falha e avisa o utilizador.
 */
const HYDRATION_WATCHDOG = `
(function () {
  var SEGUNDOS = 12;
  setTimeout(function () {
    if (document.documentElement.getAttribute('data-hidratado') === '1') return;
    var aviso = document.createElement('div');
    aviso.setAttribute('role', 'alert');
    aviso.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#fef2f2;border-top:1px solid #fecaca;color:#991b1b;padding:14px 16px;font:14px/1.4 system-ui,sans-serif;text-align:center';
    aviso.innerHTML = 'Esta página não arrancou corretamente no seu browser. ' +
      '<button style="margin:8px 4px 0;padding:8px 14px;border:1px solid #991b1b;border-radius:6px;background:#fff;color:#991b1b;font:inherit" onclick="location.reload(true)">Recarregar</button>' +
      '<a href="/backoffice/diagnostico" style="display:inline-block;margin:8px 4px 0;padding:8px 14px;border:1px solid #991b1b;border-radius:6px;color:#991b1b;text-decoration:none">Diagnóstico</a>';
    document.body.appendChild(aviso);
  }, SEGUNDOS * 1000);
})();
`;

export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <script dangerouslySetInnerHTML={{ __html: HYDRATION_WATCHDOG }} />
      <HydrationMarker />
      <BackofficeTabs />
      {children}
    </div>
  );
}
