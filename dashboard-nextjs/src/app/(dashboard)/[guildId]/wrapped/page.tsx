"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { OWNER_IDS, OWNER_GUILD_IDS } from "@/lib/owner";
import { Settings, ChevronDown, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { plural } from "@/lib/plural";
import {
  WRAPPED_THEMES,
  WRAPPED_THEME_LABELS,
  THEME_PALETTES,
  DEFAULT_WRAPPED_THEME,
  type WrappedTheme,
} from "@/lib/wrappedThemes";

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface WrappedConfig {
  guildId: string;
  channelId?: string;
  enabled: boolean;
  colorTheme: WrappedTheme;
}

interface TopUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  value: number;
}

interface WrappedPreviewData {
  serverName: string;
  serverIconUrl: string | null;
  memberCount: number;
  ageYears: number;
  totalMessages: number;
  totalVoiceHours: number;
  totalGiveaways: number;
  totalWordleGames: number;
  totalInvites: number;
  topMessages: TopUser[];
  topVoice: TopUser[];
  topLevel: TopUser[];
}

/** Domyślny awatar Discorda (publiczne CDN, bez autoryzacji) — do fejkowych wierszy podglądu. */
function fakeAvatar(index: number): string {
  return `https://cdn.discordapp.com/embed/avatars/${index % 6}.png`;
}

// Podgląd na dashboardzie jest CELOWO fejkowy — prawdziwe dane (kto jest #1, ile
// wiadomości itd.) mają zostać niespodzianką aż do realnej wysyłki 11 listopada.
// Gdyby podgląd pokazywał aktualne statystyki, każdy admin mógłby zrobić
// zrzut ekranu i zepsuć efekt zaskoczenia dla całego serwera. Dane produkcyjne
// (prawdziwy Wrapped wysyłany przez bota) nadal liczą się z realnej bazy —
// to dotyczy wyłącznie tego podglądu w panelu.
const FAKE_PREVIEW: WrappedPreviewData = {
  serverName: "Twój serwer",
  serverIconUrl: null,
  memberCount: 342,
  ageYears: 2,
  totalMessages: 128450,
  totalVoiceHours: 3210,
  totalGiveaways: 24,
  totalWordleGames: 156,
  totalInvites: 89,
  topMessages: [
    { userId: "fake-1", displayName: "Krimi_ung", avatarUrl: fakeAvatar(0), value: 15230 },
    { userId: "fake-2", displayName: "santiago9928", avatarUrl: fakeAvatar(1), value: 12890 },
    { userId: "fake-3", displayName: "wiktoria_44", avatarUrl: fakeAvatar(2), value: 9540 },
  ],
  topVoice: [
    { userId: "fake-4", displayName: "verona07491", avatarUrl: fakeAvatar(3), value: 5400 },
    { userId: "fake-5", displayName: "deszcz_xd", avatarUrl: fakeAvatar(4), value: 4820 },
    { userId: "fake-6", displayName: "natix08328", avatarUrl: fakeAvatar(5), value: 3100 },
  ],
  topLevel: [
    { userId: "fake-7", displayName: "malpinho", avatarUrl: fakeAvatar(0), value: 42 },
    { userId: "fake-8", displayName: "dominik0912", avatarUrl: fakeAvatar(2), value: 38 },
    { userId: "fake-9", displayName: "gamezone_pl", avatarUrl: fakeAvatar(4), value: 35 },
  ],
};

const SERVER_FOUNDED_YEAR = 2022;
const DAY_NAME = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
const DOT_GRADIENTS = [
  "linear-gradient(135deg,#6366f1,#a855f7)",
  "linear-gradient(135deg,#0ea5e9,#22c55e)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
];
const RANK_FG = ["#fcd34d", "#cbd5e1", "#e79c2a"];

/** Najbliższa data 11 listopada 12:00 (lokalny czas przeglądarki). */
function nextWrappedDate(): Date {
  const now = new Date();
  let year = now.getFullYear();
  let target = new Date(year, 10, 11, 12, 0, 0);
  if (target.getTime() <= now.getTime()) {
    year += 1;
    target = new Date(year, 10, 11, 12, 0, 0);
  }
  return target;
}

