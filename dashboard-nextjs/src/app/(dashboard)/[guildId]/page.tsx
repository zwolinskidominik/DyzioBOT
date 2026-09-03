"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideIn } from "@/components/ui/animated";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { OWNER_GUILD_IDS } from "@/lib/owner";
import { avatarUrlFor, getMonthString, nextPublishDate, type RawMonth } from "@/lib/monthlyStats";
import Link from "next/link";
import Image from "next/image";
import { User, ChevronRight } from "lucide-react";

/* ── Paleta wg specyfikacji redesignu strony głównej ── */
const COLOR = {
  accent: "#6366f1",
  accentHover: "#818cf8",
  pageBg: "#15161c",
  card: "#1F2129",
  inner: "#17181E",
  border: "#2f3341",
  heading: "#fff",
  body: "#d8dbe6",
  secondary: "#8d94a8",
  label: "#6b7280",
} as const;

const cardStyle: CSSProperties = {
  backgroundColor: COLOR.card,
  borderRadius: 10,
  padding: "16px 18px",
  boxShadow: "0 8px 18px rgba(8,10,16,0.16)",
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  color: COLOR.label,
  textTransform: "uppercase",
};

const chartLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  color: COLOR.label,
  textTransform: "uppercase",
};

function toggleBtnStyle(active: boolean): CSSProperties {
  return {
    border: `1px solid ${active ? COLOR.accent : COLOR.border}`,
    background: active ? "rgba(99,102,241,0.15)" : COLOR.inner,
    color: active ? "#fff" : "#b9c0d0",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all .15s ease",
  };
}

function chipStyle(active: boolean): CSSProperties {
  return {
    border: `1px solid ${active ? COLOR.accent : COLOR.border}`,
    background: active ? "rgba(99,102,241,0.15)" : COLOR.inner,
    color: active ? "#fff" : "#b9c0d0",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 10,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all .15s ease",
  };
}

function trendChipStyle(trend: number | null): CSSProperties {
  const base: CSSProperties = { borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 700 };
  if (trend === null || trend === 0) return { ...base, background: "rgba(107,114,128,0.15)", color: COLOR.label };
  return trend > 0
    ? { ...base, background: "rgba(34,197,94,0.15)", color: "#86efac" }
    : { ...base, background: "rgba(239,68,68,0.15)", color: "#fca5a5" };
}

/* ── Gradient słupków wykresu: stare → nowe ── */
function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
const GRAD_STOPS: [number, number, number][] = [hexToRgb("#2f3341"), hexToRgb("#3a3f4e"), hexToRgb("#6366f1")];
function barColor(t: number): string {
  return t <= 0.5 ? mix(GRAD_STOPS[0], GRAD_STOPS[1], t / 0.5) : mix(GRAD_STOPS[1], GRAD_STOPS[2], (t - 0.5) / 0.5);
}

interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
  botPresent: boolean;
}

interface ModulesStatus {
  [key: string]: boolean;
}

interface UpcomingBirthday {
  userId: string;
  username: string | null;
  avatar: string | null;
  day: number;
  month: number;
  daysUntil: number;
}

interface ModerationLogEntry {
  _id: string;
  kind: "ban" | "kick" | "mute" | "warn" | "clear";
  targetId: string;
  targetTag: string;
  targetUsername: string | null;
  targetAvatar: string | null;
  moderatorTag: string;
  reason: string;
  createdAt: string;
}

interface AuditLogEntry {
  _id: string;
  userId: string;
  module: string;
  action: string;
  username: string;
  description?: string;
  avatar: string | null;
  createdAt: string;
}

interface BotStatus {
  online: boolean;
  ping: number | null;
}

type FeedItem = {
  id: string;
  kind: "moderacja" | "panel";
  title: string;
  subtitle: string;
  emoji: string;
  color: string;
  createdAt: string;
};

type Metric = "messages" | "voice" | "joins";

interface DailyBucket {
  date: string;
  label: string;
  isToday: boolean;
  messages: number;
  voice: number;
  joins: number;
}

