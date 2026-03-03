"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Save, ArrowLeft, ShieldAlert, AlertCircle,
  Hash, Plus, X, Shield, AtSign, MessageSquare
} from "lucide-react";
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

interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
}

interface AntiSpamConfig {
  guildId: string;
  enabled: boolean;
  messageThreshold: number;
  timeWindowMs: number;
  action: string;
  timeoutDurationMs: number;
  deleteMessages: boolean;
  ignoredChannels: string[];
  ignoredRoles: string[];
  blockInviteLinks: boolean;
  blockMassMentions: boolean;
  maxMentionsPerMessage: number;
  blockEveryoneHere: boolean;
  blockFlood: boolean;
  floodThreshold: number;
  floodWindowMs: number;
}

const DEFAULT_CONFIG: Omit<AntiSpamConfig, "guildId"> = {
  enabled: false,
  messageThreshold: 5,
  timeWindowMs: 3000,
  action: "timeout",
  timeoutDurationMs: 300_000,
  deleteMessages: true,
  ignoredChannels: [],
  ignoredRoles: [],
  blockInviteLinks: false,
  blockMassMentions: false,
  maxMentionsPerMessage: 5,
  blockEveryoneHere: true,
  blockFlood: false,
  floodThreshold: 3,
  floodWindowMs: 30_000,
};

const cardStyle = {
  backgroundColor: "rgba(189, 189, 189, .05)",
  boxShadow: "0 0 10px #00000026",
  border: "1px solid transparent",
};

