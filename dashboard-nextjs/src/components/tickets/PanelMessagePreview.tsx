"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { EmojiDisplay } from "@/components/EmojiDisplay";
import { TicketBannerThumbnail, type TicketTypeBannerDraft } from "./TicketLivePreview";

export interface PanelMessageDraft {
  emoji: string;
  title: string;
  description: string;
  color: string;
  placeholder: string;
  banner: TicketTypeBannerDraft;
}

/** Live, illustrative preview of the panel message (embed + select menu) sent to Discord on deploy. */
export function PanelMessagePreview({ message }: { message: PanelMessageDraft }) {
  const [timestamp, setTimestamp] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setTimestamp(`dziś o ${now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`);
  }, []);

  return (
    <div className="rounded-md bg-[#313338] p-4">
      <div className="flex gap-3">
        <Image src="/deezy.png" alt="Deezy" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-white/90">Deezy</span>
            <span className="rounded bg-[#5865f2] px-1 py-0.5 text-[10px] font-bold leading-none text-white">
              BOT
            </span>
            <span className="text-xs text-[#8d94a8]">{timestamp ?? " "}</span>
          </div>

          <div
            className="space-y-2 rounded border-l-4 bg-[#2b2d31] py-2.5 pl-3 pr-3"
            style={{ borderColor: message.color || "#5865f2" }}
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold text-white/90">
              {message.emoji ? <EmojiDisplay emoji={message.emoji} size={16} /> : null}
              {message.title || "Kontakt z Administracją"}
            </p>
            <p className="whitespace-pre-wrap text-xs text-[#c4cad8]">
              {message.description || "Aby skontaktować się z wybranym działem administracji, wybierz odpowiednią kategorię poniżej:"}
            </p>

            {message.banner.mode !== "none" ? (
              <div className="overflow-hidden rounded" style={{ aspectRatio: "3 / 1" }}>
                <TicketBannerThumbnail banner={message.banner} className="h-full w-full" />
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 rounded-md border border-[#1f2024] bg-[#1e1f22] px-3 py-2">
            <span className="truncate text-sm text-[#949ba4]">
              {message.placeholder || "Wybierz odpowiednią kategorię"}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#949ba4]" />
          </div>
        </div>
      </div>
    </div>
  );
}
