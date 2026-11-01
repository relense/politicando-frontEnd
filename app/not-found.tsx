import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="mb-3 text-2xl font-bold">Página não encontrada</h1>
      <p className="mb-6 text-muted">O endereço pode estar errado ou o conteúdo pode já não existir.</p>
      <Link href="/" className="text-link underline">
        Voltar às últimas notícias
      </Link>
    </div>
  );
}
