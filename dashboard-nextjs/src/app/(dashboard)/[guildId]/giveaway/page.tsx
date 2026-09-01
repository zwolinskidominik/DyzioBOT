"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import VariableInserter from "@/components/VariableInserter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CustomSlider } from "@/components/ui/custom-slider";
import { EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { fetchGuildData } from "@/lib/cache";
import { useDirtyState } from "@/components/DirtyStateProvider";
import { cn } from "@/lib/utils";

interface Role {
  id: string;
  name: string;
  color: number;
}

interface RoleMultiplier {
  roleId: string;
  multiplier: number;
}

interface GiveawayConfig {
  guildId: string;
  enabled: boolean;
  additionalNote: string;
  roleMultipliers: RoleMultiplier[];
}

const labelClass = "text-xs font-semibold text-[#c4cad8]";
const NOTE_MAX_LENGTH = 500;

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

/** Hex koloru roli Discord (0 = brak koloru → neutralny szary jak natywny Discord). */
function roleColorHex(color: number): string {
  return color ? `#${color.toString(16).padStart(6, "0")}` : "#99aab5";
}

/** "x3" dla liczb całkowitych, "x2,5" dla ułamkowych (średnia) — polska notacja z przecinkiem. */
function formatMultiplier(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `x${rounded}` : `x${rounded.toFixed(1).replace(".", ",")}`;
}

/** Kolejność roleId posortowana malejąco po mnożniku. */
function sortRoleIds(multipliers: RoleMultiplier[]): string[] {
  return [...multipliers].sort((a, b) => b.multiplier - a.multiplier).map((m) => m.roleId);
}

export default function GiveawayPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { registerDirtyController } = useDirtyState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [addRoleOpen, setAddRoleOpen] = useState(false);

  const DEFAULT_CONFIG: GiveawayConfig = {
    guildId,
    enabled: false,
    additionalNote: "",
    roleMultipliers: [],
  };

  const [config, setConfig] = useState<GiveawayConfig>(DEFAULT_CONFIG);
  const savedConfigRef = useRef<GiveawayConfig>(DEFAULT_CONFIG);
  // Kolejność wyświetlania wierszy drabinki — aktualizowana tylko po dodaniu/usunięciu roli
  // oraz po puszczeniu suwaka (onCommit), nie przy każdej zmianie wartości w trakcie przeciągania.
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [rolesData, configResponse] = await Promise.all([
          fetchGuildData<Role[]>(guildId, "roles", `/api/discord/guild/${guildId}/roles`),
          fetchWithAuth(`/api/guild/${guildId}/giveaway/config`),
        ]);

        setRoles(rolesData.filter((r) => r.id !== guildId && r.name !== "@everyone"));

        if (configResponse.ok) {
          const data = await configResponse.json();
          const nextConfig: GiveawayConfig = {
            guildId,
            enabled: data.enabled ?? false,
            additionalNote: data.additionalNote || "",
            roleMultipliers: data.roleMultipliers || [],
          };
          setConfig(nextConfig);
          savedConfigRef.current = nextConfig;
          setOrder(sortRoleIds(nextConfig.roleMultipliers));
        }
      } catch (fetchError) {
        console.error("Error loading giveaway config:", fetchError);
        setError("Nie udało się załadować konfiguracji giveawayów. Sprawdź połączenie i spróbuj ponownie.");
        toast.error("Nie udało się załadować danych");
      } finally {
        setLoading(false);
      }
    };

    if (guildId) void fetchData();
  }, [guildId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/giveaway/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error("Failed to save giveaway config");

      const saved = await response.json();
      const nextConfig: GiveawayConfig = {
        guildId,
        enabled: saved.enabled ?? config.enabled,
        additionalNote: saved.additionalNote ?? config.additionalNote,
        roleMultipliers: saved.roleMultipliers ?? config.roleMultipliers,
      };
      setConfig(nextConfig);
      savedConfigRef.current = nextConfig;
      toast.success("Konfiguracja giveawayów została zapisana!");
    } catch (saveError) {
      console.error("Error saving giveaway config:", saveError);
      toast.error("Nie udało się zapisać konfiguracji");
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
    id: `giveaway-${guildId}`,
    isDirty,
    isSaving: saving,
    label: "Giveaway",
    onSave: handleSave,
    onCancel: handleCancel,
  }), [guildId, isDirty, saving, handleSave, handleCancel, registerDirtyController]);

  const addRole = (roleId: string) => {
    const nextMultipliers = [...config.roleMultipliers, { roleId, multiplier: 2 }];
    setConfig((c) => ({ ...c, roleMultipliers: nextMultipliers }));
    setOrder(sortRoleIds(nextMultipliers));
    setAddRoleOpen(false);
  };

  const removeRole = (roleId: string) => {
    setConfig((c) => ({
      ...c,
      roleMultipliers: c.roleMultipliers.filter((m) => m.roleId !== roleId),
    }));
    // Nie trzeba przesortowywać reszty — usunięcie wiersza nie zmienia względnej kolejności pozostałych.
    setOrder((prev) => prev.filter((id) => id !== roleId));
  };

  const updateMultiplier = (roleId: string, multiplier: number) => {
    // Tylko wartość — kolejność listy zostaje bez zmian aż do puszczenia suwaka (onCommit).
    setConfig((c) => ({
      ...c,
      roleMultipliers: c.roleMultipliers.map((m) => (m.roleId === roleId ? { ...m, multiplier } : m)),
    }));
  };

  const commitOrder = useCallback(() => {
    setOrder(sortRoleIds(config.roleMultipliers));
  }, [config.roleMultipliers]);

  const getRole = useCallback((roleId: string) => roles.find((r) => r.id === roleId), [roles]);

  const availableRoles = useMemo(
    () => roles.filter((r) => !config.roleMultipliers.some((m) => m.roleId === r.id)),
    [roles, config.roleMultipliers]
  );

  // Kolejność wizualna sterowana przez `order` (aktualizowany dopiero po puszczeniu suwaka),
  // a nie bieżącą wartością mnożnika — dzięki temu wiersze nie "skaczą" w trakcie przeciągania.
  const sortedMultipliers = useMemo(
    () =>
      order
        .map((roleId) => config.roleMultipliers.find((m) => m.roleId === roleId))
        .filter((m): m is RoleMultiplier => Boolean(m)),
    [order, config.roleMultipliers]
  );

  const stats = useMemo(() => {
    const count = config.roleMultipliers.length;
    if (count === 0) return { count: 0, max: null as number | null, avg: null as number | null };
    const values = config.roleMultipliers.map((m) => m.multiplier);
    const max = Math.max(...values);
    const avg = values.reduce((sum, v) => sum + v, 0) / count;
    return { count, max, avg };
  }, [config.roleMultipliers]);

  const noteChars = config.additionalNote.length;

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
            title="Nie udało się załadować konfiguracji giveawayów"
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
            <div className="space-y-3"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-[480px] max-w-full" /></div>
            <div className="flex items-center gap-3"><Skeleton className="h-4 w-12" /><Skeleton className="h-5 w-9 rounded-full" /></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 w-full rounded-md bg-dark-800" />
            <Skeleton className="h-20 w-full rounded-md bg-dark-800" />
            <Skeleton className="h-20 w-full rounded-md bg-dark-800" />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_440px]">
            <Skeleton className="h-72 w-full rounded-md bg-dark-800" />
            <Skeleton className="h-72 w-full rounded-md bg-dark-800" />
          </div>
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
              <h1 className="text-2xl font-semibold text-white">Giveaway</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                Włącz moduł, aby moderatorzy mogli używać komendy /giveaway na tym serwerze. Dodatkowa notatka dołączana do każdego giveawaya oraz mnożniki wpisów dla wybranych ról.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <span>{config.enabled ? "Aktywne" : "Nieaktywne"}</span>
              <DeezySwitch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig((c) => ({ ...c, enabled: checked }))}
                aria-label="Włącz lub wyłącz moduł Giveaway na tym serwerze"
              />
            </div>
          </header>
        </SlideIn>

        {!config.enabled ? (
          <SlideIn direction="up" delay={130}>
            <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-dark-900 px-4 py-3 text-xs text-[#9aa2b8]">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Moduł Giveaway jest <span className="font-semibold text-white/80">wyłączony na tym serwerze</span> — komenda <span className="font-semibold text-white/80">/giveaway</span> nie zadziała, dopóki nie włączysz przełącznika <span className="font-semibold text-white/80">Aktywne</span> u góry i nie zapiszesz konfiguracji.
              </span>
            </div>
          </SlideIn>
        ) : null}

        <SlideIn direction="up" delay={140}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-dark-800 p-4">
              <p className="text-2xl font-bold text-white">{stats.count}</p>
              <p className="mt-1 text-xs text-[#8d94a8]">role z bonusem</p>
            </div>
            <div className="rounded-md bg-dark-800 p-4">
              <p className="text-2xl font-bold text-white">{stats.max !== null ? formatMultiplier(stats.max) : "—"}</p>
              <p className="mt-1 text-xs text-[#8d94a8]">najwyższy mnożnik</p>
            </div>
            <div className="rounded-md bg-dark-800 p-4">
              <p className="text-2xl font-bold text-pink-400">{stats.avg !== null ? formatMultiplier(stats.avg) : "—"}</p>
              <p className="mt-1 text-xs text-[#8d94a8]">średni bonus</p>
            </div>
          </div>
        </SlideIn>

        <SlideIn direction="up" delay={180}>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_440px]">
            <div className="space-y-5">
              <div className="space-y-3 rounded-md bg-dark-800 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-white/90">Drabinka mnożników</p>
                  <Popover open={addRoleOpen} onOpenChange={setAddRoleOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={availableRoles.length === 0}
                        className="flex items-center gap-1.5 rounded-md bg-[#3b82f6] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Dodaj rolę
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 border-[#2f3341] bg-dark-900 p-1.5">
                      {availableRoles.length === 0 ? (
                        <p className="px-2 py-3 text-center text-xs text-[#8d94a8]">Wszystkie role są już dodane.</p>
                      ) : (
                        <div className="max-h-64 space-y-0.5 overflow-y-auto">
                          {availableRoles.map((role) => (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => addRole(role.id)}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-white/90 transition-colors hover:bg-dark-800"
                            >
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: roleColorHex(role.color) }}
                              />
                              <span className="truncate">{role.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>

                {sortedMultipliers.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[#3f4455] py-10 text-center">
                    <p className="text-sm text-[#8d94a8]">Brak ról z bonusem.</p>
                    <p className="mt-1 text-xs text-[#6f7690]">Dodaj rolę, aby dać jej graczom większą szansę na wygraną.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedMultipliers.map((m) => {
                      const role = getRole(m.roleId);
                      const color = roleColorHex(role?.color ?? 0);
                      return (
                        <div key={m.roleId} className="space-y-2 rounded-md bg-dark-900 p-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                              <span className="truncate text-sm font-medium text-white/90">
                                {role?.name ?? "Nieznana rola"}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="text-lg font-bold leading-none" style={{ color }}>{formatMultiplier(m.multiplier)}</span>
                              <button
                                type="button"
                                onClick={() => removeRole(m.roleId)}
                                className="flex h-8 w-8 items-center justify-center rounded-md text-[#9aa2b8] transition-colors hover:bg-red-500/10 hover:text-red-400"
                                aria-label={`Usuń mnożnik dla roli ${role?.name ?? m.roleId}`}
                              >
                                <Trash2 className="h-[18px] w-[18px]" />
                              </button>
                            </span>
                          </div>
                          <CustomSlider
                            value={m.multiplier}
                            onChange={(value) => updateMultiplier(m.roleId, value)}
                            onCommit={commitOrder}
                            min={1}
                            max={10}
                            step={1}
                            ariaLabel={`Mnożnik wpisów dla roli ${role?.name ?? m.roleId}`}
                            ticks={[1, 10]}
                            formatTick={(v) => `x${v}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-md bg-dark-800 p-5">
                <label className={labelClass}>Dodatkowa notatka</label>
                <VariableInserter
                  value={config.additionalNote}
                  onChange={(value) =>
                    setConfig((c) => ({ ...c, additionalNote: value.slice(0, NOTE_MAX_LENGTH) }))
                  }
                  variables={[]}
                  toolbarClassName="hidden"
                  placeholder="Opcjonalny tekst dodawany do każdego giveawaya..."
                  rows={3}
                  emojiPicker
                  unstyled
                  className="rounded-md border border-[#3f4455] bg-dark-900 text-sm text-white/90 placeholder:text-[#9aa2b8] transition-colors focus:border-[#3b82f6]"
                />
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-[#8d94a8]">Doklejane na końcu każdej wiadomości giveawaya</p>
                  <p className="text-[11px] text-[#6f7690]">{noteChars}/{NOTE_MAX_LENGTH}</p>
                </div>
              </div>
            </div>

            <div className="lg:sticky lg:top-5">
              <div className="space-y-2 rounded-md bg-dark-800 p-5">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#8d94a8]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Podgląd na żywo
                </p>
                <div className="rounded-md border border-[#2f3341] bg-[#313338] p-4">
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/deezy.png" alt="Deezy" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex items-center gap-1.5 text-sm">
                        <span className="font-semibold text-white">Deezy</span>
                        <span className="rounded bg-[#5865f2] px-1 py-px text-[10px] font-semibold uppercase text-white">
                          Bot
                        </span>
                      </p>
                      <p className="text-sm font-bold text-white">🎁 Nitro Classic (1 miesiąc)</p>
                      <p className="text-sm text-[#dbdee1]">Kliknij 🎉 aby wziąć udział!</p>
                      <p className="text-xs text-[#9aa2b8]">Koniec: za 2 dni · Zwycięzców: 1</p>

                      {sortedMultipliers.length > 0 ? (
                        <div className="space-y-1 pt-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#8d94a8]">Bonusowe wpisy:</p>
                          {sortedMultipliers.map((m) => {
                            const role = getRole(m.roleId);
                            return (
                              <p key={m.roleId} className="text-xs text-[#c4cad8]">
                                <span className="font-medium" style={{ color: roleColorHex(role?.color ?? 0) }}>
                                  @{role?.name ?? "nieznana rola"}
                                </span>
                                {" → "}{formatMultiplier(m.multiplier)} wpisów
                              </p>
                            );
                          })}
                        </div>
                      ) : null}

                      {config.additionalNote.trim() ? (
                        <p className="pt-1.5 text-xs italic text-[#9aa2b8]">{config.additionalNote}</p>
                      ) : null}

                      <div className="pt-1.5">
                        <span
                          className="inline-flex items-center gap-1.5 px-1.5 py-1 text-xs text-[#c4cad8]"
                          style={{
                            backgroundColor: "rgba(255,255,255,0.06)",
                            border: "1px solid transparent",
                            borderRadius: "0.5rem",
                          }}
                        >
                          🎉 <span>47</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs leading-5 text-[#8d94a8]">
                  Uczestnicy z kilkoma rolami dostają największy mnożnik — nie sumują się.
                </p>
              </div>
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
