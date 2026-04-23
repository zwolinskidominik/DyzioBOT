"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  Gamepad2,
  Hash,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Trash2,
  Pencil,
} from "lucide-react";
import Link from "next/link";

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

const cardStyle = {
  backgroundColor: "rgba(189, 189, 189, .05)",
  boxShadow: "0 0 10px #00000026",
  border: "1px solid transparent",
};

export default function HangmanBrowserPage() {
  const params = useParams();
  const guildId = params.guildId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HangmanData | null>(null);
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  // Add word state
  const [newWordInputs, setNewWordInputs] = useState<Record<string, string>>({});
  const [wordErrors, setWordErrors] = useState<Record<string, string>>({});
  const [savingWord, setSavingWord] = useState<string | null>(null);
  const wordInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Add category state
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryEmoji, setNewCategoryEmoji] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "word" | "category";
    categoryName: string;
    word?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit category state
  const [editCategory, setEditCategory] = useState<{
    originalName: string;
    name: string;
    emoji: string;
  } | null>(null);
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

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

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (data) {
      setExpandedCategories(new Set(data.categories.map((c) => c.name)));
    }
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  const handleAddWord = async (categoryName: string) => {
    const word = (newWordInputs[categoryName] || "").trim().toLowerCase();
    if (!word) return;

    if (!/^[a-ząćęłńóśźż]+(\s[a-ząćęłńóśźż]+){0,3}$/.test(word)) {
      setWordErrors((prev) => ({
        ...prev,
        [categoryName]: "Tylko polskie litery i spacje (bez q, v, x)",
      }));
      return;
    }

    setSavingWord(categoryName);
    setWordErrors((prev) => ({ ...prev, [categoryName]: "" }));

    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/hangman`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addWord", categoryName, word }),
      });
      const json = await res.json();
      if (!res.ok) {
        setWordErrors((prev) => ({
          ...prev,
          [categoryName]: json.error || "Błąd",
        }));
        return;
      }
      setNewWordInputs((prev) => ({ ...prev, [categoryName]: "" }));
      await fetchData(true);
      requestAnimationFrame(() => {
        wordInputRefs.current[categoryName]?.focus();
      });
    } catch {
      setWordErrors((prev) => ({
        ...prev,
        [categoryName]: "Błąd połączenia",
      }));
    } finally {
      setSavingWord(null);
    }
  };

  const handleRemoveWord = async () => {
    if (!deleteConfirm || deleteConfirm.type !== "word" || !deleteConfirm.word)
      return;
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
      await fetchData();
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

  const handleEditCategory = async () => {
    if (!editCategory) return;
    const trimmedName = editCategory.name.trim();
    const trimmedEmoji = editCategory.emoji.trim();
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
          categoryName: editCategory.originalName,
          newName: trimmedName,
          newEmoji: trimmedEmoji,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setEditError(json.error || "Błąd");
        return;
      }
      setExpandedCategories((prev) => {
        if (!prev.has(editCategory.originalName)) return prev;
        const next = new Set(prev);
        next.delete(editCategory.originalName);
        next.add(trimmedName);
        return next;
      });
      setEditCategory(null);
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
        body: JSON.stringify({
          action: "removeCategory",
          categoryName: deleteConfirm.categoryName,
        }),
      });
      setDeleteConfirm(null);
      await fetchData();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  const normalizedSearch = search.toLowerCase().trim();

  const filteredCategories = useMemo(() => {
    if (!data) return [];
    if (!normalizedSearch) return data.categories;

    return data.categories
      .map((cat) => {
        const nameMatch = cat.name.toLowerCase().includes(normalizedSearch);
        const matchingWords = cat.words.filter((w) =>
          w.includes(normalizedSearch)
        );

        if (nameMatch) return cat;
        if (matchingWords.length > 0) {
          return { ...cat, words: matchingWords, wordCount: matchingWords.length };
        }
        return null;
      })
      .filter(Boolean) as HangmanCategory[];
  }, [data, normalizedSearch]);

  const totalMatchingWords = useMemo(() => {
    return filteredCategories.reduce((sum, c) => sum + c.wordCount, 0);
  }, [filteredCategories]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto p-4 md:p-8 max-w-6xl">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-10 w-full mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto p-4 md:p-8 max-w-6xl">
          <ErrorState
            title="Błąd ładowania"
            message={error || "Nie udało się załadować danych wisielca"}
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-4 md:p-8 max-w-6xl">
        {/* Header */}
        <SlideIn delay={0}>
          <div className="flex items-center gap-3 mb-6">
            <Link
              href={`/${guildId}`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Gamepad2 className="w-7 h-7 text-bot-primary" />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                Wisielec — Zarządzanie Słowami
              </h1>
              <p className="text-sm text-muted-foreground">
                Przeglądaj, dodawaj i usuwaj kategorie oraz hasła w grze /wisielec
              </p>
            </div>
          </div>
        </SlideIn>

        {/* Stats cards */}
        <SlideIn delay={50}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card className="backdrop-blur" style={cardStyle}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-bot-primary/10">
                  <BookOpen className="w-5 h-5 text-bot-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.totalCategories}</p>
                  <p className="text-xs text-muted-foreground">Kategorii</p>
                </div>
              </CardContent>
            </Card>
            <Card className="backdrop-blur" style={cardStyle}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-discord-green/10">
                  <Hash className="w-5 h-5 text-discord-green" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.totalWords}</p>
                  <p className="text-xs text-muted-foreground">Łącznie słów</p>
                </div>
              </CardContent>
            </Card>
            <Card className="backdrop-blur" style={cardStyle}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-discord-yellow/10">
                  <Gamepad2 className="w-5 h-5 text-discord-yellow" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {Math.round(data.totalWords / data.totalCategories)}
                  </p>
                  <p className="text-xs text-muted-foreground">Śr. na kategorię</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </SlideIn>

        {/* Search & controls */}
        <SlideIn delay={100}>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj słowa lub kategorii..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddCategory(true)}
                className="text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Dodaj kategorię
              </Button>
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
            <p className="text-sm text-muted-foreground mb-4">
              Znaleziono{" "}
              <span className="font-semibold text-foreground">
                {totalMatchingWords}
              </span>{" "}
              słów w{" "}
              <span className="font-semibold text-foreground">
                {filteredCategories.length}
              </span>{" "}
              kategoriach dla &quot;{search}&quot;
            </p>
          </SlideIn>
        )}

        {/* Categories list */}
        <div className="space-y-3">
          {filteredCategories.map((category, index) => {
            const isExpanded = expandedCategories.has(category.name);

            return (
              <SlideIn key={category.name} delay={150 + index * 30}>
                <Card className="backdrop-blur" style={cardStyle}>
                  {/* Category header — clickable */}
                  <div className="flex items-center">
                    <button
                      onClick={() => toggleCategory(category.name)}
                      className="flex-1 text-left"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{category.emoji}</span>
                            <div>
                              <CardTitle className="text-base">
                                {category.name}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                {category.wordCount} słów
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      onClick={() => {
                        setEditError("");
                        setEditCategory({
                          originalName: category.name,
                          name: category.name,
                          emoji: category.emoji,
                        });
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mr-3 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() =>
                        setDeleteConfirm({
                          type: "category",
                          categoryName: category.name,
                        })
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Expanded word list */}
                  {isExpanded && (
                    <CardContent className="pt-0 pb-4">
                      <div className="border-t border-border/50 pt-3">
                        {/* Add word input */}
                        <div className="flex gap-2 mb-3">
                          <Input
                            ref={(el) => {
                              wordInputRefs.current[category.name] = el;
                            }}
                            placeholder="Dodaj nowe słowo..."
                            value={newWordInputs[category.name] || ""}
                            onChange={(e) =>
                              setNewWordInputs((prev) => ({
                                ...prev,
                                [category.name]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleAddWord(category.name);
                            }}
                            className="text-sm h-8"
                          />
                          <Button
                            size="sm"
                            className="h-8 px-3 shrink-0"
                            disabled={savingWord === category.name}
                            onClick={() => handleAddWord(category.name)}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Dodaj
                          </Button>
                        </div>
                        {wordErrors[category.name] && (
                          <p className="text-xs text-destructive mb-2">
                            {wordErrors[category.name]}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                          {category.words.map((word) => {
                            const isHighlighted =
                              normalizedSearch &&
                              word.includes(normalizedSearch);

                            return (
                              <span
                                key={word}
                                className={`group inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md transition-colors ${
                                  isHighlighted
                                    ? "bg-bot-primary/20 text-bot-light font-medium"
                                    : "bg-muted/50 text-muted-foreground"
                                }`}
                              >
                                {word}
                                <button
                                  onClick={() =>
                                    setDeleteConfirm({
                                      type: "word",
                                      categoryName: category.name,
                                      word,
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
                      </div>
                    </CardContent>
                  )}
                </Card>
              </SlideIn>
            );
          })}
        </div>

        {filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">
              Nie znaleziono słów pasujących do &quot;{search}&quot;
            </p>
          </div>
        )}

        {/* Add category dialog */}
        <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nowa kategoria</DialogTitle>
              <DialogDescription>
                Dodaj nową kategorię słów do gry w Wisielca.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Nazwa</label>
                <Input
                  placeholder="np. Przyroda"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Emoji</label>
                <Input
                  placeholder="np. 🌿"
                  value={newCategoryEmoji}
                  onChange={(e) => setNewCategoryEmoji(e.target.value)}
                />
              </div>
              {categoryError && (
                <p className="text-xs text-destructive">{categoryError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddCategory(false)}
              >
                Anuluj
              </Button>
              <Button onClick={handleAddCategory} disabled={savingCategory}>
                {savingCategory ? "Dodawanie..." : "Dodaj kategorię"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit category dialog */}
        <Dialog
          open={editCategory !== null}
          onOpenChange={(open) => {
            if (!open) setEditCategory(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edytuj kategorię</DialogTitle>
              <DialogDescription>
                Zmień nazwę lub emoji kategorii. Słowa pozostają bez zmian.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Nazwa</label>
                <Input
                  placeholder="np. Przyroda"
                  value={editCategory?.name ?? ""}
                  onChange={(e) =>
                    setEditCategory((prev) =>
                      prev ? { ...prev, name: e.target.value } : prev
                    )
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Emoji</label>
                <Input
                  placeholder="np. 🌿"
                  value={editCategory?.emoji ?? ""}
                  onChange={(e) =>
                    setEditCategory((prev) =>
                      prev ? { ...prev, emoji: e.target.value } : prev
                    )
                  }
                />
              </div>
              {editError && (
                <p className="text-xs text-destructive">{editError}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditCategory(null)}>
                Anuluj
              </Button>
              <Button onClick={handleEditCategory} disabled={savingEdit}>
                {savingEdit ? "Zapisywanie..." : "Zapisz"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog
          open={deleteConfirm !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteConfirm(null);
          }}
        >
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
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
              >
                Anuluj
              </Button>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={
                  deleteConfirm?.type === "category"
                    ? handleRemoveCategory
                    : handleRemoveWord
                }
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
