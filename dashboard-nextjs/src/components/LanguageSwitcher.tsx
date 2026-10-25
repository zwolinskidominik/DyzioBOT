"use client";

import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LANGS, type Lang } from "@/i18n/config";
import { useLang } from "@/i18n/LanguageProvider";

const LANGUAGE_INFO: Record<Lang, { flag: string; name: string; code: string }> = {
  pl: { flag: "/flags/pl.svg", name: "Polski", code: "PL" },
  en: { flag: "/flags/us.svg", name: "English", code: "EN" },
};

/** Przełącznik języka panelu (nawigacja strony głównej i panelu serwera). */
export function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGE_INFO[lang];

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-accent"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="h-5 w-5 flex-shrink-0 overflow-hidden rounded-full">
          <Image src={current.flag} alt={current.code} width={20} height={20} className="h-full w-full object-cover" />
        </div>
        <span className="text-sm font-semibold">{current.code}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 animate-in rounded-md border border-bot-blue/30 bg-card/95 shadow-lg backdrop-blur fade-in slide-in-from-top-2 duration-200">
          <div className="p-1" role="listbox">
            {LANGS.map((code) => {
              const info = LANGUAGE_INFO[code];
              return (
                <button
                  key={code}
                  role="option"
                  aria-selected={lang === code}
                  onClick={() => {
                    setOpen(false);
                    if (code !== lang) setLang(code);
                  }}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent ${
                    lang === code ? "bg-accent" : ""
                  }`}
                >
                  <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full">
                    <Image src={info.flag} alt={info.code} width={24} height={24} className="h-full w-full object-cover" />
                  </div>
                  <span className="flex-1 text-left">{info.name}</span>
                  <span className="text-xs text-muted-foreground">{info.code}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
