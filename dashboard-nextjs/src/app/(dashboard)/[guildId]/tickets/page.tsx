"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, Cog, EyeOff, Hash, Pencil, Plus, Ticket, Timer } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { cn } from "@/lib/utils";
import { useDirtyState } from "@/components/DirtyStateProvider";
import { TicketTypeCard } from "@/components/tickets/TicketTypeCard";
import { TicketTypeDrawer } from "@/components/tickets/TicketTypeDrawer";
import { TicketPanelMessageEditor, EMPTY_PANEL_MESSAGE } from "@/components/tickets/TicketPanelMessageEditor";
import type { PanelMessageDraft } from "@/components/tickets/PanelMessagePreview";
import type { TicketTypeDraft } from "@/components/tickets/TicketLivePreview";

interface Channel {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
}

interface Role {
  id: string;
  name: string;
  color: number;
}

interface AutomationDraft {
  maxOpenPerUser: number;
  autoCloseHours: number;
  transcriptEnabled: boolean;
  transcriptChannelId?: string;
}

const EMPTY_AUTOMATION: AutomationDraft = { maxOpenPerUser: 0, autoCloseHours: 0, transcriptEnabled: false };

interface TicketConfigResponse {
  enabled: boolean;
  categoryId: string;
  panelChannelId?: string;
  panelMessageId?: string;
  types: TicketTypeDraft[];
  automation?: Partial<AutomationDraft>;
  panelMessage?: Partial<PanelMessageDraft>;
}

interface ConfigSnapshot {
  enabled: boolean;
  panelChannelId: string;
  types: TicketTypeDraft[];
  automation: AutomationDraft;
  panelMessage: PanelMessageDraft;
}

function snapshotKey(s: ConfigSnapshot): string {
  return JSON.stringify(s);
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "typ";
}

/* ── shared accordion row (SettingRow pattern, matching autoroles/temp-channels) ── */

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
      <div
        className={cn(
          "flex min-h-[68px] items-center gap-4 border border-transparent px-5 py-3 transition-colors",
          isOpen && "border-[#2f3341] bg-dark-800"
        )}
      >
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

        {typeof checked === "boolean" && onCheckedChange ? (
          <DeezySwitch checked={checked} onCheckedChange={onCheckedChange} />
        ) : null}

        {isExpandable ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={isOpen ? "Zwiń sekcję" : "Rozwiń sekcję"}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#9aa2b8] transition-colors hover:bg-dark-900 hover:text-white"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
          </button>
        ) : null}
      </div>

      {isOpen && children ? <div className="border-x border-b border-[#2f3341] bg-dark-800 p-5">{children}</div> : null}
    </section>
  );
}

type SectionKey = "ogolne" | "typy" | "automatyzacja";

