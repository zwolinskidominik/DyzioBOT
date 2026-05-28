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
import { toSortedDiscordChannels } from "@/lib/discordOrdering";

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
  const [enabled, setEnabled] = useState(false);
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

        const [channelsRes, configRes] = await Promise.all([
          channelsPromise,
          fetch(`/api/guild/${guildId}/suggestions/config`),
        ]);

        if (channelsRes.ok) {
          const channelsData = toSortedDiscordChannels(await channelsRes.json()) as Channel[];
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
          setEnabled(configData.enabled !== undefined ? configData.enabled : false);
          setSelectedChannelId(configData.suggestionChannelId || "");
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
        <div className="w-full">
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
        <div className="w-full">
          <Skeleton className="h-10 w-40 mb-6" />
          
          <Card
            className="backdrop-blur mb-6"
            style={{
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
      <div className="w-full">


        {/* Configuration Card */}
        <SlideIn direction="up" delay={100}>
          <Card
          className="backdrop-blur mb-6"
          style={{
            boxShadow: '0 0 10px #00000026',
            border: '1px solid transparent'
          }}
        >
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-2xl flex items-center gap-2">
                <Lightbulb className="w-6 h-6 text-bot-primary" />
                <span className="text-white/90">
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
                    <span className="text-destructive text-xs">Kanał usunięty</span>
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

      </div>
    </div>
  );
}
