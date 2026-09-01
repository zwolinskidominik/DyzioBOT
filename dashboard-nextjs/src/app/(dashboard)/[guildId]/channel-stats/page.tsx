"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import VariableInserter from "@/components/VariableInserter";
import { EyeOff, Loader2, Plus, Trash2, Volume } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useDirtyState } from "@/components/DirtyStateProvider";
import { plural } from "@/lib/plural";

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

interface ChannelInfo {
  channelId?: string;
  template?: string;
  member?: string;
}

type CategoryKey = "lastJoined" | "users" | "bots" | "bans";

interface ChannelsConfig {
  lastJoined?: ChannelInfo;
  users?: ChannelInfo;
  bots?: ChannelInfo;
  bans?: ChannelInfo;
}

interface ChannelStatsConfig {
  guildId: string;
  enabled: boolean;
  channels: ChannelsConfig;
}

const DEFAULT_TEMPLATES: Record<CategoryKey, string> = {
  lastJoined: "👤 Ostatni: {member}",
  users: "👥 Użytkownicy: {count}",
  bots: "🤖 Boty: {count}",
  bans: "🔨 Bany: {count}",
};

const CATEGORY_ORDER: CategoryKey[] = ["lastJoined", "users", "bots", "bans"];

interface StatVariable {
  name: string;
  display: string;
  value: string;
  description: string;
}

const STAT_CATEGORIES: Record<
  CategoryKey,
  {
    name: string;
    emoji: string;
    badgeBg: string;
    variables: StatVariable[];
    presets: string[];
  }
> = {
  lastJoined: {
    name: "Ostatnio dołączył",
    emoji: "👤",
    badgeBg: "rgba(255,255,255,0.08)",
    variables: [{ name: "Użytkownik", display: "Użytkownik", value: "{member}", description: "Nazwa ostatnio dołączonego użytkownika" }],
    presets: ["👤 Ostatni: {member}", "🆕 Nowy: {member}"],
  },
  users: {
    name: "Liczba użytkowników",
    emoji: "👥",
    badgeBg: "rgba(255,255,255,0.08)",
    variables: [{ name: "Liczba", display: "Liczba", value: "{count}", description: "Liczba użytkowników na serwerze" }],
    presets: ["👥 Użytkownicy: {count}", "Użytkowników: {count}"],
  },
  bots: {
    name: "Liczba botów",
    emoji: "🤖",
    badgeBg: "rgba(255,255,255,0.08)",
    variables: [{ name: "Liczba", display: "Liczba", value: "{count}", description: "Liczba botów na serwerze" }],
    presets: ["🤖 Boty: {count}", "Botów: {count}"],
  },
  bans: {
    name: "Liczba banów",
    emoji: "🔨",
    badgeBg: "rgba(255,255,255,0.08)",
    variables: [{ name: "Liczba", display: "Liczba", value: "{count}", description: "Liczba banów na serwerze" }],
    presets: ["🔨 Bany: {count}", "Banów: {count}"],
  },
};

interface SavedState {
  enabled: boolean;
  templates: Record<CategoryKey, string>;
}

function chipClass(active: boolean): string {
  return active
    ? "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
    : "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors hover:border-bot-primary/60 hover:text-white";
}

function chipStyle(active: boolean): React.CSSProperties {
  return active
    ? { background: "rgba(99,102,241,0.15)", borderColor: "#6366f1", color: "#fff" }
    : { background: "#17181E", borderColor: "#2f3341", color: "#b9c0d0" };
}

