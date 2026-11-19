import type { Metadata } from "next";
import { AccountInbox } from "@/components/account/Inbox";

export const metadata: Metadata = {
  title: "Notificações",
  robots: { index: false, follow: false },
};

export default function InboxPage() {
  return <AccountInbox />;
}
