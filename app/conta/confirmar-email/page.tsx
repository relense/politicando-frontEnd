import type { Metadata } from "next";
import { ConfirmEmail } from "@/components/account/EmailLinks";

export const metadata: Metadata = { title: "Confirmar o email", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ token?: string | string[] }> };

/** The link in the account's confirmation email; confirms only on the button (components/account/EmailLinks). */
export default async function ConfirmEmailPage({ searchParams }: Props) {
  const { token } = await searchParams;
  return <ConfirmEmail token={typeof token === "string" ? token : ""} />;
}
