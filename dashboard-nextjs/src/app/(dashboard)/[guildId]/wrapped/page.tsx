"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, ArrowLeft, PartyPopper, Hash, AlertCircle, Calendar } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface WrappedConfig {
  guildId: string;
  channelId?: string;
  enabled: boolean;
}

export default function WrappedPage() {
  const params = useParams();
  const guildId = params.guildId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);

  const [config, setConfig] = useState<WrappedConfig>({
    guildId,
    channelId: undefined,
    enabled: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [channelsData, configRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, 'channels', `/api/discord/guild/${guildId}/channels`),
          fetchWithAuth(`/api/guild/${guildId}/wrapped/config`, { next: { revalidate: 600 } }),
        ]);

        if (channelsData) {
          const textChannels = channelsData.filter((ch: Channel) => ch.type === 0 || ch.type === 5);
          setChannels(textChannels);
        }

        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
        }
      } catch (error) {
        console.error("Error loading wrapped config:", error);
        setError("Nie udało się załadować konfiguracji Server Wrapped. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [guildId]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const response = await fetch(`/api/guild/${guildId}/wrapped/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      const savedConfig = await response.json();
      setConfig(savedConfig);
      toast.success("Konfiguracja została zapisana!");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  };

  const getChannelName = (channelId: string) => {
    return channels.find(c => c.id === channelId)?.name || 'Nieznany kanał';
  };

  if (error) {
    return <ErrorState message={error} onRetry={handleRetry} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
          <Skeleton className="h-10 w-48 mb-6" />
          <Card className="backdrop-blur">
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96 mt-2" />
            </CardHeader>
            <CardContent className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
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

        <SlideIn direction="up" delay={100}>
          <Card className="backdrop-blur" style={{
            backgroundColor: 'rgba(189, 189, 189, .05)',
            boxShadow: '0 0 10px #00000026',
            border: '1px solid transparent'
          }}>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <PartyPopper className="w-6 h-6 text-bot-primary" />
                  <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                    Server Wrapped
                  </span>
                </CardTitle>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                  className="data-[state=checked]:bg-bot-primary"
                  style={{ transform: 'scale(1.5)' }}
                />
              </div>
              <CardDescription>
                Automatyczne podsumowanie serwera na jego urodziny (11 listopada)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Current Channel Display */}
              {config.channelId && (
                <div className="p-4 rounded-lg bg-bot-primary/10 border border-bot-primary/20">
                  <p className="text-sm text-muted-foreground mb-2">Aktualnie skonfigurowany kanał:</p>
                  <div className="flex items-center gap-2 font-medium">
                    <Hash className="w-4 h-4 text-bot-primary" />
                    <span className="text-bot-primary">{getChannelName(config.channelId)}</span>
                  </div>
                </div>
              )}

              {/* Channel Selection */}
              <div className="space-y-2">
                <Label htmlFor="channel">Kanał do wysyłania Wrapped</Label>
                <Select
                  value={config.channelId || ""}
                  onValueChange={(value) => setConfig({ ...config, channelId: value || undefined })}
                  disabled={!config.enabled}
                >
                  <SelectTrigger id="channel">
                    <SelectValue placeholder="Wybierz kanał..." />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4" />
                          {channel.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Wybierz kanał tekstowy, na którym bot wyśle podsumowanie serwera
                </p>
              </div>

              {/* Info Box */}
              <div className="flex gap-3 p-4 rounded-lg bg-bot-primary/10 border border-bot-primary/20">
                <AlertCircle className="w-5 h-5 text-bot-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Jak to działa?</p>
                  <p className="text-xs text-muted-foreground">
                    Każdego roku 11 listopada o godzinie 12:00 bot automatycznie wygeneruje piękne podsumowanie
                    serwera w formie grafiki — z top aktywnymi użytkownikami, statystykami wiadomości, czasu
                    na kanałach głosowych, giveawayami i więcej!
                  </p>
                </div>
              </div>

              {/* Date Info */}
              <div className="flex gap-3 p-4 rounded-lg bg-muted/30 border border-muted/50">
                <Calendar className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Data urodzin serwera</p>
                  <p className="text-xs text-muted-foreground">
                    11 listopada 2022 — podsumowanie zostanie automatycznie wysłane w rocznicę założenia serwera.
                  </p>
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={saving || !config.enabled || !config.channelId}
                className="btn-gradient hover:scale-105 w-full"
              >
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
