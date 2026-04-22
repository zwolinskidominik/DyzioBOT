"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Search,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Hash,
  Puzzle,
} from "lucide-react";
import Link from "next/link";

/* ── Types ─────────────────────────────────────────────────── */

interface WordleCategory {
  length: number;
  words: string[];
  wordCount: number;
}

interface WordleData {
  categories: WordleCategory[];
  totalWords: number;
}

/* ── Constants ─────────────────────────────────────────────── */

const POLISH_REGEX = /^[a-ząćęłńóśźż]+$/;
const ALL_LENGTHS = [5, 6, 7];

const LENGTH_LABELS: Record<number, string> = {
  5: "5-literowe (standard)",
  6: "6-literowe",
  7: "7-literowe",
};

const cardStyle = {
  backgroundColor: "rgba(189, 189, 189, .05)",
  boxShadow: "0 0 10px #00000026",
  border: "1px solid transparent",
};

/* ── Page ──────────────────────────────────────────────────── */

export default function WordlePage() {
  const params = useParams();
  const guildId = params.guildId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WordleData | null>(null);
  const [search, setSearch] = useState("");
  const [expandedLengths, setExpandedLengths] = useState<Set<number>>(
    new Set([5])
  );

  // Per-length add-word state
  const [newWordInputs, setNewWordInputs] = useState<Record<number, string>>({});
  const [wordErrors, setWordErrors]        = useState<Record<number, string>>({});
  const [savingWord, setSavingWord]        = useState<number | null>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    word: string;
    length: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── Data fetching ─────────────────────────────────────────── */

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth(`/api/guild/${guildId}/wordle`);
      if (!res.ok) throw new Error("Nie udało się pobrać danych");
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Nie udało się załadować danych"
      );
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Category helpers ──────────────────────────────────────── */

  const toggleLength = (len: number) => {
    setExpandedLengths((prev) => {
      const next = new Set(prev);
      if (next.has(len)) next.delete(len);
      else next.add(len);
      return next;
    });
  };

  const expandAll  = () => setExpandedLengths(new Set(ALL_LENGTHS));
  const collapseAll = () => setExpandedLengths(new Set());

  /* ── Merged categories: always show all lengths ────────────── */
  const allCategories = useMemo((): WordleCategory[] => {
    const existing = data?.categories ?? [];
    return ALL_LENGTHS.map((len) => {
      const found = existing.find((c) => c.length === len);
      return found ?? { length: len, words: [], wordCount: 0 };
    });
  }, [data]);

  /* ── Search filtering ──────────────────────────────────────── */

  const normalizedSearch = search.toLowerCase().trim();

  const filteredCategories = useMemo(() => {
    if (!normalizedSearch) return allCategories;
    return allCategories
      .map((cat) => ({
        ...cat,
        words: cat.words.filter((w) => w.includes(normalizedSearch)),
        wordCount: cat.words.filter((w) => w.includes(normalizedSearch)).length,
      }))
      .filter((cat) => cat.wordCount > 0);
  }, [allCategories, normalizedSearch]);

  const totalMatchingWords = useMemo(
    () => filteredCategories.reduce((sum, c) => sum + c.wordCount, 0),
    [filteredCategories]
  );

  /* ── Add word ──────────────────────────────────────────────── */

  const handleAddWord = async (length: number) => {
    const word = (newWordInputs[length] ?? "").trim().toLowerCase();
    if (!word) return;

    if (!POLISH_REGEX.test(word)) {
      setWordErrors((prev) => ({
        ...prev,
        [length]: "Tylko polskie litery (bez q, v, x)",
      }));
      return;
    }

    if (word.length !== length) {
      setWordErrors((prev) => ({
        ...prev,
        [length]: `Słowo musi mieć dokładnie ${length} liter`,
      }));
      return;
    }

    setSavingWord(length);
    setWordErrors((prev) => ({ ...prev, [length]: "" }));

    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/wordle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addWord", word }),
      });
      const json = await res.json();
      if (!res.ok) {
        setWordErrors((prev) => ({
          ...prev,
          [length]: json.error || "Błąd",
        }));
        return;
      }
      setNewWordInputs((prev) => ({ ...prev, [length]: "" }));
      await fetchData();
    } catch {
      setWordErrors((prev) => ({ ...prev, [length]: "Błąd połączenia" }));
    } finally {
      setSavingWord(null);
    }
  };

  /* ── Remove word ───────────────────────────────────────────── */

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
      await fetchData();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  /* ── Loading / error ───────────────────────────────────────── */

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <ErrorState message={error} onRetry={fetchData} />
      </div>
    );
  }

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <SlideIn>
        <div className="flex items-center gap-3 mb-1">
          <Link
            href={`/${guildId}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Puzzle className="w-6 h-6 text-green-500" />
            <h1 className="text-2xl font-bold">Wordle</h1>
          </div>
        </div>
        <p className="text-muted-foreground text-sm ml-7">
          Zarządzaj polskimi słowami do gry /wordle. Słowa są podzielone na
          kategorie według liczby liter (4–11).
        </p>
      </SlideIn>

      {/* Stats */}
      <SlideIn delay={50}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card style={cardStyle}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-xs">
                Wszystkich słów
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {data?.totalWords ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          {[5, 6, 4, 7].map((len) => {
            const cat = allCategories.find((c) => c.length === len);
            return (
              <Card key={len} style={cardStyle}>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardDescription className="text-xs flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {len}-literowe
                    {len === 5 && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1 ml-1">
                        standard
                      </Badge>
                    )}
                  </CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {cat?.wordCount ?? 0}
                  </CardTitle>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </SlideIn>

      {/* Search + controls */}
      <SlideIn delay={100}>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj słowa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="px-3 py-2 text-xs rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
            >
              Rozwiń wszystkie
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-2 text-xs rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
            >
              Zwiń wszystkie
            </button>
          </div>
        </div>
      </SlideIn>

      {/* Search results info */}
      {normalizedSearch && (
        <SlideIn delay={0}>
          <p className="text-sm text-muted-foreground">
            Znaleziono{" "}
            <span className="font-semibold text-foreground">
              {totalMatchingWords}
            </span>{" "}
            słów dla &quot;{search}&quot;
          </p>
        </SlideIn>
      )}

      {/* Length categories */}
      <div className="space-y-3">
        {(normalizedSearch ? filteredCategories : allCategories).map(
          (category, index) => {
            const isExpanded = expandedLengths.has(category.length);
            const key        = String(category.length);

            return (
              <SlideIn key={key} delay={150 + index * 25}>
                <Card className="backdrop-blur" style={cardStyle}>
                  {/* Category header */}
                  <button
                    onClick={() => toggleLength(category.length)}
                    className="w-full text-left"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-mono font-bold text-green-500">
                            {category.length}
                          </span>
                          <div>
                            <CardTitle className="text-base">
                              {LENGTH_LABELS[category.length]}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {category.wordCount}{" "}
                              {category.wordCount === 1 ? "słowo" : "słów"}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="text-xs tabular-nums"
                          >
                            {category.wordCount}
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <CardContent className="pt-0 pb-4">
                      <div className="border-t border-border/50 pt-3 space-y-3">
                        {/* Add word row */}
                        <div className="flex gap-2">
                          <Input
                            placeholder={`Dodaj ${category.length}-literowe słowo...`}
                            value={newWordInputs[category.length] ?? ""}
                            onChange={(e) =>
                              setNewWordInputs((prev) => ({
                                ...prev,
                                [category.length]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleAddWord(category.length);
                            }}
                            className="text-sm h-8"
                            maxLength={category.length}
                          />
                          <Button
                            size="sm"
                            className="h-8 px-3 shrink-0"
                            disabled={savingWord === category.length}
                            onClick={() => handleAddWord(category.length)}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Dodaj
                          </Button>
                        </div>

                        {/* Validation hint */}
                        <p className="text-xs text-muted-foreground -mt-1">
                          Tylko polskie litery (a–ż), dokładnie{" "}
                          <strong>{category.length}</strong> znaków. Regex:{" "}
                          <code className="bg-muted px-1 rounded text-[11px]">
                            {`^[a-ząćęłńóśźż]{${category.length}}$`}
                          </code>
                        </p>

                        {wordErrors[category.length] && (
                          <p className="text-xs text-destructive font-medium">
                            ❌ {wordErrors[category.length]}
                          </p>
                        )}

                        {/* Word chips */}
                        {category.wordCount === 0 ? (
                          <p className="text-xs text-muted-foreground italic py-2">
                            Brak słów w tej kategorii. Dodaj pierwsze słowo
                            powyżej.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {category.words.map((word) => {
                              const isHighlighted =
                                normalizedSearch &&
                                word.includes(normalizedSearch);
                              return (
                                <span
                                  key={word}
                                  className={`group inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md font-mono transition-colors ${
                                    isHighlighted
                                      ? "bg-green-500/20 text-green-400 font-semibold"
                                      : "bg-muted/50 text-muted-foreground"
                                  }`}
                                >
                                  {word}
                                  <button
                                    onClick={() =>
                                      setDeleteConfirm({
                                        word,
                                        length: category.length,
                                      })
                                    }
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </SlideIn>
            );
          }
        )}
      </div>

      {filteredCategories.length === 0 && normalizedSearch && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">
            Nie znaleziono słów pasujących do &quot;{search}&quot;
          </p>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuń słowo</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz usunąć słowo{" "}
              <strong className="font-mono text-foreground">
                {deleteConfirm?.word}
              </strong>{" "}
              z listy {deleteConfirm?.length}-literowych? Tej operacji nie
              można cofnąć.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={deleting}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveWord}
              disabled={deleting}
            >
              {deleting ? "Usuwanie..." : "Usuń"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
