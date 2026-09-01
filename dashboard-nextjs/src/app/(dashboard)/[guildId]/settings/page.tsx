"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { toast } from "sonner";
import { Check, Lock } from "lucide-react";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { toSortedDiscordChannels } from "@/lib/discordOrdering";
import { useDirtyState } from "@/components/DirtyStateProvider";

interface Channel {
  id: string;
  name: string;
}

interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
}

interface FormState {
  language: "pl" | "en";
  systemNotifyChannelId?: string;
  nick: string;
  bio: string;
  /** undefined = bez zmian, null = usuń, string = nowy data URI do wysłania. */
  pendingAvatar?: string | null;
  pendingBanner?: string | null;
}

const DEFAULT_FORM: FormState = { language: "pl", nick: "", bio: "" };

const LANGS: { id: "pl" | "en"; flag: string; label: string; short: string; enabled: boolean }[] = [
  { id: "pl", flag: "🇵🇱", label: "Polski", short: "PL", enabled: true },
  { id: "en", flag: "🇬🇧", label: "English (wkrótce)", short: "EN", enabled: false },
];

interface DangerDef {
  id: "levels" | "economy" | "warnings";
  endpoint: string;
  title: string;
  action: string;
  meta: string;
  warn: string;
}

const DANGERS: DangerDef[] = [
  {
    id: "levels",
    endpoint: "reset-levels",
    title: "Zresetuj poziomy użytkowników",
    action: "Zresetuj",
    meta: "Usunie XP i poziomy wszystkich użytkowników na serwerze.",
    warn: "XP, poziomy i miejsce w rankingu zostaną usunięte wszystkim użytkownikom.",
  },
  {
    id: "economy",
    endpoint: "reset-economy",
    title: "Wyzeruj pieniądze użytkowników",
    action: "Wyzeruj",
    meta: "Wyzeruje portfel i bank wszystkich użytkowników.",
    warn: "salda portfela i banku wszystkich użytkowników zostaną wyzerowane.",
  },
  {
    id: "warnings",
    endpoint: "reset-warnings",
    title: "Zresetuj ostrzeżenia użytkowników",
    action: "Zresetuj",
    meta: "Usunie wszystkie ostrzeżenia na serwerze.",
    warn: "wszystkie ostrzeżenia wszystkich użytkowników zostaną usunięte.",
  },
];

