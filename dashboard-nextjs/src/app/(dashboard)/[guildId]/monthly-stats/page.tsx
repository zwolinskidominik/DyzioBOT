"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CustomSlider } from "@/components/ui/custom-slider";
import { Hash, BarChart3, EyeOff, Check, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useDirtyState } from "@/components/DirtyStateProvider";
import {
  RawMonth,
  MONTH_NAMES_NOMINATIVE,
  monthPublishLabel,
  monthPublishShortDate,
  scoreUsers,
  estimateCardHeight,
  avatarUrlFor,
  nf,
  formatHM,
  msgRateLabel,
} from "@/lib/monthlyStats";

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface GuildMember {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

interface MonthlyStatsConfig {
  guildId: string;
  channelId?: string;
  enabled: boolean;
  topCount: number;
  msgRate: number;
  voiceRate: number;
}

interface PreviewEntry {
  userId: string;
  username: string;
  avatarURL: string;
  messageCount: number;
  voiceMinutes: number;
  score: number;
}

type MetricId = "score" | "messages" | "voice" | "active";

const METRICS: { id: MetricId; label: string; head: string }[] = [
  { id: "score", label: "Punkty", head: "Punkty aktywności w miesiącu" },
  { id: "messages", label: "Wiadomości", head: "Wiadomości w miesiącu" },
  { id: "voice", label: "Voice chat", head: "Czas na voice chacie" },
  { id: "active", label: "Aktywni", head: "Aktywne osoby" },
];

interface SavedConfigState {
  channelId: string;
  enabled: boolean;
  topCount: number;
  msgRate: number;
  voiceRate: number;
}

export default function MonthlyStatsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { registerDirtyController } = useDirtyState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channelError, setChannelError] = useState(false);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [rawMonths, setRawMonths] = useState<RawMonth[]>([]);
  const [guildName, setGuildName] = useState("Serwer");
  const [guildIconURL, setGuildIconURL] = useState<string | null>(null);

  const [config, setConfig] = useState<MonthlyStatsConfig>({
    guildId,
    channelId: undefined,
    enabled: false,
    topCount: 10,
    msgRate: 1,
    voiceRate: 2,
  });
  const [metric, setMetric] = useState<MetricId>("score");
  const [selectedMonthId, setSelectedMonthId] = useState<string>("");

  const savedRef = useRef<SavedConfigState>({
    channelId: "",
    enabled: false,
    topCount: 10,
    msgRate: 1,
    voiceRate: 2,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [channelsData, configRes, rawRes, membersData] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, "channels", `/api/discord/guild/${guildId}/channels`),
          fetchWithAuth(`/api/guild/${guildId}/monthly-stats/config`),
          fetchWithAuth(`/api/guild/${guildId}/monthly-stats/raw`),
          fetchGuildData<GuildMember[]>(guildId, "members", `/api/discord/guild/${guildId}/members`),
        ]);

        const textChannels = channelsData.filter((ch: Channel) => ch.type === 0 || ch.type === 5);
        setChannels(textChannels);
        setMembers(membersData);

        if (configRes.ok) {
          const configData: MonthlyStatsConfig = await configRes.json();
          setConfig(configData);
          savedRef.current = {
            channelId: configData.channelId || "",
            enabled: configData.enabled,
            topCount: configData.topCount,
            msgRate: configData.msgRate,
            voiceRate: configData.voiceRate,
          };
        }

        if (rawRes.ok) {
          const rawData: { months: RawMonth[]; guildName: string; guildIconURL: string | null } = await rawRes.json();
          setRawMonths(rawData.months);
          setGuildName(rawData.guildName);
          setGuildIconURL(rawData.guildIconURL);
          const current = rawData.months.find((m) => m.isCurrent) ?? rawData.months[rawData.months.length - 1];
          if (current) setSelectedMonthId(current.id);
        }
      } catch (err) {
        console.error("Error loading monthly stats data:", err);
        setError("Nie udało się załadować danych statystyk miesięcznych. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [guildId]);

  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const decorate = useCallback(
    (entry: { userId: string; messageCount: number; voiceMinutes: number; score: number }): PreviewEntry => {
      const member = membersById.get(entry.userId);
      return {
        userId: entry.userId,
        username: member ? (member.discriminator === "0" ? member.username : `${member.username}#${member.discriminator}`) : "Nieznany użytkownik",
        avatarURL: avatarUrlFor(entry.userId, member?.avatar ?? null),
        messageCount: entry.messageCount,
        voiceMinutes: entry.voiceMinutes,
        score: entry.score,
      };
    },
    [membersById]
  );

  const monthsComputed = useMemo(
    () =>
      rawMonths.map((m) => {
        const ranked = scoreUsers(m.users, config.msgRate, config.voiceRate);
        const totalMessages = m.users.reduce((s, u) => s + u.messageCount, 0);
        const totalVoiceMinutes = m.users.reduce((s, u) => s + u.voiceMinutes, 0);
        const totalScore = ranked.reduce((s, r) => s + r.score, 0);
        return { ...m, ranked, totalMessages, totalVoiceMinutes, activeUsers: m.users.length, totalScore };
      }),
    [rawMonths, config.msgRate, config.voiceRate]
  );

  const metricValue = useCallback(
    (m: (typeof monthsComputed)[number]) => {
      switch (metric) {
        case "messages":
          return m.totalMessages;
        case "voice":
          return m.totalVoiceMinutes;
        case "active":
          return m.activeUsers;
        default:
          return m.totalScore;
      }
    },
    [metric]
  );

  const metricFormat = useCallback((m: (typeof monthsComputed)[number]) => (metric === "voice" ? formatHM(metricValue(m)) : nf(metricValue(m))), [metric, metricValue]);

  const maxVal = Math.max(1, ...monthsComputed.map(metricValue));

  const selectedIndex = monthsComputed.findIndex((m) => m.id === selectedMonthId);
  const selected = selectedIndex >= 0 ? monthsComputed[selectedIndex] : monthsComputed[monthsComputed.length - 1];
  const prevMonth = selectedIndex > 0 ? monthsComputed[selectedIndex - 1] : undefined;

  const diff = prevMonth && selected ? metricValue(selected) - metricValue(prevMonth) : 0;
  const pctDiff = prevMonth && selected && metricValue(prevMonth) ? Math.round((diff / metricValue(prevMonth)) * 100) : 0;
  const prevMonthName = prevMonth ? MONTH_NAMES_NOMINATIVE[prevMonth.id.split("-")[1]]?.toLowerCase() : "";
  const trendLabel = !prevMonth ? "brak porównania" : `${diff >= 0 ? "↑" : "↓"} ${Math.abs(pctDiff)}% vs ${prevMonthName}`;
  const trendBg = !prevMonth ? "#23252f" : diff >= 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
  const trendFg = !prevMonth ? "#8d94a8" : diff >= 0 ? "#86efac" : "#fca5a5";

  const topN = selected ? Math.min(config.topCount, selected.ranked.length) : 0;
  const shown = selected ? selected.ranked.slice(0, topN) : [];
  const podium = shown.slice(0, 3).map(decorate);
  const rest = shown.slice(3).map((e, i) => ({ ...decorate(e), rank: i + 4 }));

  const estH = estimateCardHeight(shown.length);
  const tight = config.topCount > 12;
  const shotW = 700;
  const shotScale = shotW / 900;
  const shotH = Math.ceil(estH * shotScale);

  const isDirty =
    config.enabled !== savedRef.current.enabled ||
    (config.channelId || "") !== savedRef.current.channelId ||
    config.topCount !== savedRef.current.topCount ||
    config.msgRate !== savedRef.current.msgRate ||
    config.voiceRate !== savedRef.current.voiceRate;

  const handleSave = useCallback(async () => {
    if (!config.channelId) {
      setChannelError(true);
      toast.error("Wybierz kanał publikacji");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/guild/${guildId}/monthly-stats/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: config.channelId,
          enabled: config.enabled,
          topCount: config.topCount,
          msgRate: config.msgRate,
          voiceRate: config.voiceRate,
        }),
      });

      if (!response.ok) throw new Error("Failed to save configuration");

      const saved: MonthlyStatsConfig = await response.json();
      setConfig((prev) => ({ ...prev, ...saved }));
      savedRef.current = {
        channelId: saved.channelId || "",
        enabled: saved.enabled,
        topCount: saved.topCount,
        msgRate: saved.msgRate,
        voiceRate: saved.voiceRate,
      };
      toast.success("Konfiguracja statystyk została zapisana!");
    } catch (err) {
      console.error("Error saving config:", err);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  }, [config, guildId]);

  const handleCancel = useCallback(() => {
    const s = savedRef.current;
    setConfig((prev) => ({ ...prev, channelId: s.channelId || undefined, enabled: s.enabled, topCount: s.topCount, msgRate: s.msgRate, voiceRate: s.voiceRate }));
    setChannelError(false);
  }, []);

  useEffect(
    () =>
      registerDirtyController({
        id: `monthly-stats-${guildId}`,
        isDirty,
        isSaving: saving,
        label: "Statystyki miesięczne",
        onSave: handleSave,
        onCancel: handleCancel,
      }),
    [guildId, isDirty, saving, handleSave, handleCancel, registerDirtyController]
  );

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  const selectedChannel = channels.find((c) => c.id === config.channelId);
  const publishChannelLabel = selectedChannel ? `# ${selectedChannel.name}` : "brak kanału";
  const now = new Date();
  const currentMonthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if (error) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <ErrorState title="Nie udało się załadować statystyk miesięcznych" message={error} onRetry={handleRetry} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="w-full space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-4">
            <div className="space-y-4">
              <Skeleton className="h-96 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="w-full space-y-4">
        <SlideIn direction="up">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white/90 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-bot-primary" />
                Statystyki miesięczne
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Bot generuje grafikę z topką aktywności i publikuje ją pierwszego dnia każdego miesiąca.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-white/80">
              <span>{config.enabled ? "Aktywne" : "Nieaktywne"}</span>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: checked }))}
                className="data-[state=checked]:bg-bot-primary"
              />
            </div>
          </div>
        </SlideIn>

        {!config.enabled && (
          <SlideIn direction="up">
            <div
              className="flex items-start gap-2 rounded-md px-3 py-2 text-xs"
              style={{ border: "1px solid #3a3f4e", background: "#17181E", color: "#9aa2b8" }}
            >
              <EyeOff className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Statystyki miesięczne są <span className="font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>wyłączone</span>. Możesz
                zapisać ustawienia, ale bot nie opublikuje grafiki, dopóki nie włączysz przełącznika{" "}
                <span className="font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>Aktywne</span> u góry.
              </span>
            </div>
          </SlideIn>
        )}

        {/* Wykres */}
        <SlideIn direction="up" delay={50}>
          <div className="rounded-lg p-5" style={{ background: "#1F2129", boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
            <div className="flex items-end justify-between gap-5 mb-4">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.08em", color: "#6b7280" }}>
                  {METRICS.find((m) => m.id === metric)?.head}
                </div>
                <div className="mt-2 flex items-baseline gap-2.5">
                  <span className="text-[30px] font-extrabold text-white leading-none">{selected ? metricFormat(selected) : "—"}</span>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: trendBg, color: trendFg }}>
                    {trendLabel}
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
                {METRICS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMetric(m.id)}
                    className="rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors"
                    style={{
                      border: `1px solid ${m.id === metric ? "#6366f1" : "#2f3341"}`,
                      background: m.id === metric ? "rgba(99,102,241,0.15)" : "#17181E",
                      color: m.id === metric ? "#fff" : "#b9c0d0",
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end gap-2.5" style={{ height: 130 }}>
              {monthsComputed.map((m) => {
                const isSel = m.id === selectedMonthId;
                const h = Math.max(12, Math.round((metricValue(m) / maxVal) * 100));
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMonthId(m.id)}
                    title={`Pokaż grafikę: ${m.full}`}
                    className="flex-1 min-w-0 flex flex-col items-center gap-1.5 bg-transparent border-none cursor-pointer p-0"
                  >
                    <span className="text-[10px] font-bold" style={{ color: isSel ? "#c7d2fe" : "#4b5563" }}>
                      {metricFormat(m)}
                    </span>
                    <span
                      className="w-full rounded-t transition-all"
                      style={{
                        height: h,
                        background: isSel ? "linear-gradient(180deg,#818cf8,#6366f1)" : "#2f3341",
                      }}
                    />
                    <span className="text-[10px]" style={{ fontWeight: isSel ? 700 : 500, color: isSel ? "#a5b4fc" : "#6b7280" }}>
                      {m.abbr}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px]" style={{ color: "#6b7280" }}>
              Kliknij miesiąc, aby wygenerować jego grafikę w podglądzie obok.
            </p>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-4 items-start">
          {/* Lewa kolumna */}
          <div className="flex flex-col gap-4 min-w-0">
            <SlideIn direction="up" delay={100}>
              <div className="rounded-lg p-5" style={{ background: "#1F2129", boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
                <p className="text-[13px] font-bold text-[#d8dbe6] mb-3.5">Konfiguracja</p>

                <div className="space-y-2">
                  <Label>
                    Kanał publikacji <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={config.channelId || ""}
                    onValueChange={(value) => {
                      setConfig((prev) => ({ ...prev, channelId: value || undefined }));
                      setChannelError(false);
                    }}
                  >
                    <SelectTrigger style={channelError ? { borderColor: "rgba(239,68,68,0.6)" } : undefined}>
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
                  {channelError && <p className="text-xs text-destructive">Wybierz kanał publikacji</p>}
                </div>

                <div className="mt-[18px] flex items-baseline justify-between gap-3">
                  <Label className="text-[#c4cad8]">Osób na grafice</Label>
                  <span className="text-[15px] font-extrabold" style={{ color: "#b8c8ff" }}>
                    {config.topCount}
                  </span>
                </div>
                <div className="mt-2">
                  <CustomSlider
                    value={config.topCount}
                    onChange={(v) => setConfig((prev) => ({ ...prev, topCount: v }))}
                    min={3}
                    max={15}
                    step={1}
                    ariaLabel="Osób na grafice"
                  />
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-md px-2.5 py-2 text-[11px] leading-relaxed" style={{ background: tight ? "rgba(245,158,11,0.1)" : "#17181E", color: tight ? "#fcd34d" : "#8d94a8" }}>
                  {tight ? <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                  <span>
                    {tight
                      ? `Przy ${config.topCount} osobach grafika staje się bardzo wysoka (${estH} px) — na telefonie tabela będzie drobna.`
                      : `Podium pokazuje top 3, pozostałe ${Math.max(0, config.topCount - 3)} osób trafia do tabeli. Wysokość grafiki: ${estH} px.`}
                  </span>
                </div>

                <p className="mt-[18px] mb-2 text-[12px] font-semibold text-[#c4cad8]">Punktacja wyniku</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5" style={{ background: "#17181E" }}>
                    <Label className="flex-1 text-[12px] text-[#d8dbe6]">{msgRateLabel(config.msgRate)}</Label>
                    <span className="text-[13px] font-extrabold" style={{ color: "#b8c8ff" }}>
                      1 pkt
                    </span>
                  </div>
                  <CustomSlider value={config.msgRate} onChange={(v) => setConfig((prev) => ({ ...prev, msgRate: v }))} min={1} max={5} step={1} ariaLabel="Wiadomości za punkt" />

                  <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5" style={{ background: "#17181E" }}>
                    <Label className="flex-1 text-[12px] text-[#d8dbe6]">{config.voiceRate} min na voice chat</Label>
                    <span className="text-[13px] font-extrabold" style={{ color: "#b8c8ff" }}>
                      1 pkt
                    </span>
                  </div>
                  <CustomSlider value={config.voiceRate} onChange={(v) => setConfig((prev) => ({ ...prev, voiceRate: v }))} min={1} max={5} step={1} ariaLabel="Minut na voice chat za punkt" />
                  <p className="text-[11px] leading-relaxed" style={{ color: "#6b7280" }}>
                    Im mniejsza wartość, tym mocniej liczy się czas na kanałach głosowych. Wpływa na kolejność i MVP.
                  </p>
                </div>
              </div>
            </SlideIn>

            <SlideIn direction="up" delay={150}>
              <div className="rounded-lg p-4" style={{ background: "#17181E", boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
                <div className="text-[11px] font-bold uppercase" style={{ letterSpacing: "0.06em", color: "#6b7280" }}>
                  Najbliższa publikacja
                </div>
                <div className="mt-2 text-sm font-bold text-white">{monthPublishLabel(currentMonthId)}, 00:00</div>
                <div className="mt-1 text-xs" style={{ color: "#8d94a8" }}>
                  {publishChannelLabel} · grafika 900 × {estH} px
                </div>
              </div>
            </SlideIn>
          </div>

          {/* Podgląd na żywo */}
          <SlideIn direction="up" delay={200}>
            <div className="rounded-lg p-4 pb-5" style={{ background: "#17181E", boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
              <div className="flex items-center gap-2.5 mb-3.5">
                <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase" style={{ letterSpacing: "0.08em", color: "#6b7280" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
                  Podgląd na żywo
                </span>
                <span className="flex-1" />
                {selected && (
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                    style={
                      selected.isCurrent
                        ? { background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }
                        : { background: "rgba(255,255,255,0.06)", color: "#9aa2b8" }
                    }
                  >
                    {selected.isCurrent ? "w trakcie" : "zakończony"}
                  </span>
                )}
              </div>

              {!selected || shown.length === 0 ? (
                <div className="py-14 text-center text-sm text-muted-foreground">
                  Brak statystyk za ten miesiąc — nie ma jeszcze czego pokazać na grafice.
                </div>
              ) : (
                <div className="flex gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "#5865F2" }}>
                    D
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white">
                      Deezy{" "}
                      <span className="rounded px-1 py-px text-[8px] font-bold text-white" style={{ background: "#5865F2" }}>
                        BOT
                      </span>{" "}
                      <span className="text-[10px]" style={{ color: "#6b7280" }}>
                        {monthPublishShortDate(selected.id)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs" style={{ color: "#d8dbe6" }}>
                      📊 Podsumowanie miesiąca — <span className="font-semibold">{selected.full}</span>
                    </div>

                    <div className="mt-2 relative overflow-hidden rounded-xl" style={{ width: shotW, height: shotH }}>
                      <div style={{ position: "absolute", top: 0, left: 0, width: 900, transform: `scale(${shotScale})`, transformOrigin: "top left" }}>
                        <PreviewCard
                          guildName={guildName}
                          guildIconURL={guildIconURL}
                          monthFull={selected.full}
                          totalMessages={selected.totalMessages}
                          totalVoiceMinutes={selected.totalVoiceMinutes}
                          activeUsers={selected.activeUsers}
                          podium={podium}
                          rest={rest}
                          msgRate={config.msgRate}
                          voiceRate={config.voiceRate}
                          monthFooterLabel={selected.footerLabel}
                        />
                      </div>
                    </div>

                    <div className="mt-2 text-[11px]" style={{ color: "#6b7280" }}>
                      {shown.length < config.topCount
                        ? `Ustawiono ${config.topCount} osób, ale w tym miesiącu aktywnych było tylko ${shown.length}.`
                        : `Grafika 900 × ${estH} px — Discord wyświetli ją w pełnej szerokości wiadomości.`}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </SlideIn>
        </div>
      </div>
    </div>
  );
}

/* ── Podgląd karty 1:1 z generowaną grafiką (canvasMonthlyTopkaCardV3 / monthlyStatsRenderer) ── */

interface PreviewCardProps {
  guildName: string;
  guildIconURL: string | null;
  monthFull: string;
  totalMessages: number;
  totalVoiceMinutes: number;
  activeUsers: number;
  podium: PreviewEntry[];
  rest: (PreviewEntry & { rank: number })[];
  msgRate: number;
  voiceRate: number;
  monthFooterLabel: string;
}

// Self-hosted (public/twemoji/svg/, via `npm run emoji:assets`) zamiast jsDelivr —
// CSP img-src nie zezwala na zewnętrzne CDN, patrz next.config.ts.
const MEDAL_URL: Record<number, string> = {
  1: "/twemoji/svg/1f947.svg",
  2: "/twemoji/svg/1f948.svg",
  3: "/twemoji/svg/1f949.svg",
};

function PreviewCard({ guildName, guildIconURL, monthFull, totalMessages, totalVoiceMinutes, activeUsers, podium, rest, msgRate, voiceRate, monthFooterLabel }: PreviewCardProps) {
  const [year] = monthFull.split(" ").slice(-1);
  return (
    <div style={{ width: 900, boxSizing: "border-box", borderRadius: 20, background: "#12141c", border: "1px solid #232838", padding: "34px 36px 28px", display: "flex", flexDirection: "column", gap: 24, fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, paddingBottom: 20, borderBottom: "1px solid #232838" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", overflow: "hidden", border: "2px solid #232838", flex: "none", background: "#3b4256", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 22 }}>
          {guildIconURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={guildIconURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            guildName.charAt(0).toUpperCase()
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: "#6b7a99", textTransform: "uppercase" }}>{guildName}</div>
          <h2 style={{ margin: "4px 0 0", fontSize: 34, fontWeight: 900, letterSpacing: "-0.02em", color: "#fff", lineHeight: 1 }}>{monthFull}</h2>
        </div>
        <div style={{ display: "flex", gap: 26, flex: "none", alignSelf: "flex-start", marginTop: 35, textAlign: "right" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{nf(totalMessages)}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: "#6b7a99" }}>wiadomości</div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{nf(Math.floor(totalVoiceMinutes / 60))} h</div>
            <div style={{ marginTop: 4, fontSize: 11, color: "#6b7a99" }}>voice chat</div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{nf(activeUsers)}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: "#6b7a99" }}>aktywne osoby</div>
          </div>
        </div>
      </div>

      {podium.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr 1fr", gap: 14, alignItems: "end" }}>
          {podium[1] ? <PodiumCard entry={podium[1]} rank={2} totalVoiceMinutes={totalVoiceMinutes} /> : <div />}
          {podium[0] ? <PodiumCard entry={podium[0]} rank={1} totalVoiceMinutes={totalVoiceMinutes} /> : <div />}
          {podium[2] ? <PodiumCard entry={podium[2]} rank={3} totalVoiceMinutes={totalVoiceMinutes} /> : <div />}
        </div>
      )}

      {rest.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "grid", gridTemplateColumns: "34px 1fr 104px 104px 96px", gap: 12, padding: "0 14px 8px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#5f6b85", textTransform: "uppercase", borderBottom: "1px solid #232838" }}>
            <span>#</span>
            <span>Osoba</span>
            <span style={{ textAlign: "right" }}>Wiadomości</span>
            <span style={{ textAlign: "right" }}>Voice chat</span>
            <span style={{ textAlign: "right" }}>Wynik</span>
          </div>
          {rest.map((r) => (
            <div key={r.userId} style={{ display: "grid", gridTemplateColumns: "34px 1fr 104px 104px 96px", gap: 12, alignItems: "center", borderRadius: 10, background: "#171a24", padding: "11px 14px" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#6b7a99" }}>{r.rank}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.avatarURL} alt="" style={{ width: 26, height: 26, borderRadius: "50%", flex: "none", objectFit: "cover" }} />
                <span style={{ minWidth: 0, fontSize: 14, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.username}</span>
              </span>
              <span style={{ textAlign: "right", whiteSpace: "nowrap", fontSize: 13, fontWeight: 600, color: "#9aa7bd" }}>{nf(r.messageCount)}</span>
              <span style={{ textAlign: "right", whiteSpace: "nowrap", fontSize: 13, fontWeight: 600, color: "#9aa7bd" }}>{formatHM(r.voiceMinutes)}</span>
              <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{nf(r.score)}</span>
                <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 600, color: "#5f6b85" }}>pkt</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, paddingTop: 14, borderTop: "1px solid #232838", fontSize: 11, color: "#5f6b85" }}>
        <span>
          Wynik = aktywność na czacie (1 pkt / {msgRateLabel(msgRate)}) + aktywność głosowa (1 pkt / {voiceRate} min)
        </span>
        <span>Raport miesięczny · {monthFooterLabel}</span>
      </div>
    </div>
  );
}

const TIER_STYLE: Record<number, { gradient: string; border: string; scoreColor: string; medalBg: string }> = {
  1: { gradient: "linear-gradient(180deg, rgba(250,204,21,0.16), #171a24 62%)", border: "1px solid rgba(250,204,21,0.4)", scoreColor: "#facc15", medalBg: "#facc15" },
  2: { gradient: "linear-gradient(180deg, rgba(203,213,225,0.1), #171a24 60%)", border: "1px solid rgba(203,213,225,0.24)", scoreColor: "#cbd5e1", medalBg: "#cbd5e1" },
  3: { gradient: "linear-gradient(180deg, rgba(217,119,6,0.12), #171a24 60%)", border: "1px solid rgba(217,119,6,0.3)", scoreColor: "#e79c2a", medalBg: "#d97706" },
};

function PodiumCard({ entry, rank, totalVoiceMinutes }: { entry: PreviewEntry; rank: 1 | 2 | 3; totalVoiceMinutes: number }) {
  const isMvp = rank === 1;
  const tier = TIER_STYLE[rank];
  const share = totalVoiceMinutes > 0 ? Math.round((entry.voiceMinutes / totalVoiceMinutes) * 100) : 0;

  return (
    <div style={{ borderRadius: 16, background: tier.gradient, border: tier.border, padding: isMvp ? "24px 18px" : "20px 16px", textAlign: "center" }}>
      {isMvp && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: "#facc15", textTransform: "uppercase" }}>MVP miesiąca</div>
          <div style={{ marginTop: 3, fontSize: 11, color: "#a3986a" }}>Najwyższy wynik aktywności</div>
        </>
      )}
      <div style={{ width: isMvp ? 64 : 52, height: isMvp ? 64 : 52, margin: isMvp ? "14px auto 0" : "0 auto", borderRadius: "50%", overflow: "hidden", border: `2px solid ${tier.medalBg}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={entry.avatarURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ marginTop: isMvp ? 12 : 10, display: "flex", alignItems: "center", justifyContent: "center", gap: isMvp ? 8 : 7 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MEDAL_URL[rank]} alt="" style={{ width: isMvp ? 26 : 20, height: isMvp ? 26 : 20 }} />
        <span style={{ fontSize: isMvp ? 30 : 22, fontWeight: 900, color: tier.scoreColor, lineHeight: 1 }}>{nf(entry.score)}</span>
        <span style={{ fontSize: isMvp ? 13 : 12, fontWeight: 700, color: isMvp ? "#d0b64a" : rank === 2 ? "#8b98b0" : "#8a6a3a" }}>pkt</span>
      </div>
      <div style={{ marginTop: 8, fontSize: isMvp ? 18 : 15, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.username}</div>
      <div style={{ marginTop: isMvp ? 10 : 8, display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: isMvp ? "#cbd5e1" : "#9aa7bd" }}>
        <span>{nf(entry.messageCount)} wiadomości</span>
        <span>{formatHM(entry.voiceMinutes)} na VC</span>
        {isMvp && <span style={{ color: "#facc15", fontWeight: 700 }}>{share}% ruchu serwera</span>}
      </div>
    </div>
  );
}
