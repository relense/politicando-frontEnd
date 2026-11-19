import type { Metadata } from "next";
import { AccountComments } from "@/components/account/AccountSettings";

export const metadata: Metadata = {
  title: "Os meus comentários",
  robots: { index: false, follow: false },
};

export default function AccountCommentsPage() {
  return <AccountComments />;
}