interface DangerRowState {
  open: boolean;
  value: string;
  done: boolean;
  doneMeta?: string;
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function pickImage(
  e: React.ChangeEvent<HTMLInputElement>
): Promise<{ dataUri: string; file: File } | null> {
  const file = e.target.files?.[0];
  if (!file) return null;
  const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp"];
  if (!allowed.includes(file.type)) {
    toast.error("Dozwolone formaty: PNG, JPG, GIF, WebP");
    return null;
  }
  if (file.size > 8 * 1024 * 1024) {
    toast.error("Obraz jest za duży (max 8 MB)");
    return null;
  }
  const dataUri = await fileToDataUri(file);
  return { dataUri, file };
}

const COLORS = {
  card: "#1F2129",
  input: "#17181E",
  border: "#2f3341",
  borderStrong: "#3a3f4e",
  textPrimary: "#fff",
  textSecondary: "#c4cad8",
  textMuted: "#8d94a8",
  textFaint: "#6b7280",
  accent: "#6366f1",
  danger: "#ef4444",
  dangerText: "#fca5a5",
  warn: "#fcd34d",
  success: "#22c55e",
  successText: "#86efac",
};

export default function SettingsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { registerDirtyController } = useDirtyState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [guild, setGuild] = useState<GuildInfo | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [totalModules, setTotalModules] = useState(0);
  const [liveAvatarUrl, setLiveAvatarUrl] = useState<string | null>(null);
  const [liveBannerUrl, setLiveBannerUrl] = useState<string | null>(null);
  const [avatarFileName, setAvatarFileName] = useState<string | null>(null);
  const [bannerFileName, setBannerFileName] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const savedRef = useRef<FormState>(DEFAULT_FORM);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [dangerState, setDangerState] = useState<Record<string, DangerRowState>>(() => {
    const initial: Record<string, DangerRowState> = {};
    DANGERS.forEach((d) => { initial[d.id] = { open: false, value: "", done: false }; });
    return initial;
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const [guildsRes, guildRes, channelsData, profileRes, generalRes, modulesRes] = await Promise.all([
          fetch("/api/discord/guilds"),
          fetchWithAuth(`/api/discord/guild/${guildId}`),
          fetchGuildData<unknown[]>(guildId, "channels", `/api/discord/guild/${guildId}/channels`),
          fetchWithAuth(`/api/guild/${guildId}/settings/profile`),
          fetchWithAuth(`/api/guild/${guildId}/settings/general`),
          fetch(`/api/guild/${guildId}/modules-status`),
        ]);

        if (guildsRes.ok) {
          const list: { id: string; owner?: boolean }[] = await guildsRes.json();
          setIsOwner(list.find((g) => g.id === guildId)?.owner === true);
        }

        if (guildRes.ok) {
          const data = await guildRes.json();
          setGuild({ id: guildId, name: data.name, icon: data.icon });
        }

        if (channelsData) {
          setChannels(
            toSortedDiscordChannels(channelsData)
              .filter((c) => c.type === 0 || c.type === 5)
              .map((c) => ({ id: c.id, name: c.name }))
          );
        }

        if (modulesRes.ok) {
          const data = await modulesRes.json();
          setTotalModules(Object.keys(data).length);
        }

        let nextForm: FormState = { ...DEFAULT_FORM };

        if (profileRes.ok) {
          const p = await profileRes.json();
          // Jeśli ten serwer nie ma jeszcze własnego nadpisania (nick/bio/avatar/banner),
          // pokaż standardowy profil bota zamiast pustych pól — patrz defaultUsername/defaultBio
          // i defaultAvatarUrl/defaultBannerUrl w GET /settings/profile.
          setLiveAvatarUrl(p.avatarUrl ?? p.defaultAvatarUrl ?? null);
          setLiveBannerUrl(p.bannerUrl ?? p.defaultBannerUrl ?? null);
          nextForm = { ...nextForm, nick: p.nick ?? p.defaultUsername ?? "", bio: p.bio ?? p.defaultBio ?? "" };
        }

        if (generalRes.ok) {
          const g = await generalRes.json();
          nextForm = { ...nextForm, systemNotifyChannelId: g.systemNotifyChannelId };
        }

        setForm(nextForm);
        savedRef.current = nextForm;
      } catch (err) {
        console.error("Error loading settings:", err);
        setError("Nie udało się załadować ustawień. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [guildId]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedRef.current);
  const nameTrim = form.nick.trim();

  const handleSave = useCallback(async () => {
    if (!nameTrim) {
      toast.error("Nazwa bota nie może być pusta");
      return;
    }

    try {
      setSaving(true);

      const generalRes = await fetch(`/api/guild/${guildId}/settings/general`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "pl", systemNotifyChannelId: form.systemNotifyChannelId }),
      });
      if (!generalRes.ok) throw new Error("Failed to save general settings");

      const profilePatch: Record<string, unknown> = { nick: form.nick.trim(), bio: form.bio.trim() || null };
      if (form.pendingAvatar !== undefined) profilePatch.avatar = form.pendingAvatar;
      if (form.pendingBanner !== undefined) profilePatch.banner = form.pendingBanner;

      const profileRes = await fetch(`/api/guild/${guildId}/settings/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePatch),
      });
      if (!profileRes.ok) {
        const err = await profileRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save profile");
      }
      const updatedProfile = await profileRes.json();

      setLiveAvatarUrl(updatedProfile.avatarUrl ?? null);
      setLiveBannerUrl(updatedProfile.bannerUrl ?? null);
      setAvatarFileName(null);
      setBannerFileName(null);

      const nextForm: FormState = { ...form, pendingAvatar: undefined, pendingBanner: undefined };
      setForm(nextForm);
      savedRef.current = nextForm;

      toast.success("Ustawienia zostały zapisane!");
    } catch (err) {
      console.error("Error saving settings:", err);
      toast.error(err instanceof Error ? err.message : "Nie udało się zapisać ustawień");
    } finally {
      setSaving(false);
    }
  }, [form, guildId, nameTrim]);

  const handleCancel = useCallback(() => {
    setForm(savedRef.current);
    setAvatarFileName(null);
    setBannerFileName(null);
  }, []);

  useEffect(
    () =>
      registerDirtyController({
        id: `settings-${guildId}`,
        isDirty,
        isSaving: saving,
        label: "Ustawienia",
        onSave: handleSave,
        onCancel: handleCancel,
      }),
    [guildId, isDirty, saving, handleSave, handleCancel, registerDirtyController]
  );

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = await pickImage(e);
    e.target.value = "";
    if (!picked) return;
    setForm((f) => ({ ...f, pendingAvatar: picked.dataUri }));
    setAvatarFileName(`${picked.file.name} · ${Math.round(picked.file.size / 1024)} KB`);
    toast.success("Avatar podmieniony — zapisz, aby wysłać do Discorda");
  };

  const handleBannerPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = await pickImage(e);
    e.target.value = "";
    if (!picked) return;
    setForm((f) => ({ ...f, pendingBanner: picked.dataUri }));
    setBannerFileName(`${picked.file.name} · ${Math.round(picked.file.size / 1024)} KB`);
    toast.success("Banner podmieniony — zapisz, aby wysłać do Discorda");
  };

  const previewAvatar = form.pendingAvatar !== undefined ? form.pendingAvatar : liveAvatarUrl;
  const previewBanner = form.pendingBanner !== undefined ? form.pendingBanner : liveBannerUrl;
  const hasAvatar = Boolean(previewAvatar);
  const hasBanner = Boolean(previewBanner);

  const openDanger = (id: string) => {
    if (!isOwner) return;
    setDangerState((s) => ({ ...s, [id]: { ...s[id], open: true, value: "" } }));
  };
  const cancelDanger = (id: string) => {
    setDangerState((s) => ({ ...s, [id]: { ...s[id], open: false, value: "" } }));
  };
  const typeDanger = (id: string, value: string) => {
    setDangerState((s) => ({ ...s, [id]: { ...s[id], value } }));
  };
  const confirmDanger = async (d: DangerDef) => {
    const row = dangerState[d.id];
    if (!guild || row.value.trim() !== guild.name) {
      toast.error(`Wpisz dokładnie „${guild?.name ?? ""}", aby potwierdzić`);
      return;
    }
    try {
      const res = await fetch(`/api/guild/${guildId}/settings/danger/${d.endpoint}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Nie udało się wykonać operacji");
        return;
      }
      const count = data.deletedCount ?? data.usersAffected ?? 0;
      const doneMeta =
        d.id === "levels"
          ? `Poziomy zresetowane — ${count} osób wyczyszczonych`
          : d.id === "economy"
            ? `Salda wyzerowane — ${count} kont`
            : `Ostrzeżenia zresetowane — ${count} wpisów`;
      setDangerState((s) => ({ ...s, [d.id]: { open: false, value: "", done: true, doneMeta } }));
      toast.success(doneMeta);
    } catch (err) {
      console.error("Error running danger action:", err);
      toast.error("Nie udało się wykonać operacji");
    }
  };

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="w-full max-w-[1000px] space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 rounded-lg" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={handleRetry} />;
  }

  const selectedChannel = channels.find((c) => c.id === form.systemNotifyChannelId);

  return (
    <div className="min-h-full">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-3.5 pb-20">
        <SlideIn direction="up">
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: COLORS.textPrimary }}>Ustawienia</h1>
            <p style={{ margin: "8px 0 0", maxWidth: 620, fontSize: 14, lineHeight: 1.6, color: COLORS.textMuted }}>
              Wygląd bota na tym serwerze, język i powiadomienia systemowe.
            </p>
          </div>
        </SlideIn>

        {/* Profil na tym serwerze */}
        <SlideIn direction="up" delay={80}>
          <div style={{ borderRadius: 10, background: COLORS.card, padding: 20, boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 3 }}>Profil na tym serwerze</div>
            <p style={{ margin: "0 0 16px", fontSize: 12, lineHeight: 1.6, color: COLORS.textMuted }}>
              Nazwa, opis, avatar i banner widoczne tylko tutaj — na innych serwerach bot wygląda inaczej.
            </p>

            <div className="grid grid-cols-1 items-start gap-[18px] md:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex min-w-0 flex-col gap-3.5">
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary }}>Nazwa</label>
                    <span style={{ fontSize: 11, color: form.nick.length > 28 ? COLORS.warn : COLORS.textFaint }}>
                      {form.nick.length}/32
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Deezy"
                    value={form.nick}
                    onChange={(e) => setForm((f) => ({ ...f, nick: e.target.value.slice(0, 32) }))}
                    maxLength={32}
                    className="focus:!border-[#6366f1]"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      height: 40,
                      border: `1px solid ${!nameTrim ? "rgba(239,68,68,0.6)" : COLORS.border}`,
                      borderRadius: 6,
                      background: COLORS.input,
                      color: "#d8dbe6",
                      fontFamily: "inherit",
                      fontSize: 13,
                      padding: "0 12px",
                    }}
                  />
                  {!nameTrim && (
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: COLORS.dangerText }}>Nazwa nie może być pusta.</p>
                  )}
                </div>

                <div>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary }}>Opis</label>
                    <span style={{ fontSize: 11, color: form.bio.length > 170 ? COLORS.warn : COLORS.textFaint }}>
                      {form.bio.length}/190
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Krótki opis widoczny w profilu bota…"
                    value={form.bio}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value.slice(0, 190) }))}
                    maxLength={190}
                    className="focus:!border-[#6366f1]"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      resize: "vertical",
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 6,
                      background: COLORS.input,
                      color: "#d8dbe6",
                      fontFamily: "inherit",
                      fontSize: 13,
                      lineHeight: 1.6,
                      padding: "10px 12px",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      border: `1px dashed ${hasAvatar ? "rgba(99,102,241,0.55)" : COLORS.borderStrong}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <span style={{ width: 34, height: 34, borderRadius: "50%", flex: "none", overflow: "hidden", background: "#23252f" }}>
                      {previewAvatar && (
                        <Image src={previewAvatar} alt="" width={34} height={34} unoptimized className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.textPrimary }}>Avatar</span>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, color: COLORS.textFaint }}>
                        {avatarFileName ?? (hasAvatar ? "Aktualny avatar" : "512×512 · max 8 MB")}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="flex-none rounded-[5px] border-none bg-[#23252f] px-[11px] py-1.5 font-sans text-[11px] font-semibold text-[#c4cad8] hover:bg-[#2f3341] hover:text-white"
                      style={{ cursor: "pointer" }}
                    >
                      Zmień
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      onChange={handleAvatarPick}
                      className="hidden"
                    />
                  </div>

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      border: `1px dashed ${hasBanner ? "rgba(99,102,241,0.55)" : COLORS.borderStrong}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <span style={{ width: 42, height: 24, borderRadius: 4, flex: "none", overflow: "hidden", background: "#23252f" }}>
                      {previewBanner && (
                        <Image src={previewBanner} alt="" width={42} height={24} unoptimized className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLORS.textPrimary }}>Banner</span>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, color: COLORS.textFaint }}>
                        {bannerFileName ?? (hasBanner ? "Aktualny banner" : "960×540 · max 8 MB")}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      className="flex-none rounded-[5px] border-none bg-[#23252f] px-[11px] py-1.5 font-sans text-[11px] font-semibold text-[#c4cad8] hover:bg-[#2f3341] hover:text-white"
                      style={{ cursor: "pointer" }}
                    >
                      Zmień
                    </button>
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      onChange={handleBannerPick}
                      className="hidden"
                    />
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: COLORS.textFaint }}>PNG, JPG, GIF, WebP — max 8 MB</p>
              </div>

              {/* Podgląd na żywo */}
              <div style={{ borderRadius: 10, background: COLORS.input, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: COLORS.textFaint, textTransform: "uppercase", marginBottom: 10 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.success }} /> Podgląd na żywo
                </div>
                <div style={{ borderRadius: 10, background: COLORS.card, overflow: "hidden" }}>
                  <div
                    style={{
                      height: 88,
                      position: "relative",
                      background: hasBanner ? undefined : "linear-gradient(120deg,#3f3f52,#23252f)",
                    }}
                  >
                    {previewBanner && <Image src={previewBanner} alt="" fill unoptimized className="object-cover" />}
                  </div>
                  <div style={{ padding: "0 14px 14px", marginTop: -26 }}>
                    <span
                      style={{
                        display: "block",
                        position: "relative",
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        overflow: "hidden",
                        background: hasAvatar ? undefined : "linear-gradient(135deg,#818cf8,#4c4f6b)",
                        border: `5px solid ${COLORS.card}`,
                      }}
                    >
                      {previewAvatar && <Image src={previewAvatar} alt="" fill unoptimized className="object-cover" />}
                    </span>
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 16, fontWeight: 700, color: COLORS.textPrimary }}>
                        {nameTrim || "Nazwa bota"}
                      </span>
                      <span style={{ flex: "none", background: "#5865F2", borderRadius: 3, fontSize: 9, fontWeight: 700, color: "#fff", padding: "1px 5px" }}>
                        BOT
                      </span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6, color: form.bio.trim() ? "#b9c0d0" : COLORS.textFaint }}>
                      {form.bio.trim() || "Brak opisu — dodaj krótki tekst, który zobaczą użytkownicy."}
                    </div>
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 14, fontSize: 10, color: COLORS.textMuted }}>
                      <span><span style={{ display: "block", fontWeight: 700, color: COLORS.textPrimary }}>{totalModules}</span>modułów</span>
                      <span><span style={{ display: "block", fontWeight: 700, color: COLORS.textPrimary }}>PL</span>język</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SlideIn>

        {/* Język + Powiadomienia systemowe */}
        <div className="flex flex-col gap-3">
          <SlideIn direction="up" delay={140}>
            <div style={{ borderRadius: 10, background: COLORS.card, padding: "18px 20px", boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 3 }}>Język</div>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: COLORS.textMuted }}>Język odpowiedzi bota na tym serwerze.</p>
              <div style={{ display: "flex", gap: 6 }}>
                {LANGS.map((l) => {
                  const selected = form.language === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      disabled={!l.enabled}
                      onClick={() => l.enabled && setForm((f) => ({ ...f, language: l.id }))}
                      className={l.enabled ? "hover:!border-[#6366f1]" : "cursor-not-allowed opacity-50"}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        border: `1px solid ${selected ? COLORS.accent : COLORS.border}`,
                        borderRadius: 8,
                        background: selected ? "rgba(99,102,241,0.15)" : COLORS.input,
                        color: selected ? "#fff" : "#b9c0d0",
                        fontSize: 12,
                        fontWeight: selected ? 600 : 400,
                        fontFamily: "inherit",
                        padding: 10,
                        cursor: l.enabled ? "pointer" : "not-allowed",
                      }}
                    >
                      {l.flag} {l.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </SlideIn>

          <SlideIn direction="up" delay={200}>
            <div style={{ borderRadius: 10, background: COLORS.card, padding: "18px 20px", boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 3 }}>Powiadomienia systemowe</div>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: COLORS.textMuted }}>Błędy uprawnień i nowości w modułach, których używasz.</p>
              <select
                value={form.systemNotifyChannelId ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, systemNotifyChannelId: e.target.value || undefined }))}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  height: 40,
                  border: `1px solid ${selectedChannel ? COLORS.border : "rgba(250,204,21,0.4)"}`,
                  borderRadius: 6,
                  background: COLORS.input,
                  color: selectedChannel ? "rgba(255,255,255,0.9)" : COLORS.warn,
                  fontFamily: "inherit",
                  fontSize: 13,
                  padding: "0 12px",
                  cursor: "pointer",
                  appearance: "none",
                  WebkitAppearance: "none",
                }}
              >
                <option value="">Brak — wybierz kanał…</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}># {c.name}</option>
                ))}
              </select>
              <p style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.6, color: selectedChannel ? COLORS.textFaint : COLORS.warn }}>
                {selectedChannel
                  ? `Bot będzie pisać na #${selectedChannel.name} — tylko wtedy, gdy coś wymaga Twojej uwagi.`
                  : "⚠️ Bez kanału nie dowiesz się o brakujących uprawnieniach ani usuniętych kanałach."}
              </p>

              <div style={{ marginTop: 12, borderRadius: 8, background: COLORS.input, padding: 12 }}>
                <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
                  Przykładowe powiadomienia systemowe
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, listStyleType: "disc", listStylePosition: "outside", fontSize: 12.5, lineHeight: 1.7, color: COLORS.textMuted }}>
                  <li style={{ marginBottom: 5 }}>Błędy: Bot nie ma uprawnień (np. na #general) lub usunięto przypisany kanał (np. powitań).</li>
                  <li>Twoje moduły: Nowości i przerwy techniczne funkcji, których już używasz (np. skrzynki w Ekonomii).</li>
                </ul>
              </div>
            </div>
          </SlideIn>
        </div>

        {/* Strefa nieodwracalna */}
        <SlideIn direction="up" delay={260}>
          <div style={{ borderRadius: 10, background: COLORS.card, border: "1px solid rgba(239,68,68,0.35)", padding: "18px 20px", boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.dangerText }}>Strefa nieodwracalna</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, border: "1px solid rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.1)", color: COLORS.warn, fontSize: 10, fontWeight: 700, padding: "3px 9px" }}>
                <Lock className="h-2.5 w-2.5" /> Tylko właściciel serwera
              </span>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 12, lineHeight: 1.6, color: COLORS.textMuted }}>
              Każda akcja usuwa dane bezpowrotnie i wymaga wpisania nazwy serwera.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {DANGERS.map((d) => {
                const row = dangerState[d.id];
                const ok = guild ? row.value.trim() === guild.name : false;
                return (
                  <div key={d.id} style={{ borderRadius: 8, background: COLORS.input, border: `1px solid ${row.open ? "rgba(239,68,68,0.45)" : "transparent"}`, padding: "11px 13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: row.done ? COLORS.textMuted : COLORS.textPrimary }}>{d.title}</span>
                        <span style={{ display: "block", marginTop: 1, fontSize: 11, color: row.done ? COLORS.successText : COLORS.textMuted }}>
                          {row.done ? row.doneMeta : d.meta}
                        </span>
                      </span>

                      {!row.open && !row.done && (
                        <button
                          type="button"
                          disabled={!isOwner}
                          onClick={() => openDanger(d.id)}
                          title={!isOwner ? "Tylko właściciel serwera Discord może użyć tej funkcji." : undefined}
                          className={isOwner ? "hover:!bg-[rgba(239,68,68,0.12)]" : "cursor-not-allowed opacity-40"}
                          style={{
                            flex: "none",
                            border: "1px solid rgba(239,68,68,0.45)",
                            borderRadius: 6,
                            background: "transparent",
                            color: COLORS.dangerText,
                            fontSize: 11,
                            fontWeight: 600,
                            fontFamily: "inherit",
                            padding: "7px 13px",
                            cursor: isOwner ? "pointer" : "not-allowed",
                          }}
                        >
                          {d.action}
                        </button>
                      )}

                      {row.done && (
                        <span style={{ flex: "none", display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: COLORS.successText }}>
                          <Check className="h-3.5 w-3.5" /> wykonane
                        </span>
                      )}
                    </div>

                    {row.open && (
                      <div style={{ marginTop: 11, paddingTop: 11, borderTop: `1px solid ${COLORS.border}` }}>
                        <div style={{ fontSize: 11, lineHeight: 1.6, color: COLORS.textSecondary, marginBottom: 7 }}>
                          Wpisz <span style={{ fontFamily: "ui-monospace, monospace", color: "#fff" }}>{guild?.name}</span>, aby potwierdzić — {d.warn}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <input
                            type="text"
                            placeholder="nazwa serwera"
                            value={row.value}
                            onChange={(e) => typeDanger(d.id, e.target.value)}
                            className="focus:!border-[#6366f1]"
                            style={{
                              minWidth: 140,
                              flex: 1,
                              boxSizing: "border-box",
                              height: 36,
                              border: `1px solid ${row.value && !ok ? "rgba(239,68,68,0.6)" : COLORS.border}`,
                              borderRadius: 6,
                              background: "#1d202b",
                              color: "#d8dbe6",
                              fontFamily: "inherit",
                              fontSize: 12,
                              padding: "0 12px",
                            }}
                          />
                          <button
                            type="button"
                            disabled={!ok}
                            onClick={() => confirmDanger(d)}
                            style={{
                              flex: "none",
                              border: "none",
                              borderRadius: 6,
                              background: ok ? COLORS.danger : COLORS.border,
                              color: ok ? "#fff" : COLORS.textFaint,
                              fontSize: 12,
                              fontWeight: 600,
                              fontFamily: "inherit",
                              padding: "0 16px",
                              height: 36,
                              cursor: ok ? "pointer" : "default",
                            }}
                          >
                            {d.action}
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelDanger(d.id)}
                            className="hover:!bg-[#1F2129] hover:!text-white"
                            style={{
                              flex: "none",
                              border: "1px solid #3a3f4e",
                              borderRadius: 6,
                              background: "transparent",
                              color: COLORS.textSecondary,
                              fontSize: 12,
                              fontWeight: 600,
                              fontFamily: "inherit",
                              padding: "0 14px",
                              height: 36,
                              cursor: "pointer",
                            }}
                          >
                            Anuluj
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </SlideIn>
      </div>
    </div>
  );
}
