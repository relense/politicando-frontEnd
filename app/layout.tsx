import { CookieBanner } from "@/components/CookieBanner";
import { SiteFooter } from "@/components/SiteFooter";
import type { Metadata, Viewport } from "next";
import { Domine, Space_Mono } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { NavigationProgress } from "@/components/NavigationProgress";
import { PartyOrderProvider } from "@/components/PartyOrder";
import { Providers } from "@/components/Providers";
import { SiteNav } from "@/components/SiteNav";
import { getPartyStandings } from "@/lib/api/client";
import { jsonLd, OG_BASE, siteLd } from "@/lib/seo";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const domine = Domine({ subsets: ["latin"], variable: "--font-domine" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-space-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} | Notícias dos partidos portugueses`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "politics",
  // Numbers like vote counts and NIFs are not phone numbers.
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: { ...OG_BASE, type: "website" },
  // The large card; the image comes from each route's opengraph-image (X falls back to it).
  twitter: { card: "summary_large_image" },
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#17181c" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Standings never throw: without them only the order by name is offered.
  const standings = await getPartyStandings();
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  return (
    <html lang="pt-PT" className={`${domine.variable} ${spaceMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(siteLd()) }} />
        <Providers>
          <PartyOrderProvider standings={standings}>
            <NavigationProgress />
            <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-paper focus:p-3">
              Saltar para o conteúdo
            </a>
            <Header />
            {/* The sections column on the left; the content takes the rest. */}
            <div className="mx-auto flex w-full max-w-[96rem] gap-6 px-4 py-6 2xl:gap-8">
              <SiteNav />
              <main id="conteudo" className="min-w-0 flex-1">
                {/* Every page fills the space beside the menu, at the same distance from it. */}
                {children}
              </main>
            </div>
            <SiteFooter />
            <CookieBanner />
          </PartyOrderProvider>
        </Providers>
        {plausibleDomain && <Script defer data-domain={plausibleDomain} src="https://plausible.io/js/script.js" />}
      </body>
    </html>
  );
}
