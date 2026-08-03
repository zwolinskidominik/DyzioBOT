"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Smile, Search, Lock, Bot as BotIcon } from "lucide-react";
import { useEmojis } from "@/components/EmojiContext";
import { cn } from "@/lib/utils";
import emojiData from "@/data/emoji-data.json";

interface CustomEmoji {
  id: string;
  name: string;
  animated: boolean;
  url: string;
  guildId: string;
  guildName: string;
}

interface BotEmoji {
  id: string;
  name: string;
  animated: boolean;
}

interface UnicodeEmoji {
  /** unicode glyph */
  u: string;
  /** label / name */
  n: string;
  /** Discord-style shortcodes */
  s: string[];
  /** search tags */
  t: string[];
}

interface EmojiCategoryMeta {
  key: string;
  label: string;
  icon: string;
}

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  buttonText?: string;
  hideTabs?: Array<"custom" | "bot">;
  /** Custom trigger element. When provided, replaces the default button. */
  trigger?: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

const CATEGORIES = emojiData.categories as EmojiCategoryMeta[];
const UNICODE_EMOJIS = emojiData.emojis as Record<string, UnicodeEmoji[]>;

type PreviewState =
  | { kind: "unicode"; emoji: UnicodeEmoji }
  | { kind: "custom"; emoji: CustomEmoji }
  | { kind: "bot"; emoji: BotEmoji }
  | null;

type Section =
  | { id: string; type: "custom"; label: string; navUrl: string; emojis: CustomEmoji[] }
  | { id: string; type: "bot"; label: string; emojis: BotEmoji[] }
  | { id: string; type: "unicode"; label: string; icon: string; emojis: UnicodeEmoji[] };

function botEmojiUrl(emoji: BotEmoji, size = 64) {
  const ext = emoji.animated ? "gif" : "png";
  return `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=${size}`;
}

function customEmojiCode(emoji: CustomEmoji | BotEmoji) {
  return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
}

