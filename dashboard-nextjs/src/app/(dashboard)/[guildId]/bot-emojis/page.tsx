"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { OWNER_IDS } from "@/lib/owner";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideIn } from "@/components/ui/animated";
import { toast } from "sonner";
import {
  Lock,
  Plus,
  X,
  Search,
  Upload,
  Loader2,
  SmilePlus,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Copy,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ────────────────────────────────────────────────── */

interface DiscordEmoji {
  id: string;
  name: string;
  animated: boolean;
  managed: boolean;
  require_colons: boolean;
  /** Ścieżka klucza w src/config/bot.ts (np. "faceit.levels.1") — null, gdy emoji nie jest wpięte w config bota. */
  key: string | null;
  group: string | null;
  groupLabel: string | null;
}

type SortMode = "name" | "group" | "type";

/* ── Helpers ──────────────────────────────────────────────── */

function emojiUrl(emoji: Pick<DiscordEmoji, "id" | "animated">): string {
  const ext = emoji.animated ? "gif" : "png";
  return `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=64&quality=lossless`;
}

function emojiCode(emoji: Pick<DiscordEmoji, "id" | "name" | "animated">): string {
  return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Nazwa zaczynająca się cyfrą jest niewygodna do wpisania w Discordzie i nieczytelna w kodzie. */
function hasOddName(name: string): boolean {
  return /^[0-9]/.test(name);
}

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const PAGE_SIZE_OPTIONS = [8, 15, 30];

/* ── Component ────────────────────────────────────────────── */

export default function BotEmojisPage() {
  const { data: session, status } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;
  const isOwner = status !== "loading" && OWNER_IDS.includes(currentUserId ?? "");

  const [emojis, setEmojis] = useState<DiscordEmoji[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [emojiName, setEmojiName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [sort, setSort] = useState<SortMode>("name");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Data fetching ── */

  const fetchEmojis = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/bot-emojis/manage`);
      if (!res.ok) throw new Error(await res.text());
      const data: DiscordEmoji[] = await res.json();
      setEmojis(data);
      setSelectedId((prev) => (prev && data.some((e) => e.id === prev) ? prev : data[0]?.id ?? null));
    } catch {
      toast.error("Nie udało się pobrać emoji");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOwner) fetchEmojis();
  }, [isOwner, fetchEmojis]);

  useEffect(() => () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  }, []);

  /* ── File pick ── */

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Dozwolone formaty: PNG, JPG, GIF, WebP");
      return;
    }
    if (file.size > 262144) {
      toast.error("Plik jest za duży (max 256 KB)");
      return;
    }

    try {
      const uri = await fileToDataUri(file);
      setImageData(uri);
      setPreviewUrl(uri);
    } catch {
      toast.error("Nie udało się odczytać pliku");
    }
  };

  const resetForm = () => {
    setEmojiName("");
    setImageData(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ── Upload ── */

  const handleUpload = async () => {
    if (!emojiName || !imageData) {
      toast.error("Podaj nazwę i wybierz plik");
      return;
    }
    if (!/^[a-zA-Z0-9_]{2,32}$/.test(emojiName)) {
      toast.error("Nazwa: 2–32 znaki, tylko litery / cyfry / podkreślenie");
      return;
    }
    if (emojis.some((e) => e.name.toLowerCase() === emojiName.toLowerCase())) {
      toast.error("Emoji o tej nazwie już istnieje");
      return;
    }

    setUploading(true);
    try {
      const res = await fetchWithAuth("/api/bot-emojis/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: emojiName, image: imageData }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "Błąd API" }))) as { error?: string };
        toast.error(err.error ?? "Nie udało się dodać emoji");
        return;
      }

      const created = (await res.json()) as DiscordEmoji;
      toast.success(`Emoji :${emojiName}: zostało dodane!`);
      resetForm();
      setFormOpen(false);
      setSearch("");
      setGroupFilter("");
      setPage(1);
      await fetchEmojis();
      setSelectedId(created.id ?? null);
    } catch {
      toast.error("Błąd połączenia");
    } finally {
      setUploading(false);
    }
  };

  /* ── Delete ── */

  const armDelete = (id: string) => {
    setConfirmDeleteId(id);
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3000);
  };

  const handleDelete = async (emoji: DiscordEmoji) => {
    if (emoji.key) {
      toast.error(`To emoji jest w konfiguracji bota (${emoji.key}) — usuń najpierw odwołanie w kodzie`);
      setConfirmDeleteId(null);
      return;
    }

    if (confirmDeleteId !== emoji.id) {
      armDelete(emoji.id);
      return;
    }

    setConfirmDeleteId(null);
    setDeletingId(emoji.id);
    try {
      const res = await fetchWithAuth(`/api/bot-emojis/manage?id=${emoji.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "Błąd API" }))) as { error?: string };
        toast.error(err.error ?? "Nie udało się usunąć emoji");
        return;
      }
      toast.success(`Usunięto emoji :${emoji.name}:`);
      setEmojis((prev) => prev.filter((e) => e.id !== emoji.id));
    } catch {
      toast.error("Błąd połączenia");
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Copy ── */

  const handleCopy = async (emoji: DiscordEmoji) => {
    setSelectedId(emoji.id);
    const ok = await copyToClipboard(emojiCode(emoji));
    if (ok) toast.success(`Skopiowano kod :${emoji.name}:`);
    else toast.error("Nie udało się skopiować");
  };

  /* ── Derived list ── */

  const staticCount = emojis.filter((e) => !e.animated).length;
  const animatedCount = emojis.filter((e) => e.animated).length;

  const groupOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const e of emojis) {
      const id = e.group ?? "none";
      const label = e.groupLabel ?? "Bez odwołania";
      const existing = counts.get(id);
      if (existing) existing.count += 1;
      else counts.set(id, { label, count: 1 });
    }
    return Array.from(counts.entries()).map(([id, v]) => ({ id, ...v }));
  }, [emojis]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = emojis.filter((e) => {
      const groupId = e.group ?? "none";
      if (groupFilter && groupId !== groupFilter) return false;
      if (!q) return true;
      return (e.name + " " + (e.key ?? "") + " " + (e.groupLabel ?? "")).toLowerCase().includes(q);
    });

    list = [...list];
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "pl"));
    else if (sort === "group") {
      list.sort(
        (a, b) =>
          (a.groupLabel ?? "Bez odwołania").localeCompare(b.groupLabel ?? "Bez odwołania", "pl") ||
          a.name.localeCompare(b.name, "pl")
      );
    } else {
      list.sort((a, b) => (b.animated ? 1 : 0) - (a.animated ? 1 : 0) || a.name.localeCompare(b.name, "pl"));
    }
    return list;
  }, [emojis, search, groupFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, pageCount);
  const pageSlice = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const selected = emojis.find((e) => e.id === selectedId) ?? emojis[0] ?? null;

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const windowSize = 2;
    for (let i = Math.max(1, currentPage - windowSize); i <= Math.min(pageCount, currentPage + windowSize); i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, pageCount]);

  const hasActiveFilters = Boolean(search || groupFilter);

  /* ── Access guards ── */

  if (status === "loading") {
    return (
      <div className="min-h-full">
        <div className="w-full space-y-5">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-24 w-full rounded-md bg-dark-800" />
          <Skeleton className="h-96 w-full rounded-md bg-dark-800" />
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <div className="text-6xl">🔒</div>
        <h1 className="text-2xl font-bold">Moduł niedostępny</h1>
        <p className="text-muted-foreground">Ta funkcja jest dostępna wyłącznie dla właścicieli bota.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-16">
      <div className="w-full space-y-3.5">
        <SlideIn direction="up" delay={100}>
          <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
                <SmilePlus className="h-6 w-6 text-bot-primary" />
                Emoji Bota
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                Niestandardowe emoji dostępne we wszystkich komendach i modułach. Widać kod do wklejenia
                i klucz konfiguracji, który się do emoji odwołuje.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">
                <Lock className="h-3.5 w-3.5" />
                Tylko właściciel bota
              </span>
              <button
                type="button"
                onClick={() => setFormOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold text-white transition-colors",
                  formOpen ? "bg-[#3a3f4e] hover:bg-[#454a5c]" : "bg-[#6366f1] hover:bg-[#818cf8]"
                )}
              >
                {formOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {formOpen ? "Zamknij" : "Dodaj emoji"}
              </button>
            </div>
          </header>
        </SlideIn>

        {loading ? (
          <Skeleton className="h-96 w-full rounded-md bg-dark-800" />
        ) : (
          <>
            <SlideIn direction="up" delay={130}>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-[10px] bg-dark-800 px-4 py-3.5">
                  <div className="text-[22px] font-extrabold text-white">{emojis.length}</div>
                  <div className="mt-0.5 text-[11px] text-[#8d94a8]">emoji w zasobach bota</div>
                </div>
                <div className="rounded-[10px] bg-dark-800 px-4 py-3.5">
                  <div className="text-[22px] font-extrabold text-[#a5b4fc]">{staticCount}</div>
                  <div className="mt-0.5 text-[11px] text-[#8d94a8]">statyczne</div>
                </div>
                <div className="rounded-[10px] bg-dark-800 px-4 py-3.5">
                  <div className="text-[22px] font-extrabold text-[#f9a8d4]">{animatedCount}</div>
                  <div className="mt-0.5 text-[11px] text-[#8d94a8]">animowane (GIF)</div>
                </div>
              </div>
            </SlideIn>

            {formOpen && (
              <SlideIn direction="up" delay={100}>
                <div
                  className="rounded-[10px] border p-5"
                  style={{ background: "#1F2129", borderColor: "rgba(99,102,241,0.4)", boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}
                >
                  <div className="mb-3.5 text-[13px] font-bold text-[#d8dbe6]">Dodaj nowe emoji</div>
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#c4cad8]">
                        Nazwa <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={emojiName}
                        onChange={(e) => setEmojiName(e.target.value)}
                        placeholder="np. dyzio_gg"
                        maxLength={32}
                        className="h-10 w-full rounded-md border border-[#2f3341] bg-dark-900 px-3 text-[13px] text-[#d8dbe6] outline-none transition-colors placeholder:text-[#6b7280] hover:border-[#3b82f6]/55 focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1]/45"
                      />
                      <p className="mt-1.5 text-[11px] text-[#6b7280]">2–32 znaki: litery, cyfry, podkreślenie (_)</p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#c4cad8]">
                        Obraz <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className={cn(
                            "flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-dashed px-3 text-left text-xs transition-colors",
                            imageData ? "border-[#6366f1]/60 text-white" : "border-[#3a3f4e] text-[#8d94a8] hover:border-[#6366f1] hover:text-white"
                          )}
                        >
                          <Upload className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 truncate">
                            {imageData ? "Plik wybrany" : "Wybierz plik z dysku"}
                          </span>
                        </button>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#2f3341] bg-dark-900">
                          {previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={previewUrl} alt="podgląd" className="h-6 w-6 rounded object-contain" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-[#6b7280]" />
                          )}
                        </span>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <p className="mt-1.5 text-[11px] text-[#6b7280]">PNG, JPG, GIF, WebP — max 256 KB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={uploading || !emojiName || !imageData}
                    className="mt-3.5 flex h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-[#6366f1] text-[13px] font-semibold text-white transition-colors hover:bg-[#818cf8] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Dodawanie...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Dodaj emoji
                      </>
                    )}
                  </button>
                </div>
              </SlideIn>
            )}

            <SlideIn direction="up" delay={160}>
              <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-dark-800 px-3.5 py-3">
                <div className="flex h-[34px] min-w-[200px] flex-1 items-center gap-2.5 rounded-md border border-[#2f3341] bg-dark-900 px-3">
                  <Search className="h-3.5 w-3.5 shrink-0 text-[#6b7280]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Szukaj emoji po nazwie lub kluczu konfiguracji…"
                    className="min-w-0 flex-1 border-none bg-transparent text-xs text-[#d8dbe6] outline-none placeholder:text-[#6b7280]"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => { setSearch(""); setPage(1); }}
                      title="Wyczyść"
                      className="text-[#6b7280] transition-colors hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <Select value={groupFilter || "all"} onValueChange={(v) => { setGroupFilter(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-[34px] w-[190px] border-[#2f3341] bg-dark-900 text-xs text-white/90">
                    <SelectValue placeholder="Wszystkie grupy" />
                  </SelectTrigger>
                  <SelectContent className="border-[#2f3341] bg-dark-900">
                    <SelectItem value="all">Wszystkie grupy</SelectItem>
                    {groupOptions.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.label} · {g.count}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sort} onValueChange={(v) => { setSort(v as SortMode); setPage(1); }}>
                  <SelectTrigger className="h-[34px] w-[190px] border-[#2f3341] bg-dark-900 text-xs text-white/90">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#2f3341] bg-dark-900">
                    <SelectItem value="name">Nazwa A–Z</SelectItem>
                    <SelectItem value="group">Grupa konfiguracji</SelectItem>
                    <SelectItem value="type">Typ (GIF najpierw)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </SlideIn>

            {emojis.length === 0 ? (
              <SlideIn direction="up" delay={190}>
                <div className="rounded-[10px] bg-dark-800 py-16 text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-dark-900">
                    <SmilePlus className="h-10 w-10 text-[#6b7280]" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-white">Brak emoji</h3>
                  <p className="mx-auto max-w-sm text-sm text-[#8d94a8]">
                    Dodaj pierwsze emoji korzystając z przycisku „Dodaj emoji" powyżej.
                  </p>
                </div>
              </SlideIn>
            ) : (
              <SlideIn direction="up" delay={190}>
                <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_320px]">
                  {/* Tabela */}
                  <div className="overflow-hidden rounded-[10px] bg-dark-800" style={{ boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
                    <div className="grid grid-cols-[56px_minmax(0,1fr)_180px_76px] gap-3 border-b border-[#2f3341] px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[#5f6b85]">
                      <span />
                      <span>Nazwa</span>
                      <span>Klucz w konfiguracji</span>
                      <span />
                    </div>

                    {pageSlice.map((e) => {
                      const on = e.id === selectedId;
                      const isConfirming = confirmDeleteId === e.id;
                      return (
                        <div
                          key={e.id}
                          className="grid grid-cols-[56px_minmax(0,1fr)_180px_76px] items-center gap-3 border-b border-[#23252f] px-4 py-3"
                          style={{ background: on ? "rgba(99,102,241,0.12)" : "transparent", borderLeft: `3px solid ${on ? "#6366f1" : "transparent"}` }}
                        >
                          <button type="button" onClick={() => setSelectedId(e.id)} title="Pokaż szczegóły" className="flex items-center justify-center border-none bg-transparent p-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={emojiUrl(e)} alt={e.name} className="h-10 w-10 rounded object-contain" />
                          </button>
                          <button type="button" onClick={() => setSelectedId(e.id)} className="block min-w-0 border-none bg-transparent p-0 text-left">
                            <span className={cn("block truncate text-base font-semibold", on ? "text-white" : "text-[#d8dbe6]")}>
                              :{e.name}:
                            </span>
                            <span className={cn("mt-0.5 block text-xs", e.animated ? "text-[#f9a8d4]" : hasOddName(e.name) ? "text-[#fcd34d]" : "text-[#6b7280]")}>
                              {e.animated ? "GIF · animowane" : hasOddName(e.name) ? "⚠ nietypowa nazwa" : "PNG · statyczne"}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedId(e.id)}
                            className={cn("block min-w-0 truncate border-none bg-transparent p-0 text-left font-mono text-xs", e.key ? "text-[#9cc2ff]" : "text-[#4b5563]")}
                          >
                            {e.key || "brak odwołania"}
                          </button>
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCopy(e)}
                              title="Kopiuj kod"
                              className="flex h-8 w-8 items-center justify-center rounded-md text-[#6b7280] transition-colors hover:bg-[rgba(99,102,241,0.15)] hover:text-[#a5b4fc]"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(e)}
                              disabled={deletingId === e.id}
                              title={isConfirming ? "Kliknij ponownie, aby potwierdzić" : "Usuń emoji"}
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-50",
                                isConfirming ? "bg-red-500/20 text-red-400" : "text-[#6b7280] hover:bg-red-500/10 hover:text-red-400"
                              )}
                            >
                              {deletingId === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {filtered.length === 0 && (
                      <div className="px-4 py-9 text-center text-sm text-[#8d94a8]">
                        Brak emoji pasujących do filtrów.
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5">
                      <span className="text-[11px] text-[#6b7280]">
                        {filtered.length
                          ? `${(currentPage - 1) * perPage + 1}–${Math.min(currentPage * perPage, filtered.length)} z ${filtered.length} ${plural(filtered.length, "emoji", "emoji", "emoji")}`
                          : "brak wyników"}
                      </span>
                      <span className="flex-1" />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage <= 1}
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[#2f3341] text-[#c4cad8] transition-colors hover:border-[#6366f1] disabled:cursor-default disabled:text-[#4b5563] disabled:hover:border-[#2f3341]"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        {pageNumbers.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setPage(n)}
                            className={cn(
                              "flex h-[26px] min-w-[26px] items-center justify-center rounded-md border px-1 text-[11px] transition-colors hover:border-[#6366f1]",
                              n === currentPage ? "border-[#6366f1] bg-[rgba(99,102,241,0.15)] font-bold text-white" : "border-[#2f3341] font-medium text-[#b9c0d0]"
                            )}
                          >
                            {n}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                          disabled={currentPage >= pageCount}
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[#2f3341] text-[#c4cad8] transition-colors hover:border-[#6366f1] disabled:cursor-default disabled:text-[#4b5563] disabled:hover:border-[#2f3341]"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
                        <SelectTrigger className="h-[26px] w-[104px] border-[#2f3341] bg-transparent text-[11px] text-[#b9c0d0]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-[#2f3341] bg-dark-900">
                          {PAGE_SIZE_OPTIONS.map((n) => (
                            <SelectItem key={n} value={String(n)}>{n} / stronę</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Szczegóły */}
                  <div className="sticky top-4 rounded-[10px] bg-dark-900 px-5 py-4" style={{ boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
                    <div className="mb-3.5 text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">Szczegóły emoji</div>

                    {selected ? (
                      <>
                        <div className="flex items-center justify-center rounded-lg bg-dark-800 p-8">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={emojiUrl(selected)} alt={selected.name} className="h-24 w-24 object-contain" />
                        </div>
                        <div className="mt-3.5 text-lg font-bold text-white">:{selected.name}:</div>

                        <div className="mt-3 flex flex-col gap-2">
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="shrink-0 text-[#6b7280]">Typ</span>
                            <span className={cn("min-w-0 text-right font-semibold", selected.animated ? "text-[#f9a8d4]" : "text-[#b9c0d0]")}>
                              {selected.animated ? "GIF · animowane" : "PNG · statyczne"}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="shrink-0 text-[#6b7280]">ID</span>
                            <span className="min-w-0 truncate text-right font-mono text-[#b9c0d0]">{selected.id}</span>
                          </div>
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="shrink-0 text-[#6b7280]">Grupa</span>
                            <span className="min-w-0 text-right text-[#b9c0d0]">{selected.groupLabel ?? "Bez odwołania"}</span>
                          </div>
                          <div className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="shrink-0 text-[#6b7280]">Klucz</span>
                            <span className="min-w-0 truncate text-right font-mono text-[#9cc2ff]">{selected.key ?? "brak odwołania"}</span>
                          </div>
                        </div>

                        <div className="mt-3.5 border-t border-[#2f3341] pt-3">
                          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[#5f6b85]">Kod do wiadomości</div>
                          <button
                            type="button"
                            onClick={() => handleCopy(selected)}
                            className="flex w-full items-center gap-2 rounded-md border border-[#2f3341] bg-[#101116] px-3 py-2.5 text-left transition-colors hover:border-[#6366f1]"
                          >
                            <span className="min-w-0 flex-1 truncate font-mono text-sm text-[#9cc2ff]">{emojiCode(selected)}</span>
                            <Copy className="h-4 w-4 shrink-0 text-[#a5b4fc]" />
                          </button>
                        </div>

                        {selected.key ? (
                          <div className="mt-3 flex items-start gap-2 rounded-md bg-red-500/[0.08] px-3 py-2.5 text-xs leading-6 text-red-300">
                            <span className="shrink-0">⚠️</span>
                            <span>
                              Emoji jest wpisane w <span className="font-mono">config/bot.ts</span> — usunięcie zepsuje {selected.groupLabel}.
                            </span>
                          </div>
                        ) : (
                          <div className="mt-3 flex items-start gap-2 rounded-md bg-dark-800 px-3 py-2.5 text-xs leading-6 text-[#8d94a8]">
                            <span className="shrink-0">ℹ️</span>
                            <span>Żadna część konfiguracji nie odwołuje się do tego emoji — można je usunąć bez ryzyka.</span>
                          </div>
                        )}
                        {hasOddName(selected.name) && (
                          <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-500/[0.08] px-3 py-2.5 text-xs leading-6 text-amber-300">
                            <span className="shrink-0">⚠️</span>
                            <span>Nazwa zaczyna się cyfrą — trudna do wpisania w Discordzie i nieczytelna w kodzie.</span>
                          </div>
                        )}

                        <div className="mt-3.5 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(selected)}
                            className="flex-1 rounded-md border border-[#2f3341] py-2.5 text-xs font-semibold text-[#c4cad8] transition-colors hover:bg-dark-800 hover:text-white"
                          >
                            ⧉ Kopiuj kod
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(selected)}
                            disabled={deletingId === selected.id}
                            title="Usuń emoji"
                            className={cn(
                              "shrink-0 rounded-md border px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50",
                              confirmDeleteId === selected.id
                                ? "border-red-500/60 bg-red-500/15 text-red-300"
                                : "border-red-500/40 text-red-300 hover:bg-red-500/10"
                            )}
                          >
                            {confirmDeleteId === selected.id ? "Na pewno?" : "🗑"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="py-8 text-center text-sm text-[#6b7280]">Brak emoji do wyświetlenia</p>
                    )}
                  </div>
                </div>
              </SlideIn>
            )}
          </>
        )}
      </div>
    </div>
  );
}