export default function ChannelStatsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { registerDirtyController } = useDirtyState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState<CategoryKey | null>(null);
  const [deletingChannel, setDeletingChannel] = useState<CategoryKey | null>(null);

  const [enabled, setEnabled] = useState(true);
  const [channelIds, setChannelIds] = useState<Record<CategoryKey, string | undefined>>({
    lastJoined: undefined,
    users: undefined,
    bots: undefined,
    bans: undefined,
  });
  const [templates, setTemplates] = useState<Record<CategoryKey, string>>({ ...DEFAULT_TEMPLATES });
  const [voiceChannels, setVoiceChannels] = useState<DiscordChannel[]>([]);

  const savedRef = useRef<SavedState>({ enabled: true, templates: { ...DEFAULT_TEMPLATES } });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        const [configRes, channelsData] = await Promise.all([
          fetchWithAuth(`/api/guild/${guildId}/channel-stats/config`),
          fetchGuildData<DiscordChannel[]>(guildId, "channels", `/api/discord/guild/${guildId}/channels`),
        ]);

        setVoiceChannels(channelsData.filter((ch) => ch.type === 2));

        if (configRes.ok) {
          let configData: ChannelStatsConfig = await configRes.json();

          const validateRes = await fetch(`/api/guild/${guildId}/channel-stats/validate`, { method: "POST" });
          if (validateRes.ok) {
            const validated = await validateRes.json();
            configData = { ...configData, channels: validated.channels };
          }

          const nextEnabled = configData.enabled !== undefined ? configData.enabled : true;
          const nextTemplates = { ...DEFAULT_TEMPLATES };
          const nextChannelIds: Record<CategoryKey, string | undefined> = {
            lastJoined: undefined,
            users: undefined,
            bots: undefined,
            bans: undefined,
          };

          CATEGORY_ORDER.forEach((key) => {
            const data = configData.channels[key];
            nextChannelIds[key] = data?.channelId;
            if (data?.template) {
              nextTemplates[key] = data.template
                .replace(/<count>/g, "{count}")
                .replace(/<member>/g, "{member}")
                .replace(/<value>/g, "{value}");
            }
          });

          setEnabled(nextEnabled);
          setTemplates(nextTemplates);
          setChannelIds(nextChannelIds);
          savedRef.current = { enabled: nextEnabled, templates: nextTemplates };
        }
      } catch (err) {
        console.error("Error loading channel stats data:", err);
        setError("Nie udało się załadować danych statystyk kanałów. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [guildId, savedRef]);

  const isDirty =
    enabled !== savedRef.current.enabled ||
    CATEGORY_ORDER.some((key) => templates[key] !== savedRef.current.templates[key]);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);

      const channels: ChannelsConfig = {};
      CATEGORY_ORDER.forEach((key) => {
        channels[key] = { channelId: channelIds[key], template: templates[key] };
      });

      const response = await fetch(`/api/guild/${guildId}/channel-stats/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, channels }),
      });

      if (!response.ok) throw new Error("Failed to save configuration");

      savedRef.current = { enabled, templates: { ...templates } };
      toast.success("Konfiguracja zapisana!");
    } catch (err) {
      console.error("Error saving config:", err);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  }, [enabled, templates, channelIds, guildId, savedRef]);

  const handleCancel = useCallback(() => {
    const s = savedRef.current;
    setEnabled(s.enabled);
    setTemplates({ ...s.templates });
  }, [savedRef]);

  useEffect(
    () =>
      registerDirtyController({
        id: `channel-stats-${guildId}`,
        isDirty,
        isSaving: saving,
        label: "Kanały z licznikami",
        onSave: handleSave,
        onCancel: handleCancel,
      }),
    [guildId, isDirty, saving, handleSave, handleCancel, registerDirtyController]
  );

  const handleCreateChannel = async (category: CategoryKey) => {
    const template = templates[category];
    if (!template.trim()) {
      toast.error("Szablon nazwy nie może być pusty");
      return;
    }

    try {
      setCreatingChannel(category);
      const response = await fetch(`/api/guild/${guildId}/channel-stats/create-channel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, template }),
      });

      if (!response.ok) throw new Error("Failed to create channel");

      const data = await response.json();
      setChannelIds((prev) => ({ ...prev, [category]: data.channelId }));
      toast.success(`Utworzono kanał: ${STAT_CATEGORIES[category].name.toLowerCase()}`);
    } catch (err) {
      console.error("Error creating channel:", err);
      toast.error("Nie udało się utworzyć kanału");
    } finally {
      setCreatingChannel(null);
    }
  };

  const handleDeleteChannel = async (category: CategoryKey) => {
    if (!confirm("Czy na pewno chcesz usunąć ten kanał licznika?")) return;

    try {
      setDeletingChannel(category);
      const response = await fetch(`/api/guild/${guildId}/channel-stats/create-channel`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });

      if (!response.ok) throw new Error("Failed to delete channel");

      setChannelIds((prev) => ({ ...prev, [category]: undefined }));
      toast.success(`Usunięto kanał: ${STAT_CATEGORIES[category].name.toLowerCase()}`);
    } catch (err) {
      console.error("Error deleting channel:", err);
      toast.error("Nie udało się usunąć kanału");
    } finally {
      setDeletingChannel(null);
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  const createdCount = CATEGORY_ORDER.filter((key) => channelIds[key]).length;

  if (error) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <ErrorState
            title="Nie udało się załadować statystyk kanałów"
            message={error}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="w-full space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="w-11 h-6 rounded-full" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
            <div className="space-y-6 min-w-0">
              <Card className="backdrop-blur" style={{ boxShadow: "0 0 10px #00000026", border: "1px solid transparent" }}>
                <CardContent className="space-y-4 pt-6">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-lg" />
                  ))}
                </CardContent>
              </Card>
            </div>
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="w-full space-y-6">
        <SlideIn direction="up">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white/90 flex items-center gap-2">
                <span aria-hidden>📊</span>
                Kanały z licznikami
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Bot tworzy kanały głosowe ze statystykami serwera i odświeża ich nazwy co 10 minut.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-white/80">
              <span>{enabled ? "Aktywne" : "Nieaktywne"}</span>
              <Switch checked={enabled} onCheckedChange={setEnabled} className="data-[state=checked]:bg-bot-primary" />
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
          {/* Main column */}
          <div className="space-y-3 min-w-0">
            {!enabled && (
              <SlideIn direction="up">
                <div
                  className="flex items-start gap-2 rounded-md px-3 py-2 text-xs"
                  style={{ border: "1px solid #3a3f4e", background: "#17181E", color: "#9aa2b8" }}
                >
                  <EyeOff className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Liczniki są <span className="font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>wyłączone</span>.
                    Możesz edytować szablony i zapisać ustawienia, ale nazwy kanałów nie będą odświeżane, dopóki nie
                    włączysz przełącznika <span className="font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>Aktywne</span> u góry.
                  </span>
                </div>
              </SlideIn>
            )}

            <SlideIn direction="up" delay={100}>
              <div
                className="relative overflow-hidden rounded-lg p-5"
                style={{
                  background: "linear-gradient(120deg, #1c2c4a 0%, #1F2129 58%, #1F2129 100%)",
                  border: "1px solid rgba(59,130,246,0.35)",
                }}
              >
                <div
                  className="absolute -right-8 -top-10 w-48 h-48 rounded-full pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(59,130,246,0.22), transparent 70%)" }}
                />
                <div className="relative flex items-center justify-between gap-5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold tracking-wider uppercase" style={{ color: "#93c5fd" }}>
                      Aktywne liczniki
                    </p>
                    <p className="mt-2 text-lg font-bold text-white">
                      {createdCount} z {CATEGORY_ORDER.length}{" "}
                      {plural(CATEGORY_ORDER.length, ["kanału utworzonego", "kanałów utworzonych", "kanałów utworzonych"])}
                    </p>
                    <p className="mt-1.5 text-[13px]" style={{ color: "#b9c0d0" }}>
                      {enabled ? "Bot odświeża nazwy kanałów co 10 minut." : "Odświeżanie wstrzymane."}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[22px] font-extrabold leading-none" style={{ color: "#60a5fa" }}>
                      10 min
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: "#8d94a8" }}>
                      interwał
                    </p>
                  </div>
                </div>
              </div>
            </SlideIn>

            {/* Categories */}
            {CATEGORY_ORDER.map((key, index) => {
              const category = STAT_CATEGORIES[key];
              const channelId = channelIds[key];
              const template = templates[key];

              return (
                <SlideIn key={key} direction="up" delay={150 + index * 50}>
                  <div
                    className="rounded-lg p-4"
                    style={{
                      background: "#1F2129",
                      border: channelId ? "1px solid transparent" : "1px dashed #3a3f4e",
                      boxShadow: "0 8px 18px rgba(8,10,16,0.16)",
                    }}
                  >
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <span
                        className="w-[26px] h-[26px] shrink-0 rounded-[7px] flex items-center justify-center text-[13px]"
                        style={{ background: category.badgeBg }}
                      >
                        {category.emoji}
                      </span>
                      <span className="min-w-0 flex-1 text-[13px] font-bold text-white truncate">{category.name}</span>
                      {channelId ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className="rounded-full text-[10px] font-bold px-2.5 py-1"
                            style={{ background: "rgba(34,197,94,0.15)", color: "#86efac" }}
                          >
                            ✓ utworzony
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive h-[26px] w-[26px]"
                            disabled={deletingChannel === key}
                            onClick={() => handleDeleteChannel(key)}
                            title="Usuń kanał"
                          >
                            {deletingChannel === key ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleCreateChannel(key)}
                          disabled={!template.trim() || creatingChannel === key}
                          className="btn-gradient hover:scale-105 text-[11px] h-7 px-3 shrink-0"
                        >
                          {creatingChannel === key ? (
                            <Loader2 className="mr-1 w-3 h-3 animate-spin" />
                          ) : (
                            <Plus className="mr-1 w-3 h-3" />
                          )}
                          Utwórz kanał
                        </Button>
                      )}
                    </div>

                    <VariableInserter
                      value={template}
                      onChange={(text) => setTemplates((prev) => ({ ...prev, [key]: text }))}
                      variables={category.variables}
                      rows={1}
                      emojiPicker
                      unstyled
                      className="rounded-md border border-[#2f3341] bg-dark-900 text-sm leading-6 text-[#d8dbe6] transition-colors focus:border-[#3b82f6]"
                      placeholder={category.presets[0]}
                    />

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {category.presets.map((preset) => {
                        const active = preset === template;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setTemplates((prev) => ({ ...prev, [key]: preset }))}
                            className={chipClass(active)}
                            style={chipStyle(active)}
                          >
                            {preset}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </SlideIn>
              );
            })}
          </div>

          {/* Podgląd na Discordzie */}
          <div className="lg:sticky lg:top-6">
            <SlideIn direction="up" delay={200}>
              <div className="rounded-lg p-4" style={{ background: "#17181E", boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
                <p className="text-[9px] font-bold tracking-wider uppercase flex items-center gap-1.5 mb-3" style={{ color: "#6b7280" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
                  Podgląd na Discordzie
                </p>
                <p className="text-[10px] font-bold tracking-wider uppercase px-1 pb-1.5" style={{ color: "#6b7280" }}>
                  ▾ Statystyki
                </p>

                <div className="flex flex-col gap-0.5">
                  {CATEGORY_ORDER.map((key) => {
                    const category = STAT_CATEGORIES[key];
                    const channelId = channelIds[key];
                    const channel = channelId ? voiceChannels.find((c) => c.id === channelId) : undefined;

                    return (
                      <div key={key} className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs">
                        <Volume
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: channel ? "#6b7280" : "#3f4654" }}
                        />
                        {channel ? (
                          <span className="truncate" style={{ color: "#b9c0d0" }}>
                            {channel.name}
                          </span>
                        ) : (
                          <span className="truncate italic" style={{ color: "#4b5563" }}>
                            {category.name} — brak kanału
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="mt-3.5 pt-3 text-[11px] leading-relaxed" style={{ borderTop: "1px solid #2f3341", color: "#6b7280" }}>
                  Kanały są zablokowane do wejścia — służą tylko jako etykiety w liście kanałów.
                </p>
              </div>
            </SlideIn>
          </div>
        </div>
      </div>
    </div>
  );
}
