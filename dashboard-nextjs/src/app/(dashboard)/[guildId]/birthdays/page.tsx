"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Save, Hash, Trash2, Pencil, Cake, ChevronDown, Search, Settings, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchGuildData } from "@/lib/cache";
import { cn } from "@/lib/utils";
import VariableInserter from "@/components/VariableInserter";
import { useDirtyState } from "@/components/DirtyStateProvider";
import { useMessages } from "@/i18n/LanguageProvider";
import { birthdaysMessages } from "@/i18n/messages/birthdays";
import { commonMessages } from "@/i18n/messages/common";
import type { Widen } from "@/i18n/config";

type BirthdaysText = Widen<typeof birthdaysMessages.pl>;
import { DiscordMessagePreview } from "@/components/DiscordMessagePreview";

/** Niewidoczny sentinel otaczający podstawioną wartość zmiennej — DiscordMessagePreview
 * renderuje taki fragment jako wzmiankę (chip), patrz reguła w DiscordMessagePreview.tsx. */
const SENTINEL = "";
function mention(value: string): string {
  return `${SENTINEL}${value}${SENTINEL}`;
}

/** Podstawia {user} przykładową wzmianką do podglądu na żywo. */
function resolveBirthdayPreview(template: string): string {
  return template.replace(/\{user\}/g, mention("@Deezy"));
}

function createBirthdaySchema(t: BirthdaysText) {
  return z.object({
    birthdayChannelId: z.string().min(1, t.pickChannelError),
    roleId: z.string().optional(),
    message: z.string().min(1, t.messageError),
    enabled: z.boolean().default(false),
  });
}

type BirthdayFormData = z.infer<ReturnType<typeof createBirthdaySchema>>;
// zod 4 + @hookform/resolvers 5: formularz trzyma dane wejściowe schematu, a submit dostaje dane po walidacji.
type BirthdayFormInput = z.input<ReturnType<typeof createBirthdaySchema>>;

const DEFAULT_FORM_VALUES: BirthdayFormData = {
  birthdayChannelId: "",
  roleId: "",
  message: "🎉 Wszystkiego najlepszego z okazji urodzin, {user}! 🎂",
  enabled: false,
};

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

interface UserBirthday {
  _id: string;
  userId: string;
  guildId: string;
  date: string;
  yearSpecified?: boolean;
  active?: boolean;
  username?: string;
  discriminator?: string;
  avatar?: string;
}

interface EnrichedBirthday extends UserBirthday {
  daysUntil: number;
}

const inputClass =
  "h-11 border border-[#3f4455] bg-dark-900 text-white/90 placeholder:text-[#9aa2b8] focus-visible:border-[#3b82f6] focus-visible:ring-[#3b82f6]/30 focus-visible:ring-offset-0 data-[placeholder]:text-[#9aa2b8]";
const labelClass = "text-xs font-semibold text-[#c4cad8]";
const iconButtonClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#9aa2b8] transition-colors hover:bg-dark-900 hover:text-white";
const iconButtonDangerClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#9aa2b8] transition-colors hover:bg-red-500/10 hover:text-red-400";

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

interface SettingRowProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}

