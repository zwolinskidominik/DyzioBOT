"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EyeOff, Loader2, Mic, Plus } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { cn } from "@/lib/utils";
import { TempChannelLivePreview, type TempChannelType } from "@/components/temp-channels/TempChannelLivePreview";
import { TempChannelListItem } from "@/components/temp-channels/TempChannelListItem";

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface CreatorConfig {
  channelId: string;
  type: TempChannelType;
}

function DeezySwitch({ className, ...props }: React.ComponentProps<typeof Switch>) {
  return (
    <Switch
      className={cn(
        "h-6 w-11 border-0 bg-[#636a80] shadow-none data-[state=checked]:bg-[#3b82f6] data-[state=unchecked]:bg-[#636a80] [&>span]:h-4 [&>span]:w-4 [&>span]:translate-x-1 [&>span]:bg-white [&>span]:shadow-none [&>span]:data-[state=checked]:translate-x-6 [&>span]:data-[state=unchecked]:translate-x-1",
        className
      )}
      {...props}
    />
  );
}

export default function TempChannelsPage() {
  const params = useParams();
  const guildId = params?.guildId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [creators, setCreators] = useState<CreatorConfig[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [savingEnabled, setSavingEnabled] = useState(false);

  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [selectedType, setSelectedType] = useState<TempChannelType>("panel");
  const [adding, setAdding] = useState(false);
  const [savingChannelId, setSavingChannelId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [channelsData, configRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, "channels", `/api/discord/guild/${guildId}/channels`),
          fetchWithAuth(`/api/guild/${guildId}/temp-channels/config`),
        ]);

        setChannels(channelsData.filter((ch) => ch.type === 2));

        if (configRes.ok) {
          const configData = await configRes.json() as { enabled?: boolean; channelIds?: string[]; creators?: CreatorConfig[] };
          const merged = new Map<string, CreatorConfig>();
          (configData.channelIds ?? []).forEach((channelId) => merged.set(channelId, { channelId, type: "panel" }));
          (configData.creators ?? []).forEach((c) => merged.set(c.channelId, c));
          setCreators(Array.from(merged.values()));
          setEnabled(configData.enabled !== false);
        }
      } catch {
        setError("Nie udało się załadować danych tymczasowych kanałów. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [guildId]);

  const handleRetry = () => { setError(null); window.location.reload(); };

  const saveCreators = async (next: CreatorConfig[]): Promise<boolean> => {
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/temp-channels/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creators: next, enabled }),
      });
      if (!response.ok) throw new Error("Failed to save");
      setCreators(next);
      return true;
    } catch {
      toast.error("Nie udało się zapisać konfiguracji");
      return false;
    }
  };

  const handleToggleEnabled = async (next: boolean) => {
    const previous = enabled;
    setEnabled(next);
    setSavingEnabled(true);
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/temp-channels/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creators, enabled: next }),
      });
      if (!response.ok) throw new Error("Failed to save");
      toast.success(next ? "Tymczasowe kanały włączone" : "Tymczasowe kanały wyłączone");
    } catch {
      setEnabled(previous);
      toast.error("Nie udało się zapisać ustawienia");
    } finally {
      setSavingEnabled(false);
    }
  };

  const getChannelName = (channelId: string) => channels.find((c) => c.id === channelId)?.name ?? "Nieznany kanał";

  const handleAddChannel = async () => {
    if (!selectedChannelId) {
      toast.error("Wybierz kanał głosowy!");
      return;
    }
    if (creators.some((c) => c.channelId === selectedChannelId)) {
      toast.error("Ten kanał jest już dodany!");
      return;
    }

    setAdding(true);
    const ok = await saveCreators([...creators, { channelId: selectedChannelId, type: selectedType }]);
    setAdding(false);

    if (ok) {
      toast.success("Kanał tymczasowy dodany!");
      setSelectedChannelId("");
      setSelectedType("panel");
    }
  };

  const handleUpdateType = async (channelId: string, type: TempChannelType) => {
    setSavingChannelId(channelId);
    const ok = await saveCreators(creators.map((c) => (c.channelId === channelId ? { ...c, type } : c)));
    setSavingChannelId(null);
    if (ok) toast.success("Zaktualizowano typ kanału!");
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten kanał kreator?")) return;
    const ok = await saveCreators(creators.filter((c) => c.channelId !== channelId));
    if (ok) toast.success("Kanał usunięty!");
  };

  if (error) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <ErrorState title="Nie udało się załadować tymczasowych kanałów" message={error} onRetry={handleRetry} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="w-full space-y-5">
          <div className="space-y-3 pb-2">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-72 w-full rounded-md bg-dark-800" />
        </div>
      </div>
    );
  }

  const availableChannels = channels.filter((ch) => !creators.some((c) => c.channelId === ch.id));

  return (
    <div className="min-h-full pb-16">
      <div className="w-full space-y-5">
        <SlideIn direction="up" delay={100}>
          <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold text-white">Tymczasowe Kanały</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                Konfiguracja systemu tymczasowych kanałów głosowych.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <span>{enabled ? "Aktywne" : "Nieaktywne"}</span>
              <DeezySwitch checked={enabled} onCheckedChange={(v) => void handleToggleEnabled(v)} disabled={savingEnabled} aria-label="Włącz lub wyłącz tymczasowe kanały" />
            </div>
          </header>
        </SlideIn>

        {!enabled ? (
          <SlideIn direction="up" delay={130}>
            <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-dark-900 px-4 py-3 text-xs text-[#9aa2b8]">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Moduł tymczasowych kanałów jest <span className="font-semibold text-white/80">globalnie wyłączony</span>. Możesz edytować konfigurację, ale bot nie utworzy nowych kanałów, dopóki nie włączysz przełącznika <span className="font-semibold text-white/80">Aktywne</span> u góry i nie zapiszesz konfiguracji.
              </span>
            </div>
          </SlideIn>
        ) : null}

        <SlideIn direction="up" delay={150}>
          <div className="space-y-3 rounded-md bg-dark-800 p-5 shadow-[0_8px_18px_rgba(8,10,16,0.16)]">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-dark-900 text-[#aab2c8]">
                <Plus className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/90">Nowy kanał tymczasowy</p>
                <p className="mt-1 text-xs text-[#8d94a8]">
                  Wybierz kanał i typ — podgląd po prawej pokaże efekt od razu
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 items-start gap-5 pt-2 lg:grid-cols-[1.3fr_1fr]">
              {/* ── Form ─────────────────────────────────────────────── */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                    <SelectTrigger className="h-11 border-transparent bg-dark-900 text-white/90 focus:ring-[#3b82f6]/50 focus:ring-offset-0">
                      {/* Radix ignoruje children SelectValue, gdy value="" — placeholder MUSI iść przez
                          prop placeholder, inaczej trigger renderuje się pusty (bez ikony i tekstu). */}
                      <SelectValue
                        placeholder={
                          <div className="flex items-center gap-2 text-[#8d94a8]">
                            <Mic className="h-4 w-4" />
                            <span>Wybierz kanał głosowy...</span>
                          </div>
                        }
                      >
                        {selectedChannelId ? (
                          <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4 text-[#8d94a8]" />
                            {getChannelName(selectedChannelId)}
                          </div>
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="border-[#2f3341] bg-dark-900">
                      {availableChannels.length === 0 ? (
                        <div className="p-2 text-sm text-[#8d94a8]">Brak dostępnych kanałów głosowych</div>
                      ) : (
                        availableChannels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            <div className="flex items-center gap-2">
                              <Mic className="h-4 w-4 text-[#8d94a8]" />
                              {channel.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="inline-flex rounded-md bg-dark-900 p-1">
                  <button
                    type="button"
                    onClick={() => setSelectedType("panel")}
                    className={cn(
                      "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                      selectedType === "panel" ? "bg-[#3b82f6] text-white" : "text-[#8d94a8] hover:text-white",
                    )}
                  >
                    Panel zarządzania
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedType("standard")}
                    className={cn(
                      "rounded px-6 py-1.5 text-xs font-medium transition-colors",
                      selectedType === "standard" ? "bg-[#3b82f6] text-white" : "text-[#8d94a8] hover:text-white",
                    )}
                  >
                    Standardowy
                  </button>
                </div>

                <Button
                  type="button"
                  onClick={() => void handleAddChannel()}
                  disabled={adding || !selectedChannelId}
                  className="flex w-fit bg-[#3b82f6] text-white hover:bg-[#2563eb] disabled:opacity-50"
                >
                  {adding ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Dodaj kanał tymczasowy
                </Button>
              </div>

              {/* ── Live preview ─────────────────────────────────────── */}
              <div className="space-y-2 rounded-md bg-dark-900/30 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#8d94a8]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Podgląd na żywo
                </div>
                <TempChannelLivePreview type={selectedType} />
              </div>
            </div>

            {/* ── Configured channels list ─────────────────────────── */}
            {creators.length > 0 ? (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-[#c4cad8]">
                  Skonfigurowane kanały tymczasowe ({creators.length})
                </p>
                <div className="space-y-2">
                  {creators.map((creator) => (
                    <TempChannelListItem
                      key={creator.channelId}
                      channelId={creator.channelId}
                      channelName={getChannelName(creator.channelId)}
                      type={creator.type}
                      saving={savingChannelId === creator.channelId}
                      onSave={handleUpdateType}
                      onDelete={(channelId) => void handleDeleteChannel(channelId)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </SlideIn>
      </div>
    </div>
  );
}
