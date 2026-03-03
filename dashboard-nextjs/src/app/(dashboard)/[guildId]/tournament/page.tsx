"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, ArrowLeft, Gamepad2, Hash, Eye } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import VariableInserter from "@/components/VariableInserter";
import { DiscordMessagePreview } from "@/components/DiscordMessagePreview";

interface TournamentConfig {
  guildId: string;
  enabled: boolean;
  channelId?: string | null;
  messageTemplate: string;
  cronSchedule: string;
  reactionEmoji: string;
}

export default function TournamentPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [guildIds, setGuildIds] = useState<{
    tournamentParticipantsRoleId: string;
    tournamentOrganizerRoleId: string;
    organizerUserIds: string[];
    voiceChannelId: string;
  } | null>(null);
  
  const [config, setConfig] = useState<TournamentConfig>({
    guildId,
    enabled: false,
    channelId: null,
    messageTemplate: '',
    cronSchedule: '25 20 * * 1',
    reactionEmoji: '🎮',
  });

  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [hour, setHour] = useState('20');
  const [minute, setMinute] = useState('25');

  const parseCronSchedule = (cronSchedule: string) => {
    const parts = cronSchedule.split(' ');
    if (parts.length === 5) {
      setMinute(parts[0]);
      setHour(parts[1]);
      setDayOfWeek(parts[4]);
    }
  };

  const updateCronSchedule = (day: string, hr: string, min: string) => {
    const cronExpression = `${min} ${hr} * * ${day}`;
    setConfig({ ...config, cronSchedule: cronExpression });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const [configResponse, channelsResponse, rolesResponse, membersResponse, guildIdsResponse] = await Promise.all([
          fetchWithAuth(`/api/guild/${guildId}/tournament/config`),
          fetchWithAuth(`/api/guild/${guildId}/channels`),
          fetchWithAuth(`/api/guild/${guildId}/roles`),
          fetchWithAuth(`/api/discord/guild/${guildId}/members`),
          fetchWithAuth(`/api/guild/${guildId}/tournament/guild-ids`),
        ]);
        
        if (configResponse.ok) {
          const data = await configResponse.json();
          setConfig(data);
          parseCronSchedule(data.cronSchedule);
        }

        if (channelsResponse.ok) {
          const channelsData = await channelsResponse.json();
          setChannels(channelsData.filter((ch: any) => ch.type === 0 || ch.type === 5));
        }

        if (rolesResponse.ok) {
          setRoles(await rolesResponse.json());
        }

        if (membersResponse.ok) {
          setMembers(await membersResponse.json());
        }

        if (guildIdsResponse.ok) {
          setGuildIds(await guildIdsResponse.json());
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading tournament config:', error);
        setError('Nie udało się załadować konfiguracji turnieju');
        setLoading(false);
      }
    };

    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  const handleSave = async () => {
    try {
      setSaving(true);

      const response = await fetchWithAuth(`/api/guild/${guildId}/tournament/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: config.enabled,
          channelId: config.channelId,
          messageTemplate: config.messageTemplate,
          cronSchedule: config.cronSchedule,
          reactionEmoji: config.reactionEmoji,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || 'Failed to save tournament config');
      }

      const savedConfig = await response.json();
      setConfig({
        guildId,
        enabled: savedConfig.enabled ?? false,
        channelId: savedConfig.channelId || null,
        messageTemplate: savedConfig.messageTemplate || '',
        cronSchedule: savedConfig.cronSchedule || '25 20 * * 1',
        reactionEmoji: savedConfig.reactionEmoji || '🎮',
      });
      toast.success('Konfiguracja turnieju została zapisana!');
    } catch (error) {
      console.error('Error saving tournament config:', error);
      toast.error('Nie udało się zapisać konfiguracji turnieju');
    } finally {
      setSaving(false);
    }
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
            title="Nie udało się załadować turnieju"
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
          
          <Card className="backdrop-blur mb-6">
            <CardHeader>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-96" />
            </CardHeader>
            <CardContent className="space-y-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-10 w-32" />
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
                  <Gamepad2 className="w-6 h-6" />
                  <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                    Konfiguracja Turnieju
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
                Konfiguruj cotygodniowe wiadomości o turnieju CS2
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Message Template */}
              <div className="space-y-2">
                <Label htmlFor="messageTemplate">
                  Szablon wiadomości <span className="text-destructive">*</span>
                </Label>
                <VariableInserter
                  value={config.messageTemplate}
                  onChange={(value) => setConfig({ ...config, messageTemplate: value })}
                  variables={[
                    { name: "Rola uczestników", display: "Rola uczestników", value: "{roleMention}", description: "Wzmianka roli uczestników turnieju" },
                    { name: "Rola organizatorów", display: "Rola organizatorów", value: "{organizerRoleMention}", description: "Wzmianka roli organizatorów" },
                    { name: "Pingi organizatorów", display: "Pingi organizatorów", value: "{organizerUserPings}", description: "Pingi do użytkowników organizatorów" },
                    { name: "Kanał głosowy", display: "Kanał głosowy", value: "{voiceChannelLink}", description: "Link do kanału głosowego turnieju" },
                  ]}
                  placeholder="Wpisz treść wiadomości turnieju..."
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Wiadomość wspiera markdown Discord. Użyj zmiennych wymienionych powyżej.
                </p>

                {/* Live preview */}
                {!loading && config.messageTemplate && (() => {
                  // Build lookup maps
                  const roleMap: Record<string, { name: string; color?: string }> = {};
                  for (const r of roles) {
                    const hex = r.color ? `#${r.color.toString(16).padStart(6, '0')}` : undefined;
                    roleMap[r.id] = { name: r.name, color: hex === '#000000' ? undefined : hex };
                  }

                  const userMap: Record<string, string> = {};
                  for (const m of members) {
                    userMap[m.id] = m.nickname || m.username;
                  }

                  const channelMap: Record<string, string> = {};
                  for (const c of channels) {
                    channelMap[c.id] = c.name;
                  }

                  // Resolve template variables to Discord mention syntax
                  let preview = config.messageTemplate;
                  if (guildIds) {
                    const roleMention = guildIds.tournamentParticipantsRoleId
                      ? `<@&${guildIds.tournamentParticipantsRoleId}>`
                      : '@Uczestnik turnieju';
                    const organizerRoleMention = guildIds.tournamentOrganizerRoleId
                      ? `<@&${guildIds.tournamentOrganizerRoleId}>`
                      : '@Organizator turnieju';
                    const organizerUserPings = guildIds.organizerUserIds.length
                      ? guildIds.organizerUserIds.map(id => `<@${id}>`).join(' ')
                      : '@Organizator1 @Organizator2';
                    const voiceChannelLink = guildIds.voiceChannelId
                      ? `https://discord.com/channels/${guildId}/${guildIds.voiceChannelId}`
                      : '**kanale głosowym CS2**';

                    preview = preview
                      .replace(/{roleMention}/g, roleMention)
                      .replace(/{organizerRoleMention}/g, organizerRoleMention)
                      .replace(/{organizerUserPings}/g, organizerUserPings)
                      .replace(/{voiceChannelLink}/g, voiceChannelLink);
                  }

                  return (
                    <div className="space-y-2 mt-4">
                      <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Eye className="h-3.5 w-3.5" />
                        Podgląd wiadomości
                      </Label>
                      <DiscordMessagePreview
                        content={preview}
                        roles={roleMap}
                        users={userMap}
                        channels={channelMap}
                      />
                    </div>
                  );
                })()}
              </div>

              {/* Channel Selection */}
              <div className="space-y-2">
                <Label htmlFor="channelId">
                  Kanał docelowy <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={config.channelId || ""}
                  onValueChange={(value) => setConfig({ ...config, channelId: value })}
                >
                  <SelectTrigger id="channelId">
                    <SelectValue placeholder="Wybierz kanał do wysyłki wiadomości" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        # {channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Kanał na którym będą wysyłane wiadomości turnieju
                </p>
              </div>

              {/* Current Channel Display */}
              {config.channelId && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Aktualnie skonfigurowany kanał:</span>
                    <span className="text-sm text-muted-foreground">
                      {channels.find(ch => ch.id === config.channelId)?.name || 'Nieznany kanał'}
                    </span>
                  </div>
                </div>
              )}

              {/* Schedule */}
              <div className="space-y-4">
                <Label>Harmonogram wysyłki <span className="text-destructive">*</span></Label>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Day of Week */}
                  <div className="space-y-2">
                    <Label htmlFor="dayOfWeek" className="text-sm text-muted-foreground">Dzień tygodnia</Label>
                    <Select
                      value={dayOfWeek}
                      onValueChange={(value) => {
                        setDayOfWeek(value);
                        updateCronSchedule(value, hour, minute);
                      }}
                    >
                      <SelectTrigger id="dayOfWeek">
                        <SelectValue placeholder="Wybierz dzień" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Poniedziałek</SelectItem>
                        <SelectItem value="2">Wtorek</SelectItem>
                        <SelectItem value="3">Środa</SelectItem>
                        <SelectItem value="4">Czwartek</SelectItem>
                        <SelectItem value="5">Piątek</SelectItem>
                        <SelectItem value="6">Sobota</SelectItem>
                        <SelectItem value="0">Niedziela</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Hour */}
                  <div className="space-y-2">
                    <Label htmlFor="hour" className="text-sm text-muted-foreground">Godzina</Label>
                    <Input
                      id="hour"
                      type="number"
                      min="0"
                      max="23"
                      value={hour}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 23)) {
                          setHour(value);
                          if (value !== '') {
                            updateCronSchedule(dayOfWeek, value, minute);
                          }
                        }
                      }}
                      placeholder="20"
                    />
                  </div>

                  {/* Minute */}
                  <div className="space-y-2">
                    <Label htmlFor="minute" className="text-sm text-muted-foreground">Minuta</Label>
                    <Input
                      id="minute"
                      type="number"
                      min="0"
                      max="59"
                      value={minute}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 59)) {
                          setMinute(value);
                          if (value !== '') {
                            updateCronSchedule(dayOfWeek, hour, value);
                          }
                        }
                      }}
                      placeholder="25"
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Wiadomość będzie wysyłana automatycznie w wybranym dniu o określonej godzinie
                </p>
              </div>

              {/* Reaction Emoji */}
              <div className="space-y-2">
                <Label htmlFor="reactionEmoji">Emoji reakcji</Label>
                <Input
                  id="reactionEmoji"
                  value={config.reactionEmoji}
                  onChange={(e) => setConfig({ ...config, reactionEmoji: e.target.value })}
                  placeholder="🎮"
                  maxLength={10}
                />
                <p className="text-xs text-muted-foreground">
                  Emoji które zostanie dodane jako reakcja do wiadomości
                </p>
              </div>

              {/* Save Button */}
              <Button 
                onClick={handleSave} 
                disabled={saving || !config.messageTemplate || !config.channelId} 
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
