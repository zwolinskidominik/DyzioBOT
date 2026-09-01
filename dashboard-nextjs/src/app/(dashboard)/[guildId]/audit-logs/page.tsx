"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, Search, X, ChevronLeft, ChevronRight, ChevronDown, Braces, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";

interface AuditLogChange {
  field: string;
  label: string;
  from?: unknown;
  to: unknown;
}

interface AuditLog {
  _id: string;
  guildId: string;
  userId: string;
  username: string;
  avatar?: string | null;
  action: string;
  module: string;
  description?: string;
  metadata?: Record<string, unknown>;
  changes?: AuditLogChange[];
  createdAt: string;
}

/**
 * Realna, potwierdzona lista modułów wywołujących `createAuditLog()` w całym kodzie dashboardu
 * (grep po `module:` przy każdym call site). NIE dodawaj tu modułu bez odpowiadającego wywołania —
 * ta lista musi zostać zsynchronizowana ręcznie przy każdej zmianie.
 */
const MODULE_CONFIG: Record<string, { label: string; color: string }> = {
  levels: { label: "System poziomów", color: "#3498DB" },
  tickets: { label: "Tickety", color: "#5865F2" },
  channel_stats: { label: "Kanały z licznikami", color: "#1ABC9C" },
  wrapped: { label: "Server Wrapped", color: "#9B59B6" },
  giveaway: { label: "Giveaway", color: "#F1C40F" },
  tournament: { label: "Turniej", color: "#E67E22" },
  temp_channels: { label: "Tymczasowe kanały", color: "#2ECC71" },
  "invite-tracker": { label: "Invite Tracker", color: "#E91E63" },
  logs: { label: "Logi", color: "#607D8B" },
};

const DAY_RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: "7", label: "Ostatnie 7 dni" },
  { value: "30", label: "Ostatnie 30 dni" },
  { value: "90", label: "Ostatnie 90 dni" },
  { value: "all", label: "Cały czas" },
];

const PAGE_SIZE_OPTIONS = [6, 10, 20];

function getModuleConfig(mod: string): { label: string; color: string } {
  return MODULE_CONFIG[mod] || { label: mod, color: "#6b7280" };
}

function getActionColor(action: string): string {
  const a = action.toLowerCase();
  if (a.includes("create") || a.includes("deploy")) return "#4ade80";
  if (a.includes("delete") || a.includes("remove")) return "#f87171";
  if (a.includes("update")) return "#60a5fa";
  return "#9ca3af";
}

/** Polska odmiana liczebnikowa: 1 / 2-4 / 5+. */
function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

function formatRelativeTime(date: Date): string | null {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 0) return null;
  if (diffSec < 60) return "przed chwilą";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} ${plural(diffMin, "minutę", "minuty", "minut")} temu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ${plural(diffHour, "godzinę", "godziny", "godzin")} temu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} ${plural(diffDay, "dzień", "dni", "dni")} temu`;
  return null;
}

function formatExactTime(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDayLabel(date: Date): string {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (dayKey(date) === dayKey(now)) return "Dzisiaj";
  if (dayKey(date) === dayKey(yesterday)) return "Wczoraj";

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
  }).format(date);
}

/** Ten sam wzorzec co w birthdays/page.tsx: prawdziwy awatar z Discord CDN, z fallbackiem na domyślny awatar Discorda gdy brak hasha. */
function getAvatarUrl(userId: string, avatar?: string | null): string {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=64`;
  }
  const fallbackIndex = Number(BigInt(userId) % BigInt(5));
  return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
}

function formatChangeValue(v: unknown): string {
  if (v === undefined || v === null || v === "") return "brak";
  if (typeof v === "boolean") return v ? "włączone" : "wyłączone";
  return String(v);
}

interface DayGroup {
  key: string;
  label: string;
  logs: AuditLog[];
}

