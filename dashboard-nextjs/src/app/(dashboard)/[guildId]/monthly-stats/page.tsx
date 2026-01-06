"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, ArrowLeft, BarChart3, Hash, AlertCircle, Users, MessageSquare, Mic } from "lucide-react";
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

interface MonthlyStatsConfig {
  guildId: string;
  channelId?: string;
  enabled: boolean;
  topCount: number;
}

interface GuildMember {
  id: string;
  username: string;
  discriminator: string;
}

interface UserStats {
  userId: string;
  messageCount: number;
  voiceMinutes: number;
  totalActivity: number;
  rank: number;
}

export default function MonthlyStatsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [currentStats, setCurrentStats] = useState<UserStats[]>([]);
  const [currentMonth, setCurrentMonth] = useState<string>('');
  
  const [config, setConfig] = useState<MonthlyStatsConfig>({
    guildId,
    channelId: undefined,
    enabled: true,
    topCount: 10,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [channelsData, configRes, statsRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, 'channels', `/api/discord/guild/${guildId}/channels`),
          fetchWithAuth(`/api/guild/${guildId}/monthly-stats/config`, { next: { revalidate: 600 } }),
          fetchWithAuth(`/api/guild/${guildId}/monthly-stats/current?limit=25`, { next: { revalidate: 300 } }),
        ]);

        if (channelsData) {
          const textChannels = channelsData.filter((ch: Channel) => ch.type === 0);
          setChannels(textChannels);
        }

        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setCurrentStats(statsData.stats || []);
          setCurrentMonth(statsData.month || '');
        }
        
        setLoading(false);

        fetchGuildData<GuildMember[]>(guildId, 'members', `/api/discord/guild/${guildId}/members`)
          .then(membersData => {
            if (membersData) {
              setMembers(membersData);
            }
          })
          .catch(err => console.error('Failed to load members:', err));

      } catch (error) {
        console.error("Error loading monthly stats data:", error);
        setError("Nie udało się załadować danych statystyk miesięcznych. Sprawdź połączenie z internetem i spróbuj ponownie.");
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

      const response = await fetch(`/api/guild/${guildId}/monthly-stats/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

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

  const getMemberDisplay = (userId: string) => {
    const member = members.find(m => m.id === userId);
    if (member) {
      return member.discriminator === '0' 
        ? member.username 
        : `${member.username}#${member.discriminator}`;
    }
    return `User ${userId.slice(0, 8)}`;
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 
                    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
    return `${months[parseInt(month) - 1]} ${year}`;
  };

  if (error) {
    return <ErrorState message={error} onRetry={handleRetry} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto p-4 md:p-8 max-w-6xl">
          <Skeleton className="h-10 w-48 mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="backdrop-blur">
                <CardHeader>
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-4 w-96 mt-2" />
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            <div>
              <Card className="backdrop-blur">
                <CardHeader>
                  <Skeleton className="h-7 w-32" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Section */}
          <div className="lg:col-span-2">
            <SlideIn direction="up" delay={100}>
              <Card className="backdrop-blur" style={{
                backgroundColor: 'rgba(189, 189, 189, .05)',
                boxShadow: '0 0 10px #00000026',
                border: '1px solid transparent'
              }}>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <BarChart3 className="w-6 h-6 text-bot-primary" />
                      <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                        Statystyki Miesięczne
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
                    Konfiguracja automatycznych statystyk aktywności na serwerze
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">

                  {/* Channel Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="channel">Kanał do wysyłania statystyk</Label>
                    <Select
                      value={config.channelId || ""}
                      onValueChange={(value) => setConfig({ ...config, channelId: value || undefined })}
                      disabled={!config.enabled}
                    >
                      <SelectTrigger id="channel">
                        <SelectValue placeholder="Wybierz kanał...">
                          {config.channelId && (
                            <div className="flex items-center gap-2">
                              <Hash className="w-4 h-4" />
                              {getChannelName(config.channelId)}
                            </div>
                          )}
                        </SelectValue>
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
                      Wybierz kanał tekstowy, na którym bot będzie publikował miesięczne statystyki
                    </p>
                  </div>

                  {/* Top Count */}
                  <div className="space-y-2">
                    <Label htmlFor="topCount">Ilość wyświetlanych użytkowników</Label>
                    <Select
                      value={config.topCount?.toString() || "10"}
                      onValueChange={(value) => setConfig({ ...config, topCount: parseInt(value) })}
                      disabled={!config.enabled}
                    >
                      <SelectTrigger id="topCount">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 15, 20, 25].map((count) => (
                          <SelectItem key={count} value={count.toString()}>
                            Top {count}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Ile najaktywniejszych użytkowników pokazać w statystykach (1-25)
                    </p>
                  </div>

                  {/* Info Box */}
                  <div className="flex gap-3 p-4 rounded-lg bg-bot-primary/10 border border-bot-primary/20">
                    <AlertCircle className="w-5 h-5 text-bot-primary flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Jak to działa?</p>
                      <p className="text-xs text-muted-foreground">
                        Bot automatycznie zbiera statystyki aktywności (wiadomości, czas na kanałach głosowych) 
                        i publikuje podsumowanie pierwszego dnia każdego miesiąca na wybranym kanale.
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

          {/* Current Stats Sidebar */}
          <div>
            <SlideIn direction="up" delay={200}>
              <Card className="backdrop-blur sticky top-4" style={{
                backgroundColor: 'rgba(189, 189, 189, .05)',
                boxShadow: '0 0 10px #00000026',
                border: '1px solid transparent'
              }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-bot-primary" />
                    Aktualna Topka
                  </CardTitle>
                  <CardDescription>
                    {currentMonth && formatMonth(currentMonth)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {currentStats.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                        <Users className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Brak danych w tym miesiącu
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 overflow-hidden max-h-[600px] overflow-y-auto">
                      {currentStats.slice(0, config.topCount).map((stat, index) => (
                        <SlideIn key={stat.userId} direction="up" delay={index * 30}>
                          <div className={`flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-transparent hover:bg-background/70 hover:shadow-lg hover:shadow-bot-primary/15 transition-all duration-300 ${
                            index < 3 ? 'hover:border-yellow-500/30' : 'hover:border-bot-primary/30'
                          }`}>
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm flex-shrink-0 ${
                              index === 0 ? 'bg-yellow-500 text-white' :
                              index === 1 ? 'bg-gray-400 text-white' :
                              index === 2 ? 'bg-orange-600 text-white' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              #{stat.rank}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {getMemberDisplay(stat.userId)}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {stat.messageCount}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Mic className="w-3 h-3" />
                                  {stat.voiceMinutes}m
                                </span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-xs font-medium text-bot-primary">
                                {stat.totalActivity}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                pkt
                              </div>
                            </div>
                          </div>
                        </SlideIn>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </SlideIn>
          </div>
        </div>
      </div>
    </div>
  );
}
