"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  ChevronDown, EyeOff, Hash, Loader2, Pencil, Plus, Save, Search, Send, Smile, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import EmojiPicker from "@/components/EmojiPicker";
import EmbedColorPicker from "@/components/EmbedColorPicker";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmojiDisplay } from "@/components/EmojiDisplay";
import { ReactionRoleLivePreview } from "@/components/reaction-roles/ReactionRoleLivePreview";
import { ActivePanelCard } from "@/components/reaction-roles/ActivePanelCard";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { notifyModulesStatusChanged } from "@/lib/modulesStatusBus";
import { SlideIn } from "@/components/ui/animated";
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

interface ReactionMapping {
  emoji: string;
  roleId: string;
  description?: string | undefined;
}

interface ReactionRole {
  _id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  title?: string | undefined;
  embedColor?: string | undefined;
  reactions: ReactionMapping[];
}

const DEFAULT_EMBED_COLOR = "#5865F2";

interface SettingRowProps {
  title: string;
  description?: string | undefined;
  icon: React.ReactNode;
  isOpen?: boolean | undefined;
  onToggle?: (() => void) | undefined;
  children?: React.ReactNode;
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

function SettingRow({ title, description, icon, isOpen = false, onToggle, children }: SettingRowProps) {
  return (
    <section className="overflow-hidden rounded-md bg-dark-800 shadow-[0_8px_18px_rgba(8,10,16,0.16)]">
      <div className={cn("flex min-h-[68px] items-center gap-4 border border-transparent px-5 py-3 transition-colors", isOpen && "border-[#2f3341] bg-dark-800")}>
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-dark-900 text-[#aab2c8]">
            {icon}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white/90">{title}</span>
            {description ? (
              <span className="mt-1 block truncate text-xs text-[#8d94a8]">{description}</span>
            ) : null}
          </span>
        </button>

        {onToggle ? (
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

      {isOpen && children ? (
        <div className="border-x border-b border-[#2f3341] bg-dark-800 p-5">{children}</div>
      ) : null}
    </section>
  );
}

export default function ReactionRolesPage() {
  const params = useParams();
  const guildId = params?.guildId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [reactionRoles, setReactionRoles] = useState<ReactionRole[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [savingEnabled, setSavingEnabled] = useState(false);

  const [formOpen, setFormOpen] = useState(true);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [title, setTitle] = useState("");
  const [embedColor, setEmbedColor] = useState(DEFAULT_EMBED_COLOR);
  const [previewEmbedColor, setPreviewEmbedColor] = useState<string | null>(null);
  const [reactions, setReactions] = useState<ReactionMapping[]>([]);
  const [currentEmoji, setCurrentEmoji] = useState("");
  const [currentRoleId, setCurrentRoleId] = useState("");
  const [currentDescription, setCurrentDescription] = useState("");
  const [editingPanel, setEditingPanel] = useState<ReactionRole | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [roleSearch, setRoleSearch] = useState("");
  const [rolePopoverOpen, setRolePopoverOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [channelsData, rolesData, rrRes, configRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, "channels", `/api/discord/guild/${guildId}/channels`),
          fetchGuildData<Role[]>(guildId, "roles", `/api/discord/guild/${guildId}/roles`),
          fetchWithAuth(`/api/guild/${guildId}/reaction-roles`),
          fetchWithAuth(`/api/guild/${guildId}/reaction-roles/config`),
        ]);

        setChannels(channelsData.filter((ch) => ch.type === 0 || ch.type === 5));
        setRoles(rolesData.filter((r) => r.id !== guildId && r.name !== "@everyone"));

        if (rrRes.ok) {
          const data: ReactionRole[] = await rrRes.json() as ReactionRole[];
          setReactionRoles(data);
        }

        if (configRes.ok) {
          const configData = await configRes.json() as { enabled?: boolean };
          setEnabled(configData.enabled !== false);
        }
      } catch {
        setError("Nie udało się załadować danych. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [guildId]);

  const handleToggleEnabled = async (next: boolean) => {
    const previous = enabled;
    setEnabled(next);
    setSavingEnabled(true);
    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/reaction-roles/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(next ? "Role za reakcje włączone" : "Role za reakcje wyłączone");
      notifyModulesStatusChanged();
    } catch {
      setEnabled(previous);
      toast.error("Nie udało się zapisać ustawienia");
    } finally {
      setSavingEnabled(false);
    }
  };

  const refreshReactionRoles = async () => {
    const res = await fetchWithAuth(`/api/guild/${guildId}/reaction-roles`);
    if (res.ok) {
      const data: ReactionRole[] = await res.json() as ReactionRole[];
      setReactionRoles(data);
    }
  };

  const getRoleName = (roleId: string) => roles.find((r) => r.id === roleId)?.name ?? roleId;
  const getRoleColor = (roleId: string) => roles.find((r) => r.id === roleId)?.color ?? 0;
  const getChannelName = (channelId: string) => channels.find((c) => c.id === channelId)?.name ?? channelId;

  const roleColorStyle = (roleId: string): string => {
    const color = getRoleColor(roleId);
    return color ? `#${color.toString(16).padStart(6, "0")}` : "transparent";
  };

  const addReaction = () => {
    if (!currentEmoji || !currentRoleId) {
      toast.error("Wybierz emoji i rolę");
      return;
    }

    const isCustomEmoji = /^<a?:\w+:\d+>$/.test(currentEmoji.trim());
    const unicodeEmojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}️)$/u;
    const isUnicodeEmoji = unicodeEmojiRegex.test(currentEmoji.trim());

    if (!isCustomEmoji && !isUnicodeEmoji) {
      toast.error("Wprowadź prawidłowe emoji");
      return;
    }
    if (reactions.length >= 20) {
      toast.error("Maksymalnie 20 reakcji na wiadomość");
      return;
    }
    if (reactions.some((r) => r.emoji === currentEmoji)) {
      toast.error("To emoji jest już używane");
      return;
    }
    if (reactions.some((r) => r.roleId === currentRoleId)) {
      toast.error("Ta rola jest już przypisana");
      return;
    }

    setReactions([...reactions, {
      emoji: currentEmoji,
      roleId: currentRoleId,
      description: currentDescription || undefined,
    }]);
    setCurrentEmoji("");
    setCurrentRoleId("");
    setRoleSearch("");
    setCurrentDescription("");
  };

  const removeReaction = (index: number) => {
    setReactions(reactions.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!selectedChannelId) { toast.error("Wybierz kanał"); return; }
    if (reactions.length === 0) { toast.error("Dodaj przynajmniej jedną reakcję"); return; }

    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/reaction-roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selectedChannelId, title: title || undefined, embedColor, reactions }),
      });

      if (!response.ok) throw new Error("Failed to create");

      toast.success("Wiadomość z reakcjami została wysłana!");
      setSelectedChannelId("");
      setTitle("");
      setEmbedColor(DEFAULT_EMBED_COLOR);
      setReactions([]);
      await refreshReactionRoles();
    } catch {
      toast.error("Nie udało się wysłać wiadomości");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę wiadomość z reakcjami?")) return;

    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/reaction-roles?messageId=${messageId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");

      toast.success("Wiadomość została usunięta");
      if (editingPanel?.messageId === messageId) handleCancelEdit();
      await refreshReactionRoles();
    } catch {
      toast.error("Nie udało się usunąć wiadomości");
    }
  };

  const handleEdit = (rr: ReactionRole) => {
    setEditingPanel(rr);
    setSelectedChannelId(rr.channelId);
    setTitle(rr.title ?? "");
    setEmbedColor(rr.embedColor || DEFAULT_EMBED_COLOR);
    setReactions([...rr.reactions]);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingPanel(null);
    setSelectedChannelId("");
    setTitle("");
    setEmbedColor(DEFAULT_EMBED_COLOR);
    setReactions([]);
  };

  const handleUpdate = async () => {
    if (!editingPanel || reactions.length === 0) return;

    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/reaction-roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: editingPanel.messageId,
          channelId: selectedChannelId || editingPanel.channelId,
          title: title || undefined,
          embedColor,
          reactions,
        }),
      });
      if (!response.ok) throw new Error("Failed to update");

      toast.success("Panel zaktualizowany i ponownie wysłany!");
      handleCancelEdit();
      await refreshReactionRoles();
    } catch {
      toast.error("Nie udało się zaktualizować panelu");
    } finally {
      setSaving(false);
    }
  };

  const handleResend = async (rr: ReactionRole) => {
    setResending(rr.messageId);
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/reaction-roles`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: rr.messageId }),
      });
      if (!response.ok) throw new Error("Failed to resend");

      toast.success("Panel wysłany ponownie!");
      await refreshReactionRoles();
    } catch {
      toast.error("Nie udało się wysłać panelu ponownie");
    } finally {
      setResending(null);
    }
  };

  const handleRetry = () => { setError(null); window.location.reload(); };

  const selectedRole = roles.find((role) => role.id === currentRoleId);
  const normalizedRoleSearch = roleSearch.trim().toLowerCase();
  const filteredRoles = normalizedRoleSearch
    ? roles.filter((role) => role.name.toLowerCase().includes(normalizedRoleSearch))
    : roles;
  const roleInputValue = roleSearch || selectedRole?.name || "";

  // Podgląd pokazuje też reakcję, którą się właśnie uzupełnia w formularzu — nie
  // trzeba klikać "Dodaj reakcję", żeby zobaczyć efekt (stąd "na żywo").
  const draftReaction: ReactionMapping | null =
    currentEmoji.trim() && currentRoleId && !reactions.some((r) => r.roleId === currentRoleId)
      ? { emoji: currentEmoji.trim(), roleId: currentRoleId, description: currentDescription || undefined }
      : null;
  const previewReactions = draftReaction ? [...reactions, draftReaction] : reactions;

  const handleRoleSelect = (role: Role) => {
    setCurrentRoleId(role.id);
    setRoleSearch(role.name);
    setRolePopoverOpen(false);
  };

  if (error) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <ErrorState title="Nie udało się załadować reaction-roles" message={error} onRetry={handleRetry} />
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
          <div className="space-y-3">
            <Skeleton className="h-[68px] w-full rounded-md bg-dark-800" />
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-md bg-dark-800" />
            ))}
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
              <h1 className="text-2xl font-semibold text-white">Role za Reakcje</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                Zarządzaj wiadomościami z reakcjami, które przypisują role użytkownikom na serwerze.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <span>{enabled ? "Aktywne" : "Nieaktywne"}</span>
              <DeezySwitch checked={enabled} onCheckedChange={(v) => void handleToggleEnabled(v)} disabled={savingEnabled} aria-label="Włącz lub wyłącz role za reakcje" />
            </div>
          </header>
        </SlideIn>

        {!enabled ? (
          <SlideIn direction="up" delay={130}>
            <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-dark-900 px-4 py-3 text-xs text-[#9aa2b8]">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Moduł ról za reakcje jest <span className="font-semibold text-white/80">globalnie wyłączony</span>. Możesz edytować konfigurację, ale bot nie będzie przypisywał ról, dopóki nie włączysz przełącznika <span className="font-semibold text-white/80">Aktywne</span> u góry i nie zapiszesz konfiguracji.
              </span>
            </div>
          </SlideIn>
        ) : null}

        <SlideIn direction="up" delay={150}>
          <div className="space-y-3">
            {/* ── Create / Edit panel ─────────────────────────────────── */}
            <SettingRow
              title={editingPanel ? "Edytuj panel" : "Nowy panel"}
              description={
                editingPanel
                  ? "Zmodyfikuj konfigurację — podgląd aktualizuje się od razu"
                  : "Skonfiguruj wiadomość i role, podgląd aktualizuje się od razu"
              }
              icon={editingPanel ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              isOpen={formOpen}
              onToggle={() => setFormOpen((prev) => !prev)}
            >
              <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.3fr_1fr]">
              <div className="space-y-5">
                {/* Channel */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-[#c4cad8]">
                    Kanał docelowy <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                    <SelectTrigger className="h-11 border-transparent bg-dark-900 text-white/90 focus:ring-[#3b82f6]/50 focus:ring-offset-0">
                      {/* Radix ignoruje children SelectValue, gdy value="" — placeholder MUSI iść przez
                          prop placeholder, inaczej trigger renderuje się pusty (bez ikony i tekstu). */}
                      <SelectValue
                        placeholder={
                          <div className="flex items-center gap-2 text-[#8d94a8]">
                            <Hash className="h-4 w-4" />
                            <span>Wybierz kanał...</span>
                          </div>
                        }
                      >
                        {selectedChannelId ? (
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-[#8d94a8]" />
                            {channels.find((ch) => ch.id === selectedChannelId)?.name ?? "Wybierz kanał..."}
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
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-xs font-semibold text-[#c4cad8]">Tytuł embeda (opcjonalnie)</Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#8d94a8]">Kolor embeda</span>
                      <EmbedColorPicker value={embedColor} onChange={setEmbedColor} onPreviewChange={setPreviewEmbedColor} />
                    </div>
                  </div>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Wybierz swoją rolę"
                    maxLength={256}
                    className="h-11 border-transparent bg-dark-900 text-white/90 placeholder:text-[#8d94a8] focus-visible:ring-[#3b82f6]/50 focus-visible:ring-offset-0"
                  />
                </div>

                {/* Add reaction subsection */}
                <div className="space-y-4 rounded-md border border-[#2f3341] bg-dark-900 p-4">
                  <p className="text-xs font-semibold text-[#c4cad8]">Dodaj reakcję</p>

                  <div className="grid grid-cols-1 gap-4">
                    {/* Emoji */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-[#c4cad8]">Emoji</Label>
                      <div className="flex gap-2">
                        <Input
                          value={currentEmoji}
                          onChange={(e) => setCurrentEmoji(e.target.value)}
                          placeholder="Lub wpisz własne emoji"
                          maxLength={10}
                          className="h-11 flex-1 border-transparent bg-dark-800 text-white/90 placeholder:text-[#8d94a8] focus-visible:ring-[#3b82f6]/50 focus-visible:ring-offset-0"
                        />
                        <div className="[&_button]:h-11 [&_button]:flex [&_button]:items-center [&_button]:justify-center">
                          <EmojiPicker onEmojiSelect={setCurrentEmoji} buttonText={currentEmoji} />
                        </div>
                      </div>
                    </div>

                    {/* Role combobox */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-[#c4cad8]">Rola</Label>
                      <Popover
                        open={rolePopoverOpen}
                        onOpenChange={(open) => {
                          setRolePopoverOpen(open);
                          if (open) setRoleSearch("");
                        }}
                      >
                        <PopoverAnchor asChild>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d94a8]" />
                            <Input
                              role="combobox"
                              aria-expanded={rolePopoverOpen}
                              aria-controls="rr-role-options"
                              placeholder="Wybierz rolę..."
                              value={roleInputValue}
                              onFocus={(e) => {
                                setRolePopoverOpen(true);
                                e.currentTarget.select();
                              }}
                              onChange={(e) => {
                                setRoleSearch(e.target.value);
                                setCurrentRoleId("");
                                setRolePopoverOpen(true);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && filteredRoles[0]) {
                                  e.preventDefault();
                                  handleRoleSelect(filteredRoles[0]);
                                }
                              }}
                              className="h-11 border-transparent bg-dark-800 pl-9 text-white/90 placeholder:text-[#8d94a8] focus-visible:ring-[#3b82f6]/50 focus-visible:ring-offset-0"
                            />
                          </div>
                        </PopoverAnchor>
                        <PopoverContent
                          id="rr-role-options"
                          align="start"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                          className="w-[var(--radix-popover-trigger-width)] border-[#2f3341] bg-dark-900 p-1"
                        >
                          <div className="max-h-64 overflow-y-auto overscroll-contain">
                            {filteredRoles.length === 0 ? (
                              <div className="py-6 text-center text-sm text-[#8d94a8]">Nie znaleziono roli</div>
                            ) : (
                              filteredRoles.map((role) => (
                                <button
                                  key={role.id}
                                  type="button"
                                  onClick={() => handleRoleSelect(role)}
                                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-white/90 hover:bg-dark-800"
                                >
                                  <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
                                    style={{ backgroundColor: roleColorStyle(role.id) }}
                                  />
                                  <span className="min-w-0 truncate">{role.name}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-[#c4cad8]">Opis (opcjonalnie)</Label>
                      <Input
                        value={currentDescription}
                        onChange={(e) => setCurrentDescription(e.target.value)}
                        placeholder="Opcjonalny opis..."
                        maxLength={100}
                        className="h-11 border-transparent bg-dark-800 text-white/90 placeholder:text-[#8d94a8] focus-visible:ring-[#3b82f6]/50 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={addReaction}
                    variant="outline"
                    className="w-full border-dashed border-[#3a3f4e] bg-transparent text-[#8d94a8] hover:border-[#3b82f6]/50 hover:bg-dark-800 hover:text-white"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Dodaj reakcję
                  </Button>
                </div>

                {/* Configured reactions list */}
                {reactions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#c4cad8]">
                      Skonfigurowane reakcje ({reactions.length}/20)
                    </p>
                    <div className="space-y-2">
                      {reactions.map((reaction, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-md border border-[#2f3341] bg-dark-900 px-3 py-2.5"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                              <EmojiDisplay emoji={reaction.emoji} size={22} />
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
                                  style={{ backgroundColor: roleColorStyle(reaction.roleId) }}
                                />
                                <span className="text-sm font-medium text-white/90">
                                  {getRoleName(reaction.roleId)}
                                </span>
                              </div>
                              {reaction.description ? (
                                <span className="text-xs text-[#8d94a8]">{reaction.description}</span>
                              ) : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeReaction(index)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-[#8d94a8] transition-colors hover:bg-dark-800 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-1">
                  {editingPanel ? (
                    <Button
                      type="button"
                      onClick={handleCancelEdit}
                      variant="outline"
                      disabled={saving}
                      className="w-full border-[#3a3f4e] bg-transparent text-[#8d94a8] hover:bg-dark-900 hover:text-white"
                    >
                      Anuluj edycję
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    onClick={() => void (editingPanel ? handleUpdate() : handleSend())}
                    disabled={saving || !selectedChannelId || reactions.length === 0}
                    className="w-full bg-[#3b82f6] text-white hover:bg-[#2563eb] disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editingPanel ? "Zapisywanie..." : "Wysyłanie..."}
                      </>
                    ) : editingPanel ? (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Zapisz zmiany
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Wyślij wiadomość
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* ── Live preview ───────────────────────────────────────── */}
              <div className="space-y-2 rounded-md bg-dark-900/30 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#8d94a8]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Podgląd na żywo
                </div>
                <ReactionRoleLivePreview title={title} reactions={previewReactions} roles={roles} embedColor={previewEmbedColor || embedColor} />
                <p className="text-xs text-[#6f7690]">
                  Podgląd aktualizuje się automatycznie podczas edycji formularza.
                </p>
              </div>
              </div>
            </SettingRow>

            {/* ── Existing panels ─────────────────────────────────────── */}
            {reactionRoles.length === 0 ? (
              <div className="rounded-md bg-dark-800 py-16 text-center shadow-[0_8px_18px_rgba(8,10,16,0.16)]">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-dark-900">
                  <Smile className="h-8 w-8 text-[#8d94a8]" />
                </div>
                <p className="text-sm font-semibold text-white/80">Brak wiadomości z reakcjami</p>
                <p className="mx-auto mt-1 max-w-xs text-xs text-[#8d94a8]">
                  Utwórz pierwszą wiadomość z reakcjami powyżej.
                </p>
              </div>
            ) : (
              reactionRoles.map((rr, index) => (
                <SlideIn key={rr._id} direction="up" delay={index * 50}>
                  <ActivePanelCard
                    reactionRole={rr}
                    channelName={getChannelName(rr.channelId)}
                    roles={roles}
                    isEditing={editingPanel?._id === rr._id}
                    isResending={resending === rr.messageId}
                    onResend={() => void handleResend(rr)}
                    onEdit={() => handleEdit(rr)}
                    onDelete={() => void handleDelete(rr.messageId)}
                  />
                </SlideIn>
              ))
            )}
          </div>
        </SlideIn>
      </div>
    </div>
  );
}