function formatNumberDotSep(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Polska odmiana liczebnikowa: 1 forma / 2-4 forma / 5+ forma (z wyjątkiem 12-14). */
const STAT_DEFS: { icon: string; forms: [string, string, string] }[] = [
  { icon: "👥", forms: ["członek", "członków", "członków"] },
  { icon: "✉", forms: ["wiadomość", "wiadomości", "wiadomości"] },
  { icon: "🎙", forms: ["godzina na VC", "godziny na VC", "godzin na VC"] },
  { icon: "🎉", forms: ["giveaway", "giveawaye", "giveawayów"] },
  { icon: "🔤", forms: ["gra w Wordle", "gry w Wordle", "gier w Wordle"] },
  { icon: "📨", forms: ["dołączenie", "dołączenia", "dołączeń"] },
];

// Miniatura podglądu: bazowy układ 400×620 (trochę więcej niż realne 400×600, żeby stopka
// "Wygenerowano..." miała margines i nigdy nie ucinała się po przeskalowaniu) wyświetlany w skali 1.125x.
const PREVIEW_SCALE = 1.125;
const PREVIEW_BASE_W = 400;
const PREVIEW_BASE_H = 600;
const PREVIEW_W = Math.round(PREVIEW_BASE_W * PREVIEW_SCALE);
const PREVIEW_H = Math.round(PREVIEW_BASE_H * PREVIEW_SCALE);

const CONTENT_TILES = [
  { icon: "👥", label: "Liczba członków" },
  { icon: "💬", label: "Liczba wiadomości" },
  { icon: "🎙", label: "Liczba godzin na VC" },
  { icon: "🎉", label: "Liczba giveawayów" },
  { icon: "🔤", label: "Liczba rozegranych gier Wordle" },
  { icon: "⭐", label: "Zdobyte poziomy" },
];

export default function WrappedPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { data: session, status } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channelError, setChannelError] = useState(false);
  const [configOpen, setConfigOpen] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const preview = FAKE_PREVIEW;

  const [config, setConfig] = useState<WrappedConfig>({
    guildId,
    channelId: undefined,
    enabled: false,
    colorTheme: DEFAULT_WRAPPED_THEME,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [channelsData, configRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, "channels", `/api/discord/guild/${guildId}/channels`),
          fetchWithAuth(`/api/guild/${guildId}/wrapped/config`),
        ]);

        if (channelsData) {
          setChannels(channelsData.filter((ch) => ch.type === 0 || ch.type === 5));
        }

        if (configRes.ok) {
          const data = await configRes.json();
          setConfig({
            guildId,
            channelId: data.channelId || undefined,
            enabled: data.enabled ?? false,
            colorTheme: (WRAPPED_THEMES as readonly string[]).includes(data.colorTheme)
              ? data.colorTheme
              : DEFAULT_WRAPPED_THEME,
          });
        }
      } catch (fetchError) {
        console.error("Error loading wrapped config:", fetchError);
        setError("Nie udało się załadować konfiguracji Server Wrapped. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    };

    if (guildId) void fetchData();
  }, [guildId]);

  const handleSave = async () => {
    if (!config.channelId) {
      setChannelError(true);
      toast.error("Wybierz kanał docelowy");
      return;
    }
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/wrapped/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error("Failed to save configuration");
      const saved = await response.json();
      setConfig({
        guildId,
        channelId: saved.channelId || undefined,
        enabled: saved.enabled ?? config.enabled,
        colorTheme: saved.colorTheme ?? config.colorTheme,
      });
      toast.success("Konfiguracja Wrapped została zapisana!");
    } catch (saveError) {
      console.error("Error saving config:", saveError);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  const getChannelName = (channelId: string) => channels.find((c) => c.id === channelId)?.name;

  const nextDate = useMemo(() => nextWrappedDate(), []);
  const daysLeft = useMemo(() => Math.ceil((nextDate.getTime() - Date.now()) / 86_400_000), [nextDate]);
  const serverAge = nextDate.getFullYear() - SERVER_FOUNDED_YEAR;
  const nextDateLabel = `${DAY_NAME[nextDate.getDay()]}, 11 listopada ${nextDate.getFullYear()} • 12:00`;
  const serverAgeLabel = `${serverAge}${serverAge === 1 ? " rok" : serverAge < 5 ? " lata" : " lat"}`;
  const countdownLabel = `${daysLeft}${daysLeft === 1 ? " dzień" : " dni"}`;
  const channelName = config.channelId ? getChannelName(config.channelId) : undefined;
  const channelLabel = channelName ? `# ${channelName}` : "brak kanału";

  const palette = THEME_PALETTES[config.colorTheme];
  const now = new Date();
  const generatedAt = `${now.getDate()}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;

  const previewStats = STAT_DEFS.map((def, i) => {
    const values = [preview.memberCount, preview.totalMessages, preview.totalVoiceHours, preview.totalGiveaways, preview.totalWordleGames, preview.totalInvites];
    const value = values[i];
    return {
      icon: def.icon,
      value: formatNumberDotSep(value),
      label: plural(value, def.forms),
    };
  });

  const previewSections: { title: string; rows: { name: string; value: string; avatarUrl: string | null }[] }[] = [
    {
      title: "💬 Top wiadomości",
      rows: preview.topMessages.map((u) => ({ name: u.displayName, value: `${formatNumberDotSep(u.value)} wiad.`, avatarUrl: u.avatarUrl })),
    },
    {
      title: "🎙 Top głosowe",
      rows: preview.topVoice.map((u) => ({
        name: u.displayName,
        value: `${Math.floor(u.value / 60)}h ${Math.round(u.value % 60)}m`,
        avatarUrl: u.avatarUrl,
      })),
    },
    {
      title: "⭐ Top poziom",
      rows: preview.topLevel.map((u) => ({ name: u.displayName, value: `${u.value} lvl`, avatarUrl: u.avatarUrl })),
    },
  ];

  if (status !== "loading" && (!OWNER_IDS.includes(currentUserId ?? "") || !OWNER_GUILD_IDS.includes(guildId))) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-4xl">🔒</p>
        <h2 className="text-xl font-semibold">Brak dostępu</h2>
        <p className="text-sm text-muted-foreground">Ten moduł jest dostępny wyłącznie dla właściciela bota na jego serwerach.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <ErrorState title="Nie udało się załadować konfiguracji Server Wrapped" message={error} onRetry={handleRetry} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="w-full space-y-4">
          <div className="flex items-start justify-between gap-6 pb-2">
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-[420px] max-w-full" />
            </div>
          </div>
          <Skeleton className="h-24 w-full rounded-md bg-dark-800" />
          <div style={{ display: "grid", gridTemplateColumns: "500px minmax(0,1fr)", gap: 16 }}>
            <Skeleton className="h-[500px] w-full rounded-md bg-dark-800" />
            <Skeleton className="h-[500px] w-full rounded-md bg-dark-800" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-16">
      <div className="flex w-full flex-col gap-4">
        <SlideIn direction="up" delay={100}>
          <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#fff" }}>Server Wrapped</h1>
              <p style={{ margin: "8px 0 0", maxWidth: 640, fontSize: 14, lineHeight: 1.6, color: "#969db0" }}>
                Roczne podsumowanie serwera wysyłane automatycznie w urodziny serwera.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  flex: "none",
                  borderRadius: 999,
                  border: "1px solid rgba(245,158,11,0.35)",
                  background: "rgba(245,158,11,0.1)",
                  color: "#fcd34d",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "5px 12px",
                }}
              >
                🔒 Tylko właściciel bota
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>
                <span>{config.enabled ? "Aktywne" : "Nieaktywne"}</span>
                <button
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
                  aria-label="Włącz lub wyłącz Wrapped"
                  style={{
                    position: "relative",
                    width: 44,
                    height: 24,
                    border: "none",
                    borderRadius: 999,
                    cursor: "pointer",
                    background: config.enabled ? "#3b82f6" : "#636a80",
                    transition: "background .15s",
                    padding: 0,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 0,
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "transform .15s",
                      transform: `translateX(${config.enabled ? 24 : 4}px)`,
                    }}
                  />
                </button>
              </div>
            </div>
          </header>
        </SlideIn>

        {!config.enabled && (
          <SlideIn direction="up" delay={120}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                border: "1px solid #3a3f4e",
                background: "#17181E",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 12,
                color: "#9aa2b8",
              }}
            >
              <Info size={14} style={{ flex: "none", marginTop: 2 }} />
              <span>
                Moduł Wrapped jest <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>wyłączony</span>. Możesz zapisać
                ustawienia, ale podsumowanie nie zostanie wysłane, dopóki nie włączysz przełącznika{" "}
                <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>Aktywne</span> u góry.
              </span>
            </div>
          </SlideIn>
        )}

        <SlideIn direction="up" delay={140}>
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 10,
              background: "linear-gradient(120deg, #2b2350 0%, #1F2129 55%, #1F2129 100%)",
              border: "1px solid rgba(99,102,241,0.35)",
              padding: "20px 24px",
            }}
          >
            <div
              style={{
                position: "absolute",
                right: -20,
                top: -20,
                width: 160,
                height: 160,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(236,72,153,0.25), transparent 70%)",
              }}
            />
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#b3a6ff", textTransform: "uppercase" }}>
                  Najbliższe wrapped
                </div>
                <div style={{ marginTop: 10, fontSize: 16, fontWeight: 700, color: "#fff" }}>{nextDateLabel}</div>
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12, color: "#9aa2b8" }}>
                  <span style={{ borderRadius: 999, background: "rgba(34,197,94,0.15)", color: "#86efac", fontSize: 10, fontWeight: 700, padding: "3px 9px" }}>
                    {channelLabel}
                  </span>
                  <span>
                    serwer skończy <span style={{ fontWeight: 700, color: "#fff" }}>{serverAgeLabel}</span>
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: "#ec4899", lineHeight: 1 }}>{countdownLabel}</div>
                <div style={{ marginTop: 2, fontSize: 11, color: "#8d94a8" }}>do wysyłki</div>
              </div>
            </div>
          </div>
        </SlideIn>

        <SlideIn direction="up" delay={180}>
          <div style={{ display: "grid", gridTemplateColumns: "500px minmax(0,1fr)", gap: 16, alignItems: "start" }}>
            {/* Lewa kolumna: podgląd + motyw */}
            <div style={{ borderRadius: 10, background: "#17181E", padding: 16, boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#6b7280",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
                Podgląd grafiki (przykładowe dane)
              </div>

              <div
                style={{
                  width: PREVIEW_W,
                  height: PREVIEW_H,
                  margin: "0 auto",
                  boxSizing: "border-box",
                  borderRadius: 8,
                  background: palette.bg,
                  border: `1px solid ${palette.border}`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: PREVIEW_BASE_W,
                    height: PREVIEW_BASE_H,
                    boxSizing: "border-box",
                    padding: "19px 20px 15px",
                    transform: `scale(${PREVIEW_SCALE})`,
                    transformOrigin: "top left",
                    position: "relative",
                  }}
                >
                  <div style={{ position: "absolute", right: -110, top: -110, width: 310, height: 310, background: palette.glowA }} />
                  <div style={{ position: "absolute", left: -120, bottom: -130, width: 350, height: 350, background: palette.glowB }} />

                  <div style={{ position: "relative", textAlign: "center" }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        margin: "0 auto",
                        borderRadius: "50%",
                        overflow: "hidden",
                        border: `1.5px solid ${palette.accent}`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview.serverIconUrl ?? "/deezy.png"}
                        alt=""
                        style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
                      />
                    </div>
                    <div style={{ marginTop: 5, fontSize: 12, fontWeight: 800, color: "#fff" }}>{preview.serverName}</div>
                    <div style={{ marginTop: 10, fontSize: 20, fontWeight: 900, letterSpacing: "0.02em", color: palette.accent, lineHeight: 1 }}>SERVER WRAPPED</div>
                    <div style={{ marginTop: 4, fontSize: 8, color: "#98a2b8" }}>{preview.ageYears} lata razem!</div>
                  </div>

                  <div style={{ position: "relative", marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    {previewStats.map((st, i) => (
                      <div key={i} style={{ borderRadius: 6, background: palette.tile, border: `1px solid ${palette.tileBorder}`, padding: "8px 5px", textAlign: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>
                          {st.icon} {st.value}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 7, color: "#98a2b8" }}>{st.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ position: "relative", marginTop: 11 }}>
                    {previewSections.map((section, si) => (
                      <div key={section.title}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700, color: palette.accent, margin: si === 0 ? "0 0 4px" : "8px 0 4px" }}>
                          {section.title}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {section.rows.length === 0 ? (
                            <div style={{ fontSize: 9, color: "#98a2b8", padding: "4px 8px" }}>Brak danych</div>
                          ) : (
                            section.rows.map((row, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, borderRadius: 5, background: palette.tile, border: `1px solid ${palette.tileBorder}`, padding: "4px 8px" }}>
                                <span style={{ width: 13, fontSize: 8, fontWeight: 800, color: RANK_FG[i] ?? "#fff", flex: "none" }}>#{i + 1}</span>
                                {row.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={row.avatarUrl} alt="" style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover", flex: "none" }} />
                                ) : (
                                  <span style={{ width: 16, height: 16, borderRadius: "50%", background: DOT_GRADIENTS[i % DOT_GRADIENTS.length], flex: "none" }} />
                                )}
                                <span style={{ flex: 1, minWidth: 0, fontSize: 8, color: "#fff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {row.name}
                                </span>
                                <span style={{ flex: "none", fontSize: 8, fontWeight: 700, color: palette.accent }}>{row.value}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ position: "relative", marginTop: 8, textAlign: "center", fontSize: 7, color: "#98a2b8" }}>Wygenerowano {generatedAt}</div>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "#6b7280", textTransform: "uppercase", marginBottom: 8 }}>
                  Wersja kolorystyczna
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {WRAPPED_THEMES.map((theme) => {
                    const active = config.colorTheme === theme;
                    const tp = THEME_PALETTES[theme];
                    return (
                      <button
                        key={theme}
                        type="button"
                        onClick={() => setConfig((c) => ({ ...c, colorTheme: theme }))}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          border: `1px solid ${active ? "#6366f1" : "#2f3341"}`,
                          borderRadius: 999,
                          background: active ? "rgba(99,102,241,0.15)" : "#1F2129",
                          color: active ? "#fff" : "#c4cad8",
                          fontSize: 10,
                          fontWeight: 600,
                          fontFamily: "inherit",
                          padding: "5px 10px 5px 6px",
                          cursor: "pointer",
                          transition: "border-color .15s",
                        }}
                      >
                        <span style={{ width: 14, height: 14, borderRadius: "50%", background: tp.accent, flex: "none" }} />
                        {WRAPPED_THEME_LABELS[theme]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 10, color: "#6b7280", textAlign: "center" }}>
                  Przykładowe dane — prawdziwe statystyki i ranking zobaczysz dopiero po realnej wysyłce, żeby zachować element zaskoczenia.
                </span>
              </div>
            </div>

            {/* Prawa kolumna: konfiguracja (zwijana) + zawartość */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
              <div style={{ borderRadius: 10, background: "#1F2129", boxShadow: "0 8px 18px rgba(8,10,16,0.16)", overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() => setConfigOpen((v) => !v)}
                  className="hover:bg-[#23252f]"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    border: "none",
                    background: "transparent",
                    padding: "16px 20px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: "#d8dbe6" }}>
                    <Settings size={15} color="#aab2c8" />
                    Konfiguracja — kanał wysyłki
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#8d94a8" }}>{channelLabel}</span>
                    <ChevronDown size={15} color="#9aa2b8" style={{ transition: "transform .15s", transform: `rotate(${configOpen ? 180 : 0}deg)` }} />
                  </span>
                </button>

                {configOpen && (
                  <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#c4cad8" }}>
                      Kanał do wysyłania Wrapped <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <select
                      value={config.channelId ?? ""}
                      onChange={(e) => {
                        setConfig((c) => ({ ...c, channelId: e.target.value || undefined }));
                        setChannelError(false);
                      }}
                      style={{
                        height: 44,
                        border: `1px solid ${channelError ? "rgba(239,68,68,0.6)" : "transparent"}`,
                        borderRadius: 6,
                        background: "#17181E",
                        color: "rgba(255,255,255,0.9)",
                        fontFamily: "inherit",
                        fontSize: 13,
                        padding: "0 12px",
                        cursor: "pointer",
                      }}
                    >
                      <option value="">Wybierz kanał...</option>
                      {channels.map((c) => (
                        <option key={c.id} value={c.id}>
                          # {c.name}
                        </option>
                      ))}
                    </select>
                    {channelError && <p style={{ margin: 0, fontSize: 12, color: "#ef4444" }}>Wybierz kanał docelowy</p>}
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#8d94a8" }}>
                      Podsumowanie wysyłane raz w roku, 11 listopada o 12:00 — w urodziny serwera.
                    </p>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="hover:bg-[#818cf8] disabled:cursor-not-allowed"
                      style={{
                        marginTop: 8,
                        border: "none",
                        borderRadius: 8,
                        background: "#6366f1",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: "inherit",
                        height: 44,
                        cursor: "pointer",
                        opacity: saving ? 0.7 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Zapisywanie...
                        </>
                      ) : (
                        "Zapisz konfigurację"
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ borderRadius: 10, background: "#1F2129", padding: 20, boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
                <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6b7280", textTransform: "uppercase" }}>
                  Co znajdzie się w podsumowaniu
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {CONTENT_TILES.map((tile) => (
                    <div key={tile.label} style={{ borderRadius: 8, background: "#17181E", padding: "14px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 20 }}>{tile.icon}</div>
                      <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: "#d8dbe6" }}>{tile.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SlideIn>
      </div>
    </div>
  );
}
