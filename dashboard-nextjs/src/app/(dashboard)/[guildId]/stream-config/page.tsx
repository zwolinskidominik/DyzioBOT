'use client';

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import VariableInserter from '@/components/VariableInserter';
import {
  Loader2,
  Save,
  Trash2,
  Hash,
  Plus,
  Edit2,
  X,
  Tv,
  Eye,
  Radio,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { fetchGuildData } from '@/lib/cache';
import { SlideIn } from '@/components/ui/animated';
import { useDirtyState } from '@/components/DirtyStateProvider';
import { plural } from '@/lib/plural';

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface StreamConfig {
  guildId: string;
  enabled?: boolean;
  channelId: string | null;
  messageTemplate?: string;
  notificationsThisMonth?: number;
}

interface Streamer {
  _id: string;
  guildId: string;
  twitchChannel: string;
  userId: string;
  isLive: boolean;
  active: boolean;
  title?: string;
  game?: string;
  viewerCount?: number;
  liveSince?: string;
  thumbnailUrl?: string;
  avatarUrl?: string;
}

interface GuildMember {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

const DEFAULT_MESSAGE_TEMPLATE = '@everyone {streamer} właśnie zaczął streama! {link}';

const STREAM_VARIABLES = [
  { name: 'Streamer', display: 'Streamer', value: '{streamer}', description: 'Nazwa kanału Twitch' },
  { name: 'Gra', display: 'Gra', value: '{gra}', description: 'Aktualnie grana gra' },
  { name: 'Tytuł', display: 'Tytuł', value: '{tytuł}', description: 'Tytuł streamu' },
  { name: 'Link', display: 'Link', value: '{link}', description: 'Link do streamu' },
];

const AVATAR_COLORS = ['#8b5cf6', '#14b8a6', '#f97316', '#ec4899', '#3b82f6', '#eab308'];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function renderTemplate(
  template: string,
  vars: { streamer: string; gra: string; tytul: string; link: string },
): string {
  return template
    .replace(/\{streamer\}/g, vars.streamer)
    .replace(/\{gra\}/g, vars.gra)
    .replace(/\{tytuł\}/g, vars.tytul)
    .replace(/\{link\}/g, vars.link);
}

/** Podświetla pingi (@everyone, @here) na niebiesko, tak jak standardowo w Discordzie. */
function renderPreviewText(text: string): React.ReactNode[] {
  const parts = text.split(/(@everyone|@here)/g);
  return parts.map((part, i) =>
    part === '@everyone' || part === '@here' ? (
      <span
        key={i}
        className="rounded px-0.5 font-medium"
        style={{ backgroundColor: 'rgba(88,101,242,0.3)', color: '#dee0fc' }}
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function formatElapsed(sinceIso: string): string {
  const ms = Date.now() - new Date(sinceIso).getTime();
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface SavedConfigState {
  enabled: boolean;
  channelId: string;
  messageTemplate: string;
}

export default function StreamConfigPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { registerDirtyController } = useDirtyState();

  const [config, setConfig] = useState<StreamConfig | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [messageTemplate, setMessageTemplate] = useState<string>(DEFAULT_MESSAGE_TEMPLATE);
  const [channelError, setChannelError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [previewStreamerId, setPreviewStreamerId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTwitchChannel, setNewTwitchChannel] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [addError, setAddError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTwitchChannel, setEditTwitchChannel] = useState('');
  const [editUserId, setEditUserId] = useState('');
  const [, setTick] = useState(0);

  const savedRef = useRef<SavedConfigState>({ enabled: true, channelId: '', messageTemplate: DEFAULT_MESSAGE_TEMPLATE });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [configRes, channelsData, streamersRes, membersData] = await Promise.all([
          fetch(`/api/guild/${guildId}/stream-config`),
          fetchGuildData<Channel[]>(guildId, 'channels', `/api/discord/guild/${guildId}/channels`),
          fetch(`/api/guild/${guildId}/streamers`),
          fetchGuildData<GuildMember[]>(guildId, 'members', `/api/discord/guild/${guildId}/members`),
        ]);

        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
          const nextChannelId = configData.channelId || '';
          const nextEnabled = configData.enabled !== undefined ? configData.enabled : true;
          // Pusty string to celowy stan (brak treści nad embedem) — nie zamieniamy go na domyślny szablon.
          const nextTemplate = typeof configData.messageTemplate === 'string' ? configData.messageTemplate : DEFAULT_MESSAGE_TEMPLATE;
          setSelectedChannelId(nextChannelId);
          setEnabled(nextEnabled);
          setMessageTemplate(nextTemplate);
          savedRef.current = { enabled: nextEnabled, channelId: nextChannelId, messageTemplate: nextTemplate };
        }

        const textChannels = channelsData.filter((ch: Channel) => ch.type === 0 || ch.type === 5);
        setChannels(textChannels);

        if (streamersRes.ok) {
          const streamersData: Streamer[] = await streamersRes.json();
          setStreamers(streamersData);
          const live = streamersData.find((s) => s.isLive);
          setPreviewStreamerId(live?._id ?? streamersData[0]?._id ?? null);
        }

        setMembers(membersData);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError("Nie udało się załadować danych stream-config. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [guildId]);

  // Odświeża "Xh Ym" na żywej karcie co minutę bez ponownego pobierania danych.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const liveStreamer = useMemo(() => streamers.find((s) => s.isLive) ?? null, [streamers]);
  const previewStreamer = useMemo(
    () => streamers.find((s) => s._id === previewStreamerId) ?? liveStreamer ?? streamers[0] ?? null,
    [streamers, previewStreamerId, liveStreamer]
  );

  const isDirty =
    enabled !== savedRef.current.enabled ||
    selectedChannelId !== savedRef.current.channelId ||
    messageTemplate !== savedRef.current.messageTemplate;

  const handleSave = useCallback(async () => {
    if (!selectedChannelId) {
      setChannelError(true);
      toast.error('Wybierz kanał powiadomień');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/guild/${guildId}/stream-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled,
          channelId: selectedChannelId,
          messageTemplate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      const updatedConfig = await response.json();
      setConfig((prev) => ({ ...prev, ...updatedConfig, notificationsThisMonth: prev?.notificationsThisMonth ?? 0 }));
      savedRef.current = { enabled, channelId: selectedChannelId, messageTemplate };
      toast.success('Konfiguracja zapisana!');
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Błąd podczas zapisywania konfiguracji');
    } finally {
      setSaving(false);
    }
  }, [enabled, selectedChannelId, messageTemplate, guildId]);

  const handleCancel = useCallback(() => {
    const s = savedRef.current;
    setEnabled(s.enabled);
    setSelectedChannelId(s.channelId);
    setMessageTemplate(s.messageTemplate);
  }, []);

  useEffect(() => registerDirtyController({
    id: `stream-config-${guildId}`,
    isDirty,
    isSaving: saving,
    label: 'Powiadomienia Twitch',
    onSave: handleSave,
    onCancel: handleCancel,
  }), [guildId, isDirty, saving, handleSave, handleCancel, registerDirtyController]);

  const handleAddStreamer = async () => {
    const name = newTwitchChannel.trim();
    if (!name) {
      setAddError('Podaj nazwę kanału Twitch');
      return;
    }
    if (!newUserId) {
      setAddError('Wybierz użytkownika Discord');
      return;
    }

    const normalized = name.toLowerCase();
    if (streamers.some((s) => s.twitchChannel.toLowerCase() === normalized)) {
      setAddError('Ten kanał jest już śledzony');
      return;
    }

    try {
      const response = await fetch(`/api/guild/${guildId}/streamers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twitchChannel: name,
          userId: newUserId,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Failed to add streamer');
      }

      const streamer = await response.json();
      setStreamers([...streamers, streamer]);
      setNewTwitchChannel('');
      setNewUserId('');
      setAddError('');
      setShowAddForm(false);
      toast.success(`Dodano streamera ${name}`);
    } catch (error) {
      console.error('Error adding streamer:', error);
      setAddError(error instanceof Error ? error.message : 'Błąd podczas dodawania streamera');
    }
  };

  const handleEditStreamer = async (streamerId: string) => {
    if (!editTwitchChannel.trim() || !editUserId) {
      toast.error('Podaj kanał Twitch i wybierz użytkownika Discord');
      return;
    }

    try {
      const response = await fetch(`/api/guild/${guildId}/streamers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamerId,
          twitchChannel: editTwitchChannel.trim(),
          userId: editUserId,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Failed to update streamer');
      }

      const updatedStreamer = await response.json();
      setStreamers(streamers.map((s) => (s._id === streamerId ? { ...s, ...updatedStreamer } : s)));
      setEditingId(null);
      setEditTwitchChannel('');
      setEditUserId('');
      toast.success('Streamer został zaktualizowany!');
    } catch (error) {
      console.error('Error updating streamer:', error);
      toast.error(error instanceof Error ? error.message : 'Błąd podczas aktualizacji streamera');
    }
  };

  const handleDeleteStreamer = async (streamerId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tego streamera?')) return;

    try {
      setDeleting(streamerId);
      const response = await fetch(`/api/guild/${guildId}/streamers?streamerId=${streamerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete streamer');
      }

      const removed = streamers.find((s) => s._id === streamerId);
      setStreamers(streamers.filter((s) => s._id !== streamerId));
      if (previewStreamerId === streamerId) setPreviewStreamerId(null);
      toast.success(`Usunięto ${removed?.twitchChannel ?? 'streamera'}`);
    } catch (error) {
      console.error('Error deleting streamer:', error);
      toast.error('Błąd podczas usuwania streamera');
    } finally {
      setDeleting(null);
    }
  };

  const getMemberDisplay = (userId: string) => {
    const member = members.find((m) => m.id === userId);
    if (member) {
      return member.discriminator === '0'
        ? member.username
        : `${member.username}#${member.discriminator}`;
    }
    return userId;
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
            title="Nie udało się załadować konfiguracji streamów"
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

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
            <div className="space-y-4 min-w-0">
              <Skeleton className="h-24 w-full rounded-lg" />
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
              <Skeleton className="h-56 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="w-full space-y-4">
        <SlideIn direction="up">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white/90 flex items-center gap-2">
                <Tv className="w-6 h-6 text-bot-primary" />
                Powiadomienia Twitch
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Bot pilnuje śledzonych streamerów i ogłasza start transmisji na wybranym kanale.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-white/80">
              <span>{enabled ? "Aktywne" : "Nieaktywne"}</span>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                className="data-[state=checked]:bg-bot-primary"
              />
            </div>
          </div>
        </SlideIn>

        {!enabled && (
          <SlideIn direction="up">
            <div
              className="flex items-start gap-2 rounded-md px-3 py-2 text-xs"
              style={{ border: '1px solid #3a3f4e', background: '#17181E', color: '#9aa2b8' }}
            >
              <EyeOff className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Powiadomienia o streamach są <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>wyłączone</span>.
                Możesz edytować listę i zapisać ustawienia, ale bot nie wyśle ogłoszeń, dopóki nie włączysz przełącznika{' '}
                <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>Aktywne</span> u góry.
              </span>
            </div>
          </SlideIn>
        )}

        {/* Hero: teraz na żywo / stan spokojny */}
        <SlideIn direction="up" delay={50}>
          {liveStreamer ? (
            <div
              className="relative overflow-hidden rounded-lg p-5"
              style={{
                background: 'linear-gradient(120deg, #3a2154 0%, #1F2129 58%, #1F2129 100%)',
                border: '1px solid rgba(169,112,255,0.4)',
              }}
            >
              <div
                className="absolute -right-5 -top-8 w-44 h-44 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(169,112,255,0.28), transparent 70%)' }}
              />
              <div className="relative flex items-center gap-4">
                <div className="relative shrink-0">
                  {liveStreamer.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={liveStreamer.avatarUrl}
                      alt={liveStreamer.twitchChannel}
                      className="w-14 h-14 rounded-full object-cover border-2"
                      style={{ borderColor: '#ef4444' }}
                    />
                  ) : (
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold border-2"
                      style={{ background: avatarColor(liveStreamer.twitchChannel), borderColor: '#ef4444' }}
                    >
                      {liveStreamer.twitchChannel[0]?.toUpperCase()}
                    </div>
                  )}
                  <span
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[8px] font-extrabold tracking-wide bg-discord-red text-white leading-none animate-pulse"
                  >
                    LIVE
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold tracking-wider uppercase flex items-center gap-1" style={{ color: '#c9aaff' }}>
                    <Radio className="w-3 h-3" /> Teraz na żywo
                  </p>
                  <p className="mt-1.5 text-lg font-bold text-white truncate">twitch.tv/{liveStreamer.twitchChannel}</p>
                  <p className="mt-1.5 text-[13px] text-[#b9c0d0] truncate">
                    {liveStreamer.game || 'Nieznana gra'}
                    {liveStreamer.title ? ` · „${liveStreamer.title}"` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[22px] font-extrabold leading-none" style={{ color: '#a970ff' }}>
                    {liveStreamer.liveSince ? formatElapsed(liveStreamer.liveSince) : '—'}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8d94a8]">
                    {typeof liveStreamer.viewerCount === 'number'
                      ? `${liveStreamer.viewerCount.toLocaleString('pl-PL')} ${plural(liveStreamer.viewerCount, ['widz', 'widzów', 'widzów'])}`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg p-5 flex items-center gap-3.5" style={{ background: '#1F2129', border: '1px solid #2f3341' }}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#4b5563' }} />
              <div>
                <p className="text-sm font-semibold text-[#d8dbe6]">Nikt teraz nie streamuje</p>
                <p className="mt-0.5 text-xs text-[#8d94a8]">
                  Sprawdzamy status {streamers.length} {plural(streamers.length, ['kanału', 'kanałów', 'kanałów'])} co ok. 1 minutę.
                </p>
              </div>
            </div>
          )}
        </SlideIn>

        {/* Statystyki */}
        <SlideIn direction="up" delay={80}>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg p-4" style={{ background: '#1F2129' }}>
              <p className="text-2xl font-bold text-white">{streamers.length}</p>
              <p className="mt-0.5 text-[11px] text-[#8d94a8]">
                {plural(streamers.length, ['śledzony streamer', 'śledzonych streamerów', 'śledzonych streamerów'])}
              </p>
            </div>
            <div className="rounded-lg p-4" style={{ background: '#1F2129' }}>
              <p className="text-2xl font-bold" style={{ color: streamers.some((s) => s.isLive) ? '#ef4444' : '#8d94a8' }}>
                {streamers.filter((s) => s.isLive).length}
              </p>
              <p className="mt-0.5 text-[11px] text-[#8d94a8]">na żywo teraz</p>
            </div>
            <div className="rounded-lg p-4" style={{ background: '#1F2129' }}>
              <p className="text-2xl font-bold" style={{ color: '#a970ff' }}>{config?.notificationsThisMonth ?? 0}</p>
              <p className="mt-0.5 text-[11px] text-[#8d94a8]">
                {plural(config?.notificationsThisMonth ?? 0, ['powiadomienie', 'powiadomienia', 'powiadomień'])} w tym miesiącu
              </p>
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
          {/* Main column */}
          <div className="flex flex-col gap-4 min-w-0">
            <SlideIn direction="up" delay={100}>
              <div className="rounded-lg p-5" style={{ background: '#1F2129', boxShadow: '0 8px 18px rgba(8,10,16,0.16)' }}>
                <p className="text-[13px] font-bold text-[#d8dbe6] mb-3">Konfiguracja</p>

                <div className="space-y-2">
                  <Label htmlFor="channel-select">
                    Kanał powiadomień <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedChannelId}
                    onValueChange={(v) => {
                      setSelectedChannelId(v);
                      setChannelError(false);
                    }}
                  >
                    <SelectTrigger
                      id="channel-select"
                      className="w-full"
                      style={channelError ? { borderColor: 'rgba(239,68,68,0.6)' } : undefined}
                    >
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
                  {channelError && <p className="text-xs text-destructive">Wybierz kanał powiadomień</p>}
                </div>

                <div className="space-y-2 mt-4">
                  <Label>Treść powiadomienia</Label>
                  <VariableInserter
                    value={messageTemplate}
                    onChange={setMessageTemplate}
                    variables={STREAM_VARIABLES}
                    rows={2}
                    emojiPicker
                    unstyled
                    className="rounded-md border border-[#2f3341] bg-dark-900 text-sm leading-6 text-[#d8dbe6] transition-colors focus:border-[#3b82f6]"
                    placeholder={DEFAULT_MESSAGE_TEMPLATE}
                  />
                  <p className="text-xs text-muted-foreground">
                    Bot sprawdza status streamerów co ok. 1 minutę.
                  </p>
                </div>
              </div>
            </SlideIn>

            <SlideIn direction="up" delay={150}>
              <Card className="backdrop-blur" style={{ boxShadow: '0 0 10px #00000026', border: '1px solid transparent' }}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <span className="text-white/90">Streamerzy</span>
                      <span className="text-sm font-normal text-muted-foreground">{streamers.length}</span>
                    </CardTitle>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setShowAddForm((v) => !v);
                        setAddError('');
                      }}
                      className="btn-gradient hover:scale-105"
                    >
                      <Plus className="mr-1 w-4 h-4" />
                      Dodaj streamera
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {showAddForm && (
                    <div className="space-y-3 p-4 rounded-lg" style={{ background: '#17181E', border: '1px solid rgba(99,102,241,0.4)' }}>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="twitchChannel" className="text-xs">Kanał Twitch</Label>
                          <Input
                            id="twitchChannel"
                            placeholder="np. OstryWojti"
                            value={newTwitchChannel}
                            onChange={(e) => {
                              setNewTwitchChannel(e.target.value);
                              setAddError('');
                            }}
                            style={{ background: '#1d202b', borderColor: '#2f3341' }}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="discordUser" className="text-xs">Użytkownik Discord</Label>
                          <Select
                            value={newUserId}
                            onValueChange={(v) => {
                              setNewUserId(v);
                              setAddError('');
                            }}
                          >
                            <SelectTrigger id="discordUser" style={{ background: '#1d202b', borderColor: '#2f3341' }}>
                              <SelectValue placeholder="Wybierz..." />
                            </SelectTrigger>
                            <SelectContent>
                              {members.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  @{member.discriminator === '0' ? member.username : `${member.username}#${member.discriminator}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {addError && <p className="text-xs text-destructive">{addError}</p>}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleAddStreamer}
                          className="btn-gradient hover:scale-105"
                        >
                          Dodaj
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowAddForm(false);
                            setAddError('');
                          }}
                        >
                          Anuluj
                        </Button>
                      </div>
                    </div>
                  )}

                  {streamers.length === 0 ? (
                    <div className="text-center py-10 px-4 text-sm text-muted-foreground">
                      Brak streamerów — dodaj kanał Twitch, aby bot ogłaszał jego transmisje.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {streamers.map((streamer, index) => (
                        <SlideIn key={streamer._id} direction="up" delay={index * 50}>
                          <div
                            className="p-3 rounded-lg"
                            style={{ background: '#17181E', borderLeft: streamer.isLive ? '3px solid #ef4444' : '3px solid transparent' }}
                          >
                            {editingId === streamer._id ? (
                              <div className="space-y-3">
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-channel-${streamer._id}`}>Kanał Twitch</Label>
                                  <Input
                                    id={`edit-channel-${streamer._id}`}
                                    value={editTwitchChannel}
                                    onChange={(e) => setEditTwitchChannel(e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-user-${streamer._id}`}>Użytkownik Discord</Label>
                                  <Select value={editUserId} onValueChange={setEditUserId}>
                                    <SelectTrigger id={`edit-user-${streamer._id}`}>
                                      <SelectValue placeholder="Wybierz użytkownika..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {members.map((member) => (
                                        <SelectItem key={member.id} value={member.id}>
                                          {member.discriminator === '0'
                                            ? member.username
                                            : `${member.username}#${member.discriminator}`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleEditStreamer(streamer._id)}
                                    className="btn-gradient hover:scale-105"
                                  >
                                    <Save className="mr-1 h-3 w-3" />
                                    Zapisz
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditTwitchChannel('');
                                      setEditUserId('');
                                    }}
                                  >
                                    <X className="mr-1 h-3 w-3" />
                                    Anuluj
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                {streamer.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={streamer.avatarUrl}
                                    alt={streamer.twitchChannel}
                                    className="w-8 h-8 shrink-0 rounded-full object-cover"
                                  />
                                ) : (
                                  <div
                                    className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                    style={{ background: avatarColor(streamer.twitchChannel) }}
                                  >
                                    {streamer.twitchChannel[0]?.toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[13px] font-semibold text-white truncate">twitch.tv/{streamer.twitchChannel}</span>
                                    {streamer.isLive && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-discord-red text-white shrink-0">
                                        LIVE
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-0.5 text-[11px] text-[#8d94a8] truncate">
                                    @{getMemberDisplay(streamer.userId)} ·{' '}
                                    {streamer.isLive
                                      ? typeof streamer.viewerCount === 'number'
                                        ? `${streamer.viewerCount.toLocaleString('pl-PL')} ${plural(streamer.viewerCount, ['widz', 'widzów', 'widzów'])}`
                                        : '—'
                                      : 'offline'}
                                  </p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className={previewStreamerId === streamer._id ? 'text-bot-primary' : 'text-muted-foreground'}
                                    onClick={() => setPreviewStreamerId(streamer._id)}
                                    title="Pokaż w podglądzie"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-muted-foreground"
                                    onClick={() => {
                                      setEditingId(streamer._id);
                                      setEditTwitchChannel(streamer.twitchChannel);
                                      setEditUserId(streamer.userId);
                                    }}
                                    title="Edytuj"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-destructive"
                                    disabled={deleting === streamer._id}
                                    onClick={() => handleDeleteStreamer(streamer._id)}
                                    title="Usuń"
                                  >
                                    {deleting === streamer._id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </SlideIn>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </SlideIn>
          </div>

          {/* Podgląd na żywo */}
          <div className="lg:sticky lg:top-6">
            <SlideIn direction="up" delay={200}>
              <div className="space-y-2 rounded-md bg-dark-800 p-5">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#8d94a8]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Podgląd na żywo
                </p>

                {previewStreamer ? (
                  <>
                    <div className="rounded-md border border-[#2f3341] bg-[#313338] p-4">
                      <div className="flex items-start gap-3">
                        <Image
                          src="/deezy.png"
                          alt="Deezy"
                          width={36}
                          height={36}
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="flex items-center gap-1.5 text-sm">
                            <span className="font-semibold text-white">Deezy</span>
                            <span className="rounded bg-[#5865f2] px-1 py-px text-[10px] font-semibold uppercase text-white">
                              Bot
                            </span>
                          </p>

                          {messageTemplate.trim() ? (
                            <p className="text-sm text-[#dbdee1] break-words">
                              {renderPreviewText(
                                renderTemplate(messageTemplate, {
                                  streamer: previewStreamer.twitchChannel,
                                  gra: previewStreamer.game || 'Nieznana gra',
                                  tytul: previewStreamer.title || 'Tytuł streamu',
                                  link: `twitch.tv/${previewStreamer.twitchChannel}`,
                                })
                              )}
                            </p>
                          ) : null}

                          <div className="overflow-hidden rounded-md" style={{ background: '#2b2d31', borderLeft: '3px solid #a970ff' }}>
                            <div className="p-3 space-y-2">
                              <p className="text-[11px] text-[#b9c0d0] truncate">{previewStreamer.twitchChannel}</p>
                              <p className="text-[13px] font-bold truncate" style={{ color: '#a970ff' }}>{previewStreamer.title || 'Tytuł streamu'}</p>
                              <div className="flex gap-4 text-[11px] text-[#b9c0d0]">
                                <span><span className="block font-bold text-white text-[10px]">GRA</span>{previewStreamer.game || '—'}</span>
                                <span><span className="block font-bold text-white text-[10px]">WIDZOWIE</span>{typeof previewStreamer.viewerCount === 'number' ? previewStreamer.viewerCount.toLocaleString('pl-PL') : '—'}</span>
                              </div>
                            </div>
                            {previewStreamer.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={previewStreamer.thumbnailUrl}
                                alt=""
                                className="w-full object-cover"
                                style={{ aspectRatio: '16/9' }}
                              />
                            ) : (
                              <div
                                className="w-full flex items-center justify-center text-[10px] text-[#6b7280]"
                                style={{ aspectRatio: '16/9', background: 'linear-gradient(135deg, #2b1a45, #14161d)' }}
                              >
                                miniatura streamu
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs leading-5 text-[#8d94a8]">
                      Podgląd używa danych kanału <span className="text-[#b9c0d0]">{previewStreamer.twitchChannel}</span> — kliknij ikonę oka przy streamerze, aby podejrzeć jego wiadomość.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Dodaj streamera, aby zobaczyć podgląd powiadomienia.
                  </p>
                )}
              </div>
            </SlideIn>
          </div>
        </div>
      </div>
    </div>
  );
}
