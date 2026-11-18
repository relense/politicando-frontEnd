import type { Metadata } from "next";
import { AuthPage } from "@/components/account/AuthPage";
import { safeReturn } from "@/lib/api/account";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entra na tua conta do Politicando.",
  alternates: { canonical: "/entrar" },
  robots: { index: false, follow: true },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ depois?: string | string[] }> }) {
  const { depois } = await searchParams;
  return <AuthPage mode="login" back={safeReturn(typeof depois === "string" ? depois : undefined)} />;
}
