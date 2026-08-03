"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { EmojiDisplay } from "@/components/EmojiDisplay";

export type TicketBannerMode = "preset" | "text" | "none";

export interface TicketTypeBannerDraft {
  mode: TicketBannerMode;
  presetId?: string;
  text?: string;
}

export interface TicketTypeDraft {
  id: string;
  emoji: string;
  name: string;
  description: string;
  roleIds: string[];
  color: string;
  banner: TicketTypeBannerDraft;
}

const DEFAULT_PRESET = "ticketBanner.png";

/** Base banner.png texture with the configured text overlaid — a CSS approximation of the server-side canvas render. */
export function TextOverBannerPreview({ text }: { text: string }) {
  const safeText = (text || "Nowy ticket").trim();
  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-cover bg-center px-3 py-2"
      style={{ backgroundImage: "url(/api/tickets/assets/banner)" }}
    >
      <p
        className="line-clamp-2 text-center text-white"
        style={{
          fontFamily: "TicketAgeer, sans-serif",
          fontSize: "1.4rem",
          textShadow: "0 1px 10px rgba(0, 0, 0, 0.7), 0 0 4px rgba(0, 0, 0, 0.6)",
        }}
      >
        {safeText}
      </p>
      <style jsx global>{`
        @font-face {
          font-family: "TicketAgeer";
          src: url("/api/tickets/assets/font") format("opentype");
          font-display: swap;
        }
      `}</style>
    </div>
  );
}

/** Resolves a ticket type's banner (preset thumbnail or text-over-banner) to a visual element. Renders nothing for "none". */
export function TicketBannerThumbnail({ banner, className }: { banner: TicketTypeBannerDraft; className?: string }) {
  if (banner.mode === "none") {
    return null;
  }

  if (banner.mode === "text") {
    return (
      <div className={className}>
        <TextOverBannerPreview text={banner.text ?? ""} />
      </div>
    );
  }

  const presetFile = banner.presetId || DEFAULT_PRESET;
  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/tickets/assets/preset/${presetFile}`}
        alt="Baner ticketa"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

/** Live, illustrative preview of the Discord welcome message a ticket type will produce when a ticket is created. */
export function TicketLivePreview({ type }: { type: TicketTypeDraft }) {
  const [timestamp, setTimestamp] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setTimestamp(`dziś o ${now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`);
  }, []);

  const description = (type.description || "Witaj {user}!").replace(/\{user\}/g, "@Użytkownik");

  return (
    <div className="rounded-md bg-[#313338] p-4">
      <div className="flex gap-3">
        <Image src="/deezy.png" alt="Deezy" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-white/90">Dyzio</span>
            <span className="rounded bg-[#5865f2] px-1 py-0.5 text-[10px] font-bold leading-none text-white">
              APP
            </span>
            <span className="text-xs text-[#8d94a8]">{timestamp ?? " "}</span>
          </div>

          <div
            className="space-y-2 rounded border-l-4 bg-[#2b2d31] py-2.5 pl-3 pr-3"
            style={{ borderColor: type.color || "#5865f2" }}
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold text-white/90">
              {type.emoji ? <EmojiDisplay emoji={type.emoji} size={16} /> : null}
              {type.name || "Nowy typ ticketa"}
            </p>
            <p className="whitespace-pre-wrap text-xs text-[#c4cad8]">{description}</p>

            {type.banner.mode !== "none" ? (
              <div className="overflow-hidden rounded" style={{ aspectRatio: "3 / 1" }}>
                <TicketBannerThumbnail banner={type.banner} className="h-full w-full" />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <span className="rounded-md bg-[#3b82f6] px-2.5 py-1 text-xs font-medium text-white">Zajmij zgłoszenie</span>
            <span className="rounded-md bg-[#da373c] px-2.5 py-1 text-xs font-medium text-white">Zamknij zgłoszenie</span>
          </div>
        </div>
      </div>
    </div>
  );
}
