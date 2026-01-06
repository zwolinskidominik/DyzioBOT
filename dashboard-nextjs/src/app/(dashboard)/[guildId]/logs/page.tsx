"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, ArrowLeft, FileText, Hash, Palette } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { SlideIn } from "@/components/ui/animated";

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface LogEventConfig {
  name: string;
  emoji: string;
  color: number;
  description: string;
}

interface LogConfig {
  guildId: string;
  enabled?: boolean;
  logChannels: Record<string, string>;
  enabledEvents: Record<string, boolean>;
  colorOverrides: Record<string, string>;
}

const LOG_EVENT_CONFIGS: Record<string, LogEventConfig> = {
  memberBan: { name: 'Zbanowanie członka', emoji: '🔨', color: 0xFF0000, description: 'Użytkownik został zbanowany' },
  memberUnban: { name: 'Odbanowanie członka', emoji: '✈️', color: 0xFAA61A, description: 'Użytkownik został odbanowany' },
  memberKick: { name: 'Wyrzucenie członka', emoji: '👢', color: 0xFF4444, description: 'Użytkownik został wyrzucony' },
  memberTimeout: { name: 'Wyciszenie', emoji: '🔇', color: 0xFF8800, description: 'Wyciszenie (nadane/usunięte)' },
  moderationCommand: { name: 'Komenda moderacyjna', emoji: '⚖️', color: 0xFFAA00, description: 'Użyto komendy moderacyjnej' },
  
  messageDelete: { name: 'Usunięcie wiadomości', emoji: '🗑️', color: 0xFF6B6B, description: 'Wiadomość została usunięta' },
  messageEdit: { name: 'Edycja wiadomości', emoji: '✏️', color: 0x4A90E2, description: 'Wiadomość została zedytowana' },
  
  memberJoin: { name: 'Członek dołączył', emoji: '📥', color: 0x43B581, description: 'Nowy członek dołączył do serwera' },
  memberLeave: { name: 'Członek opuścił', emoji: '📤', color: 0xFAA61A, description: 'Członek opuścił serwer' },
  memberNicknameChange: { name: 'Zmiana pseudonimu', emoji: '📝', color: 0x95A5A6, description: 'Zmieniono pseudonim' },
  memberRoleAdd: { name: 'Nadanie roli', emoji: '➕', color: 0x3498DB, description: 'Nadano rolę' },
  memberRoleRemove: { name: 'Usunięcie roli', emoji: '➖', color: 0xE74C3C, description: 'Usunięto rolę' },
  
  voiceJoin: { name: 'Dołączył do VC', emoji: '🔊', color: 0x9B59B6, description: 'Dołączył do kanału głosowego' },
  voiceLeave: { name: 'Opuścił VC', emoji: '🔇', color: 0xE91E63, description: 'Opuścił kanał głosowy' },
  voiceMove: { name: 'Przełączył kanał VC', emoji: '🔄', color: 0x8E44AD, description: 'Przełączył się między kanałami głosowymi' },
  voiceDisconnect: { name: 'Odłączony od VC', emoji: '⚡', color: 0xC0392B, description: 'Odłączony od kanału głosowego (force)' },
  voiceMemberMove: { name: 'Przeniesiony do VC', emoji: '👉', color: 0xD35400, description: 'Przeniesiony do innego kanału (moderator)' },
  voiceStateChange: { name: 'Stan głosu', emoji: '🎤', color: 0x7F8C8D, description: 'Stan głosu (mute/deaf/stream/camera)' },
  
  channelCreate: { name: 'Utworzenie kanału', emoji: '📁', color: 0x1ABC9C, description: 'Utworzono kanał' },
  channelDelete: { name: 'Usunięcie kanału', emoji: '🗑️', color: 0xE67E22, description: 'Usunięto kanał' },
  channelUpdate: { name: 'Aktualizacja kanału', emoji: '✏️', color: 0x16A085, description: 'Zaktualizowano kanał' },
  channelPermissionUpdate: { name: 'Aktualizacja uprawnień', emoji: '🔐', color: 0x2C3E50, description: 'Zaktualizowano uprawnienia kanału' },
  
  threadCreate: { name: 'Tworzenie wątku', emoji: '🧵', color: 0x5DADE2, description: 'Utworzono wątek' },
  threadDelete: { name: 'Usuwanie wątku', emoji: '🗑️', color: 0xF39C12, description: 'Usunięto wątek' },
  threadUpdate: { name: 'Aktualizacja wątku', emoji: '✏️', color: 0x3498DB, description: 'Zaktualizowano wątek' },
  
  roleCreate: { name: 'Utworzenie roli', emoji: '🎭', color: 0xF1C40F, description: 'Utworzono rolę' },
  roleDelete: { name: 'Usunięcie roli', emoji: '🗑️', color: 0xE74C3C, description: 'Usunięto rolę' },
  roleUpdate: { name: 'Aktualizacja roli', emoji: '✏️', color: 0xE67E22, description: 'Zaktualizowano rolę' },
  
  guildUpdate: { name: 'Aktualizacja serwera', emoji: '🏠', color: 0x2C3E50, description: 'Zaktualizowano serwer' },
  inviteCreate: { name: 'Wysłano zaproszenie', emoji: '📨', color: 0x1F8B4C, description: 'Utworzono zaproszenie' },
};

