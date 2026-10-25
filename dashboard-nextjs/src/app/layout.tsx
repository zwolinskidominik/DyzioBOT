import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import SessionProvider from "@/components/SessionProvider";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { getLang } from "@/i18n/server";

const inter = Inter({ subsets: ["latin"] });

const DESCRIPTION =
  "Discord bot dashboard: moderation, logs, Anti-Spam, tickets, levels and more. · Panel bota Deezy dla Discorda.";

export const metadata: Metadata = {
  // Bez metadataBase względne URL-e obrazków w og:image nie działają — Discord/Facebook
  // pokazałyby link bez miniaturki.
  metadataBase: new URL("https://deezy.cc"),
  title: "Deezy Dashboard",
  description: DESCRIPTION,
  icons: {
    icon: "/deezy.png",
    apple: "/deezy.png",
  },
  openGraph: {
    type: "website",
    siteName: "Deezy",
    title: "Deezy Dashboard",
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/deezy.png", width: 1024, height: 1024, alt: "Deezy" }],
  },
  // „summary” = mała miniaturka obok opisu (logo jest kwadratowe, duży podgląd by je rozciągnął).
  twitter: {
    card: "summary",
    title: "Deezy Dashboard",
    description: DESCRIPTION,
    images: ["/deezy.png"],
  },
};

// Kolor paska embeda linku na Discordzie.
export const viewport: Viewport = { themeColor: "#5865F2" };

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await getLang();
  return (
    <html lang={lang} suppressHydrationWarning>
      <body className={inter.className}>
        <LanguageProvider initialLang={lang}>
          <SessionProvider>
            {children}
          </SessionProvider>
        </LanguageProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
