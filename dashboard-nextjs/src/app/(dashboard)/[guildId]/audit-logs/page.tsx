"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ScrollText, Filter, X } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";

interface AuditLog {
  _id: string;
  guildId: string;
  userId: string;
  username: string;
  action: string;
  module: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export default function AuditLogsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [page, setPage] = useState(0);
  const limit = 50;

  useEffect(() => {
    fetchLogs();
  }, [guildId, moduleFilter, page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        limit: limit.toString(),
        skip: (page * limit).toString(),
      });
      
      if (moduleFilter) {
        params.append('module', moduleFilter);
      }

      const response = await fetch(`/api/guild/${guildId}/audit-logs?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setTotal(data.total);
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error loading audit logs:", error);
      setError("Nie udało się załadować logów systemowych.");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    fetchLogs();
  };

  const clearFilter = () => {
    setModuleFilter("");
    setPage(0);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pl-PL', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(date);
  };

  const getModuleName = (module: string) => {
    const names: Record<string, string> = {
      channel_stats: 'Kanały z licznikami',
      temp_channels: 'Tymczasowe kanały',
      levels: 'System poziomów',
      greetings: 'Powitania',
      logs: 'Logi',
      suggestions: 'Sugestie',
      tickets: 'Tickety',
    };
    return names[module] || module;
  };

  const getActionColor = (action: string) => {
    if (action.includes('create')) return 'text-green-600 dark:text-green-400';
    if (action.includes('update')) return 'text-blue-600 dark:text-blue-400';
    if (action.includes('delete')) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  if (error) {
    return <ErrorState message={error} onRetry={handleRetry} />;
  }

  if (loading && logs.length === 0) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto p-4 md:p-8 max-w-6xl">
          <Skeleton className="h-10 w-48 mb-6" />
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

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-4 md:p-8 max-w-6xl">
        <SlideIn direction="left">
          <Button asChild variant="outline" className="mb-6">
            <Link href={`/${guildId}`}>
              <ArrowLeft className="mr-2 w-4 h-4" />
              Powrót do panelu
            </Link>
          </Button>
        </SlideIn>

        <SlideIn direction="up" delay={100}>
          <Card className="backdrop-blur" style={{
            backgroundColor: 'rgba(189, 189, 189, .05)',
            boxShadow: '0 0 10px #00000026',
            border: '1px solid transparent'
          }}>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <ScrollText className="w-6 h-6 text-bot-primary" />
                Logi Systemowe
              </CardTitle>
              <CardDescription>
                Historia wszystkich zmian dokonanych w panelu administracyjnym
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex gap-2 items-center">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={moduleFilter || "all"} onValueChange={(value) => { setModuleFilter(value === "all" ? "" : value); setPage(0); }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filtruj po module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie moduły</SelectItem>
                    <SelectItem value="channel_stats">Kanały z licznikami</SelectItem>
                    <SelectItem value="temp_channels">Tymczasowe kanały</SelectItem>
                    <SelectItem value="levels">System poziomów</SelectItem>
                    <SelectItem value="greetings">Powitania</SelectItem>
                    <SelectItem value="logs">Logi</SelectItem>
                  </SelectContent>
                </Select>
                {moduleFilter && (
                  <Button onClick={clearFilter} variant="ghost" size="sm">
                    <X className="w-4 h-4 mr-1" />
                    Wyczyść
                  </Button>
                )}
                <span className="ml-auto text-sm text-muted-foreground">
                  Znaleziono: {total}
                </span>
              </div>

              {/* Logs List */}
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ScrollText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Brak logów systemowych</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log._id}
                      className="flex items-start gap-4 p-4 rounded-lg bg-background/50 border border-border/50 hover:bg-background/80 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{log.username}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">{getModuleName(log.module)}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className={`text-xs font-medium ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </div>
                        {log.description && (
                          <p className="text-sm text-muted-foreground mb-1">
                            {log.description}
                          </p>
                        )}
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <details className="text-xs text-muted-foreground mt-2">
                            <summary className="cursor-pointer hover:text-foreground">
                              Szczegóły
                            </summary>
                            <pre className="mt-2 p-2 rounded bg-background/50 overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                  <Button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0 || loading}
                    variant="outline"
                    size="sm"
                  >
                    Poprzednia
                  </Button>
                  <span className="flex items-center px-4 text-sm text-muted-foreground">
                    Strona {page + 1} z {totalPages}
                  </span>
                  <Button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1 || loading}
                    variant="outline"
                    size="sm"
                  >
                    Następna
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </SlideIn>
      </div>
    </div>
  );
}