const EVENT_CATEGORIES = {
  'Moderacja': ['memberBan', 'memberUnban', 'memberKick', 'memberTimeout', 'moderationCommand'],
  'Wiadomości': ['messageDelete', 'messageEdit'],
  'Członkowie': ['memberJoin', 'memberLeave', 'memberNicknameChange', 'memberRoleAdd', 'memberRoleRemove'],
  'Kanały głosowe': ['voiceJoin', 'voiceLeave', 'voiceMove', 'voiceDisconnect', 'voiceMemberMove', 'voiceStateChange'],
  'Kanały': ['channelCreate', 'channelDelete', 'channelUpdate', 'channelPermissionUpdate'],
  'Wątki': ['threadCreate', 'threadDelete', 'threadUpdate'],
  'Role': ['roleCreate', 'roleDelete', 'roleUpdate'],
  'Serwer': ['guildUpdate', 'inviteCreate'],
};

const hexToDecimal = (hex: string): number => {
  return parseInt(hex.replace('#', ''), 16);
};

const decimalToHex = (decimal: number): string => {
  return `#${decimal.toString(16).padStart(6, '0').toUpperCase()}`;
};

export default function LogsPage() {
  const params = useParams();
  const guildId = params?.guildId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [config, setConfig] = useState<LogConfig>({
    guildId,
    enabled: true,
    logChannels: {},
    enabledEvents: {},
    colorOverrides: {},
  });

  useEffect(() => {
    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [channelsData, configRes] = await Promise.all([
        fetchGuildData<Channel[]>(guildId, 'channels', `/api/discord/guild/${guildId}/channels`),
        fetchWithAuth(`/api/guild/${guildId}/logs/config`)
      ]);

      setChannels(channelsData.filter((ch: Channel) => ch.type === 0 || ch.type === 5));

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig({
          ...configData,
          guildId,
          enabled: configData.enabled ?? true,
          logChannels: configData.logChannels || {},
          enabledEvents: configData.enabledEvents || {},
          colorOverrides: configData.colorOverrides || {},
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Nie udało się załadować danych logów. Sprawdź połączenie z internetem i spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const data = await fetchGuildData<Channel[]>(guildId, 'channels', `/api/discord/guild/${guildId}/channels`);
      setChannels(data.filter((ch: Channel) => ch.type === 0 || ch.type === 5));
    } catch (error) {
      console.error("Error fetching channels:", error);
      toast.error("Nie udało się pobrać kanałów");
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/logs/config`);
      if (!response.ok) throw new Error("Failed to fetch config");
      const data = await response.json();
      setConfig({
        ...data,
        logChannels: data.logChannels || {},
        enabledEvents: data.enabledEvents || {},
        colorOverrides: data.colorOverrides || {},
      });
    } catch (error) {
      console.error("Error fetching config:", error);
      toast.error("Nie udało się pobrać konfiguracji");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/logs/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error("Failed to save config");

      toast.success("Konfiguracja została zapisana!");
      await fetchConfig();
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  };

  const toggleEvent = (eventType: string) => {
    setConfig(prev => ({
      ...prev,
      enabledEvents: {
        ...prev.enabledEvents,
        [eventType]: !prev.enabledEvents[eventType],
      },
    }));
  };

  const setEventChannel = (eventType: string, channelId: string) => {
    setConfig(prev => ({
      ...prev,
      logChannels: {
        ...prev.logChannels,
        [eventType]: channelId,
      },
    }));
  };

  const setEventColor = (eventType: string, color: string) => {
    setConfig(prev => ({
      ...prev,
      colorOverrides: {
        ...prev.colorOverrides,
        [eventType]: color,
      },
    }));
  };

  const getChannelName = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    return channel ? channel.name : 'Nie wybrano';
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  if (error) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto p-4 md:p-8 max-w-6xl">
          <Button asChild variant="outline" className="mb-6">
            <Link href={`/${guildId}`}>
              <ArrowLeft className="mr-2 w-4 h-4" />
              Powrót do panelu
            </Link>
          </Button>
          <ErrorState
            title="Nie udało się załadować logów"
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
        <div className="container mx-auto p-4 md:p-8 max-w-6xl">
          {/* Back button skeleton */}
          <Skeleton className="h-10 w-40 mb-6" />

          {/* Header card skeleton */}
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
          </Card>

          {/* Event categories skeleton */}
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <Card
                key={i}
                className="backdrop-blur"
                style={{
                  backgroundColor: 'rgba(189, 189, 189, .05)',
                  boxShadow: '0 0 10px #00000026',
                  border: '1px solid transparent'
                }}
              >
                <CardHeader>
                  <Skeleton className="h-7 w-32" />
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <Skeleton className="w-8 h-8 rounded" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-48" />
                          </div>
                        </div>
                        <Skeleton className="w-11 h-6 rounded-full" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Save button skeleton */}
          <Skeleton className="h-10 w-full mt-6" />
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
                <FileText className="w-6 h-6 text-bot-primary" />
                <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                  System Logów
                </span>
              </CardTitle>
              <Switch
                checked={config.enabled ?? true}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
                className="data-[state=checked]:bg-bot-primary"
                style={{ transform: 'scale(1.5)' }}
              />
            </div>
            <CardDescription>
              Konfiguruj automatyczne logowanie wydarzeń na serwerze
            </CardDescription>
          </CardHeader>
        </Card>
        </SlideIn>

        {/* Event Categories */}
        <div className="space-y-6">
          {Object.entries(EVENT_CATEGORIES).map(([category, events], categoryIndex) => (
            <SlideIn key={category} direction="up" delay={200 + (categoryIndex * 100)}>
            <Card
              key={category}
              className="backdrop-blur"
              style={{
                backgroundColor: 'rgba(189, 189, 189, .05)',
                boxShadow: '0 0 10px #00000026',
                border: '1px solid transparent'
              }}
            >
              <CardHeader>
                <CardTitle className="text-xl">{category}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map((eventType) => {
                  const eventConfig = LOG_EVENT_CONFIGS[eventType];
                  if (!eventConfig) return null;
                  
                  const isEnabled = config.enabledEvents?.[eventType] || false;
                  const currentColor = config.colorOverrides?.[eventType] || decimalToHex(eventConfig.color);
                  
                  return (
                    <div key={eventType} className="p-4 border rounded-lg space-y-3 bg-muted/30 hover:bg-muted/50 hover:shadow-lg hover:shadow-bot-primary/10 hover:scale-105 hover:border-bot-primary/30 transition-all duration-300 cursor-default">
                      {/* Event Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{eventConfig.emoji}</span>
                          <div>
                            <div className="font-semibold">{eventConfig.name}</div>
                            <div className="text-sm text-muted-foreground">{eventConfig.description}</div>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => toggleEvent(eventType)}
                        />
                      </div>

                      {/* Channel and Color Selection */}
                      {isEnabled && (
                        <div className="space-y-4 pt-2 border-t">
                          <div className="space-y-2">
                            <Label className="text-sm">Kanał do logowania</Label>
                            <Select
                              value={config.logChannels[eventType] || ""}
                              onValueChange={(value) => setEventChannel(eventType, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Wybierz kanał...">
                                  {config.logChannels[eventType] ? (
                                    <div className="flex items-center gap-2">
                                      <Hash className="h-4 w-4 text-muted-foreground" />
                                      {getChannelName(config.logChannels[eventType])}
                                    </div>
                                  ) : (
                                    "Wybierz kanał..."
                                  )}
                                </SelectValue>
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
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm flex items-center gap-2">
                              <Palette className="w-4 h-4" />
                              Kolor embeda
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                type="color"
                                value={currentColor}
                                onChange={(e) => setEventColor(eventType, e.target.value)}
                                className="h-10 w-20 cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={currentColor}
                                onChange={(e) => setEventColor(eventType, e.target.value)}
                                className="flex-1"
                                placeholder="#FF0000"
                                maxLength={7}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEventColor(eventType, decimalToHex(eventConfig.color))}
                              >
                                Reset
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            </SlideIn>
          ))}
        </div>

        {/* Save Button */}
        <SlideIn direction="up" delay={300}>
        <div className="mt-6 sticky bottom-4">
          <Button onClick={handleSave} disabled={saving} className="btn-gradient hover:scale-105 w-full" size="lg">
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
        </div>
        </SlideIn>
      </div>
    </div>
  );
}
