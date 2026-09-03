"use client";

import { useEffect, useState } from "react";
import { ImageOff, Loader2, Plus, Save, Smile, Sparkles, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmojiPicker from "@/components/EmojiPicker";
import { EmojiDisplay } from "@/components/EmojiDisplay";
import VariableInserter from "@/components/VariableInserter";
import { cn } from "@/lib/utils";
import { TicketLivePreview, TicketBannerThumbnail, DropdownOptionPreview, type TicketTypeDraft } from "./TicketLivePreview";

interface Role {
  id: string;
  name: string;
  color: number;
}

function getRoleColor(color: number): string {
  if (color === 0) return "#99AAB5";
  return `#${color.toString(16).padStart(6, "0")}`;
}

function RoleBadge({ role, onRemove }: { role: Role; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#2f3341] bg-dark-900 px-3 py-2">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: getRoleColor(role.color) }} />
      <span className="min-w-0 truncate text-sm font-medium text-white/90">{role.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#8d94a8] transition-colors hover:bg-red-500/20 hover:text-red-400"
        aria-label={`Usuń rolę ${role.name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function RoleAddSelect({ roles, excludeIds, onAdd }: { roles: Role[]; excludeIds: string[]; onAdd: (id: string) => void }) {
  const available = roles.filter((r) => !excludeIds.includes(r.id));
  return (
    <div className="w-full">
      <Select value="" onValueChange={onAdd}>
        <SelectTrigger className="h-9 border-dashed border-[#596276] bg-dark-900 text-[#8d94a8] hover:border-[#3b82f6] hover:text-white focus:ring-[#3b82f6]/50">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>Dodaj rolę obsługującą…</span>
          </div>
        </SelectTrigger>
        <SelectContent className="border-[#2f3341] bg-dark-900">
          {available.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[#8d94a8]">Brak dostępnych ról</div>
          ) : (
            available.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: getRoleColor(role.color) }} />
                  {role.name}
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

const PRESETS: { id: string; label: string }[] = [
  { id: "ticketBanner.png", label: "Domyślny" },
  { id: "ticketReport.png", label: "Zgłoszenie" },
  { id: "ticketPartnership.png", label: "Partnerstwo" },
  { id: "ticketIdea.png", label: "Pomysł" },
];

const EMPTY_DRAFT: TicketTypeDraft = {
  id: "",
  emoji: "",
  name: "",
  description: "Witaj {user}!\n\nOpisz dokładnie swoją sprawę, a nasz zespół postara się pomóc jak najszybciej.",
  roleIds: [],
  color: "#5865F2",
  banner: { mode: "preset", presetId: "ticketBanner.png" },
  dropdownDescription: "",
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

interface TicketTypeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType: TicketTypeDraft | null;
  roles: Role[];
  saving: boolean;
  onSave: (draft: TicketTypeDraft) => void | Promise<void>;
}

export function TicketTypeDrawer({ open, onOpenChange, initialType, roles, saving, onSave }: TicketTypeDrawerProps) {
  const [draft, setDraft] = useState<TicketTypeDraft>(EMPTY_DRAFT);

  useEffect(() => {
    if (open) {
      setDraft(initialType ? { ...initialType, banner: { ...initialType.banner } } : { ...EMPTY_DRAFT });
    }
  }, [open, initialType]);

  const isEditing = Boolean(initialType);
  const canSave = draft.name.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    await onSave(draft);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-[#2f3341] bg-dark-800 text-white/90">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edytuj typ ticketa" : "Nowy typ ticketa"}</DialogTitle>
          <DialogDescription className="text-[#8d94a8]">
            Skonfiguruj nazwę, opis, role obsługujące i grafikę — podgląd po prawej pokaże efekt od razu.
          </DialogDescription>
        </DialogHeader>

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
                <label className="text-xs font-medium text-[#c4cad8]">Nazwa typu</label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="np. Dział pomocy"
                  maxLength={60}
                  className="border-transparent bg-dark-900 text-white/90"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#c4cad8]">Opis w dropdownie</label>
              <Input
                value={draft.dropdownDescription ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, dropdownDescription: e.target.value }))}
                placeholder="np. Zgłoś problem techniczny"
                maxLength={100}
                className="border-transparent bg-dark-900 text-white/90"
              />
              <p className="text-[11px] text-[#8d94a8]">
                Krótki tekst pod nazwą typu na liście wyboru. Jeśli puste, użyjemy skróconej wiadomości powitalnej.
              </p>
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
              <label className="text-xs font-medium text-[#c4cad8]">Thumbnail (obrazek w rogu embeda)</label>
              <div className="flex items-center gap-2">
                {draft.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.thumbnail}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-dashed border-[#2f3341] text-[#8d94a8]">
                    <ImageOff className="h-4 w-4" />
                  </div>
                )}
                <Input
                  value={draft.thumbnail ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, thumbnail: e.target.value }))}
                  placeholder="https://... (puste = ikona serwera)"
                  maxLength={500}
                  className="border-transparent bg-dark-900 text-white/90"
                />
                {draft.thumbnail ? (
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, thumbnail: "" }))}
                    title="Usuń thumbnail"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-[#8d94a8] transition-colors hover:bg-red-500/20 hover:text-red-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <p className="text-[11px] text-[#8d94a8]">
                Mały obrazek w prawym górnym rogu wiadomości powitalnej. Jeśli puste, pokaże się ikona serwera.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#c4cad8]">Wiadomość powitalna</label>
              <VariableInserter
                value={draft.description}
                onChange={(value) => setDraft((d) => ({ ...d, description: value }))}
                variables={[
                  { name: "Użytkownik", display: "Użytkownik", value: "{user}", description: "Wzmianka osoby otwierającej ticket" },
                ]}
                rows={4}
                placeholder="Użyj {user}, aby wspomnieć osobę otwierającą ticket"
                unstyled
                className="rounded-md border border-transparent bg-dark-900 text-sm leading-6 text-white/90 transition-colors focus:border-[#3b82f6]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#c4cad8]">Rola obsługująca</label>
              {draft.roleIds.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {draft.roleIds.map((id) => {
                    const role = roles.find((r) => r.id === id);
                    if (!role) return null;
                    return (
                      <RoleBadge
                        key={id}
                        role={role}
                        onRemove={() => setDraft((d) => ({ ...d, roleIds: d.roleIds.filter((rid) => rid !== id) }))}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-[#8d94a8]">Brak przypisanych ról — dodaj przynajmniej jedną poniżej.</p>
              )}
              <RoleAddSelect
                roles={roles}
                excludeIds={draft.roleIds}
                onAdd={(id) => setDraft((d) => ({ ...d, roleIds: [...d.roleIds, id] }))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#c4cad8]">Grafika w kanale ticketu</label>
              <Tabs
                value={draft.banner.mode}
                onValueChange={(mode) =>
                  setDraft((d) => ({
                    ...d,
                    banner:
                      mode === "text"
                        ? { mode: "text", text: d.banner.text ?? d.name }
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
                    Bez grafiki — wiadomość powitalna w kanale ticketu będzie samym tekstem.
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
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, banner: { mode: "text", text: e.target.value } }))
                    }
                    placeholder="Tekst na grafice"
                    maxLength={80}
                    className="border-transparent bg-dark-900 text-white/90"
                  />
                  <div className="aspect-[3/1] overflow-hidden rounded">
                    <TicketBannerThumbnail
                      banner={{ mode: "text", text: draft.banner.text ?? draft.name }}
                      className="h-full w-full"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* ── Live preview ─────────────────────────────────── */}
          <div className="space-y-3 rounded-md bg-dark-900/30 p-3">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#8d94a8]">
                Wiersz w dropdownie
              </p>
              <DropdownOptionPreview type={draft} />
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#8d94a8]">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Wiadomość powitalna
              </div>
              <TicketLivePreview type={draft} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
