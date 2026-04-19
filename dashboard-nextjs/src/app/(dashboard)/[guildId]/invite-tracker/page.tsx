"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import VariableInserter from "@/components/VariableInserter";
import { DiscordMessagePreview } from "@/components/DiscordMessagePreview";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2, Save, ArrowLeft, Hash, UserPlus, Eye,
  Trophy, Users, UserMinus, ShieldAlert, RefreshCw,
  Clock, LinkIcon
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────── */

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface InviteConfig {
  guildId: string;
  enabled: boolean;
  logChannelId: string | null;
  joinMessage: string;
  joinMessageUnknown: string;
  joinMessageVanity: string;
  leaveMessage: string;
}

interface LeaderboardEntry {
  rank: number;
  inviterId: string;
  total: number;
  active: number;
  left: number;
  fake: number;
}

interface RecentJoin {
  joinedUserId: string;
  inviterId: string | null;
  inviteCode: string | null;
  active: boolean;
  fake: boolean;
  joinedAt: string;
  leftAt: string | null;
}

interface StatsOverview {
  totalEntries: number;
  totalActive: number;
  totalLeft: number;
  totalFake: number;
}

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  discriminator?: string;
}

/* ── Helpers ───────────────────────────────────────────────────── */

const INVITE_VARIABLES = [
  { name: "Użytkownik", display: "Użytkownik", value: "{user}", description: "Wzmianka użytkownika" },
  { name: "Nazwa", display: "Nazwa", value: "{username}", description: "Nazwa użytkownika" },
  { name: "Tag", display: "Tag", value: "{tag}", description: "Tag użytkownika" },
  { name: "Serwer", display: "Serwer", value: "{server}", description: "Nazwa serwera" },
  { name: "Członkowie", display: "Członkowie", value: "{memberCount}", description: "Liczba członków" },
  { name: "Zapraszający", display: "Zapraszający", value: "{inviter}", description: "Wzmianka zapraszającego" },
  { name: "Kod zaproszenia", display: "Kod zaproszenia", value: "{inviteCode}", description: "Kod zaproszenia" },
  { name: "Aktywne zaproszenia", display: "Aktywne zaproszenia", value: "{activeCount}", description: "Liczba aktywnych zaproszeń zapraszającego" },
  { name: "Statystyki", display: "Statystyki", value: "{stats}", description: "Pełne statystyki zapraszającego (aktywne, opuściło, fałszywe)" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "przed chwilą";
  if (mins < 60) return `${mins} min temu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h temu`;
  const days = Math.floor(hours / 24);
  return `${days}d temu`;
}

/* ── Component ─────────────────────────────────────────────────── */

export default function InviteTrackerPage() {
  const params = useParams();
  const guildId = params.guildId as string;

  // Config state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [logChannelId, setLogChannelId] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [joinMessageUnknown, setJoinMessageUnknown] = useState("");
  const [joinMessageVanity, setJoinMessageVanity] = useState("");
  const [leaveMessage, setLeaveMessage] = useState("");

  // Stats state
  const [statsLoading, setStatsLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [recentJoins, setRecentJoins] = useState<RecentJoin[]>([]);
  const [overview, setOverview] = useState<StatsOverview>({ totalEntries: 0, totalActive: 0, totalLeft: 0, totalFake: 0 });
  const [userCache, setUserCache] = useState<Record<string, DiscordUser>>({});

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await fetchWithAuth(`/api/guild/${guildId}/invite-tracker/stats`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
        setRecentJoins(data.recentJoins || []);
        setOverview(data.overview || { totalEntries: 0, totalActive: 0, totalLeft: 0, totalFake: 0 });

        // Fetch user info for all unique user IDs
        const userIds = new Set<string>();
        (data.leaderboard || []).forEach((e: LeaderboardEntry) => userIds.add(e.inviterId));
        (data.recentJoins || []).forEach((e: RecentJoin) => {
          userIds.add(e.joinedUserId);
          if (e.inviterId) userIds.add(e.inviterId);
        });
        
        if (userIds.size > 0) {
          try {
            const membersRes = await fetch(`/api/discord/guild/${guildId}/members`);
            if (membersRes.ok) {
              const members = await membersRes.json();
              const cache: Record<string, DiscordUser> = {};
              for (const m of members) {
                if (userIds.has(m.id)) {
                  cache[m.id] = { id: m.id, username: m.username || m.user?.username || m.id, avatar: m.avatar || m.user?.avatar || null };
                }
              }
              setUserCache(cache);
            }
          } catch {
            // User cache is best-effort
          }
        }
      }
    } catch {
      // Stats are optional, don't block
    } finally {
      setStatsLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Channels cache
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
          fetchWithAuth(`/api/guild/${guildId}/invite-tracker/config`),
        ]);

        if (channelsRes.ok) {
          const channelsData = await channelsRes.json();
          const textChannels = channelsData.filter(
            (ch: Channel) => ch.type === 0 || ch.type === 5,
          );
          setChannels(textChannels);

          if (!cached || Date.now() - JSON.parse(cached).timestamp >= 60 * 1000) {
            localStorage.setItem(
              cacheKey,
              JSON.stringify({ data: channelsData, timestamp: Date.now() }),
            );
          }
        }

        if (configRes.ok) {
          const configData: InviteConfig = await configRes.json();
          setEnabled(configData.enabled);
          setLogChannelId(configData.logChannelId || "");
          setJoinMessage(configData.joinMessage || "");
          setJoinMessageUnknown(configData.joinMessageUnknown || "");
          setJoinMessageVanity(configData.joinMessageVanity || "");
          setLeaveMessage(configData.leaveMessage || "");
        }
      } catch (err) {
        setError("Nie udało się załadować danych. Spróbuj ponownie.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    fetchStats();
  }, [guildId, fetchStats]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/invite-tracker/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          logChannelId: logChannelId || null,
          joinMessage,
          joinMessageUnknown,
          joinMessageVanity,
          leaveMessage,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setEnabled(data.enabled);
        setLogChannelId(data.logChannelId || "");
        setJoinMessage(data.joinMessage || "");
        setJoinMessageUnknown(data.joinMessageUnknown || "");
        setJoinMessageVanity(data.joinMessageVanity || "");
        setLeaveMessage(data.leaveMessage || "");
        toast.success("Konfiguracja Invite Trackera została zapisana.");
      } else {
        toast.error("Nie udało się zapisać konfiguracji.");
      }
    } catch {
      toast.error("Wystąpił błąd podczas zapisywania.");
    } finally {
      setSaving(false);
    }
  };

  const getUserName = (userId: string) => {
    return userCache[userId]?.username || userId;
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <ErrorState
          title="Błąd ładowania"
          message={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <SlideIn>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/${guildId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-blue-500" />
              Invite Tracker
            </h1>
            <p className="text-muted-foreground text-sm">
              Śledź kto kogo zaprosił na serwer i wyświetlaj statystyki zaproszeń.
            </p>
          </div>
        </div>

        {/* Stats overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              {statsLoading ? (
                <Skeleton className="h-10 w-16 mx-auto" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-500">{overview.totalActive}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Users className="h-3 w-3" />
                    Aktywnych
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              {statsLoading ? (
                <Skeleton className="h-10 w-16 mx-auto" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-muted-foreground">{overview.totalLeft}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <UserMinus className="h-3 w-3" />
                    Opuściło
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              {statsLoading ? (
                <Skeleton className="h-10 w-16 mx-auto" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-red-500">{overview.totalFake}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    Fałszywych
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              {statsLoading ? (
                <Skeleton className="h-10 w-16 mx-auto" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-blue-500">{overview.totalEntries}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <LinkIcon className="h-3 w-3" />
                    Łącznie
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main config card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Konfiguracja
              {loading ? (
                <Skeleton className="h-6 w-10" />
              ) : (
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              )}
            </CardTitle>
            <CardDescription>
              Włącz śledzenie zaproszeń — bot będzie monitorował, kto kogo zaprosił na serwer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Log channel selector */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Kanał logów zaproszeń
              </Label>
              <p className="text-xs text-muted-foreground">
                Kanał, na który bot będzie wysyłał informacje o dołączeniach i opuszczeniach z danymi o zaproszeniach.
              </p>
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={logChannelId} onValueChange={setLogChannelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz kanał..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak (bez logów)</SelectItem>
                    {channels.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        # {ch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Join message template – known inviter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Wiadomość przy dołączeniu — znany zapraszający (opcjonalne)
              </Label>
              <p className="text-xs text-muted-foreground">
                Szablon używany, gdy osoba zapraszająca jest znana. Zostaw puste, aby użyć domyślnego embeda.
              </p>
              {loading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <VariableInserter
                  value={joinMessage}
                  onChange={setJoinMessage}
                  variables={INVITE_VARIABLES}
                  rows={4}
                  className="font-mono text-sm"
                  placeholder="Zostaw puste, aby użyć domyślnego embeda..."
                />
              )}
              {!loading && joinMessage && (
                <div className="space-y-2 mt-2">
                  <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" />
                    Podgląd wiadomości
                  </Label>
                  <DiscordMessagePreview content={joinMessage} />
                </div>
              )}
            </div>

            {/* Join message template – unknown inviter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Wiadomość przy dołączeniu — nieznany zapraszający (opcjonalne)
              </Label>
              <p className="text-xs text-muted-foreground">
                Szablon używany, gdy nie można ustalić kto zaprosił. Zostaw puste, aby użyć domyślnego embeda.
              </p>
              {loading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <VariableInserter
                  value={joinMessageUnknown}
                  onChange={setJoinMessageUnknown}
                  variables={INVITE_VARIABLES}
                  rows={4}
                  className="font-mono text-sm"
                  placeholder="Zostaw puste, aby użyć domyślnego embeda..."
                />
              )}
              {!loading && joinMessageUnknown && (
                <div className="space-y-2 mt-2">
                  <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" />
                    Podgląd wiadomości
                  </Label>
                  <DiscordMessagePreview content={joinMessageUnknown} />
                </div>
              )}
            </div>

            {/* Join message template – vanity/custom link */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Wiadomość przy dołączeniu — niestandardowy link (opcjonalne)
              </Label>
              <p className="text-xs text-muted-foreground">
                Szablon używany, gdy osoba dołączyła przez niestandardowy (vanity) link serwera. Zostaw puste, aby użyć domyślnego embeda.
              </p>
              {loading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <VariableInserter
                  value={joinMessageVanity}
                  onChange={setJoinMessageVanity}
                  variables={INVITE_VARIABLES}
                  rows={4}
                  className="font-mono text-sm"
                  placeholder="Zostaw puste, aby użyć domyślnego embeda..."
                />
              )}
              {!loading && joinMessageVanity && (
                <div className="space-y-2 mt-2">
                  <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" />
                    Podgląd wiadomości
                  </Label>
                  <DiscordMessagePreview content={joinMessageVanity} />
                </div>
              )}
            </div>

            {/* Leave message template */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <UserMinus className="h-4 w-4" />
                Wiadomość przy opuszczeniu (opcjonalne)
              </Label>
              <p className="text-xs text-muted-foreground">
                Niestandardowa wiadomość przy opuszczeniu serwera. Zostaw puste, aby użyć domyślnego embeda.
              </p>
              {loading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <VariableInserter
                  value={leaveMessage}
                  onChange={setLeaveMessage}
                  variables={INVITE_VARIABLES}
                  rows={4}
                  className="font-mono text-sm"
                  placeholder="Zostaw puste, aby użyć domyślnego embeda..."
                />
              )}
              {!loading && leaveMessage && (
                <div className="space-y-2 mt-2">
                  <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" />
                    Podgląd wiadomości
                  </Label>
                  <DiscordMessagePreview content={leaveMessage} />
                </div>
              )}
            </div>

            {/* Save button */}
            <Button onClick={handleSave} disabled={saving || loading} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Zapisywanie…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Zapisz konfigurację
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Ranking zapraszających
              </span>
              <Button variant="ghost" size="sm" onClick={fetchStats} disabled={statsLoading}>
                <RefreshCw className={`h-4 w-4 ${statsLoading ? "animate-spin" : ""}`} />
              </Button>
            </CardTitle>
            <CardDescription>
              Użytkownicy z największą liczbą aktywnych zaproszeń.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Brak danych o zaproszeniach.
              </p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.inviterId}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold w-8 text-center ${
                        entry.rank === 1 ? "text-yellow-500" :
                        entry.rank === 2 ? "text-gray-400" :
                        entry.rank === 3 ? "text-amber-600" :
                        "text-muted-foreground"
                      }`}>
                        #{entry.rank}
                      </span>
                      <div>
                        <div className="font-medium text-sm">{getUserName(entry.inviterId)}</div>
                        <div className="text-xs text-muted-foreground">
                          {entry.total} łącznie
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-green-500 font-medium">{entry.active} ✓</span>
                      <span className="text-muted-foreground">{entry.left} ✗</span>
                      {entry.fake > 0 && (
                        <span className="text-red-500">{entry.fake} ⚠</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent joins */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Ostatnie dołączenia
            </CardTitle>
            <CardDescription>
              10 ostatnich osób, które dołączyły do serwera.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentJoins.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Brak danych o dołączeniach.
              </p>
            ) : (
              <div className="space-y-2">
                {recentJoins.map((entry, i) => (
                  <div
                    key={`${entry.joinedUserId}-${i}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        entry.fake ? "bg-red-500" : entry.active ? "bg-green-500" : "bg-gray-500"
                      }`} />
                      <div>
                        <span className="font-medium">{getUserName(entry.joinedUserId)}</span>
                        {entry.inviterId && (
                          <span className="text-muted-foreground">
                            {" "}← {getUserName(entry.inviterId)}
                          </span>
                        )}
                        {entry.inviteCode && (
                          <span className="text-muted-foreground text-xs ml-1">
                            ({entry.inviteCode})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {entry.fake && (
                        <span className="text-red-500 font-medium">FAKE</span>
                      )}
                      {!entry.active && (
                        <span className="text-gray-500">opuścił</span>
                      )}
                      <span>{timeAgo(entry.joinedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </SlideIn>
    </div>
  );
}
