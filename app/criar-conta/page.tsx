import type { Metadata } from "next";
import { AuthPage } from "@/components/account/AuthPage";
import { safeReturn } from "@/lib/api/account";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Cria uma conta no Politicando: só um nome público e uma palavra-passe.",
  alternates: { canonical: "/criar-conta" },
  robots: { index: false, follow: true },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ depois?: string | string[] }> }) {
  const { depois } = await searchParams;
  return <AuthPage mode="register" back={safeReturn(typeof depois === "string" ? depois : undefined)} />;
}
