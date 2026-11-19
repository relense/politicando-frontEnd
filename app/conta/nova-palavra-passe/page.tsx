import type { Metadata } from "next";
import { ResetPassword } from "@/components/account/EmailLinks";

export const metadata: Metadata = { title: "Nova palavra-passe", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ token?: string | string[] }> };

/** The link in the "esqueci-me da palavra-passe" email. */
export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;
  return <ResetPassword token={typeof token === "string" ? token : ""} />;
}
