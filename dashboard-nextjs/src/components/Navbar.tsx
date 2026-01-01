"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { LogIn, ChevronDown } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState, useEffect, useRef } from "react";

interface Language {
  flag: string;
  name: string;
  code: string;
  disabled?: boolean;
}

export default function Navbar() {
  const [langOpen, setLangOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState("pl");
  const langDropdownRef = useRef<HTMLDivElement>(null);

  const languages: Record<string, Language> = {
    pl: { flag: "https://flagcdn.com/pl.svg", name: "Polski", code: "PL" },
    en: { flag: "https://flagcdn.com/us.svg", name: "English", code: "US", disabled: true },
    de: { flag: "https://flagcdn.com/de.svg", name: "Deutsch", code: "DE", disabled: true },
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setLangOpen(false);
      }
    };

    if (langOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [langOpen]);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-bot-blue/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo & Name */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Image
            src="/dyzio.png"
            alt="DyzioBOT"
            width={40}
            height={40}
            className="rounded-full"
          />
          <span className="text-xl font-bold bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
            DyzioBOT
          </span>
        </Link>

        {/* Right side - Language & Login */}
        <div className="flex items-center gap-4">
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

          {/* Login Button */}
          <Button
            onClick={() => signIn("discord")}
            className="btn-gradient shadow-lg shadow-bot-primary/30 hover:scale-105"
          >
            <LogIn className="mr-2 w-4 h-4" />
            Zaloguj się
          </Button>
        </div>
      </div>
    </nav>
  );
}
