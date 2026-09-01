"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { OWNER_IDS, OWNER_GUILD_IDS } from "@/lib/owner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Hash, Eye, EyeOff, Edit3, Users, Shield, Mic, X, Search, AtSign } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import VariableInserter from "@/components/VariableInserter";
import { DiscordMessagePreview } from "@/components/DiscordMessagePreview";
import EmojiPicker from "@/components/EmojiPicker";
import { EmojiDisplay } from "@/components/EmojiDisplay";
import EmbedColorPicker from "@/components/EmbedColorPicker";
import { InlineToolbarField } from "@/components/greetings/FieldToolbar";
import { useDirtyState } from "@/components/DirtyStateProvider";
import { cn } from "@/lib/utils";

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface Role {
  id: string;
  name: string;
  color: number;
}

interface Member {
  id: string;
  username: string;
  nickname?: string;
}

interface TournamentConfig {
  guildId: string;
  enabled: boolean;
  channelId?: string | null;
  messageTemplate: string;
  cronSchedule: string;
  reactionEmoji: string;
  messageMode: "embed" | "text";
  embedColor: string;
  titleText: string;
  footerText: string;
  participantRoleId?: string | null;
  organizerRoleId?: string | null;
  organizerUserIds: string[];
  voiceChannelId?: string | null;
}

const TOURNAMENT_VARIABLES = [
  { name: "Rola uczestników", display: "Rola uczestników", value: "{roleMention}", description: "Wzmianka roli uczestników turnieju" },
  { name: "Rola organizatorów", display: "Rola organizatorów", value: "{organizerRoleMention}", description: "Wzmianka roli organizatorów" },
  { name: "Pingi organizatorów", display: "Pingi organizatorów", value: "{organizerUserPings}", description: "Pingi do użytkowników organizatorów" },
  { name: "Kanał głosowy", display: "Kanał głosowy", value: "{voiceChannelLink}", description: "Link do kanału głosowego turnieju" },
];

interface GuildIds {
  tournamentParticipantsRoleId: string;
  tournamentOrganizerRoleId: string;
  organizerUserIds: string[];
  voiceChannelId: string;
}

const DAY_OPTIONS: { value: string; short: string }[] = [
  { value: "1", short: "PN" },
  { value: "2", short: "WT" },
  { value: "3", short: "ŚR" },
  { value: "4", short: "CZ" },
  { value: "5", short: "PT" },
  { value: "6", short: "SB" },
  { value: "0", short: "ND" },
];

const DAY_NAMES: Record<string, string> = {
  "0": "Niedziela", "1": "Poniedziałek", "2": "Wtorek", "3": "Środa",
  "4": "Czwartek", "5": "Piątek", "6": "Sobota",
};

const DAY_EVERY: Record<string, string> = {
  "0": "każdą niedzielę", "1": "każdy poniedziałek", "2": "każdy wtorek", "3": "każdą środę",
  "4": "każdy czwartek", "5": "każdy piątek", "6": "każdą sobotę",
};

const MONTHS_GENITIVE = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];

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

/** Rozkłada datę na komponenty czasu warszawskiego (odporne na DST) — jak w module Pytanie Dnia. */
function getWarsawParts(date: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });
  return fmt.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
}

/** Najbliższy przyszły termin wysyłki (dany dzień tygodnia + godzina czasu warszawskiego). */
function nextTournamentTime(now: Date, targetDay: number, hour: number, minute: number): Date {
  const parts = getWarsawParts(now);
  const warsawNowAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  const offsetMs = now.getTime() - warsawNowAsUtc;

  const currentWeekday = new Date(warsawNowAsUtc).getUTCDay();
  const dayDiff = (targetDay - currentWeekday + 7) % 7;

  let targetWarsawWallAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day) + dayDiff, hour, minute, 0
  );
  if (targetWarsawWallAsUtc <= warsawNowAsUtc) {
    targetWarsawWallAsUtc += 7 * 24 * 60 * 60 * 1000;
  }
  return new Date(targetWarsawWallAsUtc + offsetMs);
}