export default function TicketsPage() {
  const params = useParams();
  const guildId = params?.guildId as string;
  const { registerDirtyController } = useDirtyState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [panelMessageId, setPanelMessageId] = useState<string | undefined>(undefined);

  const [enabled, setEnabled] = useState(false);
  const [panelChannelId, setPanelChannelId] = useState("");
  const [types, setTypes] = useState<TicketTypeDraft[]>([]);
  const [automation, setAutomation] = useState<AutomationDraft>(EMPTY_AUTOMATION);
  const [panelMessage, setPanelMessage] = useState<PanelMessageDraft>(EMPTY_PANEL_MESSAGE);

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    ogolne: true,
    typy: false,
    automatyzacja: false,
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingType, setEditingType] = useState<TicketTypeDraft | null>(null);
  const [savingType, setSavingType] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [panelMessageDrawerOpen, setPanelMessageDrawerOpen] = useState(false);
  const [savingPanelMessage, setSavingPanelMessage] = useState(false);

  const deployedSnapshotRef = useRef<ConfigSnapshot>({
    enabled: false,
    panelChannelId: "",
    types: [],
    automation: EMPTY_AUTOMATION,
    panelMessage: EMPTY_PANEL_MESSAGE,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [channelsData, rolesData, configRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, "channels", `/api/discord/guild/${guildId}/channels`),
          fetchGuildData<Role[]>(guildId, "roles", `/api/discord/guild/${guildId}/roles`),
          fetchWithAuth(`/api/guild/${guildId}/tickets/config`),
        ]);

        setChannels(channelsData);
        setRoles(rolesData);

        if (configRes.ok) {
          const config = (await configRes.json()) as TicketConfigResponse;
          const nextEnabled = config.enabled ?? false;
          const nextPanelChannelId = config.panelChannelId ?? "";
          const nextTypes = config.types ?? [];
          const nextAutomation: AutomationDraft = {
            maxOpenPerUser: config.automation?.maxOpenPerUser ?? 0,
            autoCloseHours: config.automation?.autoCloseHours ?? 0,
            transcriptEnabled: config.automation?.transcriptEnabled ?? false,
            ...(config.automation?.transcriptChannelId ? { transcriptChannelId: config.automation.transcriptChannelId } : {}),
          };
          const nextPanelMessage: PanelMessageDraft = {
            emoji: config.panelMessage?.emoji ?? EMPTY_PANEL_MESSAGE.emoji,
            title: config.panelMessage?.title ?? EMPTY_PANEL_MESSAGE.title,
            description: config.panelMessage?.description ?? EMPTY_PANEL_MESSAGE.description,
            color: config.panelMessage?.color ?? EMPTY_PANEL_MESSAGE.color,
            placeholder: config.panelMessage?.placeholder ?? EMPTY_PANEL_MESSAGE.placeholder,
            banner: config.panelMessage?.banner ?? EMPTY_PANEL_MESSAGE.banner,
          };

          setEnabled(nextEnabled);
          setPanelChannelId(nextPanelChannelId);
          setTypes(nextTypes);
          setAutomation(nextAutomation);
          setPanelMessage(nextPanelMessage);
          setPanelMessageId(config.panelMessageId);

          deployedSnapshotRef.current = {
            enabled: nextEnabled,
            panelChannelId: nextPanelChannelId,
            types: nextTypes,
            automation: nextAutomation,
            panelMessage: nextPanelMessage,
          };
        }
      } catch {
        setError("Nie udało się załadować danych ticketów. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [guildId]);

  const getChannelCategoryId = useCallback(
    (channelId: string) => channels.find((c) => c.id === channelId)?.parent_id ?? "",
    [channels]
  );

  const persistConfig = useCallback(
    async (
      nextEnabled: boolean,
      nextPanelChannelId: string,
      nextTypes: TicketTypeDraft[],
      nextAutomation: AutomationDraft,
      nextPanelMessage: PanelMessageDraft
    ): Promise<boolean> => {
      try {
        const response = await fetchWithAuth(`/api/guild/${guildId}/tickets/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: nextEnabled,
            categoryId: getChannelCategoryId(nextPanelChannelId),
            panelChannelId: nextPanelChannelId,
            types: nextTypes,
            automation: nextAutomation,
            panelMessage: nextPanelMessage,
          }),
        });
        if (!response.ok) throw new Error("Failed to save");
        return true;
      } catch {
        toast.error("Nie udało się zapisać konfiguracji");
        return false;
      }
    },
    [guildId, getChannelCategoryId]
  );

  const currentSnapshot: ConfigSnapshot = { enabled, panelChannelId, types, automation, panelMessage };
  const isDirty = snapshotKey(currentSnapshot) !== snapshotKey(deployedSnapshotRef.current);

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openAddDrawer = () => {
    setEditingType(null);
    setDrawerOpen(true);
  };

  const openEditDrawer = (type: TicketTypeDraft) => {
    setEditingType(type);
    setDrawerOpen(true);
  };

  const handleSaveType = async (draft: TicketTypeDraft) => {
    setSavingType(true);
    try {
      let nextId = draft.id;
      if (!nextId) {
        const base = slugify(draft.name);
        let candidate = base;
        let suffix = 2;
        while (types.some((t) => t.id === candidate)) {
          candidate = `${base}-${suffix}`;
          suffix += 1;
        }
        nextId = candidate;
      }

      const finalDraft: TicketTypeDraft = { ...draft, id: nextId };
      const exists = types.some((t) => t.id === nextId);
      const nextTypes = exists ? types.map((t) => (t.id === nextId ? finalDraft : t)) : [...types, finalDraft];

      const ok = await persistConfig(enabled, panelChannelId, nextTypes, automation, panelMessage);
      if (!ok) return;

      setTypes(nextTypes);
      setDrawerOpen(false);
      toast.success("Zapisano zmiany w panelu");
      setHighlightedId(nextId);
      window.setTimeout(() => setHighlightedId((current) => (current === nextId ? null : current)), 1800);
    } finally {
      setSavingType(false);
    }
  };

  const handleDeleteType = async (typeId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten typ ticketa?")) return;
    const nextTypes = types.filter((t) => t.id !== typeId);
    const ok = await persistConfig(enabled, panelChannelId, nextTypes, automation, panelMessage);
    if (ok) {
      setTypes(nextTypes);
      toast.success("Typ ticketa usunięty");
    }
  };

  const handleReorderTypes = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const next = [...types];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    const ok = await persistConfig(enabled, panelChannelId, next, automation, panelMessage);
    if (ok) {
      setTypes(next);
      toast.success("Zapisano zmiany w panelu");
    }
  };

  const handlePanelChannelChange = async (nextPanelChannelId: string) => {
    const ok = await persistConfig(enabled, nextPanelChannelId, types, automation, panelMessage);
    if (ok) setPanelChannelId(nextPanelChannelId);
  };

  const handleToggleEnabled = async (nextEnabled: boolean) => {
    const ok = await persistConfig(nextEnabled, panelChannelId, types, automation, panelMessage);
    if (ok) setEnabled(nextEnabled);
  };

  const handleAutomationChange = async (patch: Partial<AutomationDraft>) => {
    const next: AutomationDraft = { ...automation, ...patch };
    const ok = await persistConfig(enabled, panelChannelId, types, next, panelMessage);
    if (ok) {
      setAutomation(next);
      toast.success("Zapisano zmiany w panelu");
    }
  };

  const handleSavePanelMessage = async (draft: PanelMessageDraft) => {
    setSavingPanelMessage(true);
    try {
      const ok = await persistConfig(enabled, panelChannelId, types, automation, draft);
      if (!ok) return;
      setPanelMessage(draft);
      setPanelMessageDrawerOpen(false);
      toast.success("Zapisano zmiany w panelu");
    } finally {
      setSavingPanelMessage(false);
    }
  };

  const handleDeploy = useCallback(async () => {
    setDeploying(true);
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/tickets/deploy`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Nie udało się wdrożyć panelu na Discord");
        return;
      }
      setPanelMessageId(data?.panelMessageId);
      deployedSnapshotRef.current = { enabled, panelChannelId, types, automation, panelMessage };
      toast.success("Panel ticketów wdrożony na Discord!");
    } catch {
      toast.error("Nie udało się wdrożyć panelu na Discord");
    } finally {
      setDeploying(false);
    }
  }, [guildId, enabled, panelChannelId, types, automation, panelMessage]);

  const handleDiscardChanges = useCallback(async () => {
    const snapshot = deployedSnapshotRef.current;
    const ok = await persistConfig(
      snapshot.enabled,
      snapshot.panelChannelId,
      snapshot.types,
      snapshot.automation,
      snapshot.panelMessage
    );
    if (ok) {
      setEnabled(snapshot.enabled);
      setPanelChannelId(snapshot.panelChannelId);
      setTypes(snapshot.types);
      setAutomation(snapshot.automation);
      setPanelMessage(snapshot.panelMessage);
      toast.info("Cofnięto niewdrożone zmiany");
    }
  }, [persistConfig]);

  useEffect(
    () =>
      registerDirtyController({
        id: `tickets-${guildId}`,
        isDirty,
        isSaving: deploying,
        label: "Wdróż zmiany, aby użytkownicy zobaczyli nowy panel ticketów na Discord.",
        saveLabel: "Deploy na Discord",
        onSave: handleDeploy,
        onCancel: handleDiscardChanges,
      }),
    [guildId, isDirty, deploying, handleDeploy, handleDiscardChanges, registerDirtyController]
  );

  const handleRetry = () => {
    setError(null);
    window.location.reload();
  };

  if (error) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <ErrorState title="Nie udało się załadować ticketów" message={error} onRetry={handleRetry} />
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
          <Skeleton className="h-16 w-full rounded-md bg-dark-800" />
          <Skeleton className="h-64 w-full rounded-md bg-dark-800" />
          <Skeleton className="h-16 w-full rounded-md bg-dark-800" />
        </div>
      </div>
    );
  }

  const textChannels = channels.filter((ch) => ch.type === 0 || ch.type === 5);

  return (
    <div className="min-h-full pb-16">
      <div className="w-full space-y-5">
        <SlideIn direction="up" delay={100}>
          <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold text-white">Tickety</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                Jeden kanał, lista rozwijana z typami zgłoszeń.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <span>{enabled ? "Aktywne" : "Nieaktywne"}</span>
              <DeezySwitch checked={enabled} onCheckedChange={(v) => void handleToggleEnabled(v)} aria-label="Włącz lub wyłącz tickety" />
            </div>
          </header>
        </SlideIn>

        {!enabled ? (
          <SlideIn direction="up" delay={130}>
            <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-dark-900 px-4 py-3 text-xs text-[#9aa2b8]">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Moduł ticketów jest <span className="font-semibold text-white/80">globalnie wyłączony</span>. Możesz edytować konfigurację i typy zgłoszeń, ale bot nie utworzy nowych ticketów, dopóki nie włączysz przełącznika <span className="font-semibold text-white/80">Aktywne</span> u góry i nie zapiszesz konfiguracji.
              </span>
            </div>
          </SlideIn>
        ) : null}

        {/* ── Ogólne ───────────────────────────────────────────── */}
        <SlideIn direction="up" delay={150}>
          <SettingRow
            title="Ogólne"
            description="Kanał panelu, aktywność systemu"
            icon={<Cog className="h-4 w-4" />}
            isOpen={openSections.ogolne}
            onToggle={() => toggleSection("ogolne")}
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#c4cad8]">Kanał panelu ticketów</label>
                <Select value={panelChannelId} onValueChange={(v) => void handlePanelChannelChange(v)}>
                  <SelectTrigger className="h-11 border-transparent bg-dark-900 text-white/90 focus:ring-[#3b82f6]/50 focus:ring-offset-0">
                    <SelectValue placeholder="Wybierz kanał...">
                      {panelChannelId ? (
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-[#8d94a8]" />
                          {channels.find((c) => c.id === panelChannelId)?.name ?? "Nieznany kanał"}
                        </div>
                      ) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="border-[#2f3341] bg-dark-900">
                    {textChannels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-[#8d94a8]" />
                          {channel.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-[#6f7690]">Kategoria zostanie automatycznie pobrana z wybranego kanału.</p>
              </div>

              <div className="overflow-hidden rounded-md border border-[#2f3341]">
                <div className="flex items-center justify-between gap-3 bg-dark-900 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white/90">
                      {panelMessage.emoji ? `${panelMessage.emoji} ` : ""}
                      {panelMessage.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[#6f7690]">Tytuł, opis, kolor, baner i placeholder dropdownu</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPanelMessageDrawerOpen((v) => !v)}
                    className="shrink-0 border-[#3a3f4e] bg-transparent text-[#c4cad8] hover:bg-dark-800 hover:text-white"
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    {panelMessageDrawerOpen ? "Zwiń" : "Personalizuj wiadomość"}
                  </Button>
                </div>

                {panelMessageDrawerOpen ? (
                  <div className="border-t border-[#2f3341] bg-dark-800 p-4">
                    <TicketPanelMessageEditor
                      initialMessage={panelMessage}
                      saving={savingPanelMessage}
                      onSave={handleSavePanelMessage}
                      onCancel={() => setPanelMessageDrawerOpen(false)}
                    />
                  </div>
                ) : null}
              </div>

              <p className="text-xs text-[#6f7690]">
                {panelMessageId ? "Panel jest aktualnie wdrożony na Discord." : "Panel nie został jeszcze wdrożony na Discord."}
              </p>
            </div>
          </SettingRow>
        </SlideIn>

        {/* ── Typy ticketów ────────────────────────────────────── */}
        <SlideIn direction="up" delay={200}>
          <SettingRow
            title="Typy ticketów"
            description={`${types.length} ${types.length === 1 ? "typ" : "typów"} · przeciągnij ☰, aby zmienić kolejność`}
            icon={<Plus className="h-4 w-4" />}
            isOpen={openSections.typy}
            onToggle={() => toggleSection("typy")}
          >
            <div className="space-y-3">
              {types.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {types.map((type, index) => (
                    <TicketTypeCard
                      key={type.id}
                      type={type}
                      roles={roles}
                      highlighted={highlightedId === type.id}
                      isDragging={dragIndex === index}
                      onEdit={() => openEditDrawer(type)}
                      onDelete={() => void handleDeleteType(type.id)}
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragIndex !== null) void handleReorderTypes(dragIndex, index);
                        setDragIndex(null);
                      }}
                      onDragEnd={() => setDragIndex(null)}
                    />
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-[#8d94a8]">
                  Brak skonfigurowanych typów. Dodaj pierwszy, aby aktywować panel ticketów.
                </p>
              )}

              <button
                type="button"
                onClick={openAddDrawer}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-[#3a3f4e] bg-transparent px-4 py-2.5 text-xs font-medium text-[#8d94a8] transition-colors hover:border-[#3b82f6] hover:text-white"
              >
                <Plus className="h-4 w-4" />
                Dodaj typ ticketu...
              </button>
            </div>
          </SettingRow>
        </SlideIn>

        {/* ── Automatyzacja ────────────────────────────────────── */}
        <SlideIn direction="up" delay={250}>
          <SettingRow
            title="Automatyzacja"
            description="Limity, auto-zamykanie, transkrypty, claim"
            icon={<Timer className="h-4 w-4" />}
            isOpen={openSections.automatyzacja}
            onToggle={() => toggleSection("automatyzacja")}
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#c4cad8]">Limit otwartych ticketów na użytkownika</label>
                <Input
                  type="number"
                  min={0}
                  value={automation.maxOpenPerUser}
                  onChange={(e) => setAutomation((a) => ({ ...a, maxOpenPerUser: Math.max(0, Number(e.target.value) || 0) }))}
                  onBlur={(e) => void handleAutomationChange({ maxOpenPerUser: Math.max(0, Number(e.target.value) || 0) })}
                  className="h-10 w-32 border-transparent bg-dark-900 text-white/90"
                />
                <p className="text-[11px] text-[#6f7690]">0 = bez limitu.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#c4cad8]">Auto-zamykanie po bezczynności (godziny)</label>
                <Input
                  type="number"
                  min={0}
                  value={automation.autoCloseHours}
                  onChange={(e) => setAutomation((a) => ({ ...a, autoCloseHours: Math.max(0, Number(e.target.value) || 0) }))}
                  onBlur={(e) => void handleAutomationChange({ autoCloseHours: Math.max(0, Number(e.target.value) || 0) })}
                  className="h-10 w-32 border-transparent bg-dark-900 text-white/90"
                />
                <p className="text-[11px] text-[#6f7690]">0 = wyłączone. Sprawdzane co 15 minut.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-[#c4cad8]">Transkrypty przy zamknięciu</p>
                    <p className="mt-0.5 text-[11px] text-[#6f7690]">Wyślij zapis rozmowy na wskazany kanał po zamknięciu ticketa.</p>
                  </div>
                  <DeezySwitch
                    checked={automation.transcriptEnabled}
                    onCheckedChange={(v) => void handleAutomationChange({ transcriptEnabled: v })}
                  />
                </div>

                {automation.transcriptEnabled ? (
                  <Select
                    value={automation.transcriptChannelId ?? ""}
                    onValueChange={(v) => void handleAutomationChange({ transcriptChannelId: v })}
                  >
                    <SelectTrigger className="h-10 border-transparent bg-dark-900 text-white/90 focus:ring-[#3b82f6]/50 focus:ring-offset-0">
                      <SelectValue placeholder="Wybierz kanał na transkrypty...">
                        {automation.transcriptChannelId ? (
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-[#8d94a8]" />
                            {channels.find((c) => c.id === automation.transcriptChannelId)?.name ?? "Nieznany kanał"}
                          </div>
                        ) : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="border-[#2f3341] bg-dark-900">
                      {textChannels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-[#8d94a8]" />
                            {channel.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>

              <p className="text-[11px] text-[#6f7690]">
                „Zajmij zgłoszenie" (claim) jest zawsze aktywne — moderator może przypisać się do ticketa jednym kliknięciem.
              </p>
            </div>
          </SettingRow>
        </SlideIn>

        {!enabled ? (
          <SlideIn direction="up" delay={300}>
            <button
              type="button"
              onClick={() => void handleToggleEnabled(true)}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-[#3a3f4e] bg-transparent px-4 py-3 text-xs font-medium text-[#8d94a8] transition-colors hover:border-[#3b82f6] hover:text-white"
            >
              <Ticket className="h-4 w-4" />
              Aktywuj system ticketów dla tego serwera
            </button>
          </SlideIn>
        ) : null}
      </div>

      <TicketTypeDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialType={editingType}
        roles={roles}
        saving={savingType}
        onSave={handleSaveType}
      />
    </div>
  );
}
