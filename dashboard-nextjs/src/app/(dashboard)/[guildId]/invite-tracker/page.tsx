"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { fetchGuildData } from "@/lib/cache";
import { toSortedDiscordChannels } from "@/lib/discordOrdering";
import { useDirtyState } from "@/components/DirtyStateProvider";
import VariableInserter from "@/components/VariableInserter";
import { DiscordMessagePreview } from "@/components/DiscordMessagePreview";
import EmbedColorPicker from "@/components/EmbedColorPicker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  EyeOff, LogIn, LogOut, RotateCcw, Eraser, TriangleAlert,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────── */

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface JoinMessages {
  normal: string;
  selfInvite: string;
  unknown: string;
  vanity: string;
  botAdd: string;
  [key: string]: string;
}

interface LeaveMessages {
  normal: string;
  unknown: string;
  vanity: string;
  botRemove: string;
  [key: string]: string;
}

interface SectionState<M> {
  enabled: boolean;
  logChannelId: string;
  embed: boolean;
  embedColor: string;
  messages: M;
}

interface ConfigState {
  enabled: boolean;
  join: SectionState<JoinMessages>;
  leave: SectionState<LeaveMessages>;
}

interface SituationDef {
  id: string;
  label: string;
  hint: string;
  accent: string;
  embedTitle: string;
  defaultTemplate: string;
  fill: Record<string, string>;
}

/* ── Sytuacje: 1:1 z prototypu i src/services/inviteTrackerService.ts (bot) ── */

const JOIN_SITUATIONS: SituationDef[] = [
  {
    id: "normal", label: "Normalne dołączenie", accent: "#22c55e", embedTitle: "🎉 Nowy członek",
    hint: "Kiedy użytkownik jest zaproszony przez kogoś innego.",
    defaultTemplate: "**{memberMention}** został zaproszony przez **{inviterName}**, który/a ma teraz **{inviteCount} zaproszeń**!",
    fill: { memberMention: "@Krimi_ung", memberName: "Krimi_ung", inviterName: "natix08328", inviteCount: "2", inviteCode: "deezy-vip" },
  },
  {
    id: "selfInvite", label: "Sam się zaprosił", accent: "#38bdf8", embedTitle: "🔗 Samo-zaproszenie",
    hint: "Kiedy użytkownik sam się zaprosił na Twój serwer.",
    defaultTemplate: "**{memberName}** zaprosił się sam.",
    fill: { memberMention: "@wiktoria_44", memberName: "wiktoria_44", inviterName: "wiktoria_44", inviteCount: "1", inviteCode: "gz-self" },
  },
  {
    id: "unknown", label: "Nieznany autor zaproszenia", accent: "#f59e0b", embedTitle: "❓ Nieznane źródło",
    hint: "Kiedy użytkownik dołącza, ale nie da się ustalić, kto go zaprosił.",
    defaultTemplate: "Nie jestem w stanie powiedzieć, kto zaprosił **{memberName}**. Możliwe, że to zaproszenie tymczasowe.",
    fill: { memberMention: "@santiagodongrandebarriga", memberName: "santiagodongrandebarriga", inviterName: "nieznany", inviteCount: "0", inviteCode: "—" },
  },
  {
    id: "vanity", label: "Niestandardowe zaproszenie", accent: "#a970ff", embedTitle: "✨ Niestandardowe zaproszenie",
    hint: "Gdy użytkownik jest zaproszony za pomocą zaproszenia niestandardowego.",
    defaultTemplate: "**{memberName}** dołączył używając niestandardowego zaproszenia **{inviteCode}**.",
    fill: { memberMention: "@verona07491_48298", memberName: "verona07491_48298", inviterName: "niestandardowe zaproszenie", inviteCount: "0", inviteCode: "gamezone-881293681783623680" },
  },
  {
    id: "botAdd", label: "Dodanie bota", accent: "#5865F2", embedTitle: "🤖 Dodano bota",
    hint: "Kiedy ktoś dodaje bota na serwer.",
    defaultTemplate: "**{memberMention}** 🤖 został właśnie dodany na ten serwer przez **{inviterName}**",
    fill: { memberMention: "@MusicBot", memberName: "MusicBot", inviterName: "natix08328", inviteCount: "2", inviteCode: "—" },
  },
];

