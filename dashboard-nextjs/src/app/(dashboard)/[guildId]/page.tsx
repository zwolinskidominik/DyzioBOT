"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideIn } from "@/components/ui/animated";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import Link from "next/link";
import Image from "next/image";
import {
  Puzzle, Cake, MessageSquare, Mic,
  Crown, Clock, User,
} from "lucide-react";

interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
  botPresent: boolean;
}

interface ModulesStatus {
  [key: string]: boolean;
}

interface MonthlyUserStat {
  userId: string;
  messageCount: number;
  voiceMinutes: number;
  totalActivity: number;
  rank: number;
}

interface UpcomingBirthday {
  userId: string;
  username: string | null;
  avatar: string | null;
  day: number;
  month: number;
  daysUntil: number;
}

interface AuditLogEntry {
  _id: string;
  module: string;
  action: string;
  userId: string;
  changes: Record<string, unknown>;
  createdAt: string;
}

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
}

const getGuildIcon = (guild: GuildInfo | null) => {
  if (!guild?.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
};

const getUserAvatar = (user: DiscordUser) => {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
  }
  const index = Number(BigInt(user.id) >> 22n) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
};

const MONTH_NAMES = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];

function formatVoiceTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

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

export default function GuildDashboard() {
  const params = useParams();
  const router = useRouter();
  const guildId = params.guildId as string;

  const [loading, setLoading] = useState(true);
  const [guild, setGuild] = useState<GuildInfo | null>(null);
  const [modulesStatus, setModulesStatus] = useState<ModulesStatus>({});
  const [monthlyStats, setMonthlyStats] = useState<MonthlyUserStat[]>([]);
  const [birthdays, setBirthdays] = useState<UpcomingBirthday[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [userCache, setUserCache] = useState<Record<string, DiscordUser>>({});

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [guildRes, modulesRes, statsRes, birthdaysRes, logsRes] = await Promise.all([
          fetchWithAuth(`/api/discord/guild/${guildId}`),
          fetch(`/api/guild/${guildId}/modules-status`),
          fetch(`/api/guild/${guildId}/monthly-stats/current?limit=5`),
          fetch(`/api/guild/${guildId}/birthdays/upcoming`),
          fetch(`/api/guild/${guildId}/audit-logs?limit=5`),
        ]);

        if (guildRes.ok) {
          const data = await guildRes.json();
          setGuild({ id: guildId, name: data.name, icon: data.icon, botPresent: data.hasBot !== false });
        } else {
          setGuild({ id: guildId, name: "Twój serwer", icon: null, botPresent: true });
        }

        if (modulesRes.ok) setModulesStatus(await modulesRes.json());

        if (statsRes.ok) {
          const data = await statsRes.json();
          setMonthlyStats(data.stats || []);
        }

        if (birthdaysRes.ok) {
          const data = await birthdaysRes.json();
          setBirthdays((data || []).slice(0, 5));
        }

        if (logsRes.ok) {
          const data = await logsRes.json();
          setAuditLogs((data.logs || []).slice(0, 5));
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        setGuild({ id: guildId, name: "Twój serwer", icon: null, botPresent: true });
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [guildId]);

  // Resolve Discord usernames for monthly stats + audit logs
  useEffect(() => {
    const userIds = new Set<string>();
    monthlyStats.forEach(s => userIds.add(s.userId));
    auditLogs.forEach(l => userIds.add(l.userId));

    const unknownIds = [...userIds].filter(id => !userCache[id]);
    if (unknownIds.length === 0) return;

    const fetchUsers = async () => {
      try {
        const res = await fetchWithAuth(`/api/discord/guild/${guildId}/bulk?include=members`);
        if (res.ok) {
          const data = await res.json();
          const members = data.members || [];
          const cache: Record<string, DiscordUser> = { ...userCache };
          for (const m of members) {
            // bulk API returns flat objects: { id, username, avatar, discriminator, nickname }
            const id = m.user?.id ?? m.id;
            if (id) {
              cache[id] = {
                id,
                username: m.user?.username ?? m.username ?? m.nickname ?? "Nieznany",
                avatar: m.user?.avatar ?? m.avatar ?? null,
                discriminator: m.user?.discriminator ?? m.discriminator ?? "0",
              };
            }
          }
          setUserCache(cache);
        }
      } catch {}
    };

    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyStats, auditLogs, guildId]);

  // Computed stats
  const enabledCount = Object.values(modulesStatus).filter(Boolean).length;
  const totalModules = Object.keys(modulesStatus).length;
  const totalMessages = monthlyStats.reduce((sum, s) => sum + s.messageCount, 0);
  const totalVoice = monthlyStats.reduce((sum, s) => sum + s.voiceMinutes, 0);
  const nextBirthdayDays = birthdays.length > 0 ? birthdays[0].daysUntil : null;

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto p-4 md:p-8">
          <Skeleton className="h-10 w-48 mb-4" />
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-lg" />
            <Skeleton className="h-80 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!guild?.botPresent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Bot nie jest na serwerze</CardTitle>
            <CardDescription>
              Aby zarządzać tym serwerem, musisz najpierw dodać DyzioBot
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" size="lg">
              <a
                href={`https://discord.com/api/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? ""}&permissions=8&scope=bot%20applications.commands&guild_id=${guildId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Dodaj bota na serwer
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full mt-2">
              <Link href="/guilds">Wróć do listy serwerów</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-4 md:p-8">
        {/* Header */}
        <SlideIn direction="up">
          <div className="mb-8">
            <Link
              href="/guilds"
              className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded-lg bg-gradient-to-r from-bot-blue/10 to-bot-primary/10 hover:from-bot-blue/20 hover:to-bot-primary/20 border border-bot-blue/30 hover:border-bot-blue/50 transition-all group"
            >
              <svg className="w-4 h-4 text-bot-light group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium text-foreground">Wszystkie serwery</span>
            </Link>
            <div className="flex items-center gap-4">
              {getGuildIcon(guild) ? (
                <Image src={getGuildIcon(guild)!} alt={guild.name} width={64} height={64} className="rounded-full shadow-lg shadow-bot-primary/20" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-bot-light to-bot-primary flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-bot-primary/20">
                  {guild.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold mb-1 bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                  Panel główny - {guild.name}
                </h1>
                <p className="text-muted-foreground">Przegląd aktywności serwera</p>
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              icon: Puzzle, label: "Aktywne moduły",
              value: `${enabledCount}/${totalModules}`,
              sub: enabledCount === totalModules ? "Wszystkie włączone" : `${totalModules - enabledCount} wyłączonych`,
              color: "from-blue-500 to-blue-600",
            },
            {
              icon: Cake, label: "Najbliższe urodziny",
              value: nextBirthdayDays !== null ? (nextBirthdayDays === 0 ? "Dziś!" : `za ${nextBirthdayDays}d`) : "—",
              sub: birthdays.length > 0 ? (birthdays[0].username || `ID: ${birthdays[0].userId.slice(0, 8)}...`) : "Brak danych",
              color: "from-pink-500 to-pink-600",
            },
            {
              icon: MessageSquare, label: "Wiadomości (miesiąc)",
              value: totalMessages.toLocaleString("pl-PL"),
              sub: `Top ${monthlyStats.length} użytkowników`,
              color: "from-green-500 to-green-600",
            },
            {
              icon: Mic, label: "Głos (miesiąc)",
              value: formatVoiceTime(totalVoice),
              sub: `Top ${monthlyStats.length} użytkowników`,
              color: "from-violet-500 to-violet-600",
            },
          ].map((stat, i) => (
            <SlideIn key={stat.label} direction="up" delay={i * 80}>
              <Card
                className="backdrop-blur h-full"
                style={{ backgroundColor: "rgba(189,189,189,.05)", boxShadow: "0 0 10px #00000026", border: "1px solid transparent" }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`bg-gradient-to-br ${stat.color} p-2 rounded-lg shadow-md`}>
                      <stat.icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                </CardContent>
              </Card>
            </SlideIn>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Top active users */}
          <SlideIn direction="up" delay={350}>
            <Card
              className="backdrop-blur"
              style={{ backgroundColor: "rgba(189,189,189,.05)", boxShadow: "0 0 10px #00000026", border: "1px solid transparent" }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-500" />
                  <CardTitle className="text-lg">Najbardziej aktywni w tym miesiącu</CardTitle>
                </div>
                <CardDescription>Ranking na podstawie wiadomości i czasu na głosowych</CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Brak danych za ten miesiąc</p>
                ) : (
                  <div className="space-y-3">
                    {monthlyStats.map((stat, i) => {
                      const user = userCache[stat.userId];
                      const rankColors = ["text-yellow-500", "text-gray-400", "text-amber-600"];
                      return (
                        <div key={stat.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                          <span className={`text-lg font-bold w-6 text-center ${rankColors[i] || "text-muted-foreground"}`}>
                            {stat.rank}
                          </span>
                          {user?.avatar ? (
                            <Image src={getUserAvatar(user)} alt="" width={32} height={32} className="rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <User className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {user?.username || `Użytkownik ${stat.userId.slice(-4)}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {stat.messageCount.toLocaleString("pl-PL")} wiad. · {formatVoiceTime(stat.voiceMinutes)} głos
                            </p>
                          </div>
                          <span className="text-xs font-mono text-muted-foreground">{stat.totalActivity} pkt</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Link
                  href={`/${guildId}/monthly-stats`}
                  className="block mt-4 text-center text-sm text-bot-light hover:text-bot-primary transition-colors"
                >
                  Zobacz pełne statystyki →
                </Link>
              </CardContent>
            </Card>
          </SlideIn>

          {/* Right: Birthdays + Audit logs stacked */}
          <div className="space-y-6">
            {/* Upcoming birthdays */}
            <SlideIn direction="up" delay={450}>
              <Card
                className="backdrop-blur"
                style={{ backgroundColor: "rgba(189,189,189,.05)", boxShadow: "0 0 10px #00000026", border: "1px solid transparent" }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Cake className="w-5 h-5 text-pink-500" />
                    <CardTitle className="text-lg">Nadchodzące urodziny</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {birthdays.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 text-center">Brak zarejestrowanych urodzin</p>
                  ) : (
                    <div className="space-y-2">
                      {birthdays.map((b) => (
                        <div key={b.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                          {b.avatar ? (
                            <Image
                              src={`https://cdn.discordapp.com/avatars/${b.userId}/${b.avatar}.png?size=32`}
                              alt="" width={28} height={28} className="rounded-full"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-pink-500/20 flex items-center justify-center">
                              <Cake className="w-3.5 h-3.5 text-pink-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {b.username || `ID: ${b.userId.slice(0, 12)}...`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {b.day} {MONTH_NAMES[b.month - 1]}
                            </p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            b.daysUntil === 0
                              ? "bg-pink-500/20 text-pink-400"
                              : b.daysUntil <= 7
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {b.daysUntil === 0 ? "Dziś! 🎂" : `za ${b.daysUntil}d`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Link
                    href={`/${guildId}/birthdays`}
                    className="block mt-3 text-center text-sm text-bot-light hover:text-bot-primary transition-colors"
                  >
                    Zarządzaj urodzinami →
                  </Link>
                </CardContent>
              </Card>
            </SlideIn>

            {/* Recent audit logs */}
            <SlideIn direction="up" delay={550}>
              <Card
                className="backdrop-blur"
                style={{ backgroundColor: "rgba(189,189,189,.05)", boxShadow: "0 0 10px #00000026", border: "1px solid transparent" }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <CardTitle className="text-lg">Ostatnie zmiany w panelu</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {auditLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 text-center">Brak wpisów</p>
                  ) : (
                    <div className="space-y-2">
                      {auditLogs.map((log) => {
                        const user = userCache[log.userId];
                        return (
                          <div key={log._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                            {user?.avatar ? (
                              <Image src={getUserAvatar(user)} alt="" width={24} height={24} className="rounded-full" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <User className="w-3 h-3 text-blue-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">
                                <span className="font-medium">{user?.username || "Nieznany"}</span>
                                {" "}
                                <span className="text-muted-foreground">{log.action}</span>
                                {" "}
                                <span className="text-bot-light">{log.module}</span>
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {timeAgo(log.createdAt)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Link
                    href={`/${guildId}/audit-logs`}
                    className="block mt-3 text-center text-sm text-bot-light hover:text-bot-primary transition-colors"
                  >
                    Zobacz wszystkie logi →
                  </Link>
                </CardContent>
              </Card>
            </SlideIn>
          </div>
        </div>
      </div>
    </div>
  );
}