function groupByDay(logs: AuditLog[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const indexByKey = new Map<string, number>();

  for (const log of logs) {
    const date = new Date(log.createdAt);
    const key = dayKey(date);
    let idx = indexByKey.get(key);
    if (idx === undefined) {
      idx = groups.length;
      indexByKey.set(key, idx);
      groups.push({ key, label: formatDayLabel(date), logs: [] });
    }
    groups[idx].logs.push(log);
  }

  return groups;
}

export default function AuditLogsPage() {
  const params = useParams();
  const guildId = params.guildId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [daysFilter, setDaysFilter] = useState<string>("30");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [jsonExpanded, setJsonExpanded] = useState<Set<string>>(new Set());

  // Debounce search input before it drives a fetch.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      try {
        setLoading(true);
        setError(null);

        const urlParams = new URLSearchParams({
          limit: pageSize.toString(),
          skip: (page * pageSize).toString(),
          days: daysFilter,
        });
        if (moduleFilter) urlParams.append("module", moduleFilter);
        if (search) urlParams.append("q", search);

        const response = await fetch(`/api/guild/${guildId}/audit-logs?${urlParams}`);
        if (!response.ok) throw new Error("Request failed");
        const data = await response.json();

        if (!cancelled) {
          setLogs(data.logs);
          setTotal(data.total);
        }
      } catch (err) {
        console.error("Error loading audit logs:", err);
        if (!cancelled) setError("Nie udało się załadować logów panelu kontrolnego.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [guildId, moduleFilter, daysFilter, search, page, pageSize]);

  const dayGroups = useMemo(() => groupByDay(logs), [logs]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasActiveFilters = Boolean(moduleFilter || search || daysFilter !== "30");

  const clearFilters = () => {
    setModuleFilter("");
    setSearchInput("");
    setSearch("");
    setDaysFilter("30");
    setPage(0);
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleJson = (id: string) => {
    setJsonExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const windowSize = 2;
    for (let i = Math.max(0, page - windowSize); i <= Math.min(totalPages - 1, page + windowSize); i++) {
      pages.push(i);
    }
    return pages;
  }, [page, totalPages]);

  if (error && logs.length === 0) {
    return <ErrorState message={error} onRetry={() => setPage((p) => p)} />;
  }

  if (loading && logs.length === 0) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <Card className="backdrop-blur">
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96 mt-2" />
            </CardHeader>
            <CardContent>
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full mb-2" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="w-full">
        <SlideIn direction="up" delay={100}>
          <Card
            className="backdrop-blur"
            style={{ boxShadow: "0 0 10px #00000026", border: "1px solid transparent" }}
          >
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <ScrollText className="w-6 h-6 text-bot-primary" />
                Logi panelu kontrolnego
              </CardTitle>
              <CardDescription>
                Historia wszystkich zmian dokonanych w panelu administracyjnym
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filtry */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Szukaj po użytkowniku, akcji lub opisie..."
                    className="pl-9"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => setSearchInput("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <Select value={moduleFilter || "all"} onValueChange={(value) => { setModuleFilter(value === "all" ? "" : value); setPage(0); }}>
                  <SelectTrigger className="w-[190px]">
                    <SelectValue placeholder="Wszystkie moduły" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie moduły</SelectItem>
                    {Object.entries(MODULE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={daysFilter} onValueChange={(value) => { setDaysFilter(value); setPage(0); }}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_RANGE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button onClick={clearFilters} variant="ghost" size="sm">
                    <X className="w-4 h-4 mr-1" />
                    Wyczyść
                  </Button>
                )}

                <span className="ml-auto text-sm text-muted-foreground whitespace-nowrap">
                  Znaleziono: {total}
                </span>
              </div>

              {/* Lista logów, pogrupowana dniami */}
              <div className="space-y-5">
                {dayGroups.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ScrollText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{hasActiveFilters ? "Brak logów spełniających kryteria filtrowania" : "Brak logów panelu kontrolnego"}</p>
                  </div>
                ) : (
                  dayGroups.map((group, groupIdx) => (
                    <div key={group.key}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-semibold text-foreground">{group.label}</span>
                        <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
                        <span className="text-xs text-muted-foreground">
                          {group.logs.length} {plural(group.logs.length, "wpis", "wpisy", "wpisów")}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {group.logs.map((log, logIdx) => {
                          const isMostRecent = groupIdx === 0 && logIdx === 0 && page === 0;
                          const mod = getModuleConfig(log.module);
                          const date = new Date(log.createdAt);
                          const relative = formatRelativeTime(date);
                          const isExpanded = expanded.has(log._id);
                          const isJsonExpanded = jsonExpanded.has(log._id);
                          const hasChanges = Boolean(log.changes && log.changes.length > 0);
                          const hasMetadata = Boolean(log.metadata && Object.keys(log.metadata).length > 0);

                          return (
                            <div
                              key={log._id}
                              className="rounded-lg p-4 transition-colors"
                              style={{
                                background: isMostRecent ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                                border: `1px solid ${isMostRecent ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.06)"}`,
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <img
                                  src={getAvatarUrl(log.userId, log.avatar)}
                                  alt={log.username}
                                  className="w-9 h-9 rounded-full shrink-0"
                                  style={{ background: "rgba(255,255,255,0.06)" }}
                                />

                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold">{log.username}</span>
                                    <span
                                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                      style={{ background: `${mod.color}26`, color: mod.color }}
                                    >
                                      {mod.label}
                                    </span>
                                    <span
                                      className="text-[11px] font-mono px-1.5 py-0.5 rounded"
                                      style={{ background: "rgba(255,255,255,0.06)", color: getActionColor(log.action) }}
                                    >
                                      {log.action}
                                    </span>
                                    {isMostRecent && (
                                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.25)", color: "#a5b4fc" }}>
                                        Najnowszy
                                      </span>
                                    )}
                                  </div>

                                  {log.description && (
                                    <p className="text-sm text-muted-foreground mt-1">{log.description}</p>
                                  )}

                                  {hasChanges && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {(isExpanded ? log.changes! : log.changes!.slice(0, 3)).map((change, i) => (
                                        <span
                                          key={`${change.field}-${i}`}
                                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded"
                                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                                        >
                                          <span className="text-muted-foreground">{change.label}:</span>
                                          {change.from !== undefined && (
                                            <>
                                              <span className="text-muted-foreground">{formatChangeValue(change.from)}</span>
                                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                            </>
                                          )}
                                          <span className="font-medium">{formatChangeValue(change.to)}</span>
                                        </span>
                                      ))}
                                      {!isExpanded && log.changes!.length > 3 && (
                                        <button
                                          type="button"
                                          onClick={() => toggleExpanded(log._id)}
                                          className="text-[11px] text-bot-primary hover:underline px-1"
                                        >
                                          +{log.changes!.length - 3} więcej
                                        </button>
                                      )}
                                      {isExpanded && log.changes!.length > 3 && (
                                        <button
                                          type="button"
                                          onClick={() => toggleExpanded(log._id)}
                                          className="text-[11px] text-muted-foreground hover:text-foreground px-1"
                                        >
                                          zwiń
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/*
                                    "Surowe dane" pokazujemy TYLKO gdy brak `changes` — `metadata` to stara,
                                    ręcznie dobrana (i węższa) migawka sprzed migracji na from/to. Pokazywanie
                                    jej obok kompletnych chipsów zmian myli (np. nie zawiera cooldownSec mimo
                                    że chips wyżej go pokazuje) — dla wpisów z `changes` metadata nie wnosi nic.
                                  */}
                                  {!hasChanges && hasMetadata && (
                                    <button
                                      type="button"
                                      onClick={() => toggleJson(log._id)}
                                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mt-2 transition-colors"
                                    >
                                      <Braces className="w-3 h-3" />
                                      Szczegóły (starszy wpis, bez zapisanych wartości from/to)
                                      <ChevronDown className={`w-3 h-3 transition-transform ${isJsonExpanded ? "rotate-180" : ""}`} />
                                    </button>
                                  )}

                                  {isJsonExpanded && !hasChanges && hasMetadata && (
                                    <pre
                                      className="mt-2 p-2 rounded text-xs overflow-x-auto text-muted-foreground"
                                      style={{ background: "rgba(0,0,0,0.25)" }}
                                    >
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  )}
                                </div>

                                <div className="text-right shrink-0">
                                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                                    {relative || formatExactTime(date)}
                                  </div>
                                  {relative && (
                                    <div className="text-[10px] text-muted-foreground/70 whitespace-nowrap mt-0.5">
                                      {formatExactTime(date)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Paginacja */}
              {logs.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Na stronę:</span>
                    <Select value={pageSize.toString()} onValueChange={(value) => { setPageSize(Number(value)); setPage(0); }}>
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0 || loading}
                      variant="outline"
                      size="sm"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>

                    {pageNumbers[0] > 0 && <span className="text-xs text-muted-foreground px-1">…</span>}
                    {pageNumbers.map((p) => (
                      <Button
                        key={p}
                        onClick={() => setPage(p)}
                        disabled={loading}
                        variant={p === page ? "default" : "outline"}
                        size="sm"
                        className="w-8 px-0"
                      >
                        {p + 1}
                      </Button>
                    ))}
                    {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}

                    <Button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1 || loading}
                      variant="outline"
                      size="sm"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </SlideIn>
      </div>
    </div>
  );
}
