"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, ArrowLeft, Hash, Star, CalendarClock, Info, MessageSquare, RotateCcw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { Textarea } from "@/components/ui/textarea";
import { DiscordMessagePreview } from "@/components/DiscordMessagePreview";

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
  lastSentAt: string | null;
  nextSendAt: string | null;
}

export default function DisboardPage() {
  const params = useParams();
  const guildId = params.guildId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [nextSendAt, setNextSendAt] = useState<string | null>(null);

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
          fetch(`/api/guild/${guildId}/disboard/config`),
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
          const configData: DisboardConfig = await configRes.json();
          setEnabled(configData.enabled);
          setSelectedChannelId(configData.channelId || "");
          setMessage(configData.message || DEFAULT_MESSAGE);
          setLastSentAt(configData.lastSentAt);
          setNextSendAt(configData.nextSendAt);
        }
      } catch (err) {
        setError("Nie udało się załadować danych. Spróbuj ponownie.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [guildId]);

  const handleSave = async () => {
    if (enabled && !selectedChannelId) {
      toast.error("Wybierz kanał, na który będą wysyłane przypominajki.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/guild/${guildId}/disboard/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          channelId: selectedChannelId,
          message,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setNextSendAt(data.nextSendAt);
        toast.success("Konfiguracja Disboard została zapisana.");
      } else {
        toast.error("Nie udało się zapisać konfiguracji.");
      }
    } catch {
      toast.error("Wystąpił błąd podczas zapisywania.");
    } finally {
      setSaving(false);
    }
  };

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
    <div className="container mx-auto p-6 max-w-3xl">
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
              <Star className="h-6 w-6 text-yellow-500" />
              Przypominajka Disboard
            </h1>
            <p className="text-muted-foreground text-sm">
              Automatyczna przypominajka o zostawieniu recenzji na Disboardzie (~2 razy w miesiącu).
            </p>
          </div>
        </div>

        {/* Main config card */}
        <Card>
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
              Włącz lub wyłącz automatyczne przypominajki o recenzji na Disboardzie.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Channel selector */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Kanał do wysyłania przypominajek
              </Label>
              {loading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz kanał..." />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((ch) => (
                      <SelectItem key={ch.id} value={ch.id}>
                        # {ch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Message editor */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Treść wiadomości
              </Label>
              <p className="text-xs text-muted-foreground">
                Obsługuje pełne formatowanie Discord Markdown (pogrubienie, nagłówki, emotki, linki, itp.)
              </p>
              {loading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                  placeholder="Treść przypominajki…"
                />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMessage(DEFAULT_MESSAGE)}
                disabled={loading || message === DEFAULT_MESSAGE}
              >
                <RotateCcw className="mr-2 h-3 w-3" />
                Przywróć domyślną treść
              </Button>
              {/* Live preview */}
              {!loading && (
                <div className="space-y-2 mt-2">
                  <Label className="text-xs text-muted-foreground">Podgląd wiadomości</Label>
                  <DiscordMessagePreview content={message} />
                </div>
              )}
            </div>

            {/* Schedule info */}
            {!loading && (lastSentAt || nextSendAt) && (
              <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                <h4 className="font-medium flex items-center gap-2 text-sm">
                  <CalendarClock className="h-4 w-4" />
                  Harmonogram
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Ostatnio wysłano:</span>
                  <span>{formatDate(lastSentAt)}</span>
                  <span className="text-muted-foreground">Następna wysyłka:</span>
                  <span>{formatDate(nextSendAt)}</span>
                </div>
              </div>
            )}

            {/* Info box */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-muted-foreground flex gap-3">
              <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                Przypominajki są wysyłane losowo, średnio co 12–18 dni (około 2 razy w miesiącu),
                w godzinach 10:00–20:00. Dzięki temu nie są nachalne i wyglądają naturalnie.
              </div>
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
      </SlideIn>
    </div>
  );
}
