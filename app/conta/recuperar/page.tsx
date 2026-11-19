import type { Metadata } from "next";
import { ForgotPassword } from "@/components/account/EmailLinks";

export const metadata: Metadata = { title: "Recuperar a conta", robots: { index: false, follow: false } };

/** "Esqueci-me da palavra-passe", from the login. */
export default function ForgotPasswordPage() {
  return <ForgotPassword />;
}