export default function EmojiPicker({
  onEmojiSelect,
  buttonText = "Dodaj emoji",
  hideTabs = [],
  trigger,
  align = "start",
  side = "bottom",
}: EmojiPickerProps) {
  const { customEmojis, fetchEmojis } = useEmojis();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [activeSection, setActiveSection] = useState<string>("");

  const [botEmojis, setBotEmojis] = useState<BotEmoji[]>([]);
  const [botEmojisLoaded, setBotEmojisLoaded] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isScrollingByClick = useRef(false);

  const showCustom = !hideTabs.includes("custom");
  const showBot = !hideTabs.includes("bot");

  const fetchBotEmojis = useCallback(async () => {
    if (botEmojisLoaded) return;
    try {
      const res = await fetch("/api/bot-emojis/list");
      if (res.ok) {
        const data: BotEmoji[] = await res.json();
        setBotEmojis(data);
        setBotEmojisLoaded(true);
      }
    } catch {
      // ignore
    }
  }, [botEmojisLoaded]);

  useEffect(() => {
    if (!open) return;
    if (showCustom) fetchEmojis();
    if (showBot) fetchBotEmojis();
    const id = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, showCustom, showBot, fetchEmojis, fetchBotEmojis]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setPreview(null);
    }
  }, [open]);

  // Custom emojis grouped per guild (each guild becomes a section).
  const customSections = useMemo<Section[]>(() => {
    if (!showCustom) return [];
    const byGuild = new Map<string, CustomEmoji[]>();
    for (const emoji of customEmojis) {
      const list = byGuild.get(emoji.guildId) ?? [];
      list.push(emoji);
      byGuild.set(emoji.guildId, list);
    }
    return Array.from(byGuild.values())
      .filter((list) => list.length > 0)
      .map((list) => ({
        id: `custom-${list[0].guildId}`,
        type: "custom" as const,
        label: list[0].guildName,
        navUrl: list[0].url,
        emojis: list,
      }));
  }, [customEmojis, showCustom]);

  const sections = useMemo<Section[]>(() => {
    const result: Section[] = [...customSections];
    if (showBot && botEmojis.length > 0) {
      result.push({ id: "bot", type: "bot", label: "Emoji bota", emojis: botEmojis });
    }
    for (const category of CATEGORIES) {
      result.push({
        id: `u-${category.key}`,
        type: "unicode",
        label: category.label,
        icon: category.icon,
        emojis: UNICODE_EMOJIS[category.key] ?? [],
      });
    }
    return result;
  }, [customSections, showBot, botEmojis]);

  const query = search.trim().toLowerCase();
  const isSearching = query.length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) return null;
    const matchUnicode = (emoji: UnicodeEmoji) =>
      emoji.s.some((code) => code.includes(query)) ||
      emoji.n.toLowerCase().includes(query) ||
      emoji.t.some((tag) => tag.includes(query));

    const unicode: UnicodeEmoji[] = [];
    for (const category of CATEGORIES) {
      for (const emoji of UNICODE_EMOJIS[category.key] ?? []) {
        if (matchUnicode(emoji)) unicode.push(emoji);
      }
    }
    const custom = showCustom
      ? customEmojis.filter((e) => e.name.toLowerCase().includes(query))
      : [];
    const bot = showBot
      ? botEmojis.filter((e) => e.name.toLowerCase().includes(query))
      : [];
    return { unicode, custom, bot };
  }, [isSearching, query, customEmojis, botEmojis, showCustom, showBot]);

  const handlePick = (value: string) => {
    onEmojiSelect(value);
    setOpen(false);
  };

  const handleScroll = useCallback(() => {
    if (isScrollingByClick.current) return;
    const container = scrollRef.current;
    if (!container) return;
    const containerTop = container.getBoundingClientRect().top;
    let current = sections[0]?.id ?? "";
    for (const section of sections) {
      const el = sectionRefs.current[section.id];
      if (!el) continue;
      if (el.getBoundingClientRect().top - containerTop <= 12) {
        current = section.id;
      } else {
        break;
      }
    }
    setActiveSection(current);
  }, [sections]);

  const scrollToSection = (id: string) => {
    const container = scrollRef.current;
    const el = sectionRefs.current[id];
    if (!container || !el) return;
    isScrollingByClick.current = true;
    setActiveSection(id);
    container.scrollTo({ top: el.offsetTop, behavior: "smooth" });
    window.setTimeout(() => {
      isScrollingByClick.current = false;
    }, 350);
  };

  // Nav items mirror the section order.
  const navItems = sections.map((section) => {
    if (section.type === "custom") {
      return { id: section.id, kind: "image" as const, url: section.navUrl, title: section.label, locked: true };
    }
    if (section.type === "bot") {
      return { id: section.id, kind: "bot" as const, title: section.label };
    }
    return { id: section.id, kind: "emoji" as const, glyph: section.icon, title: section.label };
  });

  const setSectionRef = (id: string) => (el: HTMLDivElement | null) => {
    sectionRefs.current[id] = el;
  };

  const renderPreviewBar = () => {
    if (!preview) {
      return (
        <div className="flex h-[44px] items-center px-3 text-xs text-[#949ba4]">
          Najedź na emoji, aby zobaczyć szczegóły
        </div>
      );
    }
    if (preview.kind === "unicode") {
      const [primary, ...rest] = preview.emoji.s;
      return (
        <div className="flex h-[44px] items-center gap-2 px-3">
          <span className="text-2xl leading-none">{preview.emoji.u}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{primary ? `:${primary}:` : preview.emoji.n}</p>
            {rest.length > 0 ? (
              <p className="truncate text-[11px] text-[#949ba4]">{rest.map((c) => `:${c}:`).join("  ")}</p>
            ) : null}
          </div>
        </div>
      );
    }
    if (preview.kind === "custom") {
      return (
        <div className="flex h-[44px] items-center gap-2 px-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.emoji.url} alt={preview.emoji.name} className="h-7 w-7 object-contain" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">:{preview.emoji.name}:</p>
            <p className="truncate text-[11px] text-[#949ba4]">od {preview.emoji.guildName}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-[44px] items-center gap-2 px-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={botEmojiUrl(preview.emoji)} alt={preview.emoji.name} className="h-7 w-7 object-contain" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">:{preview.emoji.name}:</p>
          <p className="truncate text-[11px] text-[#949ba4]">Emoji bota</p>
        </div>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <Smile className="mr-2 h-4 w-4" />
            {buttonText}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] max-w-[420px] overflow-hidden rounded-lg border border-[#1f2024] bg-[#2b2d31] p-0 sm:w-[420px]"
        align={align}
        side={side}
        sideOffset={8}
      >
        <div className="flex h-[400px] flex-col">
          {/* Search */}
          <div className="p-3">
            <div className="relative">
              <Input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Szukaj emoji"
                className="h-9 border-none bg-[#1e1f22] pr-9 text-sm text-white placeholder:text-[#6d7079] focus-visible:ring-0"
              />
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6d7079]" />
            </div>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* Sidebar */}
            <div className="flex w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-[#1f2024] py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {navItems.map((item) => {
                const active = item.id === activeSection;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.title}
                    onClick={() => scrollToSection(item.id)}
                    className={cn(
                      "relative flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors",
                      active ? "bg-[#404249] text-white" : "text-[#b5bac1] hover:bg-[#35373c] hover:text-white"
                    )}
                  >
                    {active ? (
                      <span className="absolute -left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-white" />
                    ) : null}
                    {item.kind === "emoji" ? (
                      <span className="leading-none">{item.glyph}</span>
                    ) : item.kind === "bot" ? (
                      <BotIcon className="h-4 w-4" />
                    ) : (
                      <span className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.url} alt={item.title} className="h-5 w-5 rounded-sm object-cover" />
                        {item.locked ? (
                          <Lock className="absolute -bottom-1 -right-1 h-2.5 w-2.5 text-[#949ba4]" />
                        ) : null}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Emoji grid */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="relative min-w-0 flex-1 overflow-y-auto [scrollbar-width:thin]"
            >
              {isSearching && searchResults ? (
                <div className="p-2">
                  {searchResults.unicode.length === 0 &&
                  searchResults.custom.length === 0 &&
                  searchResults.bot.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-[#949ba4]">Brak wyników</p>
                  ) : (
                    <>
                      <h3 className="px-1 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#949ba4]">
                        Wyniki wyszukiwania
                      </h3>
                      <div className="grid grid-cols-9 gap-0.5">
                        {searchResults.custom.map((emoji) => (
                          <button
                            key={emoji.id}
                            type="button"
                            title={`:${emoji.name}:`}
                            onMouseEnter={() => setPreview({ kind: "custom", emoji })}
                            onClick={() => handlePick(customEmojiCode(emoji))}
                            className="flex h-9 w-9 items-center justify-center rounded hover:bg-[#404249]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={emoji.url} alt={emoji.name} className="h-[22px] w-[22px] object-contain" />
                          </button>
                        ))}
                        {searchResults.bot.map((emoji) => (
                          <button
                            key={emoji.id}
                            type="button"
                            title={`:${emoji.name}:`}
                            onMouseEnter={() => setPreview({ kind: "bot", emoji })}
                            onClick={() => handlePick(customEmojiCode(emoji))}
                            className="flex h-9 w-9 items-center justify-center rounded hover:bg-[#404249]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={botEmojiUrl(emoji)} alt={emoji.name} className="h-[22px] w-[22px] object-contain" />
                          </button>
                        ))}
                        {searchResults.unicode.map((emoji, idx) => (
                          <button
                            key={`${emoji.u}-${idx}`}
                            type="button"
                            title={emoji.s[0] ? `:${emoji.s[0]}:` : emoji.n}
                            onMouseEnter={() => setPreview({ kind: "unicode", emoji })}
                            onClick={() => handlePick(emoji.u)}
                            className="flex h-9 w-9 items-center justify-center rounded text-xl hover:bg-[#404249]"
                          >
                            {emoji.u}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                sections.map((section) => (
                  <div key={section.id} ref={setSectionRef(section.id)} className="px-2 pb-1">
                    <h3 className="sticky top-0 z-10 bg-[#2b2d31] px-1 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#949ba4]">
                      {section.label}
                    </h3>
                    {section.type === "unicode" ? (
                      <div className="grid grid-cols-9 gap-0.5">
                        {section.emojis.map((emoji, idx) => (
                          <button
                            key={`${emoji.u}-${idx}`}
                            type="button"
                            title={emoji.s[0] ? `:${emoji.s[0]}:` : emoji.n}
                            onMouseEnter={() => setPreview({ kind: "unicode", emoji })}
                            onClick={() => handlePick(emoji.u)}
                            className="flex h-9 w-9 items-center justify-center rounded text-xl hover:bg-[#404249]"
                          >
                            {emoji.u}
                          </button>
                        ))}
                      </div>
                    ) : section.type === "custom" ? (
                      <div className="grid grid-cols-9 gap-0.5">
                        {section.emojis.map((emoji) => (
                          <button
                            key={emoji.id}
                            type="button"
                            title={`:${emoji.name}:`}
                            onMouseEnter={() => setPreview({ kind: "custom", emoji })}
                            onClick={() => handlePick(customEmojiCode(emoji))}
                            className="flex h-9 w-9 items-center justify-center rounded hover:bg-[#404249]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={emoji.url} alt={emoji.name} className="h-[22px] w-[22px] object-contain" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-9 gap-0.5">
                        {section.emojis.map((emoji) => (
                          <button
                            key={emoji.id}
                            type="button"
                            title={`:${emoji.name}:`}
                            onMouseEnter={() => setPreview({ kind: "bot", emoji })}
                            onClick={() => handlePick(customEmojiCode(emoji))}
                            className="flex h-9 w-9 items-center justify-center rounded hover:bg-[#404249]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={botEmojiUrl(emoji)} alt={emoji.name} className="h-[22px] w-[22px] object-contain" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Preview bar */}
          <div className="border-t border-[#1f2024] bg-[#232428]">{renderPreviewBar()}</div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