const LEAVE_SITUATIONS: SituationDef[] = [
  {
    id: "normal", label: "Normalne opuszczenie", accent: "#ef4444", embedTitle: "😢 Ktoś nas opuścił",
    hint: "Kiedy użytkownik opuścił serwer i był zaproszony przez kogoś innego.",
    defaultTemplate: "**{memberName}** opuścił serwer. Zaprosił go **{inviterName}**.",
    fill: { memberMention: "@malpinho", memberName: "malpinho", inviterName: "DISBOARD", inviteCount: "388", inviteCode: "disboard" },
  },
  {
    id: "unknown", label: "Nieznany autor zaproszenia", accent: "#f59e0b", embedTitle: "❓ Odszedł — nieznane źródło",
    hint: "Kiedy użytkownik opuścił serwer, a nie wiadomo, kto go zaprosił.",
    defaultTemplate: "**{memberName}** opuścił serwer, ale nie wiem, kto go zaprosił.",
    fill: { memberMention: "@dominik0912", memberName: "dominik0912", inviterName: "nieznany", inviteCount: "0", inviteCode: "—" },
  },
  {
    id: "vanity", label: "Niestandardowe zaproszenie", accent: "#a970ff", embedTitle: "✨ Odszedł — niestandardowe",
    hint: "Kiedy użytkownik wszedł przez zaproszenie niestandardowe i opuścił serwer.",
    defaultTemplate: "**{memberName}** opuścił serwer. Dołączył używając niestandardowego zaproszenia **{inviteCode}**.",
    fill: { memberMention: "@verona07491_48298", memberName: "verona07491_48298", inviterName: "niestandardowe zaproszenie", inviteCount: "0", inviteCode: "gamezone-881293681783623680" },
  },
  {
    id: "botRemove", label: "Usunięcie bota", accent: "#5865F2", embedTitle: "🤖 Usunięto bota",
    hint: "Kiedy ktoś usuwa bota z serwera.",
    defaultTemplate: "**{memberName}** 🤖 został usunięty z serwera.",
    fill: { memberMention: "@MusicBot", memberName: "MusicBot", inviterName: "natix08328", inviteCount: "2", inviteCode: "—" },
  },
];

const VARIABLES = [
  { name: "Użytkownik", display: "Użytkownik", value: "{memberMention}", description: "Wzmianka użytkownika" },
  { name: "Nazwa użytkownika", display: "Nazwa użytkownika", value: "{memberName}", description: "Nazwa użytkownika (bez wzmianki)" },
  { name: "Zapraszający", display: "Zapraszający", value: "{inviterName}", description: "Nazwa zapraszającego" },
  { name: "Liczba zaproszeń", display: "Liczba zaproszeń", value: "{inviteCount}", description: "Liczba zaproszeń zapraszającego" },
  { name: "Kod zaproszenia", display: "Kod zaproszenia", value: "{inviteCode}", description: "Kod użytego zaproszenia" },
];

function prefillMessages(situations: SituationDef[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const s of situations) result[s.id] = s.defaultTemplate;
  return result;
}

const EMPTY_CONFIG: ConfigState = {
  enabled: false,
  join: { enabled: true, logChannelId: "", embed: false, embedColor: "", messages: prefillMessages(JOIN_SITUATIONS) as JoinMessages },
  leave: { enabled: true, logChannelId: "", embed: false, embedColor: "", messages: prefillMessages(LEAVE_SITUATIONS) as LeaveMessages },
};

/* ── Helpers ───────────────────────────────────────────────────── */

/** Pole jest "zmienione" tylko gdy ma treść RÓŻNĄ od domyślnego szablonu — puste pole
 * (świadomie wyczyszczone) i pole zawierające dosłownie domyślny tekst NIE liczą się jako custom. */
