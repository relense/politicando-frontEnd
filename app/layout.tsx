import type { Metadata, Viewport } from "next";
import { Domine, Space_Mono } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import { getParties } from "@/lib/api/client";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import type { Party } from "@/lib/types";
import "./globals.css";

const domine = Domine({ subsets: ["latin"], variable: "--font-domine" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} | Notícias dos partidos portugueses`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, locale: "pt_PT", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#17181c" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The drawer must not take the whole site down if only this request fails.
  const parties: Party[] = await getParties().catch(() => []);
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  return (
    <html lang="pt-PT" className={`${domine.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>
          <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-paper focus:p-3">
            Saltar para o conteúdo
          </a>
          <Header parties={parties} />
          <main id="conteudo" className="mx-auto w-full max-w-4xl px-4 py-6">
            {children}
          </main>
        </Providers>
        {plausibleDomain && <Script defer data-domain={plausibleDomain} src="https://plausible.io/js/script.js" />}
      </body>
    </html>
  );
}
