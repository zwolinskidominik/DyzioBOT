"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { OWNER_IDS } from "@/lib/owner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Search, Lock, Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WordleCategory {
  length: number;
  words: string[];
  wordCount: number;
}

interface WordleData {
  categories: WordleCategory[];
  totalWords: number;
}

const ALL_LENGTHS = [5, 6, 7];
const POLISH_REGEX = /^[a-ząćęłńóśźż]+$/;

const inputClass =
  "h-11 border border-[#3f4455] bg-dark-900 text-white/90 placeholder:text-[#9aa2b8] focus-visible:border-[#3b82f6] focus-visible:ring-[#3b82f6]/30 focus-visible:ring-offset-0";

/** Kafelki w stylu Wordle układające się w napis „SŁOWA" — jedyny element hero, który zachowuje kolory gry. */
const HERO_TILES: { letter: string; color: string }[] = [
  { letter: "S", color: "#22c55e" },
  { letter: "Ł", color: "#2f3341" },
  { letter: "O", color: "#f59e0b" },
  { letter: "W", color: "#22c55e" },
  { letter: "A", color: "#2f3341" },
];

/** Grupuje słowa alfabetycznie (polska kolejność sortowania) — identycznie jak w module Wisielec. */
function groupWordsByLetter(words: string[]): { letter: string; words: string[] }[] {
  const sorted = [...words].sort((a, b) => a.localeCompare(b, "pl"));
  const groups: { letter: string; words: string[] }[] = [];
  for (const word of sorted) {
    const letter = word.charAt(0).toUpperCase();
    let group = groups[groups.length - 1];
    if (!group || group.letter !== letter) {
      group = { letter, words: [] };
      groups.push(group);
    }
    group.words.push(word);
  }
  return groups;
}