function isCustomized(value: string, defaultTemplate: string): boolean {
  const v = (value || "").trim();
  return v !== "" && v !== defaultTemplate.trim();
}

function fillOrDefault(value: string | undefined, situations: SituationDef[], id: string): string {
  if (value) return value;
  return situations.find((s) => s.id === id)?.defaultTemplate ?? "";
}

/** Owija podstawioną wartość zmiennej w sentinel, żeby DiscordMessagePreview
 * wyrenderował ją jako wzmiankę (patrz nowa reguła w DiscordMessagePreview.tsx). */
function mention(value: string): string {
  return `${value}`;
}

function resolvePreviewText(template: string, fill: Record<string, string>): string {
  // Na realnym Discordzie tylko {memberMention} jest prawdziwą wzmianką (<@id>) — memberName,
  // inviterName, inviteCount i inviteCode to zwykły tekst (patrz src/services/inviteTrackerService.ts).
  return template
    .replace(/\{memberMention\}/g, mention(fill.memberMention))
    .replace(/\{memberName\}/g, fill.memberName)
    .replace(/\{inviterName\}/g, fill.inviterName)
    .replace(/\{inviteCount\}/g, fill.inviteCount)
    .replace(/\{inviteCode\}/g, fill.inviteCode);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromApi(data: any): ConfigState {
  return {
    enabled: data?.enabled ?? false,
    join: {
      enabled: data?.join?.enabled ?? true,
      logChannelId: data?.join?.logChannelId || "",
      embed: data?.join?.embed ?? false,
      embedColor: data?.join?.embedColor || "",
      messages: {
        normal: fillOrDefault(data?.join?.messages?.normal, JOIN_SITUATIONS, "normal"),
        selfInvite: fillOrDefault(data?.join?.messages?.selfInvite, JOIN_SITUATIONS, "selfInvite"),
        unknown: fillOrDefault(data?.join?.messages?.unknown, JOIN_SITUATIONS, "unknown"),
        vanity: fillOrDefault(data?.join?.messages?.vanity, JOIN_SITUATIONS, "vanity"),
        botAdd: fillOrDefault(data?.join?.messages?.botAdd, JOIN_SITUATIONS, "botAdd"),
      },
    },
    leave: {
      enabled: data?.leave?.enabled ?? true,
      logChannelId: data?.leave?.logChannelId || "",
      embed: data?.leave?.embed ?? false,
      embedColor: data?.leave?.embedColor || "",
      messages: {
        normal: fillOrDefault(data?.leave?.messages?.normal, LEAVE_SITUATIONS, "normal"),
        unknown: fillOrDefault(data?.leave?.messages?.unknown, LEAVE_SITUATIONS, "unknown"),
        vanity: fillOrDefault(data?.leave?.messages?.vanity, LEAVE_SITUATIONS, "vanity"),
        botRemove: fillOrDefault(data?.leave?.messages?.botRemove, LEAVE_SITUATIONS, "botRemove"),
      },
    },
  };
}

const DEFAULT_JOIN_CHANNEL_NAME = "lobby-info-serwer";

/* ── Styled primitives ────────────────────────────────────────── */

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

function SectionSwitch({ className, ...props }: React.ComponentProps<typeof Switch>) {
  return (
    <Switch
      className={cn(
        "h-[22px] w-10 border-0 bg-[#636a80] shadow-none data-[state=checked]:bg-[#3b82f6] data-[state=unchecked]:bg-[#636a80] [&>span]:h-3.5 [&>span]:w-3.5 [&>span]:translate-x-1 [&>span]:bg-white [&>span]:shadow-none [&>span]:data-[state=checked]:translate-x-[22px] [&>span]:data-[state=unchecked]:translate-x-1",
        className
      )}
      {...props}
    />
  );
}

function EmbedSwitch({ className, ...props }: React.ComponentProps<typeof Switch>) {
  return (
    <Switch
      className={cn(
        "h-[19px] w-[34px] border-0 bg-[#636a80] shadow-none data-[state=checked]:bg-[#3b82f6] data-[state=unchecked]:bg-[#636a80] [&>span]:h-[13px] [&>span]:w-[13px] [&>span]:translate-x-[3px] [&>span]:bg-white [&>span]:shadow-none [&>span]:data-[state=checked]:translate-x-[18px] [&>span]:data-[state=unchecked]:translate-x-[3px]",
        className
      )}
      {...props}
    />
  );
}

/* ── Component ─────────────────────────────────────────────────── */

export default function InviteTrackerPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { registerDirtyController } = useDirtyState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [config, setConfig] = useState<ConfigState>(EMPTY_CONFIG);
  const [channelErrors, setChannelErrors] = useState<{ join: boolean; leave: boolean }>({ join: false, leave: false });
  const [activeTab, setActiveTab] = useState<{ join: string; leave: string }>({ join: "normal", leave: "normal" });
  const savedRef = useRef<ConfigState>(EMPTY_CONFIG);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [channelsData, configRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, "channels", `/api/guild/${guildId}/channels`),
          fetchWithAuth(`/api/guild/${guildId}/invite-tracker/config`),
        ]);

        let textChannels: Channel[] = [];
        if (channelsData) {
          const sorted = toSortedDiscordChannels(channelsData) as Channel[];
          textChannels = sorted.filter((ch) => ch.type === 0 || ch.type === 5);
          setChannels(textChannels);
        }

        if (configRes.ok) {
          const data = await configRes.json();
          const next = fromApi(data);

          // Domyślny kanał dla dołączeń, jeśli nikt jeszcze nic nie wybrał.
          if (!next.join.logChannelId) {
            const defaultChannel = textChannels.find((ch) => ch.name === DEFAULT_JOIN_CHANNEL_NAME);
            if (defaultChannel) next.join.logChannelId = defaultChannel.id;
          }

          setConfig(next);
          savedRef.current = next;
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

  const handleSave = useCallback(async () => {
    const errs = {
      join: config.join.enabled && !config.join.logChannelId,
      leave: config.leave.enabled && !config.leave.logChannelId,
    };
    if (errs.join || errs.leave) {
      setChannelErrors(errs);
      toast.error(errs.join ? "Wybierz kanał dla wiadomości o dołączeniu na serwer" : "Wybierz kanał dla wiadomości o opuszczeniu serwera");
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/invite-tracker/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        const data = await res.json();
        const next = fromApi(data);
        setConfig(next);
        savedRef.current = next;
        toast.success("Konfiguracja Invite Trackera została zapisana!");
      } else {
        toast.error("Nie udało się zapisać konfiguracji.");
      }
    } catch {
      toast.error("Wystąpił błąd podczas zapisywania.");
    } finally {
      setSaving(false);
    }
  }, [config, guildId]);

  const handleCancel = useCallback(() => {
    setConfig(savedRef.current);
    setChannelErrors({ join: false, leave: false });
  }, []);

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedRef.current);

  useEffect(() => {
    return registerDirtyController({
      id: `invite-tracker-${guildId}`,
      isDirty,
      isSaving: saving,
      label: "Invite Tracker",
      onSave: handleSave,
      onCancel: handleCancel,
    });
  }, [guildId, isDirty, saving, handleSave, handleCancel, registerDirtyController]);

  if (error) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <ErrorState title="Błąd ładowania" message={error} onRetry={() => window.location.reload()} />
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
          <Skeleton className="h-40 w-full rounded-md bg-dark-800" />
          <Skeleton className="h-40 w-full rounded-md bg-dark-800" />
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
              <h1 className="text-2xl font-semibold text-white">Invite Tracker</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                Dwie osobne sekcje — dołączenie i opuszczenie, każda z własnym kanałem, przełącznikiem i podglądem.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <span>{config.enabled ? "Aktywne" : "Nieaktywne"}</span>
              <DeezySwitch checked={config.enabled} onCheckedChange={(checked) => setConfig((c) => ({ ...c, enabled: checked }))} aria-label="Włącz lub wyłącz Invite Tracker" />
            </div>
          </header>
        </SlideIn>

        {!config.enabled ? (
          <SlideIn direction="up" delay={130}>
            <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-dark-900 px-4 py-3 text-xs text-[#9aa2b8]">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Śledzenie zaproszeń jest <span className="font-semibold text-white/80">wyłączone</span>. Możesz edytować szablony i zapisać ustawienia, ale bot nie wyśle logów, dopóki nie włączysz przełącznika <span className="font-semibold text-white/80">Aktywne</span> u góry.
              </span>
            </div>
          </SlideIn>
        ) : null}

        <SlideIn direction="up" delay={150}>
          <InviteSection
            sectionKey="join"
            icon={<LogIn className="h-[17px] w-[17px]" />}
            title="Dołączenie na serwer"
            offLoc="dołączeniu na serwer"
            situations={JOIN_SITUATIONS}
            channels={channels}
            state={config.join}
            activeSituationId={activeTab.join}
            channelError={channelErrors.join}
            onSelectTab={(id) => setActiveTab((t) => ({ ...t, join: id }))}
            onToggleSection={(enabled) => setConfig((c) => ({ ...c, join: { ...c.join, enabled } }))}
            onChannelChange={(id) => { setConfig((c) => ({ ...c, join: { ...c.join, logChannelId: id } })); setChannelErrors((e) => ({ ...e, join: false })); }}
            onTextChange={(id, text) => setConfig((c) => ({ ...c, join: { ...c.join, messages: { ...c.join.messages, [id]: text } } }))}
            onReset={(id, template) => { setConfig((c) => ({ ...c, join: { ...c.join, messages: { ...c.join.messages, [id]: template } } })); toast.success("Przywrócono domyślną treść"); }}
            onClear={(id) => { setConfig((c) => ({ ...c, join: { ...c.join, messages: { ...c.join.messages, [id]: "" } } })); toast.success("Wyczyszczono — bot użyje treści domyślnej"); }}
            onToggleEmbed={(embed) => setConfig((c) => ({ ...c, join: { ...c.join, embed } }))}
            onEmbedColorChange={(color) => setConfig((c) => ({ ...c, join: { ...c.join, embedColor: color } }))}
          />
        </SlideIn>

        <SlideIn direction="up" delay={170}>
          <InviteSection
            sectionKey="leave"
            icon={<LogOut className="h-[17px] w-[17px]" />}
            title="Opuszczenie serwera"
            offLoc="opuszczeniu serwera"
            situations={LEAVE_SITUATIONS}
            channels={channels}
            state={config.leave}
            activeSituationId={activeTab.leave}
            channelError={channelErrors.leave}
            onSelectTab={(id) => setActiveTab((t) => ({ ...t, leave: id }))}
            onToggleSection={(enabled) => setConfig((c) => ({ ...c, leave: { ...c.leave, enabled } }))}
            onChannelChange={(id) => { setConfig((c) => ({ ...c, leave: { ...c.leave, logChannelId: id } })); setChannelErrors((e) => ({ ...e, leave: false })); }}
            onTextChange={(id, text) => setConfig((c) => ({ ...c, leave: { ...c.leave, messages: { ...c.leave.messages, [id]: text } } }))}
            onReset={(id, template) => { setConfig((c) => ({ ...c, leave: { ...c.leave, messages: { ...c.leave.messages, [id]: template } } })); toast.success("Przywrócono domyślną treść"); }}
            onClear={(id) => { setConfig((c) => ({ ...c, leave: { ...c.leave, messages: { ...c.leave.messages, [id]: "" } } })); toast.success("Wyczyszczono — bot użyje treści domyślnej"); }}
            onToggleEmbed={(embed) => setConfig((c) => ({ ...c, leave: { ...c.leave, embed } }))}
            onEmbedColorChange={(color) => setConfig((c) => ({ ...c, leave: { ...c.leave, embedColor: color } }))}
          />
        </SlideIn>
      </div>
    </div>
  );
}

