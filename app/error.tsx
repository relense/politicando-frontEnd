"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="py-16 text-center">
      <h1 className="mb-3 text-2xl font-bold">Não foi possível carregar esta página</h1>
      <p className="mb-6 text-muted">Pode ser um problema temporário. Tenta novamente daqui a pouco.</p>
      <button type="button" onClick={reset} className="rounded border border-line px-4 py-2 font-mono text-sm hover:bg-surface">
        Tentar novamente
      </button>
    </div>
  );
}
