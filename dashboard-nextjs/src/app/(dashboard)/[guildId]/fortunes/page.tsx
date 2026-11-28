"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Search, Lock, Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import { OWNER_IDS } from "@/lib/owner";
import { FORTUNE_MAX, FORTUNE_MIN, normalizeFortune } from "@/lib/fortunes";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { cn } from "@/lib/utils";
import { useMessages } from "@/i18n/LanguageProvider";
import { fortunesMessages } from "@/i18n/messages/fortunes";
import { commonMessages } from "@/i18n/messages/common";

interface FortuneItem {
  id: string;
  content: string;
}

/** Bot: DAILY_FORTUNE_LIMIT w src/services/fortuneService.ts. */
const DAILY_LIMIT = 2;
/** Poniżej tej liczby panel ostrzega, że pula się kończy. */
const LOW_POOL = 20;

const inputClass =
  "border border-[#3f4455] bg-dark-900 text-white/90 placeholder:text-[#9aa2b8] focus-visible:border-[#3b82f6] focus-visible:ring-[#3b82f6]/30 focus-visible:ring-offset-0";

export default function FortunesPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { data: session, status } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;

  const t = useMessages(fortunesMessages);
  const m = useMessages(commonMessages).module;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fortunes, setFortunes] = useState<FortuneItem[]>([]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FortuneItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        const res = await fetchWithAuth(`/api/guild/${guildId}/fortunes`);
        if (!res.ok) throw new Error(t.fetchError);
        const json = (await res.json()) as { fortunes: FortuneItem[] };
        setFortunes(json.fortunes);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : m.loadErrorShort);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [guildId, t, m]
  );

  useEffect(() => {
    if (status === "authenticated" && OWNER_IDS.includes(currentUserId ?? "")) fetchData();
  }, [fetchData, status, currentUserId]);

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () => (query ? fortunes.filter((f) => f.content.toLowerCase().includes(query)) : fortunes),
    [fortunes, query]
  );

  const handleAdd = async () => {
    const content = normalizeFortune(draft);
    if (content.length < FORTUNE_MIN) {
      setDraftError(t.tooShort(FORTUNE_MIN));
      return;
    }
    setSaving(true);
    setDraftError("");
    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/fortunes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", content }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setDraftError(json.error ?? m.error);
        return;
      }
      setDraft("");
      toast.success(t.added);
      await fetchData(true);
    } catch {
      setDraftError(m.connectionError);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/fortunes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", id: deleteTarget.id }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(json.error ?? m.error);
      }
      setDeleteTarget(null);
      await fetchData(true);
    } catch {
      toast.error(m.connectionError);
    } finally {
      setDeleting(false);
    }
  };

  // Po wszystkich hookach (jak w module Wordle) - inaczej liczba hooków zmienia się między renderami.
  if (status !== "loading" && !OWNER_IDS.includes(currentUserId ?? "")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-4xl">🔒</p>
        <h2 className="text-xl font-semibold">{m.noAccess}</h2>
        <p className="text-sm text-muted-foreground">{m.ownerOnlyText}</p>
      </div>
    );
  }

  if (loading || status === "loading") {
    return (
      <div className="w-full space-y-5">
        <div className="space-y-3 pb-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-[420px] max-w-full" />
        </div>
        <Skeleton className="h-24 w-full rounded-md bg-dark-800" />
        <Skeleton className="h-36 w-full rounded-md bg-dark-800" />
        <Skeleton className="h-72 w-full rounded-md bg-dark-800" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title={m.loadErrorGeneric} message={error} onRetry={() => window.location.reload()} />;
  }

  const total = fortunes.length;
  const draftLength = normalizeFortune(draft).length;

  return (
    <div className="min-h-full pb-32">
      <div className="w-full space-y-5">
        <SlideIn delay={0}>
          <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold text-white">{t.title}</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">{t.subtitle}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">
              <Lock className="h-3.5 w-3.5" />
              {m.ownerOnlyBadge}
            </span>
          </header>
        </SlideIn>

        <SlideIn delay={50}>
          <div
            className="relative flex flex-wrap items-center gap-5 overflow-hidden rounded-[10px] px-6 py-5"
            style={{ background: "linear-gradient(120deg, #2a1f3d 0%, #1F2129 55%, #1F2129 100%)", border: "1px solid rgba(168,85,247,0.3)" }}
          >
            <div
              className="pointer-events-none absolute -right-5 -top-5 h-40 w-40 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(168,85,247,0.2), transparent 70%)" }}
            />
            <span className="relative flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: "rgba(168,85,247,0.18)" }}>
              🔮
            </span>
            <div className="relative">
              <p className="text-3xl font-extrabold text-white">{total}</p>
              <p className="text-[11px] text-[#8d94a8]">
                {t.poolLabel} · {t.usageHint(DAILY_LIMIT)}
              </p>
            </div>
            {total < LOW_POOL ? (
              <p
                className="relative ml-auto rounded-md px-3 py-2 text-xs font-medium"
                style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}
              >
                {total === 0 ? t.emptyPool : t.lowPool}
              </p>
            ) : null}
          </div>
        </SlideIn>

        <SlideIn delay={90}>
          <div className="rounded-md bg-dark-800 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <Sparkles className="h-4 w-4 text-[#c084fc]" />
              {t.addTitle}
            </h2>
            <Textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (draftError) setDraftError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAdd();
              }}
              placeholder={t.addPlaceholder}
              maxLength={FORTUNE_MAX}
              rows={3}
              className={cn(inputClass, "mt-3 resize-y")}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className={cn("text-[11px]", draftError ? "text-destructive" : "text-[#6f7690]")}>
                {draftError || t.charCount(draftLength, FORTUNE_MAX)}
              </span>
              <Button
                type="button"
                onClick={handleAdd}
                disabled={saving || draftLength === 0}
                className="shrink-0 bg-[#3b82f6] text-white hover:bg-[#2563eb]"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {m.add}
              </Button>
            </div>
          </div>
        </SlideIn>

        <SlideIn delay={120}>
          <div className="rounded-md bg-dark-800 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-white">
                {t.listTitle} <span className="ml-1 text-xs font-normal text-[#8d94a8]">{visible.length} · {t.newestFirst}</span>
              </h2>
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d94a8]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className={cn(inputClass, "h-10 pl-9")}
                />
              </div>
            </div>

            {visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#8d94a8]">{query ? t.notFound(search) : t.emptyPool}</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-1.5">
                {visible.map((f) => (
                  <li
                    key={f.id}
                    className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[#262935]"
                    style={{ background: "#1d202b" }}
                  >
                    <span className="mt-0.5 text-sm">🔮</span>
                    <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#c4cad8]">{f.content}</p>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(f)}
                      className="shrink-0 rounded-md p-1.5 text-[#8d94a8] opacity-60 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      aria-label={t.remove}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SlideIn>

        <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.deleteTitle}</DialogTitle>
              <DialogDescription>{t.deleteText}</DialogDescription>
            </DialogHeader>
            {deleteTarget ? (
              <p className="rounded-md bg-dark-900 px-3 py-2 text-sm text-[#c4cad8]">{deleteTarget.content}</p>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                {m.cancel}
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? m.deleting : m.delete}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
