"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Music, ArrowLeft, Volume2, ListMusic, Timer, Shield, Hash, Bell } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { SlideIn } from "@/components/ui/animated";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface Role {
  id: string;
  name: string;
  color: number;
}

interface MusicConfig {
  enabled: boolean;
  defaultVolume: number;
  maxQueueSize: number;
  maxSongDuration: number;
  djRoleId: string;
  allowedChannels: string[];
  announceSongs: boolean;
  leaveOnEmpty: boolean;
  leaveOnEnd: boolean;
  leaveTimeout: number;
}

export default function MusicPage() {
  const params = useParams();
  const guildId = params?.guildId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  
  const [config, setConfig] = useState<MusicConfig>({
    enabled: true,
    defaultVolume: 50,
    maxQueueSize: 100,
    maxSongDuration: 0,
    djRoleId: '',
    allowedChannels: [],
    announceSongs: true,
    leaveOnEmpty: true,
    leaveOnEnd: true,
    leaveTimeout: 300,
  });

  useEffect(() => {
    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchChannels(),
        fetchRoles(),
        fetchConfig(),
      ]);
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Nie udało się załadować danych muzyki. Sprawdź połączenie z internetem i spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const data = await fetchGuildData<Channel[]>(guildId, 'channels', `/api/discord/guild/${guildId}/channels`);
      setChannels(data.filter((ch: Channel) => ch.type === 2)); // Voice channels only
    } catch (error) {
      console.error("Error fetching channels:", error);
      toast.error("Nie udało się pobrać kanałów");
    }
  };

  const fetchRoles = async () => {
    try {
      const data = await fetchGuildData<Role[]>(guildId, 'roles', `/api/discord/guild/${guildId}/roles`);
      setRoles(data);
    } catch (error) {
      console.error("Error fetching roles:", error);
      toast.error("Nie udało się pobrać ról");
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/music`);
      if (!response.ok) throw new Error("Failed to fetch music config");
      const data = await response.json();
      setConfig(data);
    } catch (error) {
      console.error("Error fetching music config:", error);
      toast.error("Nie udało się pobrać konfiguracji muzyki");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/music`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error("Failed to save music config");

      toast.success("Konfiguracja muzyki została zapisana!");
    } catch (error) {
      console.error("Error saving music config:", error);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  };

  const handleChannelToggle = (channelId: string) => {
    setConfig(prev => ({
      ...prev,
      allowedChannels: prev.allowedChannels.includes(channelId)
        ? prev.allowedChannels.filter(id => id !== channelId)
        : [...prev.allowedChannels, channelId]
    }));
  };

  const getRoleColor = (color: number) => {
    if (color === 0) return '#99AAB5';
    return `#${color.toString(16).padStart(6, '0')}`;
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
            title="Nie udało się załadować muzyki"
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
          <Card className="backdrop-blur" style={{ backgroundColor: 'rgba(189, 189, 189, .05)', boxShadow: '0 0 10px #00000026', border: '1px solid transparent' }}>
            <CardHeader>
              <Skeleton className="h-8 w-56 mb-2" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </CardHeader>
            <CardContent className="space-y-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const commands = [
    { name: '/play', description: 'Odtwórz muzykę z YouTube, Spotify lub wyszukaj po frazie' },
    { name: '/pause', description: 'Zapauzuj odtwarzanie' },
    { name: '/resume', description: 'Wznów odtwarzanie' },
    { name: '/skip', description: 'Pomiń aktualny utwór' },
    { name: '/stop', description: 'Zatrzymaj odtwarzanie i wyczyść kolejkę' },
    { name: '/queue', description: 'Wyświetl kolejkę utworów' },
    { name: '/nowplaying', description: 'Wyświetl aktualnie odtwarzany utwór' },
    { name: '/volume', description: 'Ustaw głośność odtwarzania (0-100)' },
    { name: '/shuffle', description: 'Przemieszaj kolejkę utworów' },
    { name: '/loop', description: 'Zapętl utwór lub całą kolejkę' },
  ];

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

        <div className="space-y-6">
          <SlideIn direction="up" delay={100}>
            <Card className="backdrop-blur" style={{ backgroundColor: 'rgba(189, 189, 189, .05)', boxShadow: '0 0 10px #00000026', border: '1px solid transparent' }}>
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Music className="w-6 h-6" />
                    <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                      Odtwarzacz Muzyki
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
                  Odtwarzaj muzykę z YouTube, Spotify i innych platform
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 pt-6">
                {/* Basic Settings */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Volume2 className="w-5 h-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Podstawowe ustawienia</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="defaultVolume">Domyślna głośność: {config.defaultVolume}%</Label>
                    </div>
                    <input
                      id="defaultVolume"
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={config.defaultVolume}
                      onChange={(e) => setConfig({ ...config, defaultVolume: parseInt(e.target.value) })}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-bot-primary"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxQueueSize">Maksymalna wielkość kolejki</Label>
                      <Input
                        id="maxQueueSize"
                        type="number"
                        min="1"
                        value={config.maxQueueSize}
                        onChange={(e) => setConfig({ ...config, maxQueueSize: parseInt(e.target.value) || 100 })}
                      />
                      <p className="text-xs text-muted-foreground">Maksymalna liczba utworów w kolejce</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxSongDuration">Maksymalna długość utworu (minuty)</Label>
                      <Input
                        id="maxSongDuration"
                        type="number"
                        min="0"
                        value={config.maxSongDuration}
                        onChange={(e) => setConfig({ ...config, maxSongDuration: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-muted-foreground">0 = bez limitu</p>
                    </div>
                  </div>
                </div>

                {/* Permissions */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-5 h-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Uprawnienia</h3>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="djRole">Rola DJ (opcjonalnie)</Label>
                    <Select value={config.djRoleId || 'none'} onValueChange={(value) => setConfig({ ...config, djRoleId: value === 'none' ? '' : value })}>
                      <SelectTrigger id="djRole">
                        <SelectValue placeholder="Brak - wszyscy mogą używać" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Brak - wszyscy mogą używać</SelectItem>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: getRoleColor(role.color) }}
                              />
                              {role.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Jeśli wybierzesz rolę, tylko użytkownicy z tą rolą będą mogli używać komend muzycznych</p>
                  </div>

                  <Accordion type="multiple" defaultValue={config.allowedChannels.length > 0 ? ["channels"] : []}>
                    <AccordionItem value="channels">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4" />
                          <span>Dozwolone kanały głosowe</span>
                          {config.allowedChannels.length > 0 && (
                            <span className="text-sm text-muted-foreground">
                              ({config.allowedChannels.length})
                            </span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 pt-4">
                        <p className="text-sm text-muted-foreground mb-3">
                          {config.allowedChannels.length === 0 
                            ? "Wszystkie kanały głosowe są dozwolone" 
                            : "Wybierz kanały gdzie można używać muzyki"}
                        </p>
                        {channels.map((channel) => (
                          <div key={channel.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50">
                            <Switch
                              id={`channel-${channel.id}`}
                              checked={config.allowedChannels.includes(channel.id)}
                              onCheckedChange={() => handleChannelToggle(channel.id)}
                            />
                            <Label htmlFor={`channel-${channel.id}`} className="flex-1 cursor-pointer">
                              🔊 {channel.name}
                            </Label>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                {/* Bot Behavior */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2 mb-4">
                    <Timer className="w-5 h-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Zachowanie bota</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="space-y-1">
                        <Label htmlFor="announceSongs" className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4" />
                            Ogłaszaj nowe utwory
                          </div>
                        </Label>
                        <p className="text-xs text-muted-foreground">Wysyłaj wiadomość gdy nowy utwór zaczyna grać</p>
                      </div>
                      <Switch
                        id="announceSongs"
                        checked={config.announceSongs}
                        onCheckedChange={(checked) => setConfig({ ...config, announceSongs: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="space-y-1">
                        <Label htmlFor="leaveOnEmpty" className="cursor-pointer">Opuść kanał gdy pusty</Label>
                        <p className="text-xs text-muted-foreground">Bot opuści kanał gdy zostanie sam</p>
                      </div>
                      <Switch
                        id="leaveOnEmpty"
                        checked={config.leaveOnEmpty}
                        onCheckedChange={(checked) => setConfig({ ...config, leaveOnEmpty: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="space-y-1">
                        <Label htmlFor="leaveOnEnd" className="cursor-pointer">Opuść po zakończeniu kolejki</Label>
                        <p className="text-xs text-muted-foreground">Bot opuści kanał gdy kolejka się skończy</p>
                      </div>
                      <Switch
                        id="leaveOnEnd"
                        checked={config.leaveOnEnd}
                        onCheckedChange={(checked) => setConfig({ ...config, leaveOnEnd: checked })}
                      />
                    </div>

                    {(config.leaveOnEmpty || config.leaveOnEnd) && (
                      <div className="space-y-2">
                        <Label htmlFor="leaveTimeout">Opóźnienie wyjścia (sekundy)</Label>
                        <Input
                          id="leaveTimeout"
                          type="number"
                          min="0"
                          value={config.leaveTimeout}
                          onChange={(e) => setConfig({ ...config, leaveTimeout: parseInt(e.target.value) || 300 })}
                        />
                        <p className="text-xs text-muted-foreground">Ile sekund czekać przed opuszczeniem kanału</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Save Button */}
                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="w-full"
                  size="lg"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Zapisywanie...
                    </>
                  ) : (
                    'Zapisz konfigurację'
                  )}
                </Button>
              </CardContent>
            </Card>
          </SlideIn>

          {/* Commands List */}
          <SlideIn direction="up" delay={200}>
            <Card className="backdrop-blur" style={{ backgroundColor: 'rgba(189, 189, 189, .05)', boxShadow: '0 0 10px #00000026', border: '1px solid transparent' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListMusic className="w-5 h-5" />
                  Dostępne komendy
                </CardTitle>
                <CardDescription>
                  Lista wszystkich komend muzycznych
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {commands.map((cmd, index) => (
                    <div key={index} className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="font-mono text-sm font-semibold text-bot-primary">{cmd.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{cmd.description}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </SlideIn>
        </div>
      </div>
    </div>
  );
}
