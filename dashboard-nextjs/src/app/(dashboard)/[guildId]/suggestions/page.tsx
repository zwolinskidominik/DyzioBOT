"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, ArrowLeft, Hash, Lightbulb, ThumbsUp, ThumbsDown, Trash2, ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface SuggestionConfig {
  guildId: string;
  enabled: boolean;
  suggestionChannelId: string;
}

interface Suggestion {
  _id: string;
  suggestionId: string;
  authorId: string;
  messageId: string;
  content: string;
  upvotes: string[];
  upvoteUsernames: string[];
  downvotes: string[];
  downvoteUsernames: string[];
}

export default function SuggestionsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [config, setConfig] = useState<SuggestionConfig | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<string>("upvotes");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const cacheKey = `channels_${guildId}`;
        const cached = localStorage.getItem(cacheKey);
        let channelsPromise;
        
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          if (age < 60 * 1000) {
            channelsPromise = Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
          } else {
            channelsPromise = fetch(`/api/discord/guild/${guildId}/channels`);
          }
        } else {
          channelsPromise = fetch(`/api/discord/guild/${guildId}/channels`);
        }

        const [channelsRes, configRes, suggestionsRes] = await Promise.all([
          channelsPromise,
          fetch(`/api/guild/${guildId}/suggestions/config`),
          fetch(`/api/guild/${guildId}/suggestions/list`),
        ]);

        if (channelsRes.ok) {
          const channelsData = await channelsRes.json();
          const textChannels = channelsData.filter((ch: Channel) => ch.type === 0 || ch.type === 5);
          setChannels(textChannels);
          
          if (!cached || Date.now() - JSON.parse(cached).timestamp >= 60 * 1000) {
            localStorage.setItem(cacheKey, JSON.stringify({
              data: channelsData,
              timestamp: Date.now()
            }));
          }
        }

        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
          setEnabled(configData.enabled !== undefined ? configData.enabled : true);
          setSelectedChannelId(configData.suggestionChannelId || "");
        }

        if (suggestionsRes.ok) {
          const suggestionsData = await suggestionsRes.json();
          setSuggestions(suggestionsData);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        setError("Nie udało się załadować danych sugestii. Sprawdź połączenie z internetem i spróbuj ponownie.");
        toast.error("Nie udało się załadować danych");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [guildId]);

  const handleSave = async () => {
    if (!selectedChannelId) {
      toast.error("Wybierz kanał sugestii");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/guild/${guildId}/suggestions/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          suggestionChannelId: selectedChannelId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save config");
      }

      toast.success("Konfiguracja została zapisana!");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Czy na pewno chcesz usunąć konfigurację sugestii?")) return;

    try {
      const response = await fetch(`/api/guild/${guildId}/suggestions/config`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete config");
      }

      setSelectedChannelId("");
      setConfig(null);
      toast.success("Konfiguracja została usunięta!");
    } catch (error) {
      console.error("Error deleting config:", error);
      toast.error("Nie udało się usunąć konfiguracji");
    }
  };

  const handleDeleteSuggestion = async (suggestionId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę sugestię?")) return;

    try {
      const response = await fetch(`/api/guild/${guildId}/suggestions/list?suggestionId=${suggestionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete suggestion");
      }

      setSuggestions(suggestions.filter(s => s.suggestionId !== suggestionId));
      toast.success("Sugestia została usunięta!");
    } catch (error) {
      console.error("Error deleting suggestion:", error);
      toast.error("Nie udało się usunąć sugestii");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSuggestions.size === 0) return;
    
    if (!confirm("Czy na pewno chcesz usunąć " + selectedSuggestions.size + " sugestii?")) return;

    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedSuggestions).map(suggestionId =>
        fetch(
          "/api/guild/" + guildId + "/suggestions/list?suggestionId=" + suggestionId,
          { method: "DELETE" }
        )
      );

      const results = await Promise.all(deletePromises);
      const successCount = results.filter(r => r.ok).length;
      
      if (successCount > 0) {
        setSuggestions(suggestions.filter((s) => !selectedSuggestions.has(s.suggestionId)));
        setSelectedSuggestions(new Set());
        toast.success("Usunięto " + successCount + " sugestii!");
      }
      
      if (successCount < selectedSuggestions.size) {
        toast.error("Nie udało się usunąć " + (selectedSuggestions.size - successCount) + " sugestii");
      }
    } catch (error) {
      console.error("Error bulk deleting suggestions:", error);
      toast.error("Nie udało się usunąć sugestii");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedSuggestions.size === suggestions.length) {
      setSelectedSuggestions(new Set());
    } else {
      setSelectedSuggestions(new Set(suggestions.map(s => s.suggestionId)));
    }
  };

  const toggleSelectSuggestion = (suggestionId: string) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(suggestionId)) {
      newSelected.delete(suggestionId);
    } else {
      newSelected.add(suggestionId);
    }
    setSelectedSuggestions(newSelected);
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  if (error) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
          <Button asChild variant="outline" className="mb-6">
            <Link href={`/${guildId}`}>
              <ArrowLeft className="mr-2 w-4 h-4" />
              Powrót do panelu
            </Link>
          </Button>
          <ErrorState
            title="Nie udało się załadować sugestii"
            message={error}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
          <Skeleton className="h-10 w-40 mb-6" />
          
          <Card
            className="backdrop-blur mb-6"
            style={{
              backgroundColor: 'rgba(189, 189, 189, .05)',
              boxShadow: '0 0 10px #00000026',
              border: '1px solid transparent'
            }}
          >
            <CardHeader>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-96" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="w-11 h-6 rounded-full" />
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
          
          <Card
            className="backdrop-blur"
            style={{
              backgroundColor: 'rgba(189, 189, 189, .05)',
              boxShadow: '0 0 10px #00000026',
              border: '1px solid transparent'
            }}
          >
            <CardHeader>
              <Skeleton className="h-7 w-40" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-9 w-20" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <div className="flex gap-4">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Skeleton className="h-10 w-full mt-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-4 md:p-8 max-w-4xl">
        <SlideIn direction="left">
          <Button asChild variant="outline" className="mb-6">
            <Link href={`/${guildId}`}>
              <ArrowLeft className="mr-2 w-4 h-4" />
              Powrót do panelu
            </Link>
          </Button>
        </SlideIn>

        {/* Configuration Card */}
        <SlideIn direction="up" delay={100}>
          <Card
          className="backdrop-blur mb-6"
          style={{
            backgroundColor: 'rgba(189, 189, 189, .05)',
            boxShadow: '0 0 10px #00000026',
            border: '1px solid transparent'
          }}
        >
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-2xl flex items-center gap-2">
                <Lightbulb className="w-6 h-6" />
                <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                  Konfiguracja Sugestii
                </span>
              </CardTitle>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                className="data-[state=checked]:bg-bot-primary"
                style={{ transform: 'scale(1.5)' }}
              />
            </div>
            <CardDescription>
              Skonfiguruj kanał, na którym użytkownicy mogą zostawiać sugestie dla serwera
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Channel Select */}
            <div className="space-y-2">
              <Label htmlFor="channel">
                Kanał sugestii <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                <SelectTrigger id="channel" className="w-full">
                  <SelectValue placeholder="Wybierz kanał..." />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        {channel.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Kanał, na którym będą publikowane sugestie od użytkowników
              </p>
            </div>

            {/* Current Config */}
            {config?.suggestionChannelId && (
              <div className="rounded-lg bg-background/50 p-4 space-y-2">
                <p className="text-sm font-medium">Aktualnie skonfigurowany kanał:</p>
                <p className="text-sm text-muted-foreground">
                  {channels.find((ch) => ch.id === config.suggestionChannelId)?.name ? (
                    <span className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      {channels.find((ch) => ch.id === config.suggestionChannelId)?.name}
                    </span>
                  ) : (
                    <span className="text-destructive">Kanał nie znaleziony (może został usunięty)</span>
                  )}
                </p>
              </div>
            )}

            {/* Action Button */}
            <Button onClick={handleSave} disabled={saving || !selectedChannelId} className="btn-gradient hover:scale-105 w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Zapisywanie...
                </>
              ) : (
                <>
                  <Save className="mr-2 w-4 h-4" />
                  Zapisz konfigurację
                </>
              )}
            </Button>
          </CardContent>
        </Card>
        </SlideIn>

        {/* Suggestions List */}
        <SlideIn direction="up" delay={200}>
          <Card
          className="backdrop-blur"
          style={{
            backgroundColor: 'rgba(189, 189, 189, .05)',
            boxShadow: '0 0 10px #00000026',
            border: '1px solid transparent'
          }}
        >
          <CardHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                      Wszystkie Sugestie ({
                        searchQuery.trim() 
                          ? suggestions.filter(s => s.content.toLowerCase().includes(searchQuery.toLowerCase())).length 
                          : suggestions.length
                      })
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Lista wszystkich sugestii zgłoszonych przez użytkowników
                    {searchQuery.trim() && ` (wyniki dla: "${searchQuery}")`}
                  </CardDescription>
                </div>
                {suggestions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Sortuj..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upvotes">Najwięcej upvote'ów</SelectItem>
                        <SelectItem value="downvotes">Najwięcej downvote'ów</SelectItem>
                        <SelectItem value="total">Najwięcej głosów</SelectItem>
                        <SelectItem value="newest">Najnowsze</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={toggleSelectAll}
                    >
                      {selectedSuggestions.size === suggestions.length ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
                    </Button>
                    {selectedSuggestions.size > 0 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDelete}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Usuń zaznaczone ({selectedSuggestions.size})
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              {suggestions.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Szukaj w sugestiach..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full"
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {suggestions.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mb-4">
                  <Lightbulb className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Brak sugestii</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Użytkownicy mogą zgłaszać sugestie za pomocą komendy. Wszystkie zgłoszenia pojawią się tutaj.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const filtered = [...suggestions].filter((suggestion) => {
                    if (!searchQuery.trim()) return true;
                    const query = searchQuery.toLowerCase();
                    return suggestion.content.toLowerCase().includes(query);
                  });

                  if (filtered.length === 0 && searchQuery.trim()) {
                    return (
                      <div className="text-center py-16 px-4">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mb-4">
                          <Search className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold text-lg mb-2">Brak wyników</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                          Nie znaleziono sugestii pasujących do "{searchQuery}"
                        </p>
                      </div>
                    );
                  }

                  return filtered
                  .sort((a, b) => {
                    switch (sortBy) {
                      case "upvotes":
                        return b.upvotes.length - a.upvotes.length;
                      case "downvotes":
                        return b.downvotes.length - a.downvotes.length;
                      case "total":
                        return (b.upvotes.length + b.downvotes.length) - (a.upvotes.length + a.downvotes.length);
                      case "newest":
                        return parseInt(b.suggestionId) - parseInt(a.suggestionId);
                      default:
                        return 0;
                    }
                  })
                  .map((suggestion, index) => (
                  <SlideIn key={suggestion.suggestionId} direction="up" delay={index * 50}>
                    <div
                      className="p-4 rounded-lg bg-background/50 border border-transparent hover:bg-background/70 hover:shadow-lg hover:shadow-bot-primary/15 hover:border-bot-primary/30 transition-all duration-300"
                    >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedSuggestions.has(suggestion.suggestionId)}
                        onChange={() => toggleSelectSuggestion(suggestion.suggestionId)}
                        className="mt-1 h-4 w-4 rounded appearance-none border-2 border-gray-500/40 bg-gray-700/30 transition-all duration-200 cursor-pointer hover:border-bot-primary/60 hover:bg-gray-600/30 focus:outline-none focus:ring-2 focus:ring-bot-primary/40 checked:bg-bot-primary checked:border-bot-primary checked:hover:bg-bot-blue"
                        style={{
                          backgroundImage: selectedSuggestions.has(suggestion.suggestionId) 
                            ? "url(\"data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e\")"
                            : 'none',
                          backgroundSize: '100% 100%',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat'
                        }}
                      />
                    <div className="flex flex-1 items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm break-words whitespace-pre-wrap">{suggestion.content}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-8 w-8 p-0 hover:bg-bot-primary/10 hover:text-bot-primary"
                          title="Skocz do wiadomości"
                        >
                          <a
                            href={`https://discord.com/channels/${guildId}/${config?.suggestionChannelId}/${suggestion.messageId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSuggestion(suggestion.suggestionId)}
                          className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                          title="Usuń sugestię"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground ml-8">
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="w-4 h-4 text-green-500" />
                        <span>{suggestion.upvotes.length}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ThumbsDown className="w-4 h-4 text-red-500" />
                        <span>{suggestion.downvotes.length}</span>
                      </div>
                      <div className="ml-auto text-xs">
                        ID: {suggestion.suggestionId.slice(0, 8)}
                      </div>
                    </div>
                  </div>
                  </SlideIn>
                ))})()}
              </div>
            )}
          </CardContent>
        </Card>
        </SlideIn>
      </div>
    </div>
  );
}