/* ── Sekcja Join/Leave ─────────────────────────────────────────── */

interface InviteSectionProps<M extends Record<string, string>> {
  sectionKey: "join" | "leave";
  icon: React.ReactNode;
  title: string;
  offLoc: string;
  situations: SituationDef[];
  channels: Channel[];
  state: SectionState<M>;
  activeSituationId: string;
  channelError: boolean;
  onSelectTab: (id: string) => void;
  onToggleSection: (enabled: boolean) => void;
  onChannelChange: (channelId: string) => void;
  onTextChange: (id: string, text: string) => void;
  onReset: (id: string, defaultTemplate: string) => void;
  onClear: (id: string) => void;
  onToggleEmbed: (embed: boolean) => void;
  onEmbedColorChange: (color: string) => void;
}

function InviteSection<M extends Record<string, string>>({
  sectionKey, icon, title, offLoc, situations, channels, state, activeSituationId, channelError,
  onSelectTab, onToggleSection, onChannelChange, onTextChange, onReset, onClear, onToggleEmbed, onEmbedColorChange,
}: InviteSectionProps<M>) {
  const live = state.enabled;
  const situation = situations.find((s) => s.id === activeSituationId) ?? situations[0];
  const customCount = situations.filter((s) => isCustomized(state.messages[s.id], s.defaultTemplate)).length;
  const channelName = channels.find((c) => c.id === state.logChannelId)?.name;
  const channelText = channelName ? `# ${channelName}` : "brak kanału";
  const currentText = state.messages[situation.id] || "";
  const usingDefault = !currentText.trim();
  const shownText = usingDefault ? situation.defaultTemplate : currentText;
  const previewText = resolvePreviewText(shownText, situation.fill);
  const iconBg = sectionKey === "leave" ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)";
  const iconColor = sectionKey === "leave" ? "#fca5a5" : "#86efac";

  return (
    <div className="rounded-md bg-dark-800 p-5 shadow-[0_8px_18px_rgba(8,10,16,0.16)]">
      <div className="flex items-center gap-3">
        <span
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
          style={{ background: live ? iconBg : "#23252f", color: live ? iconColor : "#636a80" }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold text-white">{title}</div>
          <div className="mt-0.5 text-xs" style={{ color: live ? "#8d94a8" : "#fcd34d" }}>
            {live ? `${situations.length} sytuacji${customCount ? ` · ${customCount} zmienione` : ""}` : "wyłączone"}
          </div>
        </div>
        <Select value={state.logChannelId || undefined} onValueChange={onChannelChange}>
          <SelectTrigger className={cn("h-[38px] w-[200px] shrink-0 border bg-dark-900 text-xs text-white/90", channelError ? "border-red-500/60" : "border-[#2f3341]")}>
            <SelectValue placeholder="Wybierz kanał..." />
          </SelectTrigger>
          <SelectContent>
            {channels.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                # {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <SectionSwitch checked={live} onCheckedChange={onToggleSection} aria-label="Włącz lub wyłącz sekcję" />
      </div>

      {!live ? (
        <div className="mt-3.5 flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-dark-900 px-3 py-2 text-xs leading-6 text-[#9aa2b8]">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#fcd34d]" />
          <span>
            Wiadomości o <span className="font-semibold text-white/80">{offLoc}</span> są wyłączone — możesz edytować szablony, ale bot ich nie wyśle.
          </span>
        </div>
      ) : null}

      <div className={cn("mt-4", !live && "opacity-55")}>
        <div className="flex flex-wrap gap-1.5">
          {situations.map((s) => {
            const active = s.id === activeSituationId;
            const custom = isCustomized(state.messages[s.id], s.defaultTemplate);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectTab(s.id)}
                className="flex items-center gap-[7px] rounded-full border px-[13px] py-1.5 text-[11px] font-semibold transition-colors hover:border-[#6366f1]"
                style={{
                  borderColor: active ? "#6366f1" : "#2f3341",
                  background: active ? "rgba(99,102,241,0.15)" : "#17181E",
                  color: active ? "#fff" : "#b9c0d0",
                }}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.accent }} />
                {s.label}
                {custom ? <span className="text-[10px] text-[#a5b4fc]">•</span> : null}
              </button>
            );
          })}
        </div>

        {/* Edytor + podgląd — items-stretch, h-full na obu pudełkach, przyciski/uwaga przypięte do dołu (wzór: Urodziny). */}
        <div className="mt-3.5 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          {/* Edytor szablonu */}
          <div className="flex h-full min-w-0 flex-col rounded-md bg-dark-900 px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-bold text-[#d8dbe6]">{situation.label}</span>
              <span className="text-[11px]" style={{ color: currentText.length > 1800 ? "#fcd34d" : "#6b7280" }}>
                {currentText.length}/2000
              </span>
            </div>
            <p className="mt-1 text-xs text-[#8d94a8]">{situation.hint}</p>

            <VariableInserter
              value={currentText}
              onChange={(text) => onTextChange(situation.id, text)}
              variables={VARIABLES}
              rows={3}
              emojiPicker
              unstyled
              className="mt-2.5 rounded-md border border-[#2f3341] bg-dark-900 text-sm leading-6 text-[#d8dbe6] transition-colors focus:border-[#3b82f6]"
              placeholder="Zostaw puste, aby użyć domyślnej treści..."
            />

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
              <button
                type="button"
                onClick={() => onReset(situation.id, situation.defaultTemplate)}
                className="flex h-[30px] items-center gap-1.5 rounded-md border border-[#3a3f4e] bg-transparent px-3 text-[11px] font-semibold text-[#c4cad8] transition-colors hover:bg-dark-800 hover:text-white"
              >
                <RotateCcw className="h-3 w-3" /> Zresetuj wiadomość
              </button>
              <button
                type="button"
                onClick={() => onClear(situation.id)}
                className="flex h-[30px] items-center gap-1.5 rounded-md border border-[#3a3f4e] bg-transparent px-3 text-[11px] font-semibold text-[#c4cad8] transition-colors hover:bg-dark-800 hover:text-white"
              >
                <Eraser className="h-3 w-3" /> Wyczyść
              </button>
              <span className="flex-1" />
              {state.embed ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[#8d94a8]">Kolor embedu</span>
                  <EmbedColorPicker
                    value={state.embedColor || situation.accent}
                    onChange={onEmbedColorChange}
                    className="h-7 w-7"
                  />
                </span>
              ) : null}
              <span className="flex items-center gap-2">
                <EmbedSwitch checked={state.embed} onCheckedChange={onToggleEmbed} aria-label="Wyślij jako embed" />
                <span className="text-[11px] text-[#8d94a8]">Wyślij jako embed</span>
              </span>
            </div>
          </div>

          {/* Podgląd na żywo */}
          <div className="flex h-full min-w-0 flex-col rounded-md bg-dark-900 px-4 py-3.5">
            <div className="mb-2 flex items-center gap-2.5">
              <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: live ? situation.accent : "#4b5563" }} />
                Podgląd na żywo
              </span>
              <span className="flex-1" />
              <span className="text-[11px] text-[#8d94a8]">{channelText}</span>
            </div>

            <DiscordMessagePreview
              content={previewText}
              avatarUrl="/deezy.png"
              compact
              embed={state.embed ? { color: state.embedColor || situation.accent, title: situation.embedTitle } : undefined}
            />

            {!live ? (
              <div className="mt-auto flex items-start gap-1.5 pt-2 text-[11px] leading-6" style={{ color: "#fcd34d" }}>
                <span className="shrink-0">⚠️</span>
                <span>Ta sekcja jest wyłączona — wiadomość nie zostanie wysłana.</span>
              </div>
            ) : usingDefault ? (
              <div className="mt-auto flex items-start gap-1.5 pt-2 text-[11px] leading-6 text-[#6b7280]">
                <span className="shrink-0">ℹ️</span>
                <span>Pole jest puste — bot użyje treści domyślnej pokazanej powyżej.</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
