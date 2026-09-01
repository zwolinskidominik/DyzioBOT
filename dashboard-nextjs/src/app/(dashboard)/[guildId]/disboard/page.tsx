"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { OWNER_IDS, OWNER_GUILD_IDS } from "@/lib/owner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Star, Lock, Hash, Eye, EyeOff, Edit3, CalendarClock, Info, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import VariableInserter from "@/components/VariableInserter";
import { DiscordMessagePreview } from "@/components/DiscordMessagePreview";
import { toSortedDiscordChannels } from "@/lib/discordOrdering";
import { useDirtyState } from "@/components/DirtyStateProvider";
import { cn } from "@/lib/utils";

const DEFAULT_MESSAGE =
  '### Cześć i czołem! <a:pepo_howody:1351311201614827583>  \n' +
  'Pomóżcie nam rosnąć w siłę! Zostawcie szczerą recenzję o naszym serwerze na Disboardzie. \n' +
  'Każda opinia – niezależnie od tego, czy pozytywna, czy negatywna – jest dla nas bardzo cenna. \n\n' +
  '**Z góry dziękuję każdemu, kto znajdzie chwilę, by pomóc.** <:pepe_ok:1351199540304285726> \n' +
  '**Link do zamieszczenia recenzji:** https://disboard.org/pl/server/881293681783623680\n' +
  '-# Dla każdego, kto zdecyduje się napisać swoją opinię i zgłosi się do administracji serwera, przewidziano jednorazową nagrodę w postaci bonusu +5.000 XP.';

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface DisboardConfig {
  guildId: string;
  enabled: boolean;
  channelId: string;
  message: string;
}

const inputClass =
  "h-11 border border-[#3f4455] bg-dark-900 text-white/90 placeholder:text-[#9aa2b8] focus-visible:border-[#3b82f6] focus-visible:ring-[#3b82f6]/30 focus-visible:ring-offset-0";
const labelClass = "text-xs font-semibold text-[#c4cad8]";

function DeezySwitch({ className, ...props }: React.ComponentProps<typeof Switch>) {
  return (
    <Switch
      className={cn(
        "deezy-switch h-6 w-11 border-0 bg-[#636a80] shadow-none data-[state=checked]:bg-[#3b82f6] data-[state=unchecked]:bg-[#636a80] [&>span]:h-4 [&>span]:w-4 [&>span]:translate-x-1 [&>span]:bg-white [&>span]:shadow-none [&>span]:data-[state=checked]:translate-x-6 [&>span]:data-[state=unchecked]:translate-x-1",
        className
      )}
      {...props}
    />
  );
}