const getGuildIcon = (guild: GuildInfo | null) => {
  if (!guild?.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
};

const MODERATION_LABELS: Record<ModerationLogEntry["kind"], string> = {
  ban: "Zbanowano",
  kick: "Wyrzucono",
  mute: "Wyciszono",
  warn: "Ostrzeżono",
  clear: "Wyczyszczono wiadomości",
};

const MODERATION_EMOJI: Record<ModerationLogEntry["kind"], string> = {
  ban: "🔨",
  kick: "👢",
  mute: "🔇",
  warn: "⚠️",
  clear: "🧹",
};

const MODERATION_COLOR: Record<ModerationLogEntry["kind"], string> = {
  ban: "#ef4444",
  kick: "#ef4444",
  mute: "#a970ff",
  warn: "#facc15",
  clear: "#a970ff",
};

/** Emoji per moduł zmieniony w panelu — żeby wiersze "panel" w strumieniu nie wyglądały identycznie. */
const MODULE_EMOJI: Record<string, string> = {
  greetings: "👋",
  autoroles: "🎭",
  "reaction-roles": "🙂",
  "temp-channels": "🔊",
  tickets: "🎫",
  suggestions: "💡",
  levels: "⭐",
  birthdays: "🎂",
  qotd: "❓",
  giveaway: "🎁",
  wrapped: "🎉",
  "stream-config": "📺",
  "channel-stats": "📈",
  "monthly-stats": "📊",
  "invite-tracker": "🔗",
  logs: "📋",
  "anti-spam": "🛡️",
  moderation: "🔨",
  commands: "⌨️",
  settings: "⚙️",
  disboard: "📣",
  tournament: "🎮",
};

/** Polskie etykiety modułów — 1:1 z nazwami w Sidebar.tsx (moduleGroups), żeby karta "Moduły" nie pokazywała surowych kluczy. */
const MODULE_LABELS: Record<string, string> = {
  commands: "Komendy",
  greetings: "Powitania",
  autoroles: "Auto role",
  "reaction-roles": "Role za reakcje",
  "temp-channels": "Tymczasowe Kanały",
  tickets: "Tickety",
  suggestions: "Sugestie",
  levels: "Poziomy",
  birthdays: "Urodziny",
  qotd: "Pytanie Dnia",
  tournament: "Turniej CS2",
  giveaway: "Giveaway",
  wrapped: "Server Wrapped",
  "stream-config": "Powiadomienia Twitch",
  "channel-stats": "Kanały z licznikami",
  "monthly-stats": "Statystyki Miesięczne",
  "invite-tracker": "Invite Tracker",
  logs: "Logi",
  "anti-spam": "Anti-Spam",
  moderation: "Moderacja",
  disboard: "Disboard",
};

/** Ścieżka strony modułu — j.w., 1:1 z Sidebar.tsx. */
const MODULE_HREF: Record<string, string> = {
  commands: "/commands",
  greetings: "/greetings",
  autoroles: "/autoroles",
  "reaction-roles": "/reaction-roles",
  "temp-channels": "/temp-channels",
  tickets: "/tickets",
  suggestions: "/suggestions",
  levels: "/levels",
  birthdays: "/birthdays",
  qotd: "/qotd",
  tournament: "/tournament",
  giveaway: "/giveaway",
  wrapped: "/wrapped",
  "stream-config": "/stream-config",
  "channel-stats": "/channel-stats",
  "monthly-stats": "/monthly-stats",
  "invite-tracker": "/invite-tracker",
  logs: "/logs",
  "anti-spam": "/anti-spam",
  moderation: "/moderation",
  disboard: "/disboard",
};

function moduleCountLabel(n: number): string {
  if (n === 1) return "1 moduł wymaga konfiguracji";
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${n} moduły wymagają konfiguracji`;
  return `${n} modułów wymaga konfiguracji`;
}

/** Naprzemienny kolor "moduły" z palety (#6366f1 / #38bdf8), deterministyczny wg nazwy modułu. */
function moduleColor(mod: string): string {
  let hash = 0;
  for (let i = 0; i < mod.length; i++) hash = (hash * 31 + mod.charCodeAt(i)) >>> 0;
  return hash % 2 === 0 ? "#6366f1" : "#38bdf8";
}

function formatVoiceTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
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

function daysUntil(target: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86_400_000);
}

/** Server Wrapped: cron w bocie to 11 listopada 12:00 (Europe/Warsaw), co roku. */
function nextWrappedDate(): Date {
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), 10, 11, 12, 0, 0);
  return thisYear >= now ? thisYear : new Date(now.getFullYear() + 1, 10, 11, 12, 0, 0);
}

export default function GuildDashboard() {
  const params = useParams();
  const guildId = params.guildId as string;

  const [loading, setLoading] = useState(true);
  const [guild, setGuild] = useState<GuildInfo | null>(null);
  const [modulesStatus, setModulesStatus] = useState<ModulesStatus>({});
  const [moduleIssues, setModuleIssues] = useState<{ key: string; reason: string }[]>([]);
  const [months, setMonths] = useState<RawMonth[]>([]);
  const [birthdays, setBirthdays] = useState<UpcomingBirthday[]>([]);
  const [modLogs, setModLogs] = useState<ModerationLogEntry[]>([]);
  const [modLogsTotal, setModLogsTotal] = useState(0);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLogsTotal, setAuditLogsTotal] = useState(0);
  const [dailyData, setDailyData] = useState<DailyBucket[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus>({ online: false, ping: null });
  const [mvp, setMvp] = useState<{ userId: string; username: string | null; avatar: string | null } | null>(null);

  const [metric, setMetric] = useState<Metric>("messages");
  const [feedFilter, setFeedFilter] = useState<"all" | "moderacja" | "panel">("all");
  const [hoverBarIndex, setHoverBarIndex] = useState<number | null>(null);
  const [modulesExpanded, setModulesExpanded] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [guildRes, modulesRes, issuesRes, rawRes, dailyRes, birthdaysRes, modLogRes, auditRes, statusRes] = await Promise.all([
          fetchWithAuth(`/api/discord/guild/${guildId}`),
          fetchWithAuth(`/api/guild/${guildId}/modules-status`),
          fetchWithAuth(`/api/guild/${guildId}/modules-status/issues`),
          fetchWithAuth(`/api/guild/${guildId}/monthly-stats/raw`),
          fetchWithAuth(`/api/guild/${guildId}/activity/daily`),
          fetchWithAuth(`/api/guild/${guildId}/birthdays/upcoming`),
          fetchWithAuth(`/api/guild/${guildId}/moderation/log?limit=5`),
          fetchWithAuth(`/api/guild/${guildId}/audit-logs?limit=5`),
          fetchWithAuth(`/api/bot-status`),
        ]);

        if (guildRes.ok) {
          const data = await guildRes.json();
          setGuild({ id: guildId, name: data.name, icon: data.icon, botPresent: data.hasBot !== false });
        } else {
          setGuild({ id: guildId, name: "Twój serwer", icon: null, botPresent: true });
        }

        if (modulesRes.ok) setModulesStatus(await modulesRes.json());
        if (issuesRes.ok) {
          const data = await issuesRes.json();
          setModuleIssues(data.issues || []);
        }
        if (rawRes.ok) {
          const data = await rawRes.json();
          setMonths(data.months || []);
        }
        if (dailyRes.ok) {
          const data = await dailyRes.json();
          setDailyData(data.days || []);
        }
        if (birthdaysRes.ok) setBirthdays(((await birthdaysRes.json()) || []).slice(0, 5));
        if (modLogRes.ok) {
          const data = await modLogRes.json();
          setModLogs(data.logs || []);
          setModLogsTotal(data.total ?? data.logs?.length ?? 0);
        }
        if (auditRes.ok) {
          const data = await auditRes.json();
          setAuditLogs(data.logs || []);
          setAuditLogsTotal(data.total ?? data.logs?.length ?? 0);
        }
        if (statusRes.ok) setBotStatus(await statusRes.json());
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        setGuild({ id: guildId, name: "Twój serwer", icon: null, botPresent: true });
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [guildId]);

  // MVP miesiąca — top user bieżącego miesiąca (wg wiadomości + głos), z avatarem/nickiem z Discorda.
  useEffect(() => {
    const current = months.find((m) => m.isCurrent);
    if (!current || current.users.length === 0) {
      setMvp(null);
      return;
    }
    const top = [...current.users].sort(
      (a, b) => b.messageCount + b.voiceMinutes * 2 - (a.messageCount + a.voiceMinutes * 2)
    )[0];

    fetchWithAuth(`/api/discord/guild/${guildId}/bulk?include=members`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const member = (data?.members || []).find((m: { user?: { id: string }; id?: string }) => (m.user?.id ?? m.id) === top.userId);
        setMvp({
          userId: top.userId,
          username: member?.user?.username ?? member?.username ?? member?.nickname ?? null,
          avatar: member?.user?.avatar ?? member?.avatar ?? null,
        });
      })
      .catch(() => setMvp({ userId: top.userId, username: null, avatar: null }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, guildId]);

  const enabledCount = Object.values(modulesStatus).filter(Boolean).length;
  const totalModules = Object.keys(modulesStatus).length;

  const chartData = dailyData;

  // Trend: suma ostatnich 15 dni vs suma poprzednich 15 dni (okno 30-dniowego wykresu).
  const trend = useMemo(() => {
    if (chartData.length < 30) return null;
    const last15 = chartData.slice(15, 30).reduce((sum, d) => sum + d[metric], 0);
    const prev15 = chartData.slice(0, 15).reduce((sum, d) => sum + d[metric], 0);
    if (prev15 === 0) return null;
    return Math.round(((last15 - prev15) / prev15) * 100);
  }, [chartData, metric]);

  const metricTotal30d = useMemo(() => chartData.reduce((sum, d) => sum + d[metric], 0), [chartData, metric]);

  const currentMonth = months.find((m) => m.isCurrent);
  const monthMessages = currentMonth?.users.reduce((sum, u) => sum + u.messageCount, 0) ?? 0;
  const monthVoice = currentMonth?.users.reduce((sum, u) => sum + u.voiceMinutes, 0) ?? 0;
  const monthActiveUsers = currentMonth?.users.filter((u) => u.messageCount > 0 || u.voiceMinutes > 0).length ?? 0;

  const maxChartVal = useMemo(() => Math.max(1, ...chartData.map((d) => d[metric])), [chartData, metric]);
  const activeBarIndex = hoverBarIndex ?? chartData.length - 1;
  const hasChartData = useMemo(() => chartData.some((d) => d[metric] > 0), [chartData, metric]);

  const feed: FeedItem[] = useMemo(() => {
    const modItems: FeedItem[] = modLogs.map((log) => ({
      id: `mod-${log._id}`,
      kind: "moderacja",
      title: `${MODERATION_LABELS[log.kind]}${log.kind !== "clear" ? ` ${log.targetUsername ?? log.targetTag}` : ""}`,
      subtitle: `przez ${log.moderatorTag}${log.reason ? ` · ${log.reason}` : ""}`,
      emoji: MODERATION_EMOJI[log.kind],
      color: MODERATION_COLOR[log.kind],
      createdAt: log.createdAt,
    }));
    const panelItems: FeedItem[] = auditLogs.map((log) => ({
      id: `audit-${log._id}`,
      kind: "panel",
      title: log.description ?? `${log.action} (${log.module})`,
      subtitle: `przez ${log.username}`,
      emoji: MODULE_EMOJI[log.module] ?? "⚙️",
      color: moduleColor(log.module),
      createdAt: log.createdAt,
    }));
    return [...modItems, ...panelItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [modLogs, auditLogs]);

  const filteredFeed = feedFilter === "all" ? feed : feed.filter((f) => f.kind === feedFilter);

  const upcoming = useMemo(() => {
    const items: { key: string; emoji: string; title: string; daysUntil: number; href: string }[] = [];

    if (birthdays.length > 0) {
      const b = birthdays[0];
      items.push({
        key: "birthday",
        emoji: "🎂",
        title: `Urodziny ${b.username ?? `użytkownika ${b.userId.slice(-4)}`}`,
        daysUntil: b.daysUntil,
        href: `/${guildId}/birthdays`,
      });
    }

    if (months.length > 0) {
      const currentId = getMonthString(new Date(), 0);
      items.push({
        key: "topka",
        emoji: "🏆",
        title: "Topka miesiąca",
        daysUntil: daysUntil(nextPublishDate(currentId)),
        href: `/${guildId}/monthly-stats`,
      });
    }

    if (OWNER_GUILD_IDS.includes(guildId) && modulesStatus.wrapped) {
      items.push({
        key: "wrapped",
        emoji: "🎉",
        title: "Server Wrapped",
        daysUntil: daysUntil(nextWrappedDate()),
        href: `/${guildId}/wrapped`,
      });
    }

    // Wydarzenia dalej niż ~60 dni to szum na liście "Nadchodzi" — pomijamy zamiast pokazywać "za 154d".
    return items
      .filter((item) => item.daysUntil <= 60)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 4);
  }, [birthdays, months, modulesStatus, guildId]);

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-64 rounded-lg mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96 rounded-lg lg:col-span-2" />
            <Skeleton className="h-96 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!guild?.botPresent) {
    return (
      <div className="min-h-full flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Bot nie jest na serwerze</CardTitle>
            <CardDescription>
              Aby zarządzać tym serwerem, musisz najpierw dodać Deezy
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

  const activeBar = chartData[activeBarIndex] as (typeof chartData)[number] | undefined;

  return (
    <div className="flex w-full flex-col" style={{ maxWidth: 1000, margin: "0 auto", gap: 12 }}>
      {/* Header */}
      <SlideIn direction="up">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {getGuildIcon(guild) ? (
                <Image src={getGuildIcon(guild)!} alt={guild.name} width={52} height={52} className="rounded-full" />
              ) : (
                <div
                  className="flex items-center justify-center rounded-full text-xl font-bold text-white"
                  style={{ width: 52, height: 52, background: `linear-gradient(135deg, ${COLOR.accentHover}, ${COLOR.accent})` }}
                >
                  {guild.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: COLOR.heading, marginBottom: 2 }}>{guild.name}</h1>
                <p style={{ fontSize: 13, color: "#969db0" }}>Przegląd aktywności serwera</p>
              </div>
            </div>

            <div
              className="flex items-center gap-2"
              style={{
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                background: botStatus.online ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                color: botStatus.online ? "#86efac" : "#fca5a5",
              }}
            >
              <span
                className="animate-pulse"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: botStatus.online ? "#22c55e" : "#ef4444",
                }}
              />
              {botStatus.online ? `Bot online · ping ${botStatus.ping}ms` : "Bot offline"}
            </div>
          </div>
        </SlideIn>

        {/* Hero: metric chart */}
        <SlideIn direction="up" delay={80}>
          <div style={{ ...cardStyle, padding: "18px 20px" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div style={chartLabelStyle}>
                  {metric === "voice" ? "Głos" : metric === "joins" ? "Dołączenia" : "Wiadomości"} · ostatnie 30 dni
                </div>
                {hasChartData && (
                  <div className="flex items-baseline gap-2" style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>
                      {metric === "voice" ? formatVoiceTime(metricTotal30d) : metricTotal30d.toLocaleString("pl-PL")}
                    </span>
                    {trend !== null && (
                      <span style={trendChipStyle(trend)}>
                        {`${trend > 0 ? "↑" : "↓"} ${Math.abs(trend)}% vs poprzednie 15 dni`}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {([["messages", "Wiadomości"], ["voice", "Głos"], ["joins", "Dołączenia"]] as const).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setMetric(key)} style={toggleBtnStyle(metric === key)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              {!hasChartData ? (
                <div style={{ height: 96, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ fontSize: 13, color: COLOR.secondary }}>Brak danych za ostatnie 30 dni</p>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 96 }}>
                    {chartData.map((d, i) => {
                      const value = d[metric];
                      const isActive = i === activeBarIndex;
                      const hasValue = value > 0;
                      const heightStyle: CSSProperties = hasValue
                        ? { height: `${Math.max(3, Math.round((value / maxChartVal) * 100))}%` }
                        : { height: 3 };
                      const color = !hasValue ? "#2f3341" : isActive ? "#a5b4fc" : barColor(chartData.length > 1 ? i / (chartData.length - 1) : 1);
                      return (
                        <div
                          key={`${d.date}-${i}`}
                          onMouseEnter={() => setHoverBarIndex(i)}
                          onMouseLeave={() => setHoverBarIndex(null)}
                          onClick={() => setHoverBarIndex(i)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            ...heightStyle,
                            background: color,
                            borderRadius: "3px 3px 0 0",
                            cursor: "pointer",
                            transition: "background .15s ease",
                          }}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 10, color: COLOR.label }}>{chartData[0]?.label}</span>
                    <span style={{ fontSize: 11, color: "#c7d2fe" }}>
                      {activeBar
                        ? `${activeBar.isToday ? "Dziś" : activeBar.label}: ${
                            metric === "voice"
                              ? formatVoiceTime(activeBar.voice)
                              : metric === "joins"
                                ? `${activeBar.joins} dołączeń`
                                : `${activeBar.messages.toLocaleString("pl-PL")} wiad.`
                          }`
                        : ""}
                    </span>
                    <span style={{ fontSize: 10, color: COLOR.label }}>{chartData[chartData.length - 1]?.label}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </SlideIn>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-3 items-start">
          {/* Left: activity feed */}
          <SlideIn direction="up" delay={160} className="min-w-0">
            <div style={cardStyle}>
              <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLOR.body }}>Co się dzieje na serwerze</div>
                <div className="flex items-center gap-2">
                  {([["all", "Wszystko"], ["moderacja", "Moderacja"], ["panel", "Panel"]] as const).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => setFeedFilter(key)} style={chipStyle(feedFilter === key)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredFeed.length === 0 ? (
                <p style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: COLOR.secondary }}>Brak ostatnich zdarzeń</p>
              ) : (
                <div className="flex flex-col" style={{ gap: 8 }}>
                  {filteredFeed.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start"
                      style={{
                        background: COLOR.inner,
                        borderRadius: 8,
                        padding: "10px 12px",
                        borderLeft: `3px solid ${item.color}`,
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 13, lineHeight: 1.5 }}>{item.emoji}</span>
                      <div className="flex-1 min-w-0" style={{ fontSize: 12, lineHeight: 1.5, color: COLOR.body }}>
                        <strong style={{ color: "#fff" }}>{item.title}</strong> <span>{item.subtitle}</span>
                      </div>
                      <span style={{ fontSize: 10, color: COLOR.label, whiteSpace: "nowrap", flexShrink: 0 }}>
                        {timeAgo(item.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <Link
                href={feedFilter === "panel" ? `/${guildId}/audit-logs` : `/${guildId}/moderation`}
                className="flex items-center justify-center"
                style={{
                  marginTop: 14,
                  border: `1px solid ${COLOR.border}`,
                  background: "transparent",
                  color: "#c4cad8",
                  borderRadius: 8,
                  padding: 9,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Pokaż wszystkie ({feedFilter === "all" ? modLogsTotal + auditLogsTotal : feedFilter === "moderacja" ? modLogsTotal : auditLogsTotal})
              </Link>
            </div>
          </SlideIn>

          {/* Right: sidebar */}
          <div className="flex flex-col min-w-0" style={{ gap: 12 }}>
            {/* Nadchodzi */}
            <SlideIn direction="up" delay={240}>
              <div style={cardStyle}>
                <div style={{ ...sectionLabelStyle, marginBottom: 10 }}>Nadchodzi</div>
                {upcoming.length === 0 ? (
                  <p style={{ padding: "8px 0", textAlign: "center", fontSize: 12, color: COLOR.secondary }}>Brak nadchodzących wydarzeń</p>
                ) : (
                  <div className="flex flex-col" style={{ gap: 2 }}>
                    {upcoming.map((item) => (
                      <Link key={item.key} href={item.href} className="flex items-center" style={{ gap: 8, padding: "6px 0" }}>
                        <span style={{ fontSize: 14 }}>{item.emoji}</span>
                        <span
                          className="flex-1 min-w-0 truncate"
                          style={{ fontSize: 12, color: COLOR.body }}
                        >
                          {item.title}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            color: item.daysUntil <= 0 ? "#fca5a5" : item.daysUntil <= 7 ? "#facc15" : COLOR.label,
                          }}
                        >
                          {item.daysUntil <= 0 ? "Dziś" : `za ${item.daysUntil}d`}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </SlideIn>

            {/* Moduły */}
            <SlideIn direction="up" delay={320}>
              <div style={cardStyle}>
                <div style={{ ...sectionLabelStyle, marginBottom: 10 }}>Moduły</div>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                    {enabledCount}/{totalModules}
                  </span>
                  <span style={{ fontSize: 11, color: COLOR.secondary }}>włączonych</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: COLOR.border, overflow: "hidden", marginBottom: 10 }}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 3,
                      width: totalModules > 0 ? `${(enabledCount / totalModules) * 100}%` : "0%",
                      background: "linear-gradient(90deg,#6366f1,#a855f7)",
                    }}
                  />
                </div>
                {moduleIssues.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setModulesExpanded((v) => !v)}
                      className="flex w-full items-center justify-between"
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#fcd34d" }}>
                        ⚠️ {moduleCountLabel(moduleIssues.length)}
                      </span>
                      <ChevronRight
                        className="w-3.5 h-3.5"
                        style={{ color: COLOR.label, transform: modulesExpanded ? "rotate(90deg)" : "none", transition: "transform .15s ease" }}
                      />
                    </button>

                    {modulesExpanded && (
                      <div className="flex flex-col" style={{ gap: 6, marginTop: 8 }}>
                        {moduleIssues.map(({ key, reason }) => (
                          <div
                            key={key}
                            className="flex items-center"
                            style={{ gap: 8, background: COLOR.inner, borderRadius: 8, padding: "8px 10px" }}
                          >
                            <span style={{ fontSize: 14 }}>{MODULE_EMOJI[key] ?? "⚙️"}</span>
                            <div className="flex-1 min-w-0">
                              <p style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{MODULE_LABELS[key] ?? key}</p>
                              <p className="truncate" style={{ fontSize: 11, color: COLOR.secondary }}>{reason}</p>
                            </div>
                            <Link
                              href={`/${guildId}${MODULE_HREF[key] ?? ""}`}
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#fff",
                                background: COLOR.accent,
                                borderRadius: 6,
                                padding: "4px 10px",
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                              }}
                            >
                              Napraw
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SlideIn>

            {/* Ten miesiąc */}
            <SlideIn direction="up" delay={400}>
              <div style={cardStyle}>
                <div style={{ ...sectionLabelStyle, marginBottom: 10 }}>Ten miesiąc</div>
                <div className="flex flex-col" style={{ gap: 8, marginBottom: mvp ? 12 : 0 }}>
                  {[
                    ["Wiadomości", monthMessages.toLocaleString("pl-PL")],
                    ["Na głosowych", formatVoiceTime(monthVoice)],
                    ["Aktywnych osób", String(monthActiveUsers)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span style={{ fontSize: 12, color: COLOR.secondary }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", fontVariantNumeric: "tabular-nums" }}>{value}</span>
                    </div>
                  ))}
                </div>

                {mvp && (
                  <Link
                    href={`/${guildId}/monthly-stats`}
                    className="flex items-center"
                    style={{ gap: 10, padding: "8px 10px", borderRadius: 8, background: COLOR.inner }}
                  >
                    {mvp.avatar ? (
                      <Image src={avatarUrlFor(mvp.userId, mvp.avatar)} alt="" width={28} height={28} className="rounded-full" />
                    ) : (
                      <div
                        className="flex items-center justify-center rounded-full"
                        style={{ width: 28, height: 28, background: "rgba(99,102,241,0.15)" }}
                      >
                        <User className="w-3.5 h-3.5" style={{ color: COLOR.accentHover }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 10, color: COLOR.label }}>MVP miesiąca</p>
                      <p className="truncate" style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                        {mvp.username ?? `Użytkownik ${mvp.userId.slice(-4)}`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4" style={{ color: COLOR.label }} />
                  </Link>
                )}
              </div>
            </SlideIn>
          </div>
        </div>
      </div>
  );
}

