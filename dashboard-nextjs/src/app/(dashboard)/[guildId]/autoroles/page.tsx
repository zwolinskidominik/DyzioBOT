"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Bot, ChevronDown, EyeOff, Plus, TriangleAlert, Trash2, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { toSortedDiscordRoles } from "@/lib/discordOrdering";
import { cn } from "@/lib/utils";
import { useDirtyState } from "@/components/DirtyStateProvider";

interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
}

type SettingsSection = "users" | "bots";

function getRoleColor(color: number): string {
  if (color === 0) return "#99AAB5";
  return `#${color.toString(16).padStart(6, "0")}`;
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

function SettingRow({
  title,
  description,
  icon,
  checked,
  onCheckedChange,
  isOpen = false,
  onToggle,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}) {
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

        {typeof checked === "boolean" && onCheckedChange ? <DeezySwitch checked={checked} onCheckedChange={onCheckedChange} /> : null}

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

function RoleBadge({ role, invalid, onRemove }: { role: Role; invalid?: boolean; onRemove: () => void }) {
  const color = getRoleColor(role.color);
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-md border px-3 py-2 transition-colors",
      invalid
        ? "border-red-500/40 bg-red-500/10"
        : "border-[#2f3341] bg-dark-900"
    )}>
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="min-w-0 truncate text-sm font-medium text-white/90">{role.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#8d94a8] transition-colors hover:bg-red-500/20 hover:text-red-400"
        aria-label={`Usuń rolę ${role.name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function RoleAddSelect({
  roles,
  excludeIds,
  onAdd,
}: {
  roles: Role[];
  excludeIds: string[];
  onAdd: (id: string) => void;
}) {
  const available = roles.filter((r) => !excludeIds.includes(r.id));
  return (
    <div className="w-full max-w-xs">
      <Select value="" onValueChange={onAdd}>
        <SelectTrigger className="h-9 border-dashed border-[#596276] bg-dark-900 text-[#8d94a8] hover:border-[#3b82f6] hover:text-white focus:ring-[#3b82f6]/50">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>Dodaj rolę…</span>
          </div>
        </SelectTrigger>
        <SelectContent className="border-[#2f3341] bg-dark-900">
          {available.length === 0 ? (
            <div className="px-3 py-2 text-xs text-[#8d94a8]">Brak dostępnych ról</div>
          ) : (
            available.map((role) => (
              <SelectItem key={role.id} value={role.id}>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: getRoleColor(role.color) }} />
                  {role.name}
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

interface SavedState {
  enabled: boolean;
  userRoleIds: string[];
  botRoleIds: string[];
}

export default function AutoRolePage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { registerDirtyController } = useDirtyState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [botMaxPosition, setBotMaxPosition] = useState<number>(0);

  const [enabled, setEnabled] = useState(false);
  const [userRoleIds, setUserRoleIds] = useState<string[]>([]);
  const [botRoleIds, setBotRoleIds] = useState<string[]>([]);
  const [openSections, setOpenSections] = useState<Record<SettingsSection, boolean>>({ users: true, bots: true });

  const savedRef = useRef<SavedState>({ enabled: false, userRoleIds: [], botRoleIds: [] });

  const isDirty =
    enabled !== savedRef.current.enabled ||
    JSON.stringify(userRoleIds) !== JSON.stringify(savedRef.current.userRoleIds) ||
    JSON.stringify(botRoleIds) !== JSON.stringify(savedRef.current.botRoleIds);

  const rolePositionMap = new Map(roles.map((r) => [r.id, r.position]));
  const invalidUserRoleIds = botMaxPosition > 0
    ? userRoleIds.filter((id) => (rolePositionMap.get(id) ?? 0) >= botMaxPosition)
    : [];
  const invalidBotRoleIds = botMaxPosition > 0
    ? botRoleIds.filter((id) => (rolePositionMap.get(id) ?? 0) >= botMaxPosition)
    : [];
  const hasInvalidRoles = invalidUserRoleIds.length > 0 || invalidBotRoleIds.length > 0;

  const toggleSection = (section: SettingsSection) =>
    setOpenSections((s) => ({ ...s, [section]: !s[section] }));

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [rolesRes, configRes, botPosRes] = await Promise.all([
          fetchWithAuth(`/api/guild/${guildId}/roles`),
          fetchWithAuth(`/api/guild/${guildId}/autoroles`),
          fetchWithAuth(`/api/guild/${guildId}/bot-position`),
        ]);

        if (rolesRes.ok) {
          const sorted = toSortedDiscordRoles(await rolesRes.json()).map((r) => ({
            id: r.id,
            name: r.name,
            color: typeof r.color === "number" ? r.color : 0,
            position: r.position,
          }));
          setRoles(sorted);
        }

        if (botPosRes.ok) {
          const { botMaxPosition: pos } = await botPosRes.json();
          setBotMaxPosition(pos ?? 0);
        }

        if (configRes.ok) {
          const config = await configRes.json();
          const nextEnabled = config.enabled ?? false;
          const nextUser = config.userRoleIds ?? [];
          const nextBot = config.botRoleIds ?? [];
          savedRef.current = { enabled: nextEnabled, userRoleIds: nextUser, botRoleIds: nextBot };
          setEnabled(nextEnabled);
          setUserRoleIds(nextUser);
          setBotRoleIds(nextBot);
        }
      } catch {
        setError("Nie udało się załadować danych. Sprawdź połączenie i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [guildId]);

  const handleSave = useCallback(async () => {
    if (hasInvalidRoles) {
      toast.error("Usuń role wyższe niż rola bota, zanim zapiszesz.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/autoroles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, userRoleIds, botRoleIds }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Błąd zapisu");
      savedRef.current = { enabled, userRoleIds: [...userRoleIds], botRoleIds: [...botRoleIds] };
      toast.success("Konfiguracja została zapisana!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  }, [botRoleIds, enabled, guildId, userRoleIds]);

  const handleCancel = useCallback(() => {
    const s = savedRef.current;
    setEnabled(s.enabled);
    setUserRoleIds([...s.userRoleIds]);
    setBotRoleIds([...s.botRoleIds]);
  }, []);

  useEffect(() => registerDirtyController({
    id: `autoroles-${guildId}`,
    isDirty,
    isSaving: saving,
    label: "Auto Role",
    onSave: hasInvalidRoles ? () => { toast.error("Usuń role wyższe niż rola bota, zanim zapiszesz."); } : handleSave,
    onCancel: handleCancel,
  }), [guildId, isDirty, saving, hasInvalidRoles, handleSave, handleCancel, registerDirtyController]);

  if (error) {
    return (
      <div className="min-h-full">
        <ErrorState title="Nie udało się załadować Auto Role" message={error} onRetry={() => { setError(null); setLoading(true); window.location.reload(); }} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="w-full space-y-5">
          <div className="flex items-start justify-between gap-6 pb-2">
            <div className="space-y-3"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-96 max-w-full" /></div>
            <div className="flex items-center gap-3"><Skeleton className="h-4 w-12" /><Skeleton className="h-5 w-9 rounded-full" /></div>
          </div>
          <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-[68px] w-full rounded-md bg-dark-800" />)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="w-full space-y-5">
        <SlideIn direction="up" delay={100}>
          <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold text-white">Auto Role</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                Automatycznie przypisuj role nowym członkom i botom zaraz po dołączeniu do serwera.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <span>{enabled ? "Aktywne" : "Nieaktywne"}</span>
              <DeezySwitch checked={enabled} onCheckedChange={setEnabled} aria-label="Włącz lub wyłącz auto role" />
            </div>
          </header>
        </SlideIn>

        {!enabled ? (
          <SlideIn direction="up" delay={130}>
            <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-dark-900 px-4 py-3 text-xs text-[#9aa2b8]">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Moduł auto ról jest <span className="font-semibold text-white/80">globalnie wyłączony</span>. Możesz edytować konfigurację, ale bot nie przypisze ról nowym członkom, dopóki nie włączysz przełącznika <span className="font-semibold text-white/80">Aktywne</span> u góry i nie zapiszesz konfiguracji.
              </span>
            </div>
          </SlideIn>
        ) : null}

        <SlideIn direction="up" delay={150}>
          <div className="space-y-3">
            <SettingRow
              title="Role użytkowników"
              description="Przypisywane automatycznie każdemu nowemu użytkownikowi"
              icon={<UserIcon className="h-5 w-5" />}
              isOpen={openSections.users}
              onToggle={() => toggleSection("users")}
            >
              <div className="space-y-3">
                {userRoleIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {userRoleIds.map((id) => {
                      const role = roles.find((r) => r.id === id);
                      if (!role) return null;
                      return (
                        <RoleBadge key={id} role={role} invalid={invalidUserRoleIds.includes(id)} onRemove={() => setUserRoleIds((prev) => prev.filter((rid) => rid !== id))} />
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[#8d94a8]">Brak przypisanych ról użytkowników. Dodaj poniżej.</p>
                )}
                <RoleAddSelect
                  roles={roles}
                  excludeIds={[...userRoleIds, ...botRoleIds]}
                  onAdd={(id) => setUserRoleIds((prev) => [...prev, id])}
                />
              </div>
            </SettingRow>

            <SettingRow
              title="Role botów"
              description="Opcjonalnie — przypisywane tylko nowym botom"
              icon={<Bot className="h-5 w-5" />}
              isOpen={openSections.bots}
              onToggle={() => toggleSection("bots")}
            >
              <div className="space-y-3">
                {botRoleIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {botRoleIds.map((id) => {
                      const role = roles.find((r) => r.id === id);
                      if (!role) return null;
                      return (
                        <RoleBadge key={id} role={role} invalid={invalidBotRoleIds.includes(id)} onRemove={() => setBotRoleIds((prev) => prev.filter((rid) => rid !== id))} />
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[#8d94a8]">Brak przypisanych ról botów. Zostaw puste, jeśli nie chcesz przypisywać roli botom.</p>
                )}
                <RoleAddSelect
                  roles={roles}
                  excludeIds={[...userRoleIds, ...botRoleIds]}
                  onAdd={(id) => setBotRoleIds((prev) => [...prev, id])}
                />
              </div>
            </SettingRow>
          </div>
        </SlideIn>

        {hasInvalidRoles ? (
          <SlideIn direction="up" delay={0}>
            <div className="flex items-start gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Nie mogę nadać jednej z wybranych ról — jest ona wyżej niż moja rola na serwerze.
                Przesuń rolę Deezy wyżej niż zaznaczone role lub usuń je z listy.
              </span>
            </div>
          </SlideIn>
        ) : null}
      </div>
    </div>
  );
}