function formatDateLabel(date: Date, targetDay: number): string {
  const parts = getWarsawParts(date);
  return `${DAY_NAMES[String(targetDay)]}, ${Number(parts.day)} ${MONTHS_GENITIVE[Number(parts.month) - 1]} • ${parts.hour}:${parts.minute}`;
}

function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days} dni ${hours} godz.`;
}

const pad = (value: string) => value.padStart(2, "0");

export default function TournamentPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { data: session, status } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;
  const { registerDirtyController } = useDirtyState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [guildIds, setGuildIds] = useState<GuildIds | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [organizerSearch, setOrganizerSearch] = useState('');

  const DEFAULT_CONFIG: TournamentConfig = {
    guildId,
    enabled: false,
    channelId: null,
    messageTemplate: '',
    cronSchedule: '25 20 * * 1',
    reactionEmoji: '🎮',
    messageMode: 'text',
    embedColor: '#3b82f6',
    titleText: '🏆 Turniej CS2',
    footerText: '',
    participantRoleId: null,
    organizerRoleId: null,
    organizerUserIds: [],
    voiceChannelId: null,
  };

  const [config, setConfig] = useState<TournamentConfig>(DEFAULT_CONFIG);
  const savedConfigRef = useRef<TournamentConfig>(DEFAULT_CONFIG);

  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [hour, setHour] = useState('20');
  const [minute, setMinute] = useState('25');
  const [editorMode, setEditorMode] = useState<"editor" | "preview">("editor");
  const [draftEmbedColor, setDraftEmbedColor] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const parseCronSchedule = (cronSchedule: string) => {
    const parts = cronSchedule.split(' ');
    if (parts.length === 5) {
      setMinute(parts[0]);
      setHour(parts[1]);
      setDayOfWeek(parts[4]);
    }
  };

  const updateCronSchedule = (day: string, hr: string, min: string) => {
    const cronExpression = `${min} ${hr} * * ${day}`;
    setConfig((prev) => ({ ...prev, cronSchedule: cronExpression }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [configResponse, channelsResponse, rolesResponse, membersResponse, guildIdsResponse] = await Promise.all([
          fetchWithAuth(`/api/guild/${guildId}/tournament/config`),
          fetchWithAuth(`/api/guild/${guildId}/channels`),
          fetchWithAuth(`/api/guild/${guildId}/roles`),
          fetchWithAuth(`/api/discord/guild/${guildId}/members`),
          fetchWithAuth(`/api/guild/${guildId}/tournament/guild-ids`),
        ]);

        if (configResponse.ok) {
          const data = await configResponse.json();
          setConfig(data);
          savedConfigRef.current = data;
          parseCronSchedule(data.cronSchedule);
        }

        if (channelsResponse.ok) {
          const channelsData: Channel[] = await channelsResponse.json();
          setAllChannels(channelsData);
          setChannels(channelsData.filter((ch) => ch.type === 0 || ch.type === 5));
        }

        if (rolesResponse.ok) {
          setRoles(await rolesResponse.json());
        }

        if (membersResponse.ok) {
          setMembers(await membersResponse.json());
        }

        if (guildIdsResponse.ok) {
          setGuildIds(await guildIdsResponse.json());
        }

        setLoading(false);
      } catch (fetchError) {
        console.error('Error loading tournament config:', fetchError);
        setError('Nie udało się załadować konfiguracji turnieju');
        setLoading(false);
      }
    };

    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  const handleSave = useCallback(async () => {
    if (!config.messageTemplate || !config.channelId) {
      toast.error('Uzupełnij szablon wiadomości i kanał docelowy');
      return;
    }
    try {
      setSaving(true);

      const response = await fetchWithAuth(`/api/guild/${guildId}/tournament/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: config.enabled,
          channelId: config.channelId,
          messageTemplate: config.messageTemplate,
          cronSchedule: config.cronSchedule,
          reactionEmoji: config.reactionEmoji,
          messageMode: config.messageMode,
          embedColor: config.embedColor,
          titleText: config.titleText,
          footerText: config.footerText,
          participantRoleId: config.participantRoleId,
          organizerRoleId: config.organizerRoleId,
          organizerUserIds: config.organizerUserIds,
          voiceChannelId: config.voiceChannelId,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || 'Failed to save tournament config');
      }

      const savedConfig = await response.json();
      const nextConfig: TournamentConfig = {
        guildId,
        enabled: savedConfig.enabled ?? false,
        channelId: savedConfig.channelId || null,
        messageTemplate: savedConfig.messageTemplate || '',
        cronSchedule: savedConfig.cronSchedule || '25 20 * * 1',
        reactionEmoji: savedConfig.reactionEmoji || '🎮',
        messageMode: savedConfig.messageMode === 'embed' ? 'embed' : 'text',
        embedColor: savedConfig.embedColor || '#3b82f6',
        titleText: savedConfig.titleText ?? '🏆 Turniej CS2',
        footerText: savedConfig.footerText ?? '',
        participantRoleId: savedConfig.participantRoleId || null,
        organizerRoleId: savedConfig.organizerRoleId || null,
        organizerUserIds: Array.isArray(savedConfig.organizerUserIds) ? savedConfig.organizerUserIds : [],
        voiceChannelId: savedConfig.voiceChannelId || null,
      };
      setConfig(nextConfig);
      savedConfigRef.current = nextConfig;
      toast.success('Konfiguracja turnieju została zapisana!');
    } catch (saveError) {
      console.error('Error saving tournament config:', saveError);
      toast.error('Nie udało się zapisać konfiguracji turnieju');
    } finally {
      setSaving(false);
    }
  }, [config, guildId]);

  const handleCancel = useCallback(() => {
    setConfig(savedConfigRef.current);
    parseCronSchedule(savedConfigRef.current.cronSchedule);
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(savedConfigRef.current),
    [config]
  );

  useEffect(() => registerDirtyController({
    id: `tournament-${guildId}`,
    isDirty,
    isSaving: saving,
    label: 'Turniej CS2',
    onSave: handleSave,
    onCancel: handleCancel,
  }), [guildId, isDirty, saving, handleSave, handleCancel, registerDirtyController]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  const selectedChannel = channels.find((ch) => ch.id === config.channelId);
  const voiceChannels = useMemo(() => allChannels.filter((ch) => ch.type === 2), [allChannels]);
  const selectedVoiceChannel = voiceChannels.find((ch) => ch.id === config.voiceChannelId);

  const memberLabel = useCallback(
    (m: Member) => m.nickname || m.username,
    []
  );

  const filteredOrganizerMembers = useMemo(() => {
    const q = organizerSearch.trim().toLowerCase();
    const list = q
      ? members.filter((m) => memberLabel(m).toLowerCase().includes(q))
      : members;
    return list.slice(0, 50);
  }, [members, organizerSearch, memberLabel]);

  const toggleOrganizer = (userId: string) => {
    setConfig((c) => ({
      ...c,
      organizerUserIds: c.organizerUserIds.includes(userId)
        ? c.organizerUserIds.filter((id) => id !== userId)
        : [...c.organizerUserIds, userId],
    }));
  };

  const { roleMap, userMap, channelMap } = useMemo(() => {
    const rMap: Record<string, { name: string; color?: string }> = {};
    for (const r of roles) {
      const hex = r.color ? `#${r.color.toString(16).padStart(6, '0')}` : undefined;
      rMap[r.id] = { name: r.name, color: hex === '#000000' ? undefined : hex };
    }
    const uMap: Record<string, string> = {};
    for (const m of members) {
      uMap[m.id] = m.nickname || m.username;
    }
    const cMap: Record<string, string> = {};
    for (const c of channels) {
      cMap[c.id] = c.name;
    }
    return { roleMap: rMap, userMap: uMap, channelMap: cMap };
  }, [roles, members, channels]);

  const applyPreviewVariables = useMemo(() => {
    return (text: string) => {
      const participantRoleId = config.participantRoleId || guildIds?.tournamentParticipantsRoleId;
      const organizerRoleId = config.organizerRoleId || guildIds?.tournamentOrganizerRoleId;
      const organizerUserIds = config.organizerUserIds.length ? config.organizerUserIds : guildIds?.organizerUserIds ?? [];
      const voiceChannelId = config.voiceChannelId || guildIds?.voiceChannelId;

      const roleMention = participantRoleId ? `<@&${participantRoleId}>` : '@Uczestnik turnieju';
      const organizerRoleMention = organizerRoleId ? `<@&${organizerRoleId}>` : '@Organizator turnieju';
      const organizerUserPings = organizerUserIds.length
        ? organizerUserIds.map((id) => `<@${id}>`).join(' ')
        : '@Organizator1 @Organizator2';
      const voiceChannelLink = voiceChannelId
        ? `https://discord.com/channels/${guildId}/${voiceChannelId}`
        : '**kanale głosowym CS2**';

      return text
        .replace(/{roleMention}/g, roleMention)
        .replace(/{organizerRoleMention}/g, organizerRoleMention)
        .replace(/{organizerUserPings}/g, organizerUserPings)
        .replace(/{voiceChannelLink}/g, voiceChannelLink);
    };
  }, [guildIds, guildId, config.participantRoleId, config.organizerRoleId, config.organizerUserIds, config.voiceChannelId]);

  const previewContent = useMemo(
    () => applyPreviewVariables(config.messageTemplate),
    [config.messageTemplate, applyPreviewVariables]
  );
  const previewTitle = useMemo(
    () => applyPreviewVariables(config.titleText),
    [config.titleText, applyPreviewVariables]
  );
  const previewFooter = useMemo(
    () => applyPreviewVariables(config.footerText),
    [config.footerText, applyPreviewVariables]
  );
  const activeEmbedColor = draftEmbedColor || config.embedColor;

  if (status !== 'loading' && (!OWNER_IDS.includes(currentUserId ?? '') || !OWNER_GUILD_IDS.includes(guildId))) {
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
            title="Nie udało się załadować turnieju"
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
        <div className="w-full space-y-5">
          <div className="flex items-start justify-between gap-6 pb-2">
            <div className="space-y-3"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-[420px] max-w-full" /></div>
            <Skeleton className="h-7 w-40 rounded-full" />
          </div>
          <Skeleton className="h-24 w-full rounded-md bg-dark-800" />
          <Skeleton className="h-96 w-full rounded-md bg-dark-800" />
        </div>
      </div>
    );
  }

  const targetDay = Number(dayOfWeek);
  const targetHour = Number(hour) || 0;
  const targetMinute = Number(minute) || 0;
  const nextSendAt = nextTournamentTime(now, targetDay, targetHour, targetMinute);
  const countdown = formatCountdown(nextSendAt.getTime() - now.getTime());

  return (
    <div className="min-h-full pb-16">
      <div className="w-full space-y-5">
        <SlideIn direction="up" delay={100}>
          <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold text-white">Turniej CS2</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                Cotygodniowe wiadomości o turnieju CS2 z zapisami przez reakcję.
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
                  aria-label="Włącz lub wyłącz turniej"
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
                Moduł turnieju CS2 jest <span className="font-semibold text-white/80">globalnie wyłączony</span>. Możesz edytować konfigurację, ale bot nie wyśle wiadomości o turnieju, dopóki nie włączysz przełącznika <span className="font-semibold text-white/80">Aktywne</span> u góry i nie zapiszesz konfiguracji.
              </span>
            </div>
          </SlideIn>
        ) : null}

        <SlideIn direction="up" delay={150}>
          <div
            className="relative overflow-hidden rounded-[10px] px-6 py-5"
            style={{ background: "linear-gradient(120deg, #2b2350 0%, #1F2129 55%, #1F2129 100%)", border: "1px solid rgba(99,102,241,0.35)" }}
          >
            <div
              className="pointer-events-none absolute -right-5 -top-5 h-40 w-40 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(236,72,153,0.25), transparent 70%)" }}
            />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#b3a6ff]">Następna wiadomość turniejowa</p>
                <p className="mt-2 text-base font-bold text-white">{formatDateLabel(nextSendAt, targetDay)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: "rgba(34,197,94,0.15)", color: "#86efac" }}
                  >
                    #{selectedChannel?.name ?? "kanał"}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-[#9aa2b8]">
                    reakcja: <EmojiDisplay emoji={config.reactionEmoji || "🎮"} size={14} />
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[26px] font-extrabold leading-none" style={{ color: "#ec4899" }}>{countdown}</p>
                <p className="mt-0.5 text-[11px] text-[#8d94a8]">do wysyłki</p>
              </div>
            </div>
          </div>
        </SlideIn>

        <SlideIn direction="up" delay={200}>
          <div className="space-y-5 rounded-md bg-dark-800 p-5">
            {/* Harmonogram wysyłki */}
            <div className="space-y-2">
              <label className={labelClass}>
                Harmonogram wysyłki <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_OPTIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => { setDayOfWeek(d.value); updateCronSchedule(d.value, hour, minute); }}
                    className={cn(
                      "rounded-md py-2.5 text-center text-xs font-semibold transition-colors",
                      dayOfWeek === d.value ? "bg-[#6366f1] text-white" : "bg-dark-900 text-[#9aa2b8] hover:text-white"
                    )}
                  >
                    {d.short}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                <div className="flex shrink-0 items-center gap-1.5">
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={hour}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 23)) {
                        setHour(value);
                        if (value !== '') updateCronSchedule(dayOfWeek, value, minute);
                      }
                    }}
                    placeholder="00"
                    className={cn(inputClass, "h-12 w-16 text-center text-lg font-bold")}
                  />
                  <span className="text-lg font-bold text-[#8d94a8]">:</span>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={minute}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 59)) {
                        setMinute(value);
                        if (value !== '') updateCronSchedule(dayOfWeek, hour, value);
                      }
                    }}
                    placeholder="00"
                    className={cn(inputClass, "h-12 w-16 text-center text-lg font-bold")}
                  />
                </div>
                <p className="text-xs leading-5 text-[#9aa2b8]">
                  Wiadomość poleci <span className="font-semibold text-white/90">w {DAY_EVERY[dayOfWeek]} o {pad(hour)}:{pad(minute)}</span>{" "}
                  na kanał <span className="font-semibold text-white/90">#{selectedChannel?.name ?? "—"}</span> z reakcją{" "}
                  <EmojiDisplay emoji={config.reactionEmoji || "🎮"} size={14} />
                </p>
              </div>
            </div>

            {/* Kanał docelowy + Emoji reakcji */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className={labelClass}>
                  Kanał docelowy <span className="text-destructive">*</span>
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
                <p className="text-[11px] text-[#8d94a8]">Kanał, na którym będą wysyłane wiadomości turnieju</p>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Emoji reakcji</label>
                <div className="flex gap-2">
                  <Input
                    value={config.reactionEmoji}
                    onChange={(e) => setConfig((c) => ({ ...c, reactionEmoji: e.target.value }))}
                    placeholder="Lub wpisz własne emoji"
                    maxLength={10}
                    className={cn(inputClass, "flex-1")}
                  />
                  <div className="[&_button]:h-11 [&_button]:flex [&_button]:items-center [&_button]:justify-center">
                    <EmojiPicker
                      onEmojiSelect={(emoji) => setConfig((c) => ({ ...c, reactionEmoji: emoji }))}
                      buttonText={config.reactionEmoji}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-[#8d94a8]">Emoji dodawane jako reakcja do zapisów na turniej</p>
              </div>
            </div>

            {/* Szablon wiadomości: tryb Embed/Tekst + edytor zintegrowany z podglądem */}
            <div className="space-y-3">
              <label className={labelClass}>
                Szablon wiadomości <span className="text-destructive">*</span>
              </label>

              <div className="grid w-full max-w-[432px] grid-cols-2 gap-2 rounded-md bg-dark-900 p-1">
                <button
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, messageMode: "embed" }))}
                  className={cn(
                    "h-9 rounded-md px-3 text-xs font-semibold transition-colors",
                    config.messageMode === "embed"
                      ? "bg-[#3b82f6] text-white"
                      : "bg-dark-900 text-[#9aa2b8] hover:bg-dark-700 hover:text-white"
                  )}
                >
                  Embed
                </button>
                <button
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, messageMode: "text" }))}
                  className={cn(
                    "h-9 rounded-md px-3 text-xs font-semibold transition-colors",
                    config.messageMode === "text"
                      ? "bg-[#3b82f6] text-white"
                      : "bg-dark-900 text-[#9aa2b8] hover:bg-dark-700 hover:text-white"
                  )}
                >
                  Tekst
                </button>
              </div>

              <div className="w-full max-w-[880px]">
                <div className="flex items-start gap-3">
                  <div className="flex w-10 shrink-0 flex-col items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/deezy.png" alt="Deezy" className="h-10 w-10 rounded-full object-cover" />
                    {config.messageMode === "embed" ? (
                      <EmbedColorPicker
                        value={config.embedColor}
                        onPreviewChange={setDraftEmbedColor}
                        onChange={(color) => {
                          setConfig((c) => ({ ...c, embedColor: color }));
                          setDraftEmbedColor(null);
                        }}
                      />
                    ) : null}
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

                  <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 w-full sm:w-[508px] sm:flex-none">
                      {editorMode === "preview" ? (
                        <>
                          <div className="flex min-h-10 flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-white">Deezy</span>
                            <span className="rounded bg-[#5865f2] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">BOT</span>
                            <span className="text-xs text-[#8d94a8]">dziś</span>
                          </div>

                          <div className="mt-2 overflow-hidden rounded-md border border-[#2f3341]">
                            <DiscordMessagePreview
                              content={previewContent}
                              avatarUrl="/deezy.png"
                              roles={roleMap}
                              users={userMap}
                              channels={channelMap}
                              roundBottom={false}
                              compact
                              bordered={false}
                              embed={
                                config.messageMode === "embed"
                                  ? { color: activeEmbedColor, title: previewTitle, footer: previewFooter }
                                  : undefined
                              }
                            />
                            <div className="flex flex-wrap gap-1 bg-[#313338] pb-3 pl-16 pr-4 pt-0.5">
                              <span
                                className="flex items-center gap-1.5 px-1.5 py-1 text-xs text-[#c4cad8]"
                                style={{
                                  backgroundColor: "rgba(255,255,255,0.06)",
                                  border: "1px solid transparent",
                                  borderRadius: "0.5rem",
                                }}
                              >
                                <EmojiDisplay emoji={config.reactionEmoji || "🎮"} size={14} />
                                <span>1</span>
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex min-h-10 flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-white">Deezy</span>
                            <span className="rounded bg-[#5865f2] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">BOT</span>
                            <span className="text-xs text-[#8d94a8]">dziś</span>
                          </div>

                          {config.messageMode === "embed" ? (
                            <div className="relative mt-2 w-full max-w-full overflow-hidden rounded-md bg-dark-900 shadow-[0_10px_30px_rgba(6,8,14,0.35)]">
                              <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: activeEmbedColor }} />
                              <div className="space-y-2 p-3 pl-5">
                                <InlineToolbarField
                                  value={config.titleText}
                                  onChange={(next) => setConfig((c) => ({ ...c, titleText: next }))}
                                  placeholder="Tytuł embeda"
                                  variables={TOURNAMENT_VARIABLES}
                                  inputClassName="rounded-md border border-[#3f4455] bg-dark-800 pl-2.5 py-1.5 text-sm font-semibold text-white outline-none transition-colors placeholder:text-[#8d94a8] hover:border-[#3b82f6]/70 focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/30 focus:ring-offset-0"
                                />
                                <VariableInserter
                                  value={config.messageTemplate}
                                  onChange={(value) => setConfig((c) => ({ ...c, messageTemplate: value }))}
                                  variables={TOURNAMENT_VARIABLES}
                                  placeholder="Wpisz treść wiadomości turnieju..."
                                  rows={6}
                                  unstyled
                                  className="rounded-md border border-[#3f4455] bg-dark-800 text-sm leading-6 text-[#d8dbe6] transition-colors hover:border-[#3b82f6]/70 focus:border-[#3b82f6] font-mono"
                                />
                                <InlineToolbarField
                                  value={config.footerText}
                                  onChange={(next) => setConfig((c) => ({ ...c, footerText: next }))}
                                  placeholder="Footer (opcjonalnie)"
                                  variables={TOURNAMENT_VARIABLES}
                                  containerClassName="mt-1"
                                  inputClassName="rounded-md border border-[#3f4455] bg-dark-800 pl-2.5 py-1.5 text-xs text-[#c4cad8] outline-none transition-colors placeholder:text-[#8d94a8] hover:border-[#3b82f6]/70 focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/30 focus:ring-offset-0"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2">
                              <VariableInserter
                                value={config.messageTemplate}
                                onChange={(value) => setConfig((c) => ({ ...c, messageTemplate: value }))}
                                variables={TOURNAMENT_VARIABLES}
                                placeholder="Wpisz treść wiadomości turnieju..."
                                rows={8}
                                unstyled
                                className="rounded-md border border-[#3f4455] bg-dark-900 text-sm leading-6 text-[#d8dbe6] transition-colors hover:border-[#3b82f6]/70 focus:border-[#3b82f6] font-mono"
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Konfiguracja zmiennych — zawsze widoczna po prawej, niezależnie od trybu edytor/podgląd */}
                    <div className="w-full shrink-0 space-y-3 rounded-md border border-[#2f3341] bg-dark-900 p-3 sm:w-[260px]">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8d94a8]">Konfiguracja zmiennych</p>

                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#c4cad8]">
                          <Users className="h-3.5 w-3.5 text-[#8d94a8]" /> Rola uczestników
                        </label>
                        <Select
                          value={config.participantRoleId || ""}
                          onValueChange={(value) => setConfig((c) => ({ ...c, participantRoleId: value }))}
                        >
                          <SelectTrigger className="h-9 border border-[#3f4455] bg-dark-800 text-xs text-white/90 focus:ring-[#3b82f6]/30 focus:ring-offset-0">
                            <SelectValue placeholder="Wybierz rolę..." />
                          </SelectTrigger>
                          <SelectContent className="border-[#2f3341] bg-dark-900">
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                <span className="flex items-center gap-2">
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full border border-white/20"
                                    style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#99a1af" }}
                                  />
                                  {role.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="font-mono text-[10px] text-[#6f7690]">{"{roleMention}"}</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#c4cad8]">
                          <Shield className="h-3.5 w-3.5 text-[#8d94a8]" /> Rola organizatorów
                        </label>
                        <Select
                          value={config.organizerRoleId || ""}
                          onValueChange={(value) => setConfig((c) => ({ ...c, organizerRoleId: value }))}
                        >
                          <SelectTrigger className="h-9 border border-[#3f4455] bg-dark-800 text-xs text-white/90 focus:ring-[#3b82f6]/30 focus:ring-offset-0">
                            <SelectValue placeholder="Wybierz rolę..." />
                          </SelectTrigger>
                          <SelectContent className="border-[#2f3341] bg-dark-900">
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                <span className="flex items-center gap-2">
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full border border-white/20"
                                    style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#99a1af" }}
                                  />
                                  {role.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="font-mono text-[10px] text-[#6f7690]">{"{organizerRoleMention}"}</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#c4cad8]">
                          <Mic className="h-3.5 w-3.5 text-[#8d94a8]" /> Kanał głosowy
                        </label>
                        <Select
                          value={config.voiceChannelId || ""}
                          onValueChange={(value) => setConfig((c) => ({ ...c, voiceChannelId: value }))}
                        >
                          <SelectTrigger className="h-9 border border-[#3f4455] bg-dark-800 text-xs text-white/90 focus:ring-[#3b82f6]/30 focus:ring-offset-0">
                            <SelectValue placeholder="Wybierz kanał...">
                              {config.voiceChannelId ? selectedVoiceChannel?.name ?? "Wybierz kanał..." : null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="border-[#2f3341] bg-dark-900">
                            {voiceChannels.map((ch) => (
                              <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="font-mono text-[10px] text-[#6f7690]">{"{voiceChannelLink}"}</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#c4cad8]">
                          <AtSign className="h-3.5 w-3.5 text-[#8d94a8]" /> Organizatorzy (pingi)
                        </label>
                        {config.organizerUserIds.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {config.organizerUserIds.map((id) => {
                              const m = members.find((mm) => mm.id === id);
                              return (
                                <span key={id} className="flex items-center gap-1 rounded-full bg-dark-800 px-2 py-0.5 text-[10px] text-white/80">
                                  {m ? memberLabel(m) : id}
                                  <button type="button" onClick={() => toggleOrganizer(id)} className="text-[#8d94a8] hover:text-white">
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        ) : null}
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8d94a8]" />
                          <Input
                            value={organizerSearch}
                            onChange={(e) => setOrganizerSearch(e.target.value)}
                            placeholder="Szukaj użytkownika..."
                            className="h-9 border border-[#3f4455] bg-dark-800 pl-8 text-xs text-white/90 placeholder:text-[#8d94a8] focus-visible:border-[#3b82f6] focus-visible:ring-[#3b82f6]/30 focus-visible:ring-offset-0"
                          />
                        </div>
                        <div className="max-h-36 space-y-0.5 overflow-y-auto rounded-md border border-[#2f3341] bg-dark-800 p-1">
                          {filteredOrganizerMembers.length === 0 ? (
                            <p className="px-2 py-3 text-center text-[11px] text-[#8d94a8]">Brak wyników</p>
                          ) : (
                            filteredOrganizerMembers.map((m) => {
                              const checked = config.organizerUserIds.includes(m.id);
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => toggleOrganizer(m.id)}
                                  className={cn(
                                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
                                    checked ? "bg-[#3b82f6]/15 text-white" : "text-[#c4cad8] hover:bg-dark-700"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
                                      checked ? "border-[#3b82f6] bg-[#3b82f6]" : "border-[#4a5064]"
                                    )}
                                  >
                                    {checked ? <span className="h-1.5 w-1.5 rounded-[1px] bg-white" /> : null}
                                  </span>
                                  <span className="min-w-0 truncate">{memberLabel(m)}</span>
                                </button>
                              );
                            })
                          )}
                        </div>
                        <p className="font-mono text-[10px] text-[#6f7690]">{"{organizerUserPings}"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#6f7690]">
                Wiadomość wspiera markdown Discord (pogrubienie **tekst**, nagłówki ###). Kliknij ikonę oka, aby zobaczyć podgląd na żywo.
              </p>
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
