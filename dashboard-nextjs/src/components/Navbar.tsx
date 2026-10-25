"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { LogIn, LayoutDashboard } from "lucide-react";
import { signIn } from "next-auth/react";
import { useSession } from "next-auth/react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useMessages } from "@/i18n/LanguageProvider";
import { commonMessages } from "@/i18n/messages/common";

export default function Navbar() {
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  const t = useMessages(commonMessages).nav;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-bot-blue/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo & Name */}
        <Link href="/" className="flex shrink-0 items-center gap-3 hover:opacity-80 transition-opacity">
          <Image
            src="/deezy.png"
            alt="Deezy"
            width={40}
            height={40}
            className="rounded-full"
          />
          <span className="text-xl font-bold bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
            Deezy
          </span>
        </Link>

        {/* Right side - Language & Login */}
        <div className="flex items-center gap-2 sm:gap-4">
          <LanguageSwitcher />

          {/* Login / Dashboard Button — na telefonie (<640px) sama ikona, żeby nie nachodziła na logo. */}
          {isLoggedIn ? (
            <Button asChild className="btn-gradient px-3 shadow-lg shadow-bot-primary/30 hover:scale-105 sm:px-4">
              <Link href="/guilds" aria-label={t.myServers}>
                <LayoutDashboard className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{t.myServers}</span>
              </Link>
            </Button>
          ) : (
            <Button
              onClick={() => signIn("discord", { callbackUrl: "/guilds" })}
              aria-label={t.login}
              className="btn-gradient px-3 shadow-lg shadow-bot-primary/30 hover:scale-105 sm:px-4"
            >
              <LogIn className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">{t.login}</span>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
