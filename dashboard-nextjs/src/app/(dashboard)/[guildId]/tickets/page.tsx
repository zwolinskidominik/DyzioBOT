"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Send, ArrowLeft, Ticket, Hash, User } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { SlideIn } from "@/components/ui/animated";

interface Category {
  id: string;
  name: string;
  type: number;
}

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface TicketConfig {
  guildId: string;
  enabled: boolean;
  categoryId: string;
  panelChannelId?: string;
}

interface TicketStat {
  _id: string;
  guildId: string;
  userId: string;
  count: number;
}

interface GuildMember {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

export default function TicketsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [config, setConfig] = useState<TicketConfig | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedPanelChannelId, setSelectedPanelChannelId] = useState("");
  const [stats, setStats] = useState<TicketStat[]>([]);
  const [members, setMembers] = useState<GuildMember[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [channelsRes, configRes, statsRes, membersRes] = await Promise.all([
          fetch(`/api/discord/guild/${guildId}/channels`),
          fetch(`/api/guild/${guildId}/tickets/config`),
          fetch(`/api/guild/${guildId}/tickets/stats`),
          fetch(`/api/discord/guild/${guildId}/members`),
        ]);

        if (channelsRes.ok) {
          const channelsData = await channelsRes.json();
          const categoryChannels = channelsData.filter((ch: Category) => ch.type === 4);
          setCategories(categoryChannels);
          const textChannels = channelsData.filter((ch: Channel) => ch.type === 0 || ch.type === 5);
          setChannels(textChannels);
        }

        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
          setEnabled(configData.enabled !== undefined ? configData.enabled : true);
          setSelectedCategoryId(configData.categoryId || "");
          setSelectedPanelChannelId(configData.panelChannelId || "");
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (membersRes.ok) {
          const membersData = await membersRes.json();
          setMembers(membersData);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        setError("Nie udało się załadować danych tickets. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [guildId]);

  const handleSave = async () => {
    if (!selectedPanelChannelId) {
      toast.error("Wybierz kanał panelu ticketów");
      return;
    }

    const selectedChannel = channels.find(ch => ch.id === selectedPanelChannelId);
    if (!selectedChannel) {
      toast.error("Wybrany kanał nie został znaleziony");
      return;
    }

    const channelCategoryId = (selectedChannel as any).parent_id;
    
    if (!channelCategoryId) {
      toast.error("Wybrany kanał nie należy do żadnej kategorii. Wybierz kanał, który jest w kategorii.");
      return;
    }

    try {
      setSaving(true);
      const response = await fetchWithAuth(`/api/guild/${guildId}/tickets/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          categoryId: channelCategoryId,
          panelChannelId: selectedPanelChannelId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save config");
      }

      toast.success("Panel ticketów został wysłany na kanał!");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  };

  const getMemberDisplay = (userId: string) => {
    const member = members.find((m) => m.id === userId);
    if (member) {
      return member.discriminator === '0' 
        ? member.username 
        : `${member.username}#${member.discriminator}`;
    }
    return `User ${userId}`;
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
            title="Nie udało się załadować ticketów"
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
              <Skeleton className="h-8 w-56 mb-2" />
              <Skeleton className="h-4 w-96" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="w-11 h-6 rounded-full" />
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
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
              <Skeleton className="h-7 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-6 w-16" />
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
                <Ticket className="w-6 h-6" />
                <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                  Konfiguracja Ticketów
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
              Skonfiguruj system ticketów wsparcia dla użytkowników serwera
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Panel Channel Select */}
            <div className="space-y-2">
              <Label htmlFor="panelChannel">
                Kanał panelu ticketów <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedPanelChannelId} onValueChange={setSelectedPanelChannelId}>
                <SelectTrigger id="panelChannel" className="w-full">
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
                Kanał, na którym zostanie wysłany panel z przyciskiem do tworzenia ticketów. Kategoria zostanie automatycznie pobrana z tego kanału.
              </p>
            </div>

            {/* Current Config */}
            {(config?.categoryId || config?.panelChannelId) && (
              <div className="rounded-lg bg-background/50 p-4 space-y-2">
                {config.categoryId && (
                  <div>
                    <p className="text-sm font-medium">Kategoria ticketów:</p>
                    <p className="text-sm text-muted-foreground">
                      {categories.find((cat) => cat.id === config.categoryId)?.name ? (
                        <span className="flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          {categories.find((cat) => cat.id === config.categoryId)?.name}
                        </span>
                      ) : (
                        <span className="text-destructive">Kategoria nie znaleziona (może została usunięta)</span>
                      )}
                    </p>
                  </div>
                )}
                {config.panelChannelId && (
                  <div>
                    <p className="text-sm font-medium">Kanał panelu:</p>
                    <p className="text-sm text-muted-foreground">
                      {channels.find((ch) => ch.id === config.panelChannelId)?.name ? (
                        <span className="flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          {channels.find((ch) => ch.id === config.panelChannelId)?.name}
                        </span>
                      ) : (
                        <span className="text-destructive">Kanał nie znaleziony (może został usunięty)</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Info Box */}
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
              <p className="text-sm font-medium mb-2">💡 Jak to działa?</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Użytkownicy mogą tworzyć tickety używając komendy lub przycisku</li>
                <li>Każdy ticket to prywatny kanał w wybranej kategorii</li>
                <li>Tylko autor i moderatorzy mają dostęp do kanału</li>
                <li>Tickety można zamykać, co archiwizuje kanał</li>
              </ul>
            </div>

            {/* Action Button */}
            <Button onClick={handleSave} disabled={saving || !selectedPanelChannelId} className="btn-gradient hover:scale-105 w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Wysyłanie...
                </>
              ) : (
                <>
                  <Send className="mr-2 w-4 h-4" />
                  Wyślij na kanał
                </>
              )}
            </Button>
          </CardContent>
        </Card>
        </SlideIn>

        {/* Stats Card */}
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
            <CardTitle className="text-xl flex items-center gap-2">
              <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                Statystyki Ticketów
              </span>
            </CardTitle>
            <CardDescription>
              Top 10 użytkowników z największą liczbą utworzonych ticketów
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mb-4">
                  <Ticket className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Brak statystyk</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Statystyki pojawią się po utworzeniu pierwszych ticketów przez użytkowników.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.map((stat, index) => (
                  <SlideIn key={stat._id} direction="up" delay={index * 50}>
                  <div
                    className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border hover:bg-background/70 hover:shadow-lg hover:shadow-bot-primary/15 hover:scale-[1.02] hover:border-bot-primary/30 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-bot-primary/10 text-bot-primary font-bold text-sm">
                        #{index + 1}
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{getMemberDisplay(stat.userId)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-muted-foreground" />
                      <span className="font-bold">{stat.count}</span>
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
  );
}
