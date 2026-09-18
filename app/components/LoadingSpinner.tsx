/** Indicador de carregamento reutilizável — anel a rodar em vez de texto simples. */
export default function LoadingSpinner({ label = "A carregar..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <span className="relative inline-flex h-10 w-10">
        <span className="absolute inset-0 rounded-full border-[3px] border-gray-200" />
        <span className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-gray-900 animate-spin" />
      </span>
      {label && <span className="text-sm text-gray-400">{label}</span>}
    </div>
  );
}
