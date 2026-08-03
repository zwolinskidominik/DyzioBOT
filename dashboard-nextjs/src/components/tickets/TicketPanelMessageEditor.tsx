"use client";

import { useState } from "react";
import { ImageOff, Loader2, Save, Smile, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmojiPicker from "@/components/EmojiPicker";
import { EmojiDisplay } from "@/components/EmojiDisplay";
import { cn } from "@/lib/utils";
import { TicketBannerThumbnail } from "./TicketLivePreview";
import { PanelMessagePreview, type PanelMessageDraft } from "./PanelMessagePreview";

const PRESETS: { id: string; label: string }[] = [
  { id: "ticketBanner.png", label: "Domyślny" },
  { id: "ticketReport.png", label: "Zgłoszenie" },
  { id: "ticketPartnership.png", label: "Partnerstwo" },
  { id: "ticketIdea.png", label: "Pomysł" },
];

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const EMPTY_PANEL_MESSAGE: PanelMessageDraft = {
  emoji: "",
  title: "Kontakt z Administracją",
  description: "Aby skontaktować się z wybranym działem administracji, wybierz odpowiednią kategorię poniżej:",
  color: "#5865F2",
  placeholder: "Wybierz odpowiednią kategorię",
  banner: { mode: "preset", presetId: "ticketBanner.png" },
};

interface TicketPanelMessageEditorProps {
  initialMessage: PanelMessageDraft;
  saving: boolean;
  onSave: (draft: PanelMessageDraft) => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Inline editor for the panel message (embed + select menu) sent on deploy.
 * Rendered directly in the page flow (expands/collapses in place) rather
 * than as a modal — mounted fresh each time it's expanded so the draft
 * always starts from the last saved value.
 */
export function TicketPanelMessageEditor({ initialMessage, saving, onSave, onCancel }: TicketPanelMessageEditorProps) {
  const [draft, setDraft] = useState<PanelMessageDraft>({ ...initialMessage, banner: { ...initialMessage.banner } });

  const canSave = draft.title.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    await onSave(draft);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.2fr_1fr]">
        {/* ── Form ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#c4cad8]">Emoji</label>
              <div className="flex items-center gap-1">
                <EmojiPicker
                  onEmojiSelect={(emoji) => setDraft((d) => ({ ...d, emoji }))}
                  trigger={
                    <button
                      type="button"
                      title="Wybierz emoji"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-transparent bg-dark-900 text-white/90 transition-colors hover:border-[#3b82f6]"
                    >
                      {draft.emoji ? (
                        <EmojiDisplay emoji={draft.emoji} size={20} />
                      ) : (
                        <Smile className="h-4 w-4 text-[#8d94a8]" />
                      )}
                    </button>
                  }
                />
                {draft.emoji ? (
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, emoji: "" }))}
                    title="Usuń emoji"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#8d94a8] transition-colors hover:bg-red-500/20 hover:text-red-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#c4cad8]">Tytuł</label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="np. Kontakt z Administracją"
                maxLength={256}
                className="border-transparent bg-dark-900 text-white/90"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#c4cad8]">Opis</label>
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              rows={4}
              placeholder="Krótki opis nad listą typów zgłoszeń"
              className="border-transparent bg-dark-900 text-white/90"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#c4cad8]">Kolor</label>
            <div className="flex items-center gap-2">
              <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-[#2f3341]">
                <input
                  type="color"
                  value={HEX_COLOR_PATTERN.test(draft.color) ? draft.color : "#5865F2"}
                  onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value.toUpperCase() }))}
                  className="absolute -inset-1 h-11 w-11 cursor-pointer border-none bg-transparent p-0"
                />
              </label>
              <Input
                value={draft.color}
                onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                placeholder="#5865F2"
                maxLength={7}
                className="border-transparent bg-dark-900 text-white/90"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#c4cad8]">Placeholder dropdownu</label>
            <Input
              value={draft.placeholder}
              onChange={(e) => setDraft((d) => ({ ...d, placeholder: e.target.value }))}
              placeholder="np. Wybierz odpowiednią kategorię"
              maxLength={150}
              className="border-transparent bg-dark-900 text-white/90"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#c4cad8]">Grafika panelu</label>
            <Tabs
              value={draft.banner.mode}
              onValueChange={(mode) =>
                setDraft((d) => ({
                  ...d,
                  banner:
                    mode === "text"
                      ? { mode: "text", text: d.banner.text ?? d.title }
                      : mode === "none"
                        ? { mode: "none" }
                        : { mode: "preset", presetId: d.banner.presetId ?? "ticketBanner.png" },
                }))
              }
            >
              <TabsList className="bg-dark-900">
                <TabsTrigger value="none">
                  <ImageOff className="mr-1.5 h-3.5 w-3.5" />
                  Brak
                </TabsTrigger>
                <TabsTrigger value="preset">Gotowe</TabsTrigger>
                <TabsTrigger value="text">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Stwórz z tekstu
                </TabsTrigger>
              </TabsList>

              <TabsContent value="none" className="pt-3">
                <p className="rounded-md border border-dashed border-[#2f3341] px-3 py-4 text-center text-xs text-[#8d94a8]">
                  Bez grafiki — panel będzie samym embedem tekstowym z listą typów.
                </p>
              </TabsContent>

              <TabsContent value="preset" className="pt-3">
                <div className="grid grid-cols-4 gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, banner: { mode: "preset", presetId: preset.id } }))}
                      className={cn(
                        "space-y-1 rounded-md border p-1 text-left transition-colors",
                        draft.banner.mode === "preset" && draft.banner.presetId === preset.id
                          ? "border-[#3b82f6]"
                          : "border-[#2f3341] hover:border-[#596276]"
                      )}
                    >
                      <div className="aspect-[3/1] overflow-hidden rounded">
                        <TicketBannerThumbnail banner={{ mode: "preset", presetId: preset.id }} className="h-full w-full" />
                      </div>
                      <p className="truncate text-[11px] text-[#c4cad8]">{preset.label}</p>
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="text" className="space-y-2 pt-3">
                <Input
                  value={draft.banner.text ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, banner: { mode: "text", text: e.target.value } }))}
                  placeholder="Tekst na grafice"
                  maxLength={80}
                  className="border-transparent bg-dark-900 text-white/90"
                />
                <div className="aspect-[3/1] overflow-hidden rounded">
                  <TicketBannerThumbnail
                    banner={{ mode: "text", text: draft.banner.text ?? draft.title }}
                    className="h-full w-full"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* ── Live preview ─────────────────────────────────── */}
        <div className="space-y-2 rounded-md bg-dark-900/30 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#8d94a8]">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Podgląd
          </div>
          <PanelMessagePreview message={draft} />
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-[#2f3341] pt-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="border-[#3a3f4e] bg-transparent text-[#8d94a8] hover:bg-dark-900 hover:text-white"
        >
          Anuluj
        </Button>
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave || saving}
          className="bg-[#3b82f6] text-white hover:bg-[#2563eb]"
        >
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Zapisz
        </Button>
      </div>
    </div>
  );
}