export default function WordlePage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { data: session, status } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;

  if (status !== 'loading' && !OWNER_IDS.includes(currentUserId ?? '')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <p className="text-4xl">🔒</p>
        <h2 className="text-xl font-semibold">Brak dostępu</h2>
        <p className="text-muted-foreground text-sm">Ten moduł jest dostępny wyłącznie dla właściciela bota.</p>
      </div>
    );
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WordleData | null>(null);
  const [search, setSearch] = useState("");
  const [selectedLength, setSelectedLength] = useState<number>(5);

  const [newWord, setNewWord] = useState("");
  const [wordError, setWordError] = useState("");
  const [savingWord, setSavingWord] = useState(false);
  const wordInputRef = useRef<HTMLInputElement>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{ word: string; length: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetchWithAuth(`/api/guild/${guildId}/wordle`);
      if (!res.ok) throw new Error("Nie udało się pobrać danych");
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się załadować danych");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allCategories = useMemo((): WordleCategory[] => {
    const existing = data?.categories ?? [];
    return ALL_LENGTHS.map((len) => existing.find((c) => c.length === len) ?? { length: len, words: [], wordCount: 0 });
  }, [data]);

  const normalizedSearch = search.toLowerCase().trim();

  const filteredCategories = useMemo(() => {
    if (!normalizedSearch) return allCategories;
    return allCategories
      .map((cat) => {
        const words = cat.words.filter((w) => w.includes(normalizedSearch));
        return { ...cat, words, wordCount: words.length };
      })
      .filter((cat) => cat.wordCount > 0);
  }, [allCategories, normalizedSearch]);

  const totalMatchingWords = useMemo(
    () => filteredCategories.reduce((sum, c) => sum + c.wordCount, 0),
    [filteredCategories]
  );

  // Utrzymuj wybraną długość w zbiorze widocznych wyników; domyślnie pierwsza dostępna.
  useEffect(() => {
    if (filteredCategories.length === 0) return;
    if (!filteredCategories.some((c) => c.length === selectedLength)) {
      setSelectedLength(filteredCategories[0].length);
    }
  }, [filteredCategories, selectedLength]);

  const selectedCategoryData = useMemo(
    () => allCategories.find((c) => c.length === selectedLength) ?? null,
    [allCategories, selectedLength]
  );

  const visibleWords = useMemo(() => {
    if (!selectedCategoryData) return [];
    if (!normalizedSearch) return selectedCategoryData.words;
    const filtered = filteredCategories.find((c) => c.length === selectedCategoryData.length);
    return filtered ? filtered.words : [];
  }, [selectedCategoryData, filteredCategories, normalizedSearch]);

  const groupedWords = useMemo(() => groupWordsByLetter(visibleWords), [visibleWords]);

  const selectedLengthCount = allCategories.find((c) => c.length === selectedLength)?.wordCount ?? 0;

  const handleAddWord = async () => {
    const word = newWord.trim().toLowerCase();
    if (!word) return;

    if (!POLISH_REGEX.test(word)) {
      setWordError("Tylko polskie litery (bez q, v, x)");
      return;
    }
    if (word.length !== selectedLength) {
      setWordError(`Słowo musi mieć dokładnie ${selectedLength} liter`);
      return;
    }

    setSavingWord(true);
    setWordError("");

    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/wordle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addWord", word }),
      });
      const json = await res.json();
      if (!res.ok) {
        setWordError(json.error || "Błąd");
        return;
      }
      setNewWord("");
      await fetchData(true);
      requestAnimationFrame(() => wordInputRef.current?.focus());
    } catch {
      setWordError("Błąd połączenia");
    } finally {
      setSavingWord(false);
    }
  };

  const handleRemoveWord = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await fetchWithAuth(`/api/guild/${guildId}/wordle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "removeWord", word: deleteConfirm.word }),
      });
      setDeleteConfirm(null);
      await fetchData(true);
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="w-full space-y-5">
          <div className="flex items-start justify-between gap-6 pb-2">
            <div className="space-y-3"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-[420px] max-w-full" /></div>
            <Skeleton className="h-7 w-40 rounded-full" />
          </div>
          <Skeleton className="h-24 w-full rounded-md bg-dark-800" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 w-full rounded-md bg-dark-800" />
            <Skeleton className="h-20 w-full rounded-md bg-dark-800" />
            <Skeleton className="h-20 w-full rounded-md bg-dark-800" />
          </div>
          <Skeleton className="h-11 w-full rounded-md bg-dark-800" />
          <Skeleton className="h-72 w-full rounded-md bg-dark-800" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <ErrorState
            title="Błąd ładowania"
            message={error || "Nie udało się załadować danych Wordle"}
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-32">
      <div className="w-full space-y-5">
        <SlideIn delay={0}>
          <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold text-white">Wordle</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                Zarządzaj polskimi słowami do gry /wordle. Słowa podzielone według liczby liter (5–7).
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">
              <Lock className="h-3.5 w-3.5" />
              Tylko właściciel bota
            </span>
          </header>
        </SlideIn>

        <SlideIn delay={50}>
          <div
            className="relative flex flex-wrap items-center gap-6 overflow-hidden rounded-[10px] px-6 py-5"
            style={{ background: "linear-gradient(120deg, #1d3324 0%, #1F2129 55%, #1F2129 100%)", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            <div
              className="pointer-events-none absolute -right-5 -top-5 h-40 w-40 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(245,158,11,0.18), transparent 70%)" }}
            />
            <div className="relative flex gap-[5px]">
              {HERO_TILES.map((tile, i) => (
                <span
                  key={i}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-lg font-extrabold text-white"
                  style={{ backgroundColor: tile.color }}
                >
                  {tile.letter}
                </span>
              ))}
            </div>
            <div className="relative grid flex-1 grid-cols-2 gap-3" style={{ minWidth: "260px" }}>
              <div>
                <p className="text-2xl font-extrabold text-white">{data.totalWords}</p>
                <p className="text-[11px] text-[#8d94a8]">wszystkich słów</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold" style={{ color: "#86efac" }}>{selectedLengthCount}</p>
                <p className="text-[11px] text-[#8d94a8]">
                  {selectedLength}-literowych{selectedLength === 5 ? " (standard)" : ""}
                </p>
              </div>
            </div>
          </div>
        </SlideIn>

        <SlideIn delay={90}>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {ALL_LENGTHS.map((len) => {
              const cat = allCategories.find((c) => c.length === len);
              const isActive = len === selectedLength;
              return (
                <button
                  key={len}
                  type="button"
                  onClick={() => { setSelectedLength(len); setWordError(""); }}
                  className="rounded-[10px] px-4 py-4 text-center transition-colors hover:border-[rgba(99,102,241,0.6)]"
                  style={{ background: "#1F2129", border: isActive ? "1px solid rgba(99,102,241,0.4)" : "1px solid transparent" }}
                >
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md font-mono text-lg font-extrabold text-white"
                    style={{ backgroundColor: isActive ? "#6366f1" : "#2f3341" }}
                  >
                    {len}
                  </span>
                  <div className={cn("mt-2 flex items-center justify-center gap-1.5 text-[13px] font-bold", isActive ? "text-white" : "text-[#c4cad8]")}>
                    {len}-literowe
                    {len === 5 ? (
                      <span className="rounded border border-[#2f3341] px-1.5 py-px text-[9px] font-semibold text-[#9aa2b8]">standard</span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#8d94a8]">{cat?.wordCount ?? 0} słów</div>
                </button>
              );
            })}
          </div>
        </SlideIn>

        <SlideIn delay={120}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d94a8]" />
            <Input
              placeholder="Szukaj słowa we wszystkich długościach..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(inputClass, "pl-9")}
            />
          </div>
          {normalizedSearch ? (
            <p className="mt-2 text-xs text-[#8d94a8]">
              Znaleziono <span className="font-semibold text-white/90">{totalMatchingWords}</span> słów w{" "}
              <span className="font-semibold text-white/90">{filteredCategories.length}</span>{" "}
              {filteredCategories.length === 1 ? "długości" : "długościach"} dla „{search}"
            </p>
          ) : null}
        </SlideIn>

        {filteredCategories.length === 0 ? (
          <div className="rounded-md bg-dark-800 py-16 text-center">
            <Search className="mx-auto mb-3 h-10 w-10 text-[#8d94a8] opacity-50" />
            <p className="text-sm text-[#8d94a8]">Nie znaleziono słów pasujących do „{search}"</p>
          </div>
        ) : (
          <SlideIn delay={150}>
            <div className="rounded-md bg-dark-800 p-5">
              <h2 className="text-base font-semibold text-white">
                Słowa {selectedLength}-literowe{" "}
                <span className="ml-1 text-xs font-normal text-[#8d94a8]">{selectedCategoryData?.wordCount ?? 0} słów</span>
              </h2>

              <div className="mt-4 flex gap-2">
                <Input
                  ref={wordInputRef}
                  placeholder="Dodaj nowe słowo... (Enter)"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddWord(); }}
                  maxLength={selectedLength}
                  className={cn(inputClass, "flex-1")}
                />
                <Button
                  type="button"
                  onClick={handleAddWord}
                  disabled={savingWord}
                  className="shrink-0 bg-[#3b82f6] text-white hover:bg-[#2563eb]"
                >
                  {savingWord ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Dodaj
                </Button>
              </div>
              {wordError ? <p className="mt-1.5 text-xs text-destructive">{wordError}</p> : null}
              <p className="mt-1.5 text-[11px] text-[#6f7690]">
                Tylko polskie litery (a–ż), bez q, v, x, dokładnie {selectedLength} znaków.
              </p>

              {groupedWords.length === 0 ? (
                <p className="mt-4 text-sm text-[#8d94a8]">Ta długość nie ma jeszcze żadnych słów.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {groupedWords.map((group) => (
                    <div key={group.letter}>
                      <p className="text-xs font-bold uppercase text-[#818cf8]">{group.letter}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {group.words.map((word) => {
                          const isHighlighted = Boolean(normalizedSearch) && word.includes(normalizedSearch);
                          return (
                            <span
                              key={word}
                              className={cn(
                                "group inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                                isHighlighted ? "bg-[#3b82f6]/25 font-medium text-white" : "bg-dark-900 text-[#c4cad8]"
                              )}
                            >
                              {word}
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm({ word, length: selectedLength })}
                                className="text-[#8d94a8] opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                                aria-label={`Usuń słowo ${word}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SlideIn>
        )}

        {/* Delete confirmation dialog */}
        <Dialog open={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Usuń słowo</DialogTitle>
              <DialogDescription>
                Czy na pewno chcesz usunąć słowo{" "}
                <strong className="font-mono text-foreground">{deleteConfirm?.word}</strong>{" "}
                z listy {deleteConfirm?.length}-literowych? Tej operacji nie można cofnąć.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
                Anuluj
              </Button>
              <Button variant="destructive" onClick={handleRemoveWord} disabled={deleting}>
                {deleting ? "Usuwanie..." : "Usuń"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
