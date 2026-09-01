"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Hash, Lock, Pencil, Users } from "lucide-react";

export type TempChannelType = "panel" | "standard";

interface TempChannelLivePreviewProps {
  type: TempChannelType;
}

const PANEL_BUTTONS: { label: string; emoji: string; className: string }[] = [
  { label: "Limit", emoji: "🔢", className: "bg-[#5865f2] text-white" },
  { label: "Nazwa", emoji: "✏️", className: "bg-[#5865f2] text-white" },
  { label: "Lock", emoji: "🔒", className: "bg-[#4e5058] text-white" },
  { label: "Kick", emoji: "⚡", className: "bg-[#da373c] text-white" },
  { label: "Transfer", emoji: "👑", className: "bg-[#2d7d46] text-white" },
];

/** Live, illustrative preview of what a newly created temp channel will look like. */
export function TempChannelLivePreview({ type }: TempChannelLivePreviewProps) {
  const [timestamp, setTimestamp] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setTimestamp(`dziś o ${now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`);
  }, []);

  return (
    <div className="space-y-2 rounded-md bg-[#313338] p-4">
      <div className="flex items-center gap-2 text-xs text-[#8d94a8]">
        <Hash className="h-3 w-3" />
        <span>Kanał-Twoja Nazwa</span>
      </div>

      {type === "panel" ? (
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

            <div className="space-y-1 rounded border-l-4 border-[#5865f2] bg-[#2b2d31] py-2.5 pl-3 pr-3">
              <p className="text-sm font-semibold text-white/90">⚙️ Panel zarządzania kanałem</p>
              <p className="text-xs text-[#8d94a8]">Użyj przycisków poniżej, aby zarządzać tym kanałem głosowym.</p>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {PANEL_BUTTONS.map((btn) => (
                <span
                  key={btn.label}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${btn.className}`}
                >
                  <span>{btn.emoji}</span>
                  {btn.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded border-l-4 border-[#6f7690] bg-[#2b2d31] px-3 py-2.5">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#8d94a8]" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white/90">Kanał standardowy</p>
            <p className="text-xs text-[#8d94a8]">
              Zwykły kanał głosowy bez panelu zarządzania — bez przycisków Limit, Nazwa, Lock, Kick czy Transfer.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-[#6f7690]">
        {type === "panel" ? <Pencil className="h-3 w-3" /> : <Lock className="h-3 w-3 opacity-0" />}
        <span>
          {type === "panel"
            ? "Właściciel kanału może zarządzać nim przyciskami powyżej."
            : "Kanał zniknie automatycznie, gdy wszyscy go opuszczą."}
        </span>
      </div>
    </div>
  );
}
