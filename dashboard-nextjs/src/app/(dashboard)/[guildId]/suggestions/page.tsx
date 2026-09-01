"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hash, Lightbulb, EyeOff, Percent, BarChart3, ListOrdered } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { cn } from "@/lib/utils";
import { toSortedDiscordChannels } from "@/lib/discordOrdering";
import EmbedColorPicker from "@/components/EmbedColorPicker";
import { SuggestionEmbedPreview, type SuggestionVotingFormat } from "@/components/suggestions/SuggestionEmbedPreview";
import { useDirtyState } from "@/components/DirtyStateProvider";

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface SuggestionConfig {
  guildId: string;
  enabled: boolean;
  suggestionChannelId: string;
  votingFormat?: SuggestionVotingFormat;
  anonymous?: boolean;
  embedColor?: string;
}

interface SavedState {
  enabled: boolean;
  suggestionChannelId: string;
  votingFormat: SuggestionVotingFormat;
  anonymous: boolean;
  embedColor: string;
}

const DEFAULT_SAVED_STATE: SavedState = {
  enabled: false,
  suggestionChannelId: "",
  votingFormat: "bar",
  anonymous: false,
  embedColor: "#4C4C54",
};

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

export default function SuggestionsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { registerDirtyController } = useDirtyState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [config, setConfig] = useState<SuggestionConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [votingFormat, setVotingFormat] = useState<SuggestionVotingFormat>("bar");
  const [anonymous, setAnonymous] = useState(false);
  const [embedColor, setEmbedColor] = useState("#4C4C54");
  const [previewColor, setPreviewColor] = useState<string | null>(null);
  const savedRef = useRef<SavedState>(DEFAULT_SAVED_STATE);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

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
          fetch(`/api/guild/${guildId}/suggestions/config`),
        ]);

        if (channelsRes.ok) {
          const channelsData = toSortedDiscordChannels(await channelsRes.json()) as Channel[];
          const textChannels = channelsData.filter((ch: Channel) => ch.type === 0 || ch.type === 5);
          setChannels(textChannels);
          
          if (!cached || Date.now() - JSON.parse(cached).timestamp >= 60 * 1000) {
            localStorage.setItem(cacheKey, JSON.stringify({
              data: channelsData,
              timestamp: Date.now()
            }));
          }
        }

        if (configRes.ok) {
          const configData = await configRes.json();
          const nextState: SavedState = {
            enabled: configData.enabled !== undefined ? configData.enabled : false,
            suggestionChannelId: configData.suggestionChannelId || "",
            votingFormat: configData.votingFormat || "bar",
            anonymous: configData.anonymous === true,
            embedColor: configData.embedColor || "#4C4C54",
          };
          setConfig(configData);
          setEnabled(nextState.enabled);
          setSelectedChannelId(nextState.suggestionChannelId);
          setVotingFormat(nextState.votingFormat);
          setAnonymous(nextState.anonymous);
          setEmbedColor(nextState.embedColor);
          savedRef.current = nextState;
        }

      } catch (error) {
        console.error("Error loading data:", error);
        setError("Nie udało się załadować danych sugestii. Sprawdź połączenie z internetem i spróbuj ponownie.");
        toast.error("Nie udało się załadować danych");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [guildId]);

  const isDirty =
    enabled !== savedRef.current.enabled ||
    selectedChannelId !== savedRef.current.suggestionChannelId ||
    votingFormat !== savedRef.current.votingFormat ||
    anonymous !== savedRef.current.anonymous ||
    embedColor !== savedRef.current.embedColor;

  const channelMissing = !selectedChannelId;

  const handleSave = useCallback(async () => {
    if (!selectedChannelId) {
      toast.error("Wybierz kanał sugestii");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/guild/${guildId}/suggestions/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          suggestionChannelId: selectedChannelId,
          votingFormat,
          anonymous,
          embedColor,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save config");
      }

      savedRef.current = {
        enabled,
        suggestionChannelId: selectedChannelId,
        votingFormat,
        anonymous,
        embedColor,
      };
      toast.success("Konfiguracja została zapisana!");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  }, [anonymous, embedColor, enabled, guildId, selectedChannelId, votingFormat]);

  const handleCancel = useCallback(() => {
    const s = savedRef.current;
    setEnabled(s.enabled);
    setSelectedChannelId(s.suggestionChannelId);
    setVotingFormat(s.votingFormat);
    setAnonymous(s.anonymous);
    setEmbedColor(s.embedColor);
    setPreviewColor(null);
  }, []);

  useEffect(() => registerDirtyController({
    id: `suggestions-${guildId}`,
    isDirty,
    isSaving: saving,
    label: "Sugestie",
    onSave: channelMissing ? () => { toast.error("Wybierz kanał sugestii"); } : handleSave,
    onCancel: handleCancel,
  }), [guildId, isDirty, saving, channelMissing, handleSave, handleCancel, registerDirtyController]);

  const handleDelete = async () => {
    if (!confirm("Czy na pewno chcesz usunąć konfigurację sugestii?")) return;

    try {
      const response = await fetch(`/api/guild/${guildId}/suggestions/config`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete config");
      }

      setEnabled(false);
      setSelectedChannelId("");
      setConfig(null);
      setVotingFormat("bar");
      setAnonymous(false);
      setEmbedColor("#4C4C54");
      savedRef.current = DEFAULT_SAVED_STATE;
      toast.success("Konfiguracja została usunięta!");
    } catch (error) {
      console.error("Error deleting config:", error);
      toast.error("Nie udało się usunąć konfiguracji");
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  if (error) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <ErrorState
            title="Nie udało się załadować sugestii"
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
        <div className="w-full">
          <Skeleton className="h-10 w-40 mb-6" />
          
          <Card
            className="backdrop-blur mb-6"
            style={{
              boxShadow: '0 0 10px #00000026',
              border: '1px solid transparent'
            }}
          >
            <CardHeader>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-96" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="w-11 h-6 rounded-full" />
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
          
          <Card
            className="backdrop-blur"
            style={{
              boxShadow: '0 0 10px #00000026',
              border: '1px solid transparent'
            }}
          >
            <CardHeader>
              <Skeleton className="h-7 w-40" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-9 w-20" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <div className="flex gap-4">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Skeleton className="h-10 w-full mt-6" />
        </div>
      </div>
    );
  }

  const votingFormatOptions: { value: SuggestionVotingFormat; label: string; description: string; icon: typeof ListOrdered }[] = [
    { value: "counts", label: "Liczniki", description: "Same liczby głosów, bez procentów", icon: ListOrdered },
    { value: "percent", label: "Procenty", description: "Wynik jako udział procentowy głosów", icon: Percent },
    { value: "bar", label: "Pasek głosów", description: "Liczby, procenty i segmentowy pasek poparcia", icon: BarChart3 },
  ];

  return (
    <div className="min-h-full">
      <div className="w-full space-y-5">
        <SlideIn direction="up" delay={100}>
          <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold text-white">Sugestie</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                Wygląd i sposób publikacji sugestii na serwerze.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <span>{enabled ? "Aktywne" : "Nieaktywne"}</span>
              <DeezySwitch checked={enabled} onCheckedChange={setEnabled} aria-label="Włącz lub wyłącz sugestie" />
            </div>
          </header>
        </SlideIn>

        {!enabled ? (
          <SlideIn direction="up" delay={130}>
            <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-dark-900 px-4 py-3 text-xs text-[#9aa2b8]">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Moduł sugestii jest <span className="font-semibold text-white/80">globalnie wyłączony</span>. Możesz edytować konfigurację, ale bot nie będzie publikował sugestii, dopóki nie włączysz przełącznika <span className="font-semibold text-white/80">Aktywne</span> u góry i nie zapiszesz konfiguracji.
              </span>
            </div>
          </SlideIn>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          {/* Configuration Card */}
          <SlideIn direction="up" delay={150}>
            <Card
              className="backdrop-blur"
              style={{
                boxShadow: '0 0 10px #00000026',
                border: '1px solid transparent'
              }}
            >
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-bot-primary" />
                  <span className="text-white/90">
                    Konfiguracja
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Channel Select */}
                <div className="space-y-2">
                  <Label htmlFor="channel">
                    Kanał sugestii <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                    <SelectTrigger id="channel" className="w-full">
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
                  <p className="text-xs text-muted-foreground">
                    Kanał, na którym będą publikowane sugestie od użytkowników
                  </p>
                </div>

                {/* Current Config */}
                {config?.suggestionChannelId && (
                  <div className="rounded-lg border border-[#2f3341] bg-dark-900 p-4 space-y-2">
                    <p className="text-sm font-medium text-white/90">Aktualnie skonfigurowany kanał:</p>
                    <p className="text-sm text-[#9aa2b8]">
                      {channels.find((ch) => ch.id === config.suggestionChannelId)?.name ? (
                        <span className="flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          {channels.find((ch) => ch.id === config.suggestionChannelId)?.name}
                        </span>
                      ) : (
                        <span className="text-destructive text-xs">Kanał usunięty</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Voting Format */}
                <div className="space-y-2">
                  <Label>Format głosowania</Label>
                  <Tabs value={votingFormat} onValueChange={(value) => setVotingFormat(value as SuggestionVotingFormat)}>
                    <TabsList className="bg-dark-900">
                      {votingFormatOptions.map(({ value, label, icon: Icon }) => (
                        <TabsTrigger key={value} value={value}>
                          <Icon className="mr-1.5 h-3.5 w-3.5" />
                          {label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {votingFormatOptions.map(({ value, description }) => (
                      <TabsContent key={value} value={value} className="pt-3">
                        <p className="rounded-md border border-dashed border-[#2f3341] px-3 py-3 text-xs text-[#8d94a8]">
                          {description}
                        </p>
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>

                {/* Anonymous submissions */}
                <div className="flex items-center justify-between rounded-lg border border-[#2f3341] bg-dark-900 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <EyeOff className="h-4 w-4 text-[#8d94a8]" />
                    <div>
                      <p className="text-sm font-medium text-white/90">Zgłoszenie anonimowe</p>
                      <p className="text-xs text-muted-foreground">Ukryj tożsamość autora sugestii w embedzie</p>
                    </div>
                  </div>
                  <Switch checked={anonymous} onCheckedChange={setAnonymous} />
                </div>

                {/* Embed color */}
                <div className="space-y-2">
                  <Label>Kolor embeda</Label>
                  <div className="flex items-center gap-3 rounded-lg border border-[#2f3341] bg-dark-900 px-3 py-2.5">
                    <EmbedColorPicker
                      value={embedColor}
                      onPreviewChange={setPreviewColor}
                      onChange={(color) => {
                        setEmbedColor(color);
                        setPreviewColor(null);
                      }}
                    />
                    <span className="h-4 w-4 rounded-full border border-white/10" style={{ backgroundColor: previewColor ?? embedColor }} />
                    <span className="font-mono text-xs uppercase text-[#c4cad8]">{previewColor ?? embedColor}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </SlideIn>

          {/* Live Preview */}
          <SlideIn direction="up" delay={150}>
            <Card
              className="backdrop-blur lg:sticky lg:top-6"
              style={{
                boxShadow: '0 0 10px #00000026',
                border: '1px solid transparent'
              }}
            >
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-[#8d94a8]">
                  Podgląd na żywo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SuggestionEmbedPreview
                  votingFormat={votingFormat}
                  anonymous={anonymous}
                  embedColor={previewColor ?? embedColor}
                />
              </CardContent>
            </Card>
          </SlideIn>
        </div>

      </div>
    </div>
  );
}
