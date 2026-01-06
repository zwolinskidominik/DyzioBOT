"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, ArrowLeft, Mic, Hash, AlertCircle, Users, Plus, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchGuildData } from "@/lib/cache";

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface TempChannelConfig {
  guildId: string;
  channelIds: string[];
}

interface ActiveTempChannel {
  _id: string;
  guildId: string;
  parentId: string;
  channelId: string;
  ownerId: string;
  controlMessageId?: string;
}

export default function TempChannelsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeTempChannels, setActiveTempChannels] = useState<ActiveTempChannel[]>([]);
  
  const [config, setConfig] = useState<TempChannelConfig>({
    guildId,
    channelIds: [],
  });

  const [selectedChannelId, setSelectedChannelId] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [channelsData, configRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, 'channels', `/api/discord/guild/${guildId}/channels`),
          fetch(`/api/guild/${guildId}/temp-channels/config`),
        ]);

        if (channelsData) {
          setChannels(channelsData);
        }

        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
        }

        const activeTempRes = await fetch(`/api/guild/${guildId}/temp-channels/active`);
        if (activeTempRes.ok) {
          const activeTempData = await activeTempRes.json();
          setActiveTempChannels(activeTempData);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading temp channels data:", error);
        setError("Nie udało się załadować danych tymczasowych kanałów. Sprawdź połączenie z internetem i spróbuj ponownie.");
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

      if ((config.channelIds || []).length === 0) {
        const response = await fetch(`/api/guild/${guildId}/temp-channels/config`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete configuration");
        }

        toast.success("Konfiguracja została usunięta!");
        return;
      }

      const response = await fetch(`/api/guild/${guildId}/temp-channels/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channelIds: config.channelIds || [] }),
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

  const handleAddChannel = () => {
    if (!selectedChannelId) {
      toast.error("Wybierz kanał głosowy!");
      return;
    }
    
    if ((config.channelIds || []).includes(selectedChannelId)) {
      toast.error("Ten kanał jest już dodany!");
      return;
    }

    setConfig({
      ...config,
      channelIds: [...(config.channelIds || []), selectedChannelId],
    });
    setSelectedChannelId("");
    toast.success("Kanał dodany!");
  };

  const handleRemoveChannel = (channelId: string) => {
    setConfig({
      ...config,
      channelIds: (config.channelIds || []).filter(id => id !== channelId),
    });
    toast.success("Kanał usunięty!");
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
              <div className="space-y-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const voiceChannels = channels.filter(ch => ch.type === 2);

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
              <CardTitle className="text-2xl flex items-center gap-2">
                <Mic className="w-6 h-6 text-bot-primary" />
                Tymczasowe Kanały
              </CardTitle>
              <CardDescription>
                Konfiguracja systemu tymczasowych kanałów głosowych
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Info Box */}
              <div className="flex gap-3 p-4 rounded-lg bg-bot-primary/10 border border-bot-primary/20">
                <AlertCircle className="w-5 h-5 text-bot-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Jak to działa?</p>
                  <p className="text-xs text-muted-foreground">
                    Wybierz kanał głosowy, który będzie służył jako "kreator". 
                    Gdy użytkownik dołączy do tego kanału, bot automatycznie utworzy dla niego prywatny kanał tymczasowy. 
                    Kanał zostanie usunięty gdy wszyscy go opuszczą.
                  </p>
                </div>
              </div>

              {/* Channel Selection */}
              <SlideIn direction="up" delay={150}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="creator-channel">
                      Dodaj kanał kreator
                      <span className="ml-2 text-xs text-muted-foreground">(kanał głosowy)</span>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">
                      Możesz dodać wiele kanałów - każdy z nich będzie tworzył tymczasowe kanały.
                    </p>
                    <div className="flex gap-2">
                      <Select
                        value={selectedChannelId}
                        onValueChange={setSelectedChannelId}
                      >
                        <SelectTrigger id="creator-channel" className="flex-1">
                          <SelectValue placeholder="Wybierz kanał głosowy...">
                            {selectedChannelId && (
                              <div className="flex items-center gap-2">
                                <Mic className="w-4 h-4" />
                                {getChannelName(selectedChannelId)}
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {voiceChannels.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground">
                              Brak kanałów głosowych
                            </div>
                          ) : (
                            voiceChannels
                              .filter(ch => !(config.channelIds || []).includes(ch.id))
                              .map((channel) => (
                                <SelectItem key={channel.id} value={channel.id}>
                                  <div className="flex items-center gap-2">
                                    <Mic className="w-4 h-4" />
                                    {channel.name}
                                  </div>
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleAddChannel}
                        disabled={!selectedChannelId}
                        variant="outline"
                        size="icon"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* List of configured channels */}
                  {(config.channelIds || []).length > 0 && (
                    <div className="space-y-2">
                      <Label>Skonfigurowane kanały kreatory ({(config.channelIds || []).length})</Label>
                      <div className="space-y-2">
                        {(config.channelIds || []).map((channelId) => (
                          <div
                            key={channelId}
                            className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50"
                          >
                            <div className="flex items-center gap-2">
                              <Mic className="w-4 h-4 text-bot-primary" />
                              <span className="text-sm font-medium">
                                {getChannelName(channelId)}
                              </span>
                            </div>
                            <Button
                              onClick={() => handleRemoveChannel(channelId)}
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </SlideIn>

              {/* Active Temp Channels List */}
              {activeTempChannels.length > 0 && (
                <SlideIn direction="up" delay={200}>
                  <Card className="backdrop-blur bg-background/30">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="w-5 h-5 text-bot-primary" />
                        Aktywne Kanały Tymczasowe
                      </CardTitle>
                      <CardDescription>
                        Lista obecnie utworzonych kanałów tymczasowych
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {activeTempChannels.map((tempChannel) => {
                          const channel = channels.find(c => c.id === tempChannel.channelId);
                          const ownerMention = `<@${tempChannel.ownerId}>`;
                          
                          return (
                            <div
                              key={tempChannel._id}
                              className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50"
                            >
                              <div className="flex items-center gap-3">
                                <Mic className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">
                                    {channel?.name || 'Kanał usunięty'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Właściciel: {ownerMention}
                                  </p>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ID: {tempChannel.channelId}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </SlideIn>
              )}

              <Button 
                onClick={handleSave} 
                disabled={saving}
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
                    {(config.channelIds || []).length === 0 ? 'Usuń konfigurację' : 'Zapisz konfigurację'}
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
