import type { Metadata } from "next";
import { AccountSettings } from "@/components/account/AccountSettings";

export const metadata: Metadata = {
  title: "A tua conta",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountSettings />;
}
