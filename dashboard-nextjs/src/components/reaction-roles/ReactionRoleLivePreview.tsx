"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { EmojiDisplay } from "@/components/EmojiDisplay";

interface Role {
  id: string;
  name: string;
  color: number;
}

interface ReactionMapping {
  emoji: string;
  roleId: string;
  description?: string | undefined;
}

interface ReactionRoleLivePreviewProps {
  title?: string | undefined;
  reactions: ReactionMapping[];
  roles: Role[];
  embedColor?: string | undefined;
}

// Discord nie maluje wzmianek roli bez własnego koloru na szaro — używa
// domyślnego blurple (jak zwykłe @wzmianki), stąd fallback null zamiast "#c4cad8".
function roleColorHex(color: number): string | null {
  return color ? `#${color.toString(16).padStart(6, "0")}` : null;
}

const DEFAULT_MENTION_TEXT = "#c9cdfb";
const DEFAULT_MENTION_BG = "rgba(88, 101, 242, 0.3)";

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(196, 202, 216, ${alpha})`;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Live, illustrative preview of the Discord embed a reaction-role panel will produce. */
export function ReactionRoleLivePreview({ title, reactions, roles, embedColor }: ReactionRoleLivePreviewProps) {
  const [timestamp, setTimestamp] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setTimestamp(`dziś o ${now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`);
  }, []);

  const getRole = (roleId: string) => roles.find((r) => r.id === roleId);
  // Musi odpowiadać dokładnie temu, co faktycznie wysyłamy do Discorda (kolor
  // embeda ustawiony w formularzu) — a nie kolorowi pierwszej roli.
  const accentColor = embedColor || "#5865f2";

  return (
    <div className="rounded-md bg-[#313338] p-4">
      <div className="flex gap-3">
        <Image
          src="/deezy.png"
          alt="Deezy"
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-full"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-white/90">Dyzio</span>
            <span className="rounded bg-[#5865f2] px-1 py-0.5 text-[10px] font-bold leading-none text-white">
              APP
            </span>
            <span className="text-xs text-[#8d94a8]">{timestamp ?? " "}</span>
          </div>

          <div
            className="space-y-2 rounded border-l-4 bg-[#2b2d31] py-2.5 pl-3 pr-3"
            style={{ borderColor: accentColor }}
          >
            <p className="text-sm font-semibold text-white/90">{title || "Wybierz swoją rolę"}</p>

            {reactions.length === 0 ? (
              <p className="text-xs text-[#6f7690]">Dodaj reakcje, aby zobaczyć podgląd wiadomości.</p>
            ) : (
              <div className="space-y-1">
                {reactions.map((reaction, index) => {
                  const role = getRole(reaction.roleId);
                  const hex = roleColorHex(role?.color ?? 0);
                  const textColor = hex ?? DEFAULT_MENTION_TEXT;
                  const bgColor = hex ? hexToRgba(hex, 0.3) : DEFAULT_MENTION_BG;
                  return (
                    <div key={index} className="flex items-center gap-1.5 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        <EmojiDisplay emoji={reaction.emoji} size={16} />
                      </span>
                      <span className="text-[#949ba4]">-</span>
                      <span
                        className="rounded px-1 font-medium"
                        style={{ color: textColor, backgroundColor: bgColor }}
                      >
                        @{role?.name ?? "nieznana rola"}
                      </span>
                      {reaction.description ? (
                        <span className="truncate text-sm text-[#dbdee1]">
                          <span className="text-[#949ba4]">•</span> {reaction.description}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-xs text-[#dbdee1]">Kliknij reakcję, aby otrzymać rolę!</p>
          </div>

          {reactions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {reactions.map((reaction, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 rounded-md border border-[#2f3341] bg-dark-800 px-2 py-1 text-xs text-[#c4cad8]"
                >
                  <EmojiDisplay emoji={reaction.emoji} size={14} />
                  <span>1</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
