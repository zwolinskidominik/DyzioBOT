"use client";

import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { EmojiProvider } from "@/components/EmojiContext";

interface GuildLayoutProps {
  children: React.ReactNode;
}

interface Language {
  flag: string;
  name: string;
  code: string;
  disabled?: boolean;
}

export default function GuildLayout({ children }: GuildLayoutProps) {
  const { data: session } = useSession();
  const [langOpen, setLangOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState("pl");
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  const languages: Record<string, Language> = {
    pl: { flag: "https://flagcdn.com/pl.svg", name: "Polski", code: "PL" },
    en: { flag: "https://flagcdn.com/us.svg", name: "English", code: "US", disabled: true },
    de: { flag: "https://flagcdn.com/de.svg", name: "Deutsch", code: "DE", disabled: true },
  };

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

  // Lock body scroll + auto-close sidebar when viewport reaches lg
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    const handleResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b border-bot-blue/20" style={{ backgroundColor: '#1E2227' }}>
        <div className="container mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2">
          {/* Hamburger (mobile) + Logo & Name */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-md hover:bg-white/5 transition-colors flex-shrink-0"
              aria-label={sidebarOpen ? "Zamknij menu" : "Otwórz menu"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0">
              <div className="relative flex-shrink-0">
                <div
                  className="absolute inset-0 rounded-full blur-md opacity-60"
                  style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)", transform: "scale(1.4)" }}
                  aria-hidden="true"
                />
                <Image
                  src="/deezy.png"
                  alt="Deezy"
                  width={40}
                  height={40}
                  className="relative rounded-full"
                />
              </div>
              <span className="hidden sm:inline text-xl font-bold bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent truncate">
                Deezy
              </span>
            </Link>
          </div>

          {/* Right side - Language & User */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Language Selector */}
            <div className="relative" ref={langDropdownRef}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors"
              >
                <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                  <Image
                    src={languages[currentLang as keyof typeof languages].flag}
                    alt={languages[currentLang as keyof typeof languages].code}
                    width={20}
                    height={20}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-sm font-semibold">{languages[currentLang as keyof typeof languages].code}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${langOpen ? "rotate-180" : ""}`} />
              </button>
              
              {langOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-md border border-bot-blue/30 bg-card/95 backdrop-blur shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
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
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors ${
                          lang.disabled ? "opacity-50 cursor-not-allowed" : ""
                        } ${currentLang === code ? "bg-accent" : ""}`}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                          <Image
                            src={lang.flag}
                            alt={lang.code}
                            width={24}
                            height={24}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                          <span>{lang.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{lang.code}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            {session?.user && (
              <div className="relative" ref={userDropdownRef}>
                <button
                  onClick={() => setUserOpen(!userOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-bot-blue/10 transition-all border border-transparent hover:border-bot-blue/30"
                >
                  <div className="relative">
                    <Image
                      src={session.user.image || "/deezy.png"}
                      alt={session.user.name || "User"}
                      width={32}
                      height={32}
                      className="rounded-full ring-2 ring-bot-blue/20"
                    />
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
                  </div>
                  <span className="hidden sm:inline text-sm font-semibold text-foreground truncate max-w-[140px]">{session.user.name}</span>
                  <ChevronDown className={`hidden sm:block w-4 h-4 text-muted-foreground transition-transform ${userOpen ? "rotate-180" : ""}`} />
                </button>

                {userOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-lg border border-bot-blue/40 bg-gradient-to-br from-card via-card to-bot-blue/5 backdrop-blur-xl shadow-2xl shadow-bot-primary/20 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2">
                      <div className="px-3 py-2 mb-1">
                        <p className="text-xs font-bold text-white">Deezy</p>
                      </div>
                      <div className="h-px bg-gradient-to-r from-transparent via-bot-blue/30 to-transparent my-1"></div>
                      <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-red-500/10 transition-all group border border-transparent hover:border-red-500/20"
                      >
                        <LogOut className="w-4 h-4 text-red-400 group-hover:text-red-500 transition-colors" />
                        <span className="text-sm font-medium text-red-400 group-hover:text-red-500 transition-colors">Wyloguj się</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>
      
      {/* Main content with sidebar */}
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 lg:ml-[536px] min-w-0" style={{ backgroundColor: '#23272E' }}>
          <EmojiProvider>
            {children}
          </EmojiProvider>
        </main>
      </div>
    </div>
  );
}
