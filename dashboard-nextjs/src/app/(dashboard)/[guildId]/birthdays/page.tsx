"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Save, Hash, Trash2, Pencil, Cake, ChevronDown, Search, Settings, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchGuildData } from "@/lib/cache";
import { cn } from "@/lib/utils";
import VariableInserter from "@/components/VariableInserter";

const MONTHS = [
  { value: "1", label: "Styczeń" },
  { value: "2", label: "Luty" },
  { value: "3", label: "Marzec" },
  { value: "4", label: "Kwiecień" },
  { value: "5", label: "Maj" },
  { value: "6", label: "Czerwiec" },
  { value: "7", label: "Lipiec" },
  { value: "8", label: "Sierpień" },
  { value: "9", label: "Wrzesień" },
  { value: "10", label: "Październik" },
  { value: "11", label: "Listopad" },
  { value: "12", label: "Grudzień" },
];

const birthdaySchema = z.object({
  birthdayChannelId: z.string().min(1, "Wybierz kanał urodzinowy"),
  roleId: z.string().optional(),
  message: z.string().min(1, "Wpisz wiadomość urodzinową"),
  enabled: z.boolean().default(false),
});

type BirthdayFormData = z.infer<typeof birthdaySchema>;

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

  return (
    <section className="overflow-hidden rounded-md bg-dark-800 shadow-[0_8px_18px_rgba(8,10,16,0.16)]">
      <div className={cn("flex min-h-[68px] items-center gap-4 border border-transparent px-5 py-3 transition-colors", isOpen && "border-[#2f3341] bg-dark-800")}>
        <button
          type="button"
          onClick={isExpandable ? onToggle : undefined}
          className={cn("flex min-w-0 flex-1 items-center gap-3 text-left", isExpandable ? "cursor-pointer" : "cursor-default")}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-dark-900 text-[#aab2c8]">{icon}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white/90">{title}</span>
            {description ? <span className="mt-1 block truncate text-xs text-[#8d94a8]">{description}</span> : null}
          </span>
        </button>

        {isExpandable ? (
          <button type="button" onClick={onToggle} aria-label={isOpen ? "Zwiń sekcję" : "Rozwiń sekcję"} className="flex h-8 w-8 items-center justify-center rounded-md text-[#9aa2b8] transition-colors hover:bg-dark-900 hover:text-white">
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

function countdownText(days: number): string {
  if (days === 0) return "Dziś!";
  if (days === 1) return "1 dzień";
  return `${days} dni`;
}

function CountdownBadge({ days }: { days: number }) {
  if (days === 0 || days === 1) {
    return (
      <span className="shrink-0 rounded-full bg-pink-500/15 px-2 py-0.5 text-[11px] font-semibold text-pink-400">
        {days === 0 ? "Dziś!" : "Jutro"}
      </span>
    );
  }
  return <span className="shrink-0 text-[11px] text-[#8d94a8]">za {days} dni</span>;
}

export default function BirthdaysPage() {
  const params = useParams();
  const guildId = params.guildId as string;
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

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<BirthdayFormData>({
    resolver: zodResolver(birthdaySchema),
    defaultValues: {
      birthdayChannelId: "",
      roleId: "",
      message: "🎉 Wszystkiego najlepszego z okazji urodzin, {user}! 🎂",
      enabled: false,
    },
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
            reset({
              birthdayChannelId: config.birthdayChannelId,
              roleId: config.roleId || "",
              message: config.message || "🎉 Wszystkiego najlepszego z okazji urodzin, {user}! 🎂",
              enabled: config.enabled !== undefined ? config.enabled : false,
            });
          }
        }
      } catch (fetchError) {
        console.error('Error loading birthdays data:', fetchError);
        setError("Nie udało się załadować danych urodzin. Sprawdź połączenie z internetem i spróbuj ponownie.");
        toast.error("Nie udało się załadować danych");
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [guildId, reset]);

  const onSubmit = async (data: BirthdayFormData) => {
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
      toast.success("Konfiguracja urodzin została zapisana!");
      setConfigOpen(false);
    } catch (saveError) {
      console.error("Failed to save:", saveError);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  };

  const handleEditBirthday = async (userId: string) => {
    const day = parseInt(editDay);
    const month = parseInt(editMonth);
    const year = editYear ? parseInt(editYear) : undefined;

    if (!day || !month || day < 1 || day > 31 || month < 1 || month > 12) {
      toast.error("Nieprawidłowa data");
      return;
    }

    if (year && (year < 1900 || year > new Date().getFullYear())) {
      toast.error("Nieprawidłowy rok");
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
      toast.success("Urodziny zostały zaktualizowane!");
    } catch (editError) {
      console.error("Failed to update birthday:", editError);
      toast.error("Nie udało się zaktualizować urodzin");
    }
  };

  const handleDeleteBirthday = async (userId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć te urodziny?")) return;

    try {
      const response = await fetch(`/api/guild/${guildId}/birthdays/users?userId=${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete birthday");
      }

      setBirthdays(birthdays.filter(b => b.userId !== userId));
      toast.success("Urodziny zostały usunięte!");
    } catch (deleteError) {
      console.error("Failed to delete birthday:", deleteError);
      toast.error("Nie udało się usunąć urodzin");
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
      <div className="min-h-screen">
        <div className="w-full">
          <ErrorState
            title="Nie udało się załadować urodzin"
            message={error}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen">
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
    ? `# ${selectedChannel?.name ?? "nieznany kanał"}${selectedRole ? ` • 🎂 ${selectedRole.name}` : ""}`
    : "Nie skonfigurowano jeszcze";

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
    <div className="min-h-screen pb-32">
      <div className="w-full space-y-5">
        <SlideIn direction="up" delay={100}>
          <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold text-white">Urodziny</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                Automatyczne życzenia urodzinowe, rola na dzień urodzin i lista nadchodzących świętowań.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <span>Aktywne</span>
              <DeezySwitch
                checked={values.enabled || false}
                onCheckedChange={(checked) => setValue("enabled", checked, { shouldDirty: true })}
                aria-label="Włącz lub wyłącz urodziny"
              />
            </div>
          </header>
        </SlideIn>

        {!values.enabled ? (
          <SlideIn direction="up" delay={130}>
            <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-dark-900 px-4 py-3 text-xs text-[#9aa2b8]">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Moduł urodzin jest <span className="font-semibold text-white/80">globalnie wyłączony</span>. Możesz edytować konfigurację i listę urodzin, ale bot nie wyśle życzeń, dopóki nie włączysz przełącznika <span className="font-semibold text-white/80">Aktywne</span> u góry i nie zapiszesz konfiguracji.
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
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#b3a6ff]">Najbliższe urodziny</p>
                <div className="mt-2.5 flex items-center gap-3.5">
                  <img
                    src={getAvatarUrl(nearestBirthday.userId, nearestBirthday.avatar)}
                    alt={nearestBirthday.username || "Użytkownik"}
                    className="h-[52px] w-[52px] shrink-0 rounded-full"
                    style={{ boxShadow: "0 0 0 3px rgba(99,102,241,0.35)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-white">
                      {nearestBirthday.username || `ID: ${nearestBirthday.userId}`}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#9aa2b8]">
                      {formatBirthday(nearestBirthday.date, nearestBirthday.yearSpecified)}
                      {selectedRole ? <> • rola 🎂 {selectedRole.name} na 24h</> : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[26px] font-extrabold leading-none" style={{ color: "#ec4899" }}>
                      {countdownText(nearestBirthday.daysUntil)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#8d94a8]">do świętowania</p>
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
              <p className="mt-1 text-xs text-[#8d94a8]">zapisanych urodzin</p>
            </div>
            <div className="rounded-md bg-dark-800 p-4">
              <p className="text-2xl font-bold text-pink-400">{thisMonthCount}</p>
              <p className="mt-1 text-xs text-[#8d94a8]">w tym miesiącu</p>
            </div>
          </div>
        </SlideIn>

        <SlideIn direction="up" delay={210}>
          <SettingRow
            title="Konfiguracja — kanał, rola, wiadomość"
            description={configSummary}
            icon={<Settings className="h-4 w-4" />}
            isOpen={configOpen}
            onToggle={() => setConfigOpen((open) => !open)}
          >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className={labelClass}>
                    Kanał urodzinowy <span className="text-destructive">*</span>
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
                            <span>Wybierz kanał...</span>
                          </div>
                        }
                      >
                        {values.birthdayChannelId ? (
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
                  {errors.birthdayChannelId && (
                    <p className="text-xs text-destructive">{errors.birthdayChannelId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className={labelClass}>Rola urodzinowa (opcjonalna)</Label>
                  <div className="flex gap-2">
                    <Select
                      value={values.roleId || undefined}
                      onValueChange={(value) => setValue("roleId", value, { shouldDirty: true })}
                    >
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Brak roli" />
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
                        aria-label="Usuń rolę urodzinową"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-[#8d94a8]">Rola nadawana użytkownikowi w dniu urodzin (zostanie usunięta następnego dnia).</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className={labelClass}>
                  Wiadomość urodzinowa <span className="text-destructive">*</span>
                </Label>
                <VariableInserter
                  value={values.message || ""}
                  onChange={(value) => setValue("message", value, { shouldDirty: true })}
                  variables={[
                    { name: "Użytkownik", display: "Użytkownik", value: "{user}", description: "Wzmianka użytkownika" },
                  ]}
                  placeholder="🎉 Wszystkiego najlepszego z okazji urodzin, {user}! 🎂"
                  rows={3}
                  unstyled
                  className="rounded-md border border-[#3f4455] bg-dark-900 text-sm leading-6 text-[#d8dbe6] transition-colors focus:border-[#3b82f6]"
                />
                {errors.message && (
                  <p className="text-xs text-destructive">{errors.message.message}</p>
                )}
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving} className="bg-[#3b82f6] text-white hover:bg-[#2563eb]">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Zapisywanie...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Zapisz konfigurację
                    </>
                  )}
                </Button>
              </div>
            </form>
          </SettingRow>
        </SlideIn>

        <SlideIn direction="up" delay={240}>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold text-white/90">Oś czasu urodzin</h2>
              <div className="relative sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d94a8]" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Szukaj użytkownika..."
                  className="h-9 border-transparent bg-dark-800 pl-9 text-sm text-white/90 placeholder:text-[#8d94a8] focus-visible:ring-[#3b82f6]/50 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            {birthdays.length === 0 ? (
              <div className="rounded-md bg-dark-800 py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-dark-900">
                  <Cake className="h-8 w-8 text-[#8d94a8]" />
                </div>
                <h3 className="text-sm font-semibold text-white/90">Brak zapisanych urodzin</h3>
                <p className="mx-auto mt-1 max-w-sm text-xs text-[#8d94a8]">
                  Użytkownicy mogą ustawić swoje urodziny za pomocą komendy. Wszystkie urodziny pojawią się tutaj.
                </p>
              </div>
            ) : filteredBirthdays.length === 0 ? (
              <div className="rounded-md bg-dark-800 py-12 text-center">
                <p className="text-sm text-[#8d94a8]">Nie znaleziono użytkownika „{searchQuery.trim()}".</p>
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
                                    alt={birthday.username || "Użytkownik"}
                                    className="h-9 w-9 rounded-full"
                                  />
                                  <p className="text-sm font-medium text-white/90">
                                    {birthday.username || `ID: ${birthday.userId}`}
                                  </p>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-[11px] text-[#8d94a8]">Dzień</Label>
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
                                    <Label className="text-[11px] text-[#8d94a8]">Miesiąc</Label>
                                    <Select value={editMonth} onValueChange={(value) => setEditMonth(value)}>
                                      <SelectTrigger className={cn(inputClass, "h-9")}>
                                        <SelectValue placeholder="Wybierz miesiąc..." />
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
                                    <Label className="text-[11px] text-[#8d94a8]">Rok (opcjonalny)</Label>
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
                                    Zapisz
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
                                    Anuluj
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <img
                                    src={getAvatarUrl(birthday.userId, birthday.avatar)}
                                    alt={birthday.username || "Użytkownik"}
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
                                    aria-label={`Edytuj urodziny ${birthday.username || birthday.userId}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteBirthday(birthday.userId)}
                                    className={iconButtonDangerClass}
                                    aria-label={`Usuń urodziny ${birthday.username || birthday.userId}`}
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
                          {isExpanded ? "Zwiń" : `Pokaż pozostałe (${hiddenCount})`}
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