export default function AntiSpamPage() {
  const params = useParams();
  const guildId = params.guildId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [config, setConfig] = useState<AntiSpamConfig>({
    guildId,
    ...DEFAULT_CONFIG,
  });

  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [channelsData, rolesData, configRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, "channels", `/api/discord/guild/${guildId}/channels`),
          fetchGuildData<Role[]>(guildId, "roles", `/api/discord/guild/${guildId}/roles`),
          fetch(`/api/guild/${guildId}/anti-spam/config`),
        ]);

        if (channelsData) setChannels(channelsData);
        if (rolesData) setRoles(rolesData);

        if (configRes.ok) {
          const data = await configRes.json();
          setConfig({ guildId, ...DEFAULT_CONFIG, ...data });
        }
      } catch (err) {
        console.error("Error loading anti-spam data:", err);
        setError("Nie udało się załadować konfiguracji anti-spam. Sprawdź połączenie i spróbuj ponownie.");
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

      if (!config.enabled) {
        const res = await fetch(`/api/guild/${guildId}/anti-spam/config`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete config");
        toast.success("Konfiguracja anti-spam została wyłączona!");
        return;
      }

      const res = await fetch(`/api/guild/${guildId}/anti-spam/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) throw new Error("Failed to save config");

      const saved = await res.json();
      setConfig({ guildId, ...DEFAULT_CONFIG, ...saved });
      toast.success("Konfiguracja anti-spam została zapisana!");
    } catch (err) {
      console.error("Error saving config:", err);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  };

  /* ── helpers for ignored channels / roles ── */

  const handleAddIgnoredChannel = () => {
    if (!selectedChannelId) return toast.error("Wybierz kanał!");
    if (config.ignoredChannels.includes(selectedChannelId))
      return toast.error("Ten kanał jest już na liście!");
    setConfig({ ...config, ignoredChannels: [...config.ignoredChannels, selectedChannelId] });
    setSelectedChannelId("");
  };

  const handleRemoveIgnoredChannel = (id: string) => {
    setConfig({ ...config, ignoredChannels: config.ignoredChannels.filter((c) => c !== id) });
  };

  const handleAddIgnoredRole = () => {
    if (!selectedRoleId) return toast.error("Wybierz rolę!");
    if (config.ignoredRoles.includes(selectedRoleId))
      return toast.error("Ta rola jest już na liście!");
    setConfig({ ...config, ignoredRoles: [...config.ignoredRoles, selectedRoleId] });
    setSelectedRoleId("");
  };

  const handleRemoveIgnoredRole = (id: string) => {
    setConfig({ ...config, ignoredRoles: config.ignoredRoles.filter((r) => r !== id) });
  };

  const getChannelName = (id: string) =>
    channels.find((c) => c.id === id)?.name ?? "Nieznany kanał";

  const getRoleName = (id: string) =>
    roles.find((r) => r.id === id)?.name ?? "Nieznana rola";

  const getRoleColor = (id: string) => {
    const color = roles.find((r) => r.id === id)?.color;
    return color ? `#${color.toString(16).padStart(6, "0")}` : undefined;
  };

  /* ── render helpers ── */

  const textChannels = channels.filter((ch) => ch.type === 0 || ch.type === 5);
  const sortedRoles = [...roles].sort((a, b) => b.position - a.position);

  if (error) return <ErrorState message={error} onRetry={handleRetry} />;

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
          <Skeleton className="h-10 w-48 mb-6" />
          <Card className="backdrop-blur" style={cardStyle}>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96 mt-2" />
            </CardHeader>
            <CardContent className="space-y-6">
              {[1, 2, 3, 4].map((i) => (
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
        {/* Back button */}
        <SlideIn direction="left">
          <Button asChild variant="outline" className="mb-6">
            <Link href={`/${guildId}`}>
              <ArrowLeft className="mr-2 w-4 h-4" />
              Powrót do panelu
            </Link>
          </Button>
        </SlideIn>

        <SlideIn direction="up" delay={100}>
          <Card className="backdrop-blur" style={cardStyle}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <ShieldAlert className="w-6 h-6 text-bot-primary" />
                    Anti-Spam
                  </CardTitle>
                  <CardDescription>
                    Ochrona serwera przed spamem, linkami z zaproszeniami, masowymi wzmiankami i floodem
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="enabled" className="text-sm">
                    {config.enabled ? "Włączony" : "Wyłączony"}
                  </Label>
                  <Switch
                    id="enabled"
                    checked={config.enabled}
                    onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-8">
              {/* Info box */}
              <div className="flex gap-3 p-4 rounded-lg bg-bot-primary/10 border border-bot-primary/20">
                <AlertCircle className="w-5 h-5 text-bot-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Jak to działa?</p>
                  <p className="text-xs text-muted-foreground">
                    System monitoruje wiadomości użytkowników. Gdy ktoś wyśle zbyt wiele wiadomości
                    w krótkim czasie (rate-limit), spam linkami z zaproszeniami, masowe wzmianki lub
                    powtarzające się wiadomości (flood) — bot automatycznie podejmie wybraną akcję.
                  </p>
                </div>
              </div>

              {config.enabled && (
                <>
                  {/* ─── Protection modules ─── */}
                  <section className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Shield className="w-5 h-5 text-bot-primary" />
                      Moduły ochrony
                    </h3>

                    {/* Invite links */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                      <div>
                        <p className="text-sm font-medium">Blokuj linki z zaproszeniami</p>
                        <p className="text-xs text-muted-foreground">
                          Usuwa wiadomości zawierające linki discord.gg / discord.com/invite
                        </p>
                      </div>
                      <Switch
                        checked={config.blockInviteLinks}
                        onCheckedChange={(v) =>
                          setConfig({ ...config, blockInviteLinks: v })
                        }
                      />
                    </div>

                    {/* Mass mentions */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                        <div>
                          <p className="text-sm font-medium">Blokuj masowe wzmianki</p>
                          <p className="text-xs text-muted-foreground">
                            Blokuje wiadomości z dużą liczbą wzmianek @user
                          </p>
                        </div>
                        <Switch
                          checked={config.blockMassMentions}
                          onCheckedChange={(v) =>
                            setConfig({ ...config, blockMassMentions: v })
                          }
                        />
                      </div>

                      {config.blockMassMentions && (
                        <div className="ml-4 p-4 rounded-lg border border-dashed border-border/60 space-y-3">
                          <div className="space-y-1">
                            <Label>Maks. wzmianek na wiadomość</Label>
                            <Input
                              type="number"
                              min={1}
                              max={50}
                              value={config.maxMentionsPerMessage}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  maxMentionsPerMessage: Number(e.target.value) || 5,
                                })
                              }
                              className="max-w-[120px]"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Blokuj @everyone / @here</p>
                              <p className="text-xs text-muted-foreground">
                                Dodatkowa ochrona przed wzmiankami masowymi
                              </p>
                            </div>
                            <Switch
                              checked={config.blockEveryoneHere}
                              onCheckedChange={(v) =>
                                setConfig({ ...config, blockEveryoneHere: v })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Flood detection */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                        <div>
                          <p className="text-sm font-medium">Detekcja floodu</p>
                          <p className="text-xs text-muted-foreground">
                            Blokuje powtarzające się identyczne wiadomości
                          </p>
                        </div>
                        <Switch
                          checked={config.blockFlood}
                          onCheckedChange={(v) =>
                            setConfig({ ...config, blockFlood: v })
                          }
                        />
                      </div>

                      {config.blockFlood && (
                        <div className="ml-4 p-4 rounded-lg border border-dashed border-border/60 space-y-3">
                          <div className="space-y-1">
                            <Label>Próg powtórzeń</Label>
                            <p className="text-xs text-muted-foreground">
                              Ile razy ta sama wiadomość może zostać wysłana
                            </p>
                            <Input
                              type="number"
                              min={2}
                              max={20}
                              value={config.floodThreshold}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  floodThreshold: Number(e.target.value) || 3,
                                })
                              }
                              className="max-w-[120px]"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Okno czasowe (sekundy)</Label>
                            <p className="text-xs text-muted-foreground">
                              Okres, w którym liczone są powtórzenia
                            </p>
                            <Input
                              type="number"
                              min={5}
                              max={120}
                              value={Math.round(config.floodWindowMs / 1000)}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  floodWindowMs: (Number(e.target.value) || 30) * 1000,
                                })
                              }
                              className="max-w-[120px]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* ─── Rate-limit spam detection ─── */}
                  <section className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-bot-primary" />
                      Detekcja spamu (rate-limit)
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>Próg wiadomości</Label>
                        <p className="text-xs text-muted-foreground">
                          Ile wiadomości w oknie czasowym = spam
                        </p>
                        <Input
                          type="number"
                          min={2}
                          max={30}
                          value={config.messageThreshold}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              messageThreshold: Number(e.target.value) || 5,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Okno czasowe (sekundy)</Label>
                        <p className="text-xs text-muted-foreground">
                          Czas, w którym liczone są wiadomości
                        </p>
                        <Input
                          type="number"
                          min={1}
                          max={60}
                          value={Math.round(config.timeWindowMs / 1000)}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              timeWindowMs: (Number(e.target.value) || 3) * 1000,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                      <div>
                        <p className="text-sm font-medium">Usuwaj wiadomości spam</p>
                        <p className="text-xs text-muted-foreground">
                          Automatycznie usuwa wiadomości po wykryciu spamu
                        </p>
                      </div>
                      <Switch
                        checked={config.deleteMessages}
                        onCheckedChange={(v) =>
                          setConfig({ ...config, deleteMessages: v })
                        }
                      />
                    </div>
                  </section>

                  {/* ─── Action on detection ─── */}
                  <section className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <AtSign className="w-5 h-5 text-bot-primary" />
                      Akcja przy wykryciu
                    </h3>

                    <div className="space-y-1">
                      <Label>Rodzaj akcji</Label>
                      <Select
                        value={config.action}
                        onValueChange={(v) => setConfig({ ...config, action: v })}
                      >
                        <SelectTrigger className="max-w-xs">
                          <SelectValue placeholder="Wybierz akcję..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="timeout">⏱️ Timeout (wyciszenie)</SelectItem>
                          <SelectItem value="warn">⚠️ Ostrzeżenie</SelectItem>
                          <SelectItem value="kick">👢 Wyrzucenie</SelectItem>
                          <SelectItem value="ban">🔨 Ban</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {config.action === "timeout" && (
                      <div className="ml-4 p-4 rounded-lg border border-dashed border-border/60 space-y-1">
                        <Label>Czas wyciszenia (minuty)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={10080}
                          value={Math.round(config.timeoutDurationMs / 60_000)}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              timeoutDurationMs: (Number(e.target.value) || 5) * 60_000,
                            })
                          }
                          className="max-w-[120px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          Maks. 10 080 min (7 dni)
                        </p>
                      </div>
                    )}
                  </section>

                  {/* ─── Exceptions ─── */}
                  <section className="space-y-4">
                    <h3 className="text-lg font-semibold">Wyjątki</h3>

                    {/* Ignored channels */}
                    <div className="space-y-2">
                      <Label>
                        Ignorowane kanały
                        <span className="ml-2 text-xs text-muted-foreground">(anti-spam nie działa na tych kanałach)</span>
                      </Label>
                      <div className="flex gap-2">
                        <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Wybierz kanał...">
                              {selectedChannelId && (
                                <div className="flex items-center gap-2">
                                  <Hash className="w-4 h-4" />
                                  {getChannelName(selectedChannelId)}
                                </div>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {textChannels
                              .filter((ch) => !config.ignoredChannels.includes(ch.id))
                              .map((ch) => (
                                <SelectItem key={ch.id} value={ch.id}>
                                  <div className="flex items-center gap-2">
                                    <Hash className="w-4 h-4" />
                                    {ch.name}
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={handleAddIgnoredChannel} disabled={!selectedChannelId} variant="outline" size="icon">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      {config.ignoredChannels.length > 0 && (
                        <div className="space-y-2">
                          {config.ignoredChannels.map((id) => (
                            <div
                              key={id}
                              className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50"
                            >
                              <div className="flex items-center gap-2">
                                <Hash className="w-4 h-4 text-bot-primary" />
                                <span className="text-sm font-medium">{getChannelName(id)}</span>
                              </div>
                              <Button
                                onClick={() => handleRemoveIgnoredChannel(id)}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Ignored roles */}
                    <div className="space-y-2">
                      <Label>
                        Ignorowane role
                        <span className="ml-2 text-xs text-muted-foreground">(użytkownicy z tymi rolami są pomijani)</span>
                      </Label>
                      <div className="flex gap-2">
                        <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Wybierz rolę...">
                              {selectedRoleId && (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: getRoleColor(selectedRoleId) ?? "#99AAB5" }}
                                  />
                                  {getRoleName(selectedRoleId)}
                                </div>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {sortedRoles
                              .filter((r) => !config.ignoredRoles.includes(r.id) && r.name !== "@everyone")
                              .map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{
                                        backgroundColor: r.color
                                          ? `#${r.color.toString(16).padStart(6, "0")}`
                                          : "#99AAB5",
                                      }}
                                    />
                                    {r.name}
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={handleAddIgnoredRole} disabled={!selectedRoleId} variant="outline" size="icon">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      {config.ignoredRoles.length > 0 && (
                        <div className="space-y-2">
                          {config.ignoredRoles.map((id) => (
                            <div
                              key={id}
                              className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: getRoleColor(id) ?? "#99AAB5" }}
                                />
                                <span className="text-sm font-medium">{getRoleName(id)}</span>
                              </div>
                              <Button
                                onClick={() => handleRemoveIgnoredRole(id)}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                </>
              )}

              {/* Save button */}
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
                    {config.enabled ? "Zapisz konfigurację" : "Wyłącz anti-spam"}
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
