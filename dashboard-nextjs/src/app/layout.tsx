import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import SessionProvider from "@/components/SessionProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Deezy Dashboard",
  description: "Profesjonalny panel zarządzania botem Discord - Deezy",
  icons: {
    icon: "/deezy.png",
    apple: "/deezy.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className={inter.className}>
        <SessionProvider>
          {children}
        </SessionProvider>
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