function SettingRow({ title, description, icon, isOpen = false, onToggle, children }: SettingRowProps) {
  const isExpandable = Boolean(children && onToggle);
  const m = useMessages(commonMessages).module;

  return (
    <section className="overflow-hidden rounded-md bg-dark-800 shadow-[0_8px_18px_rgba(8,10,16,0.16)]">
      {/* Poniżej lg: ciaśniejsze odstępy i zawijanie tekstu — strzałka rozwijania zostawiała na
          telefonie za mało miejsca, więc tytuł i opis były ucinane. Od lg bez zmian. */}
      <div className={cn("flex min-h-[68px] items-center gap-2.5 border border-transparent px-5 py-3 transition-colors lg:gap-4", isOpen && "border-[#2f3341] bg-dark-800")}>
        <button
          type="button"
          onClick={isExpandable ? onToggle : undefined}
          className={cn("flex min-w-0 flex-1 items-center gap-2.5 text-left lg:gap-3", isExpandable ? "cursor-pointer" : "cursor-default")}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-dark-900 text-[#aab2c8]">{icon}</span>
          <span className="min-w-0">
            <span className="block break-words text-sm font-semibold text-white/90 lg:truncate">{title}</span>
            {description ? <span className="mt-1 block break-words text-xs text-[#8d94a8] lg:truncate">{description}</span> : null}
          </span>
        </button>

        {isExpandable ? (
          <button type="button" onClick={onToggle} aria-label={isOpen ? m.collapse : m.expand} className="flex h-8 w-8 items-center justify-center rounded-md text-[#9aa2b8] transition-colors hover:bg-dark-900 hover:text-white">
            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
          </button>
        ) : null}
      </div>

      {isOpen && children ? <div className="border-x border-b border-[#2f3341] bg-dark-800 p-5">{children}</div> : null}
    </section>
  );
}

/** Liczba dni do najbliższego wystąpienia miesiąca/dnia (ignoruje rok). */
function daysUntilBirthday(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const month = date.getMonth();
  const day = date.getDate();
  let next = new Date(today.getFullYear(), month, day);
  if (next < today) next = new Date(today.getFullYear() + 1, month, day);
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

function countdownText(days: number, t: BirthdaysText): string {
  if (days === 0) return t.today;
  return t.days(days);
}

function CountdownBadge({ days }: { days: number }) {
  const t = useMessages(birthdaysMessages);
  if (days === 0 || days === 1) {
    return (
      <span className="shrink-0 rounded-full bg-pink-500/15 px-2 py-0.5 text-[11px] font-semibold text-pink-400">
        {days === 0 ? t.today : t.tomorrow}
      </span>
    );
  }
  return <span className="shrink-0 text-[11px] text-[#8d94a8]">{t.inDays(days)}</span>;
}

export default function BirthdaysPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { registerDirtyController } = useDirtyState();
  const t = useMessages(birthdaysMessages);
  const m = useMessages(commonMessages).module;
  const birthdaySchema = useMemo(() => createBirthdaySchema(t), [t]);
  const MONTHS = t.months.map((label, i) => ({ value: String(i + 1), label }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [birthdays, setBirthdays] = useState<UserBirthday[]>([]);

  const [configOpen, setConfigOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDay, setEditDay] = useState("");
  const [editMonth, setEditMonth] = useState("");
  const [editYear, setEditYear] = useState("");

  const savedValuesRef = useRef<BirthdayFormData>(DEFAULT_FORM_VALUES);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<BirthdayFormInput, unknown, BirthdayFormData>({
    resolver: zodResolver(birthdaySchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const values = watch();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [channelsData, rolesData, birthdaysRes, configRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, 'channels', `/api/discord/guild/${guildId}/channels`),
          fetchGuildData<Role[]>(guildId, 'roles', `/api/discord/guild/${guildId}/roles`),
          fetch(`/api/guild/${guildId}/birthdays/users`),
          fetch(`/api/guild/${guildId}/birthdays`)
        ]);

        setChannels(channelsData.filter((ch: Channel) => ch.type === 0 || ch.type === 5));
        setRoles(rolesData);

        if (birthdaysRes.ok) {
          const birthdaysData = await birthdaysRes.json();
          setBirthdays(birthdaysData);
        }

        if (configRes.ok) {
          const config = await configRes.json();
          if (config && config.birthdayChannelId) {
            const nextValues: BirthdayFormData = {
              birthdayChannelId: config.birthdayChannelId,
              roleId: config.roleId || "",
              message: config.message || DEFAULT_FORM_VALUES.message,
              enabled: config.enabled !== undefined ? config.enabled : false,
            };
            savedValuesRef.current = nextValues;
            reset(nextValues, { keepDirty: false });
          }
        }
      } catch (fetchError) {
        console.error('Error loading birthdays data:', fetchError);
        setError(t.loadError);
        toast.error(m.loadErrorShort);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [guildId, reset]);

  const onSubmit = useCallback(async (data: BirthdayFormData) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/guild/${guildId}/birthdays`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      await response.json();
      savedValuesRef.current = data;
      reset(data, { keepDirty: false });
      toast.success(t.saved);
    } catch (saveError) {
      console.error("Failed to save:", saveError);
      toast.error(m.saveError);
    } finally {
      setSaving(false);
    }
  }, [guildId, reset, t, m]);

  const handleCancel = useCallback(() => {
    reset(savedValuesRef.current, { keepDirty: false });
  }, [reset]);

  const submitFromDirtyBar = useCallback(() => {
    void handleSubmit(onSubmit, () => setConfigOpen(true))();
  }, [handleSubmit, onSubmit]);

  useEffect(() => registerDirtyController({
    id: `birthdays-${guildId}`,
    isDirty,
    isSaving: saving,
    label: t.title,
    onSave: submitFromDirtyBar,
    onCancel: handleCancel,
  }), [guildId, handleCancel, isDirty, registerDirtyController, saving, submitFromDirtyBar, t]);

  const handleEditBirthday = async (userId: string) => {
    const day = parseInt(editDay);
    const month = parseInt(editMonth);
    const year = editYear ? parseInt(editYear) : undefined;

    if (!day || !month || day < 1 || day > 31 || month < 1 || month > 12) {
      toast.error(t.invalidDate);
      return;
    }

    if (year && (year < 1900 || year > new Date().getFullYear())) {
      toast.error(t.invalidYear);
      return;
    }

    try {
      const response = await fetch(`/api/guild/${guildId}/birthdays/users`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, day, month, year }),
      });

      if (!response.ok) {
        throw new Error("Failed to update birthday");
      }

      setBirthdays(birthdays.map(b =>
        b.userId === userId
          ? { ...b, date: new Date(year || 2000, month - 1, day).toISOString(), yearSpecified: !!year }
          : b
      ));
      setEditingId(null);
      setEditDay("");
      setEditMonth("");
      setEditYear("");
      toast.success(t.updated);
    } catch (editError) {
      console.error("Failed to update birthday:", editError);
      toast.error(t.updateError);
    }
  };

  const handleDeleteBirthday = async (userId: string) => {
    if (!confirm(t.confirmDelete)) return;

    try {
      const response = await fetch(`/api/guild/${guildId}/birthdays/users?userId=${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete birthday");
      }

      setBirthdays(birthdays.filter(b => b.userId !== userId));
      toast.success(t.deleted);
    } catch (deleteError) {
      console.error("Failed to delete birthday:", deleteError);
      toast.error(t.deleteError);
    }
  };

  const formatBirthday = (dateString: string, yearSpecified?: boolean) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const monthName = MONTHS.find(m => m.value === month.toString())?.label || month.toString();

    return yearSpecified
      ? `${day} ${monthName} ${year}`
      : `${day} ${monthName}`;
  };

  const getAvatarUrl = (userId: string, avatar?: string) => {
    if (avatar) {
      return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=64`;
    }
    return `https://cdn.discordapp.com/embed/avatars/${parseInt(userId) % 5}.png`;
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
            title={t.loadErrorTitle}
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
            <div className="space-y-3"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-[520px] max-w-full" /></div>
            <div className="flex items-center gap-3"><Skeleton className="h-4 w-12" /><Skeleton className="h-5 w-9 rounded-full" /></div>
          </div>
          <Skeleton className="h-24 w-full rounded-md bg-dark-800" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-20 w-full rounded-md bg-dark-800" />
            <Skeleton className="h-20 w-full rounded-md bg-dark-800" />
          </div>
          <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-[68px] w-full rounded-md bg-dark-800" />)}</div>
        </div>
      </div>
    );
  }

  const enrichedBirthdays: EnrichedBirthday[] = birthdays
    .filter((b) => b.date)
    .map((b) => ({ ...b, daysUntil: daysUntilBirthday(new Date(b.date)) }))
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const nearestBirthday = enrichedBirthdays[0] ?? null;
  const thisMonthCount = birthdays.filter((b) => b.date && new Date(b.date).getMonth() === new Date().getMonth()).length;
  const selectedRole = roles.find((r) => r.id === values.roleId);
  const selectedChannel = channels.find((c) => c.id === values.birthdayChannelId);

  const configSummary = values.birthdayChannelId
    ? `# ${selectedChannel?.name ?? t.unknownChannel}${selectedRole ? ` • 🎂 ${selectedRole.name}` : ""}`
    : t.notConfigured;

  const query = searchQuery.trim().toLowerCase();
  const filteredBirthdays = query
    ? enrichedBirthdays.filter((b) => (b.username || "").toLowerCase().includes(query))
    : enrichedBirthdays;

  const monthGroups: { key: string; label: string; items: EnrichedBirthday[] }[] = [];
  filteredBirthdays.forEach((b) => {
    const monthIndex = new Date(b.date).getMonth();
    const key = String(monthIndex);
    let group = monthGroups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: MONTHS[monthIndex].label, items: [] };
      monthGroups.push(group);
    }
    group.items.push(b);
  });

  return (
    <div className="min-h-full pb-32">
      <div className="w-full space-y-5">
        <SlideIn direction="up" delay={100}>
          <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold text-white">{t.title}</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                {t.subtitle}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <span>{values.enabled ? m.active : m.inactive}</span>
              <DeezySwitch
                checked={values.enabled || false}
                onCheckedChange={(checked) => setValue("enabled", checked, { shouldDirty: true })}
                aria-label={t.toggle}
              />
            </div>
          </header>
        </SlideIn>

        {!values.enabled ? (
          <SlideIn direction="up" delay={130}>
            <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-dark-900 px-4 py-3 text-xs text-[#9aa2b8]">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {t.disabledPrefix}<span className="font-semibold text-white/80">{t.disabledStrong}</span>{t.disabledMiddle}<span className="font-semibold text-white/80">/birthday</span>, <span className="font-semibold text-white/80">/birthdays-next</span>, <span className="font-semibold text-white/80">/birthday-remember</span>{t.and}<span className="font-semibold text-white/80">/birthday-set-user</span>{t.disabledMiddle2}<span className="font-semibold text-white/80">{m.active}</span>{t.disabledSuffix}
              </span>
            </div>
          </SlideIn>
        ) : null}

        {nearestBirthday ? (
          <SlideIn direction="up" delay={150}>
            <div
              className="relative overflow-hidden"
              style={{
                borderRadius: "10px",
                background: "linear-gradient(120deg, #2b2350 0%, #1F2129 55%, #1F2129 100%)",
                border: "1px solid rgba(99,102,241,0.35)",
                padding: "20px 24px",
              }}
            >
              <div
                className="pointer-events-none absolute -right-5 -top-5 h-40 w-40 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(236,72,153,0.25), transparent 70%)" }}
              />
              <div className="relative">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#b3a6ff]">{t.nearest}</p>
                <div className="mt-2.5 flex items-center gap-3.5">
                  <img
                    src={getAvatarUrl(nearestBirthday.userId, nearestBirthday.avatar)}
                    alt={nearestBirthday.username || t.user}
                    className="h-[52px] w-[52px] shrink-0 rounded-full"
                    style={{ boxShadow: "0 0 0 3px rgba(99,102,241,0.35)" }}
                  />
                  <div className="min-w-0 flex-1">
                    {/* Poniżej lg tekst się zawija — awatar i licznik dni zostawiały na telefonie
                        ok. 114px, więc informacja o roli była ucinana. Od lg bez zmian. */}
                    <p className="break-words text-base font-bold text-white lg:truncate">
                      {nearestBirthday.username || `ID: ${nearestBirthday.userId}`}
                    </p>
                    <p className="mt-0.5 break-words text-xs text-[#9aa2b8] lg:truncate">
                      {formatBirthday(nearestBirthday.date, nearestBirthday.yearSpecified)}
                      {selectedRole ? t.roleFor24h(selectedRole.name) : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[26px] font-extrabold leading-none" style={{ color: "#ec4899" }}>
                      {countdownText(nearestBirthday.daysUntil, t)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#8d94a8]">{t.toCelebrate}</p>
                  </div>
                </div>
              </div>
            </div>
          </SlideIn>
        ) : null}

        <SlideIn direction="up" delay={180}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-dark-800 p-4">
              <p className="text-2xl font-bold text-white">{birthdays.length}</p>
              <p className="mt-1 text-xs text-[#8d94a8]">{t.saved_count}</p>
            </div>
            <div className="rounded-md bg-dark-800 p-4">
              <p className="text-2xl font-bold text-pink-400">{thisMonthCount}</p>
              <p className="mt-1 text-xs text-[#8d94a8]">{t.thisMonth}</p>
            </div>
          </div>
        </SlideIn>

        <SlideIn direction="up" delay={210}>
          <SettingRow
            title={t.configTitle}
            description={configSummary}
            icon={<Settings className="h-4 w-4" />}
            isOpen={configOpen}
            onToggle={() => setConfigOpen((open) => !open)}
          >
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className={labelClass}>
                    {t.channel} <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={values.birthdayChannelId || ""}
                    onValueChange={(value) => setValue("birthdayChannelId", value, { shouldDirty: true })}
                  >
                    <SelectTrigger className={inputClass}>
                      {/* Radix ignoruje children SelectValue, gdy value="" — placeholder MUSI iść przez
                          prop placeholder, inaczej trigger renderuje się pusty (bez ikony i tekstu). */}
                      <SelectValue
                        placeholder={
                          <div className="flex items-center gap-2 text-[#9aa2b8]">
                            <Hash className="h-4 w-4" />
                            <span>{t.pickChannel}</span>
                          </div>
                        }
                      >
                        {values.birthdayChannelId ? (
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-[#8d94a8]" />
                            {selectedChannel?.name ?? t.pickChannel}
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
                  {errors.birthdayChannelId && (
                    <p className="text-xs text-destructive">{errors.birthdayChannelId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className={labelClass}>{t.role}</Label>
                  <div className="flex gap-2">
                    <Select
                      value={values.roleId || undefined}
                      onValueChange={(value) => setValue("roleId", value, { shouldDirty: true })}
                    >
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder={t.noRole} />
                      </SelectTrigger>
                      <SelectContent className="border-[#2f3341] bg-dark-900">
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5' }}
                              />
                              {role.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {values.roleId ? (
                      <button
                        type="button"
                        onClick={() => setValue("roleId", "", { shouldDirty: true })}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#3f4455] text-[#9aa2b8] transition-colors hover:border-red-500/50 hover:text-red-400"
                        aria-label={t.removeRole}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-[#8d94a8]">{t.roleHint}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className={labelClass}>
                    {t.message} <span className="text-destructive">*</span>
                  </Label>
                  <VariableInserter
                    value={values.message || ""}
                    onChange={(value) => setValue("message", value, { shouldDirty: true })}
                    variables={[
                      { name: t.user, display: t.user, value: "{user}", description: t.userVariableHint },
                    ]}
                    placeholder="🎉 Wszystkiego najlepszego z okazji urodzin, {user}! 🎂"
                    rows={3}
                    emojiPicker
                    unstyled
                    className="rounded-md border border-[#3f4455] bg-dark-900 text-sm leading-6 text-[#d8dbe6] transition-colors focus:border-[#3b82f6]"
                  />
                  {errors.message && (
                    <p className="text-xs text-destructive">{errors.message.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8d94a8]">{m.livePreview}</p>
                  <DiscordMessagePreview
                    compact
                    avatarUrl="/deezy.png"
                    content={
                      values.message?.trim()
                        ? resolveBirthdayPreview(values.message)
                        : t.noContent
                    }
                  />
                </div>
              </div>
            </div>
          </SettingRow>
        </SlideIn>

        <SlideIn direction="up" delay={240}>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-white/90">{t.timeline}</h2>
              <div className="relative sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d94a8]" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchUser}
                  className="h-9 border-transparent bg-dark-800 pl-9 text-sm text-white/90 placeholder:text-[#8d94a8] focus-visible:ring-[#3b82f6]/50 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            {birthdays.length === 0 ? (
              <div className="rounded-md bg-dark-800 py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-dark-900">
                  <Cake className="h-8 w-8 text-[#8d94a8]" />
                </div>
                <h3 className="text-sm font-semibold text-white/90">{t.emptyTitle}</h3>
                <p className="mx-auto mt-1 max-w-sm text-xs text-[#8d94a8]">
                  {t.emptyText}
                </p>
              </div>
            ) : filteredBirthdays.length === 0 ? (
              <div className="rounded-md bg-dark-800 py-12 text-center">
                <p className="text-sm text-[#8d94a8]">{t.userNotFound(searchQuery.trim())}</p>
              </div>
            ) : (
              <div className="relative space-y-5">
                <div className="pointer-events-none absolute bottom-2 left-1 top-2 w-px bg-[#2f3341]" />
                {monthGroups.map((group) => {
                  const isExpanded = expandedMonths[group.key] ?? false;
                  const visibleItems = isExpanded ? group.items : group.items.slice(0, 3);
                  const hiddenCount = group.items.length - visibleItems.length;

                  return (
                    <div key={group.key} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="relative z-10 h-2 w-2 rounded-full bg-[#3b82f6]" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8d94a8]">{group.label}</span>
                      </div>

                      <div className="space-y-2 pl-4">
                        {visibleItems.map((birthday) => (
                          <div key={birthday._id} className="rounded-md bg-dark-800 p-3">
                            {editingId === birthday.userId ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={getAvatarUrl(birthday.userId, birthday.avatar)}
                                    alt={birthday.username || t.user}
                                    className="h-9 w-9 rounded-full"
                                  />
                                  <p className="text-sm font-medium text-white/90">
                                    {birthday.username || `ID: ${birthday.userId}`}
                                  </p>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-[11px] text-[#8d94a8]">{t.day}</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      max="31"
                                      placeholder="DD"
                                      value={editDay}
                                      onChange={(e) => setEditDay(e.target.value)}
                                      className={cn(inputClass, "h-9")}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[11px] text-[#8d94a8]">{t.month}</Label>
                                    <Select value={editMonth} onValueChange={(value) => setEditMonth(value)}>
                                      <SelectTrigger className={cn(inputClass, "h-9")}>
                                        <SelectValue placeholder={t.pickMonth} />
                                      </SelectTrigger>
                                      <SelectContent className="border-[#2f3341] bg-dark-900">
                                        {MONTHS.map((month) => (
                                          <SelectItem key={month.value} value={month.value}>
                                            {month.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[11px] text-[#8d94a8]">{t.year}</Label>
                                    <Input
                                      type="number"
                                      min="1900"
                                      max={new Date().getFullYear()}
                                      placeholder="YYYY"
                                      value={editYear}
                                      onChange={(e) => setEditYear(e.target.value)}
                                      className={cn(inputClass, "h-9")}
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleEditBirthday(birthday.userId)}
                                    className="bg-[#3b82f6] text-white hover:bg-[#2563eb]"
                                  >
                                    <Save className="mr-2 h-4 w-4" />
                                    {m.save}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditDay("");
                                      setEditMonth("");
                                      setEditYear("");
                                    }}
                                  >
                                    {m.cancel}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <img
                                    src={getAvatarUrl(birthday.userId, birthday.avatar)}
                                    alt={birthday.username || t.user}
                                    className="h-9 w-9 shrink-0 rounded-full"
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-white/90">
                                      {birthday.username || `ID: ${birthday.userId}`}
                                    </p>
                                    <p className="truncate text-xs text-[#8d94a8]">
                                      {formatBirthday(birthday.date, birthday.yearSpecified)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <CountdownBadge days={birthday.daysUntil} />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingId(birthday.userId);
                                      const date = new Date(birthday.date);
                                      setEditDay(date.getDate().toString());
                                      setEditMonth((date.getMonth() + 1).toString());
                                      setEditYear(birthday.yearSpecified ? date.getFullYear().toString() : "");
                                    }}
                                    className={iconButtonClass}
                                    aria-label={t.editBirthday(birthday.username || birthday.userId)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBirthday(birthday.userId)}
                                    className={iconButtonDangerClass}
                                    aria-label={t.deleteBirthday(birthday.username || birthday.userId)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {hiddenCount > 0 || isExpanded ? (
                        <button
                          type="button"
                          onClick={() => setExpandedMonths((current) => ({ ...current, [group.key]: !isExpanded }))}
                          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[#3f4455] py-2 text-xs font-medium text-[#9aa2b8] transition-colors hover:border-[#3b82f6] hover:text-white"
                        >
                          {isExpanded ? t.collapse : t.showRest(hiddenCount)}
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
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
