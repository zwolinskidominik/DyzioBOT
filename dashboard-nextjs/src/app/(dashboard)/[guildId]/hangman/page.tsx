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
import { Search, Lock, Plus, X, Trash2, Pencil, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HangmanCategory {
  name: string;
  emoji: string;
  wordCount: number;
  words: string[];
}

interface HangmanData {
  categories: HangmanCategory[];
  totalWords: number;
  totalCategories: number;
}

const inputClass =
  "h-11 border border-[#3f4455] bg-dark-900 text-white/90 placeholder:text-[#9aa2b8] focus-visible:border-[#3b82f6] focus-visible:ring-[#3b82f6]/30 focus-visible:ring-offset-0";
const labelClass = "text-xs font-semibold text-[#c4cad8]";
const iconButtonClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#9aa2b8] transition-colors hover:bg-dark-900 hover:text-white";
const iconButtonDangerClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#9aa2b8] transition-colors hover:bg-red-500/10 hover:text-red-400";
const dashedButtonClass =
  "flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-[#3f4455] bg-transparent px-4 py-2.5 text-xs font-medium text-[#9aa2b8] transition-colors hover:border-[#3b82f6] hover:bg-dark-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

/** Grupuje słowa alfabetycznie (polska kolejność sortowania). */
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

export default function HangmanBrowserPage() {
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
  const [data, setData] = useState<HangmanData | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Add word state (dla aktualnie wybranej kategorii)
  const [newWord, setNewWord] = useState("");
  const [wordError, setWordError] = useState("");
  const [savingWord, setSavingWord] = useState(false);
  const wordInputRef = useRef<HTMLInputElement>(null);

  // Add category state (inline)
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryEmoji, setNewCategoryEmoji] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  // Edit category state (inline, w panelu szczegółów)
  const [editingCategory, setEditingCategory] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "word" | "category";
    categoryName: string;
    word?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await fetchWithAuth(`/api/guild/${guildId}/hangman`);
      if (!response.ok) throw new Error("Failed to fetch hangman data");
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Nie udało się załadować danych"
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const normalizedSearch = search.toLowerCase().trim();

  const filteredCategories = useMemo(() => {
    if (!data) return [];
    if (!normalizedSearch) return data.categories;

    return data.categories
      .map((cat) => {
        const nameMatch = cat.name.toLowerCase().includes(normalizedSearch);
        const matchingWords = cat.words.filter((w) => w.includes(normalizedSearch));

        if (nameMatch) return cat;
        if (matchingWords.length > 0) {
          return { ...cat, words: matchingWords, wordCount: matchingWords.length };
        }
        return null;
      })
      .filter(Boolean) as HangmanCategory[];
  }, [data, normalizedSearch]);

  const totalMatchingWords = useMemo(
    () => filteredCategories.reduce((sum, c) => sum + c.wordCount, 0),
    [filteredCategories]
  );

  // Utrzymuj wybraną kategorię w zbiorze widocznych wyników; domyślnie pierwsza dostępna.
  useEffect(() => {
    if (filteredCategories.length === 0) return;
    if (!selectedCategory || !filteredCategories.some((c) => c.name === selectedCategory)) {
      setSelectedCategory(filteredCategories[0].name);
    }
  }, [filteredCategories, selectedCategory]);

  const selectedCategoryData = useMemo(
    () => (data?.categories ?? []).find((c) => c.name === selectedCategory) ?? null,
    [data, selectedCategory]
  );

  const visibleWords = useMemo(() => {
    if (!selectedCategoryData) return [];
    if (!normalizedSearch) return selectedCategoryData.words;
    const filtered = filteredCategories.find((c) => c.name === selectedCategoryData.name);
    return filtered ? filtered.words : selectedCategoryData.words;
  }, [selectedCategoryData, filteredCategories, normalizedSearch]);

  const groupedWords = useMemo(() => groupWordsByLetter(visibleWords), [visibleWords]);

  const handleAddWord = async () => {
    if (!selectedCategoryData) return;
    const categoryName = selectedCategoryData.name;
    const word = newWord.trim().toLowerCase();
    if (!word) return;

    if (!/^[a-ząćęłńóśźż]+(\s[a-ząćęłńóśźż]+){0,3}$/.test(word)) {
      setWordError("Tylko polskie litery i spacje (bez q, v, x)");
      return;
    }

    setSavingWord(true);
    setWordError("");

    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/hangman`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addWord", categoryName, word }),
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
    if (!deleteConfirm || deleteConfirm.type !== "word" || !deleteConfirm.word) return;
    setDeleting(true);
    try {
      await fetchWithAuth(`/api/guild/${guildId}/hangman`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "removeWord",
          categoryName: deleteConfirm.categoryName,
          word: deleteConfirm.word,
        }),
      });
      setDeleteConfirm(null);
      await fetchData(true);
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !newCategoryEmoji.trim()) {
      setCategoryError("Podaj nazwę i emoji");
      return;
    }
    setSavingCategory(true);
    setCategoryError("");
    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/hangman`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addCategory",
          name: newCategoryName.trim(),
          emoji: newCategoryEmoji.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCategoryError(json.error || "Błąd");
        return;
      }
      setSelectedCategory(newCategoryName.trim());
      setNewCategoryName("");
      setNewCategoryEmoji("");
      setShowAddCategory(false);
      await fetchData();
    } catch {
      setCategoryError("Błąd połączenia");
    } finally {
      setSavingCategory(false);
    }
  };

  const startEditCategory = () => {
    if (!selectedCategoryData) return;
    setEditError("");
    setEditName(selectedCategoryData.name);
    setEditEmoji(selectedCategoryData.emoji);
    setEditingCategory(true);
  };

  const handleEditCategory = async () => {
    if (!selectedCategoryData) return;
    const trimmedName = editName.trim();
    const trimmedEmoji = editEmoji.trim();
    if (!trimmedName || !trimmedEmoji) {
      setEditError("Podaj nazwę i emoji");
      return;
    }
    setSavingEdit(true);
    setEditError("");
    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/hangman`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "editCategory",
          categoryName: selectedCategoryData.name,
          newName: trimmedName,
          newEmoji: trimmedEmoji,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setEditError(json.error || "Błąd");
        return;
      }
      setSelectedCategory(trimmedName);
      setEditingCategory(false);
      await fetchData();
    } catch {
      setEditError("Błąd połączenia");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRemoveCategory = async () => {
    if (!deleteConfirm || deleteConfirm.type !== "category") return;
    setDeleting(true);
    try {
      await fetchWithAuth(`/api/guild/${guildId}/hangman`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "removeCategory", categoryName: deleteConfirm.categoryName }),
      });
      setDeleteConfirm(null);
      setSelectedCategory(null);
      await fetchData();
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
            <div className="space-y-3"><Skeleton className="h-7 w-72" /><Skeleton className="h-4 w-[420px] max-w-full" /></div>
            <Skeleton className="h-7 w-40 rounded-full" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 w-full rounded-md bg-dark-800" />
            <Skeleton className="h-20 w-full rounded-md bg-dark-800" />
            <Skeleton className="h-20 w-full rounded-md bg-dark-800" />
          </div>
          <Skeleton className="h-11 w-full rounded-md bg-dark-800" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
            <Skeleton className="h-64 w-full rounded-md bg-dark-800" />
            <Skeleton className="h-64 w-full rounded-md bg-dark-800" />
          </div>
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
            message={error || "Nie udało się załadować danych wisielca"}
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  const avgPerCategory = data.totalCategories > 0 ? Math.round(data.totalWords / data.totalCategories) : 0;

  return (
    <div className="min-h-full pb-32">
      <div className="w-full space-y-5">
        <SlideIn delay={0}>
          <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold text-white">Wisielec — Zarządzanie Słowami</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                Przeglądaj, dodawaj i usuwaj kategorie oraz hasła w grze /wisielec.
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">
              <Lock className="h-3.5 w-3.5" />
              Tylko właściciel bota
            </span>
          </header>
        </SlideIn>

        <SlideIn delay={50}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-dark-800 p-4">
              <p className="text-2xl font-bold text-white">{data.totalCategories}</p>
              <p className="mt-1 text-xs text-[#8d94a8]">kategorii</p>
            </div>
            <div className="rounded-md bg-dark-800 p-4">
              <p className="text-2xl font-bold text-emerald-400">{data.totalWords}</p>
              <p className="mt-1 text-xs text-[#8d94a8]">łącznie słów</p>
            </div>
            <div className="rounded-md bg-dark-800 p-4">
              <p className="text-2xl font-bold text-pink-400">{avgPerCategory}</p>
              <p className="mt-1 text-xs text-[#8d94a8]">śr. na kategorię</p>
            </div>
          </div>
        </SlideIn>

        <SlideIn delay={100}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d94a8]" />
            <Input
              placeholder="Szukaj słowa lub kategorii we wszystkich kategoriach..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(inputClass, "pl-9")}
            />
          </div>
          {normalizedSearch ? (
            <p className="mt-2 text-xs text-[#8d94a8]">
              Znaleziono <span className="font-semibold text-white/90">{totalMatchingWords}</span> słów w{" "}
              <span className="font-semibold text-white/90">{filteredCategories.length}</span> kategoriach dla „{search}"
            </p>
          ) : null}
        </SlideIn>

        {filteredCategories.length === 0 ? (
          <div className="rounded-md bg-dark-800 py-16 text-center">
            <Search className="mx-auto mb-3 h-10 w-10 text-[#8d94a8] opacity-50" />
            <p className="text-sm text-[#8d94a8]">Nie znaleziono słów ani kategorii pasujących do „{search}"</p>
          </div>
        ) : (
          <SlideIn delay={130}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
              {/* Lista kategorii */}
              <div className="space-y-2">
                <div className="space-y-1 rounded-md bg-dark-800 p-2">
                  {filteredCategories.map((cat) => {
                    const isActive = cat.name === selectedCategory;
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => { setSelectedCategory(cat.name); setEditingCategory(false); setWordError(""); }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors",
                          isActive ? "bg-[#3b82f6] text-white" : "text-[#c4cad8] hover:bg-dark-900"
                        )}
                      >
                        <span className="text-lg leading-none">{cat.emoji}</span>
                        <span className="min-w-0 flex-1 truncate font-medium">{cat.name}</span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                            isActive ? "bg-white/20 text-white" : "bg-dark-900 text-[#9aa2b8]"
                          )}
                        >
                          {cat.wordCount}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {showAddCategory ? (
                  <div className="space-y-2 rounded-md bg-dark-700 p-3">
                    <Input
                      placeholder="Nazwa kategorii"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className={cn(inputClass, "h-9 bg-dark-900")}
                    />
                    <Input
                      placeholder="Emoji"
                      value={newCategoryEmoji}
                      onChange={(e) => setNewCategoryEmoji(e.target.value)}
                      className={cn(inputClass, "h-9 bg-dark-900")}
                    />
                    {categoryError && <p className="text-xs text-destructive">{categoryError}</p>}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddCategory}
                        disabled={savingCategory}
                        className="flex-1 bg-[#3b82f6] text-white hover:bg-[#2563eb]"
                      >
                        {savingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dodaj"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowAddCategory(false); setNewCategoryName(""); setNewCategoryEmoji(""); setCategoryError(""); }}
                      >
                        Anuluj
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowAddCategory(true)} className={dashedButtonClass}>
                    <Plus className="h-3.5 w-3.5" />
                    Nowa kategoria
                  </button>
                )}
              </div>

              {/* Panel szczegółów kategorii */}
              <div className="rounded-md bg-dark-800 p-5">
                {selectedCategoryData ? (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      {editingCategory ? (
                        <div className="flex flex-1 items-center gap-2">
                          <Input
                            value={editEmoji}
                            onChange={(e) => setEditEmoji(e.target.value)}
                            className={cn(inputClass, "h-9 w-16 bg-dark-900 text-center")}
                          />
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className={cn(inputClass, "h-9 flex-1 bg-dark-900")}
                          />
                        </div>
                      ) : (
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="text-2xl leading-none">{selectedCategoryData.emoji}</span>
                          <h2 className="truncate text-base font-semibold text-white">{selectedCategoryData.name}</h2>
                          <span className="shrink-0 text-xs text-[#8d94a8]">{selectedCategoryData.wordCount} słów</span>
                        </div>
                      )}
                      <div className="flex shrink-0 items-center gap-1">
                        {editingCategory ? (
                          <>
                            <button type="button" onClick={handleEditCategory} disabled={savingEdit} className={iconButtonClass} aria-label="Zapisz zmiany">
                              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            </button>
                            <button type="button" onClick={() => setEditingCategory(false)} className={iconButtonClass} aria-label="Anuluj edycję">
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={startEditCategory} className={iconButtonClass} aria-label="Edytuj kategorię">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm({ type: "category", categoryName: selectedCategoryData.name })}
                              className={iconButtonDangerClass}
                              aria-label="Usuń kategorię"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {editingCategory && editError ? <p className="mt-1.5 text-xs text-destructive">{editError}</p> : null}

                    <div className="mt-4 flex gap-2">
                      <Input
                        ref={wordInputRef}
                        placeholder="Dodaj nowe słowo... (Enter)"
                        value={newWord}
                        onChange={(e) => setNewWord(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddWord(); }}
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
                    <p className="mt-1.5 text-[11px] text-[#6f7690]">Tylko polskie litery i spacje (bez q, v, x), max. 4 wyrazy.</p>

                    {groupedWords.length === 0 ? (
                      <p className="mt-4 text-sm text-[#8d94a8]">Ta kategoria nie ma jeszcze żadnych słów.</p>
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
                                      onClick={() => setDeleteConfirm({ type: "word", categoryName: selectedCategoryData.name, word })}
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
                  </>
                ) : (
                  <p className="py-12 text-center text-sm text-[#8d94a8]">Wybierz kategorię z listy po lewej.</p>
                )}
              </div>
            </div>
          </SlideIn>
        )}

        {data.categories.length === 0 ? (
          <div className="rounded-md bg-dark-800 py-16 text-center">
            <p className="text-sm font-semibold text-white/90">Brak kategorii</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-[#8d94a8]">Dodaj pierwszą kategorię, aby zacząć budować pulę haseł do gry /wisielec.</p>
          </div>
        ) : null}

        {/* Delete confirmation dialog */}
        <Dialog open={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Potwierdź usunięcie</DialogTitle>
              <DialogDescription>
                {deleteConfirm?.type === "category"
                  ? `Czy na pewno chcesz usunąć kategorię „${deleteConfirm.categoryName}" i wszystkie jej słowa?`
                  : `Czy na pewno chcesz usunąć słowo „${deleteConfirm?.word}" z kategorii „${deleteConfirm?.categoryName}"?`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Anuluj
              </Button>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={deleteConfirm?.type === "category" ? handleRemoveCategory : handleRemoveWord}
              >
                {deleting ? "Usuwanie..." : "Usuń"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
