"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronDown, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

interface Language {
  flag: string;
  name: string;
  code: string;
  disabled?: boolean;
}

interface DashboardTopbarProps {
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
  showSidebarToggle?: boolean;
  showBrandOnDesktop?: boolean;
  className?: string;
}

const languages: Record<string, Language> = {
  pl: { flag: "https://flagcdn.com/pl.svg", name: "Polski", code: "PL" },
  en: { flag: "https://flagcdn.com/us.svg", name: "English", code: "US", disabled: true },
  de: { flag: "https://flagcdn.com/de.svg", name: "Deutsch", code: "DE", disabled: true },
};

export function DashboardTopbar({
  sidebarOpen = false,
  onSidebarToggle,
  showSidebarToggle = false,
  showBrandOnDesktop = true,
  className,
}: DashboardTopbarProps) {
  const { data: session } = useSession();
  const [langOpen, setLangOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState("pl");
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserOpen(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangOpen(false);
      }
    };

    if (userOpen || langOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userOpen, langOpen]);

  const brandVisibility = showBrandOnDesktop ? "flex" : "flex lg:hidden";
  const currentLanguage = languages[currentLang as keyof typeof languages];

  return (
    <nav className={`z-40 w-full shrink-0 ${className ?? "bg-dark-900"}`}>
      <div className="flex h-20 w-full items-center justify-between gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {showSidebarToggle && (
            <button
              onClick={onSidebarToggle}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/5 lg:hidden"
              aria-label={sidebarOpen ? "Zamknij menu" : "Otwórz menu"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
          <Link href="/" className={`${brandVisibility} min-w-0 items-center gap-3 transition-opacity hover:opacity-80`}>
            <div className="relative flex-shrink-0">
              <Image
                src="/deezy.png"
                alt="Deezy"
                width={40}
                height={40}
                className="rounded-full"
              />
            </div>
            <span className="mt-1.5 hidden truncate text-xl font-bold text-white/90 sm:inline">
              Deezy
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="relative" ref={langDropdownRef}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-accent"
            >
              <div className="h-5 w-5 flex-shrink-0 overflow-hidden rounded-full">
                <Image
                  src={currentLanguage.flag}
                  alt={currentLanguage.code}
                  width={20}
                  height={20}
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-sm font-semibold">{currentLanguage.code}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${langOpen ? "rotate-180" : ""}`} />
            </button>

            {langOpen && (
              <div className="absolute right-0 mt-2 w-48 animate-in rounded-md border border-bot-blue/30 bg-card/95 shadow-lg backdrop-blur fade-in slide-in-from-top-2 duration-200">
                <div className="p-1">
                  {Object.entries(languages).map(([code, lang]) => (
                    <button
                      key={code}
                      onClick={() => {
                        if (!lang.disabled) {
                          setCurrentLang(code);
                          setLangOpen(false);
                        }
                      }}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent ${
                        lang.disabled ? "cursor-not-allowed opacity-50" : ""
                      } ${currentLang === code ? "bg-accent" : ""}`}
                    >
                      <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full">
                        <Image
                          src={lang.flag}
                          alt={lang.code}
                          width={24}
                          height={24}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex flex-1 items-center gap-2">
                        <span>{lang.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{lang.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {session?.user && (
            <div className="relative" ref={userDropdownRef}>
              <button
                onClick={() => setUserOpen(!userOpen)}
                className="flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 transition-all hover:border-bot-blue/30 hover:bg-bot-blue/10"
              >
                <div className="relative">
                  <Image
                    src={session.user.image || "/deezy.png"}
                    alt={session.user.name || "User"}
                    width={32}
                    height={32}
                    className="rounded-full ring-2 ring-bot-blue/20"
                  />
                  <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
                </div>
                <span className="hidden max-w-[140px] truncate text-sm font-semibold text-foreground sm:inline">{session.user.name}</span>
                <ChevronDown className={`hidden h-4 w-4 text-muted-foreground transition-transform sm:block ${userOpen ? "rotate-180" : ""}`} />
              </button>

              {userOpen && (
                <div className="absolute right-0 mt-2 w-56 animate-in rounded-lg border border-bot-blue/40 bg-gradient-to-br from-card via-card to-bot-blue/5 shadow-2xl shadow-bot-primary/20 backdrop-blur-xl fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2">
                    <div className="mb-1 px-3 py-2">
                      <p className="text-xs font-bold text-white">Deezy</p>
                    </div>
                    <div className="my-1 h-px bg-gradient-to-r from-transparent via-bot-blue/30 to-transparent" />
                    <Link
                      href="/guilds"
                      onClick={() => setUserOpen(false)}
                      className="group flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2.5 transition-all hover:border-bot-blue/20 hover:bg-bot-blue/10"
                    >
                      <LayoutDashboard className="h-4 w-4 text-bot-light transition-colors group-hover:text-bot-primary" />
                      <span className="text-sm font-medium text-foreground transition-colors group-hover:text-white">Moje serwery</span>
                    </Link>
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="group flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2.5 transition-all hover:border-red-500/20 hover:bg-red-500/10"
                    >
                      <LogOut className="h-4 w-4 text-red-400 transition-colors group-hover:text-red-500" />
                      <span className="text-sm font-medium text-red-400 transition-colors group-hover:text-red-500">Wyloguj się</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
