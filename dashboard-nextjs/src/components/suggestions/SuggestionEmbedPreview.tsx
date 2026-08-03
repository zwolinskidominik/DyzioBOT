"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

export type SuggestionVotingFormat = "counts" | "percent" | "bar";

export interface SuggestionPreviewSettings {
  votingFormat: SuggestionVotingFormat;
  anonymous: boolean;
  embedColor: string;
}

/** Przykładowe głosy używane wyłącznie do celów podglądu. */
const SAMPLE_UPVOTES = 12;
const SAMPLE_DOWNVOTES = 2;

/** Live, illustrative preview of the suggestion embed posted to Discord. */
export function SuggestionEmbedPreview({ votingFormat, anonymous, embedColor }: SuggestionPreviewSettings) {
  const [timestamp, setTimestamp] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setTimestamp(`dziś o ${now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`);
  }, []);

  const total = SAMPLE_UPVOTES + SAMPLE_DOWNVOTES;
  const upPercent = total ? Math.round((SAMPLE_UPVOTES / total) * 100) : 0;
  const downPercent = 100 - upPercent;

  return (
    <div className="rounded-md bg-[#313338] p-4">
      <div className="flex gap-3">
        <Image src="/deezy.png" alt="Deezy" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-white/90">Deezy</span>
            <span className="rounded bg-[#5865f2] px-1 py-0.5 text-[10px] font-bold leading-none text-white">
              APP
            </span>
            <span className="text-xs text-[#8d94a8]">{timestamp ?? " "}</span>
          </div>

          <div
            className="space-y-2.5 rounded border-l-4 bg-[#2b2d31] py-2.5 pl-3 pr-3"
            style={{ borderColor: embedColor || "#4C4C54" }}
          >
            {anonymous ? (
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#949ba4]">
                🕵️ Zgłoszenie anonimowe
              </p>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-4 shrink-0 rounded-full bg-[#5865f2]" />
                <span className="text-xs font-medium text-[#c4cad8]">maja_gg</span>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#949ba4]">Sugestia</p>
              <p className="text-sm text-white/90">Dodać kanał głosowy do gier planszowych</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#949ba4]">Głosy</p>

              {votingFormat === "counts" && (
                <p className="text-xs text-[#c4cad8]">
                  👍 {SAMPLE_UPVOTES} głosów na tak • 👎 {SAMPLE_DOWNVOTES} głosów na nie
                </p>
              )}

              {votingFormat === "percent" && (
                <p className="text-xs text-[#c4cad8]">
                  👍 {upPercent}% na tak • 👎 {downPercent}% na nie
                </p>
              )}

              {votingFormat === "bar" && (
                <div className="space-y-1">
                  <p className="text-xs text-[#c4cad8]">
                    👍 {SAMPLE_UPVOTES} głosów na tak ({upPercent}%) • 👎 {SAMPLE_DOWNVOTES} głosów na nie ({downPercent}%)
                  </p>
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-[#43454b]">
                    <div className="h-full rounded-full bg-[#3ba55d]" style={{ width: `${upPercent}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex items-center gap-1.5 rounded-md border border-[#1f2024] bg-[#2b2d31] px-3 py-1.5 text-xs text-[#c4cad8]">
              <ThumbsUp className="h-3.5 w-3.5" />
              Za
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-[#1f2024] bg-[#2b2d31] px-3 py-1.5 text-xs text-[#c4cad8]">
              <ThumbsDown className="h-3.5 w-3.5" />
              Przeciw
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