export default function DisboardPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { data: session, status } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;
  const { registerDirtyController } = useDirtyState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [nextSendAt, setNextSendAt] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"editor" | "preview">("editor");

  const DEFAULT_CONFIG: DisboardConfig = {
    guildId,
    enabled: false,
    channelId: "",
    message: DEFAULT_MESSAGE,
  };

  const [config, setConfig] = useState<DisboardConfig>(DEFAULT_CONFIG);
  const savedConfigRef = useRef<DisboardConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [channelsRes, configRes] = await Promise.all([
          fetchWithAuth(`/api/discord/guild/${guildId}/channels`),
          fetchWithAuth(`/api/guild/${guildId}/disboard/config`),
        ]);

        if (channelsRes.ok) {
          const channelsData = toSortedDiscordChannels(await channelsRes.json()) as Channel[];
          setChannels(channelsData.filter((ch) => ch.type === 0 || ch.type === 5));
        }

        if (configRes.ok) {
          const data = await configRes.json();
          const nextConfig: DisboardConfig = {
            guildId,
            enabled: data.enabled ?? false,
            channelId: data.channelId || "",
            message: data.message || DEFAULT_MESSAGE,
          };
          setConfig(nextConfig);
          savedConfigRef.current = nextConfig;
          setLastSentAt(data.lastSentAt ?? null);
          setNextSendAt(data.nextSendAt ?? null);
        }
      } catch (err) {
        console.error(err);
        setError("Nie udało się załadować danych. Spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    };

    if (guildId) fetchData();
  }, [guildId]);

  const handleSave = useCallback(async () => {
    if (config.enabled && !config.channelId) {
      toast.error("Wybierz kanał, na który będą wysyłane przypominajki.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetchWithAuth(`/api/guild/${guildId}/disboard/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: config.enabled,
          channelId: config.channelId,
          message: config.message,
        }),
      });

      if (!res.ok) throw new Error("Failed to save disboard config");

      const data = await res.json();
      const nextConfig: DisboardConfig = {
        guildId,
        enabled: data.enabled ?? false,
        channelId: data.channelId || "",
        message: data.message || DEFAULT_MESSAGE,
      };
      setConfig(nextConfig);
      savedConfigRef.current = nextConfig;
      setLastSentAt(data.lastSentAt ?? null);
      setNextSendAt(data.nextSendAt ?? null);
      toast.success("Konfiguracja Disboard została zapisana.");
    } catch (err) {
      console.error(err);
      toast.error("Nie udało się zapisać konfiguracji.");
    } finally {
      setSaving(false);
    }
  }, [config, guildId]);

  const handleCancel = useCallback(() => {
    setConfig(savedConfigRef.current);
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(savedConfigRef.current),
    [config]
  );

  useEffect(() => registerDirtyController({
    id: `disboard-${guildId}`,
    isDirty,
    isSaving: saving,
    label: "Przypominajka Disboard",
    onSave: handleSave,
    onCancel: handleCancel,
  }), [guildId, isDirty, saving, handleSave, handleCancel, registerDirtyController]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const selectedChannel = channels.find((ch) => ch.id === config.channelId);

  if (status !== "loading" && (!OWNER_IDS.includes(currentUserId ?? "") || !OWNER_GUILD_IDS.includes(guildId))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <p className="text-4xl">🔒</p>
        <h2 className="text-xl font-semibold">Brak dostępu</h2>
        <p className="text-muted-foreground text-sm">Ten moduł jest dostępny wyłącznie dla właściciela bota na jego serwerach.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <ErrorState
            title="Nie udało się załadować przypominajki"
            message={error}
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="w-full space-y-5">
          <div className="flex items-start justify-between gap-6 pb-2">
            <div className="space-y-3"><Skeleton className="h-7 w-64" /><Skeleton className="h-4 w-[420px] max-w-full" /></div>
            <Skeleton className="h-7 w-40 rounded-full" />
          </div>
          <Skeleton className="h-24 w-full rounded-md bg-dark-800" />
          <Skeleton className="h-96 w-full rounded-md bg-dark-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-16">
      <div className="w-full space-y-5">
        <SlideIn direction="up" delay={100}>
          <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
                <Star className="h-6 w-6 text-yellow-500" />
                Przypominajka Disboard
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                Automatyczna przypominajka o zostawieniu recenzji na Disboardzie (~2 razy w miesiącu).
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">
                <Lock className="h-3.5 w-3.5" />
                Tylko właściciel bota
              </span>
              <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
                <span>{config.enabled ? "Aktywne" : "Nieaktywne"}</span>
                <DeezySwitch
                  checked={config.enabled}
                  onCheckedChange={(checked) => setConfig((c) => ({ ...c, enabled: checked }))}
                  aria-label="Włącz lub wyłącz przypominajkę Disboard"
                />
              </div>
            </div>
          </header>
        </SlideIn>

        {!config.enabled ? (
          <SlideIn direction="up" delay={130}>
            <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-dark-900 px-4 py-3 text-xs text-[#9aa2b8]">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Przypominajka Disboard jest <span className="font-semibold text-white/80">globalnie wyłączona</span>. Możesz edytować konfigurację, ale bot nie wyśle wiadomości, dopóki nie włączysz przełącznika <span className="font-semibold text-white/80">Aktywne</span> u góry i nie zapiszesz konfiguracji.
              </span>
            </div>
          </SlideIn>
        ) : null}

        <SlideIn direction="up" delay={150}>
          <div className="space-y-5 rounded-md bg-dark-800 p-5">
            {/* Kanał docelowy */}
            <div className="max-w-sm space-y-2">
              <label className={labelClass}>
                Kanał do wysyłania przypominajek <span className="text-destructive">*</span>
              </label>
              <Select
                value={config.channelId || ""}
                onValueChange={(value) => setConfig((c) => ({ ...c, channelId: value }))}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue
                    placeholder={
                      <div className="flex items-center gap-2 text-[#9aa2b8]">
                        <Hash className="h-4 w-4" />
                        <span>Wybierz kanał...</span>
                      </div>
                    }
                  >
                    {config.channelId ? (
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-[#8d94a8]" />
                        {selectedChannel?.name ?? "Wybierz kanał..."}
                      </div>
                    ) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="border-[#2f3341] bg-dark-900">
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-[#8d94a8]" />
                        {channel.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Treść wiadomości: edytor zintegrowany z podglądem, jak w module Turniej CS2 */}
            <div className="space-y-3">
              <label className={labelClass}>
                Treść wiadomości <span className="text-destructive">*</span>
              </label>
              <p className="text-[11px] text-[#8d94a8]">
                Obsługuje pełne formatowanie Discord Markdown (pogrubienie, nagłówki, emotki, linki, itp.)
              </p>

              <div className="w-full max-w-[880px]">
                <div className="flex items-start gap-3">
                  <div className="flex w-10 shrink-0 flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/deezy.png" alt="Deezy" className="h-10 w-10 rounded-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setEditorMode((mode) => (mode === "editor" ? "preview" : "editor"))}
                      className="flex h-8 w-8 items-center justify-center rounded-md bg-[#3b82f6] text-white transition-colors hover:bg-[#2563eb]"
                      aria-label={editorMode === "editor" ? "Pokaż podgląd wiadomości" : "Wróć do edytora"}
                      title={editorMode === "editor" ? "PODGLĄD" : "EDYTOR"}
                    >
                      {editorMode === "editor" ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="min-w-0 w-full flex-1">
                    <div className="flex min-h-10 flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">Deezy</span>
                      <span className="rounded bg-[#5865f2] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">BOT</span>
                      <span className="text-xs text-[#8d94a8]">dziś</span>
                    </div>

                    {editorMode === "preview" ? (
                      <div className="mt-2 overflow-hidden rounded-md border border-[#2f3341]">
                        <DiscordMessagePreview
                          content={config.message}
                          avatarUrl="/deezy.png"
                          compact
                          bordered={false}
                        />
                      </div>
                    ) : (
                      <div className="mt-2">
                        <VariableInserter
                          value={config.message}
                          onChange={(value) => setConfig((c) => ({ ...c, message: value }))}
                          variables={[]}
                          placeholder="Wpisz treść przypominajki..."
                          rows={8}
                          unstyled
                          className="rounded-md border border-[#3f4455] bg-dark-900 text-sm leading-6 text-[#d8dbe6] transition-colors hover:border-[#3b82f6]/70 focus:border-[#3b82f6] font-mono"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfig((c) => ({ ...c, message: DEFAULT_MESSAGE }))}
                disabled={config.message === DEFAULT_MESSAGE}
                className="flex items-center gap-1.5 rounded-md border border-[#3f4455] bg-dark-900 px-3 py-1.5 text-xs font-semibold text-[#c4cad8] transition-colors hover:border-[#3b82f6]/70 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="h-3 w-3" />
                Przywróć domyślną treść
              </button>

              <p className="text-[11px] text-[#6f7690]">
                Kliknij ikonę oka, aby zobaczyć podgląd wiadomości tak, jak zobaczą ją użytkownicy na Discordzie.
              </p>
            </div>

            {/* Harmonogram */}
            {(lastSentAt || nextSendAt) && (
              <div className="rounded-md border border-[#2f3341] bg-dark-900 p-4">
                <h4 className="flex items-center gap-2 text-xs font-semibold text-[#c4cad8]">
                  <CalendarClock className="h-3.5 w-3.5 text-[#8d94a8]" />
                  Harmonogram
                </h4>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <span className="text-[#8d94a8]">Ostatnio wysłano:</span>
                  <span className="text-white/90">{formatDate(lastSentAt)}</span>
                  <span className="text-[#8d94a8]">Następna wysyłka:</span>
                  <span className="text-white/90">{formatDate(nextSendAt)}</span>
                </div>
              </div>
            )}

            {/* Info box */}
            <div className="flex items-start gap-2 rounded-md border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-[#9aa2b8]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
              <span>
                Przypominajki są wysyłane losowo, średnio co 12–18 dni (około 2 razy w miesiącu),
                w godzinach 10:00–20:00. Dzięki temu nie są nachalne i wyglądają naturalnie.
              </span>
            </div>
          </div>
        </SlideIn>
      </div>

      <style jsx global>{`
        .deezy-switch span { position: relative; }
        .deezy-switch span[data-state="checked"]::after { content: ""; position: absolute; inset: 5px; border-radius: 9999px; background: #3b82f6; }
      `}</style>
    </div>
  );
}
