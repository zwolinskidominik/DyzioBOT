"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search, Shield, ShieldOff, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { SlideIn } from "@/components/ui/animated";
import { useDirtyState } from "@/components/DirtyStateProvider";
import { cn } from "@/lib/utils";

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

/* ── Typy ─────────────────────────────────────────────────────────── */

type CommandKey = "warn" | "warnRemove" | "mute" | "kick" | "ban" | "unban" | "clear";
type WarnAction = "none" | "mute" | "kick" | "ban";
type WarnMode = "single" | "ladder";
type LogKind = "ban" | "kick" | "mute" | "warn" | "clear";

interface CommandConfig {
  on: boolean;
  extraRoleIds: string[];
  dm: boolean;
  log: boolean;
}

interface WarnStep {
  action: WarnAction;
  durationMinutes: number;
}

interface ModerationConfig {
  guildId: string;
  enabled: boolean;
  warn: CommandConfig;
  warnRemove: CommandConfig;
  mute: CommandConfig;
  kick: CommandConfig;
  ban: CommandConfig;
  unban: CommandConfig;
  clear: CommandConfig;
  warnMode: WarnMode;
  warnSingle: WarnStep;
  warnSteps: WarnStep[];
  warnDm: boolean;
  warnExpiryOn: boolean;
  warnExpiryDays: number;
}

interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
}

interface ActiveWarning {
  userId: string;
  warnEntryId: string;
  reason: string;
  date: string;
  moderatorId: string;
  moderatorTag?: string;
  totalForUser: number;
  username: string | null;
  avatar: string | null;
}

interface LogEntry {
  _id: string;
  kind: LogKind;
  targetId: string;
  targetTag: string;
  moderatorId: string;
  moderatorTag: string;
  reason: string;
  extra?: string;
  warnEntryId?: string;
  undone: boolean;
  createdAt: string;
  targetAvatar: string | null;
  targetUsername: string | null;
}

/* ── Stałe ────────────────────────────────────────────────────────── */

const DEFAULT_COMMAND: CommandConfig = { on: true, extraRoleIds: [], dm: true, log: true };

const DEFAULT_CONFIG: Omit<ModerationConfig, "guildId"> = {
  enabled: true,
  warn: { ...DEFAULT_COMMAND },
  warnRemove: { ...DEFAULT_COMMAND },
  mute: { ...DEFAULT_COMMAND },
  kick: { ...DEFAULT_COMMAND },
  ban: { ...DEFAULT_COMMAND },
  unban: { ...DEFAULT_COMMAND },
  clear: { ...DEFAULT_COMMAND },
  warnMode: "ladder",
  warnSingle: { action: "none", durationMinutes: 15 },
  warnSteps: [
    { action: "mute", durationMinutes: 15 },
    { action: "mute", durationMinutes: 180 },
    { action: "mute", durationMinutes: 1440 },
    { action: "ban", durationMinutes: 0 },
  ],
  warnDm: true,
  warnExpiryOn: true,
  warnExpiryDays: 90,
};

const COMMANDS: { key: CommandKey; label: string; icon: string; desc: string }[] = [
  { key: "warn", label: "/warn", icon: "⚠️", desc: "Nadaje ostrzeżenie wg drabinki kar poniżej" },
  { key: "warnRemove", label: "/warn-remove", icon: "🗑️", desc: "Usuwa ostrzeżenie użytkownika" },
  { key: "mute", label: "/mute", icon: "🔇", desc: "Wycisza użytkownika na wskazany czas" },
  { key: "kick", label: "/kick", icon: "👢", desc: "Wyrzuca użytkownika z serwera" },
  { key: "ban", label: "/ban", icon: "🚫", desc: "Banuje użytkownika na serwerze" },
  { key: "unban", label: "/unban", icon: "✅", desc: "Odbanowuje użytkownika" },
  { key: "clear", label: "/clear", icon: "🧹", desc: "Usuwa wiadomości z kanału" },
];

const WARN_ACTIONS: { id: WarnAction; label: string; chip: string; color: string }[] = [
  { id: "none", label: "Brak dodatkowej kary — samo ostrzeżenie", chip: "Bez kary", color: "#6b7280" },
  { id: "mute", label: "🔇 Wyciszenie", chip: "🔇 Wyciszenie", color: "#a970ff" },
  { id: "kick", label: "👢 Wyrzucenie z serwera", chip: "👢 Wyrzucenie", color: "#ef4444" },
  { id: "ban", label: "🔨 Permanentny ban", chip: "🔨 Ban", color: "#dc2626" },
];

const MUTE_DURATIONS = [
  { id: 15, label: "15 min" },
  { id: 60, label: "1 godz." },
  { id: 180, label: "3 godz." },
  { id: 1440, label: "24 godz." },
  { id: 10080, label: "7 dni" },
];

const LOG_KINDS: { id: LogKind | "all"; label: string; color: string }[] = [
  { id: "all", label: "Wszystkie", color: "#8d94a8" },
  { id: "ban", label: "🚫 Ban", color: "#dc2626" },
  { id: "kick", label: "👢 Kick", color: "#ef4444" },
  { id: "mute", label: "🔇 Mute", color: "#a970ff" },
  { id: "warn", label: "⚠️ Warn", color: "#facc15" },
  { id: "clear", label: "🧹 Clear", color: "#6366f1" },
];

const DAY_RANGES = [
  { id: "7", label: "7 dni" },
  { id: "30", label: "30 dni" },
  { id: "90", label: "90 dni" },
  { id: "all", label: "Cały okres" },
];

const PER_PAGE_OPTIONS = [6, 12, 25];

// Realne zabezpieczenia — patrz src/utils/moderationHelpers.ts (canModerate + applyTimeoutSafely)
// i src/services/moderationLogService.ts. Zawsze aktywne dla /ban, /kick, /mute i /warn.
const GUARDS = [
  "Nie można ukarać właściciela serwera",
  "Nie można ukarać samego siebie",
  "Nie można ukarać osoby z rolą wyższą lub równą swojej",
  "Nie można ukarać osoby z rolą wyższą niż rola bota",
  "Nie można wyciszyć osoby z uprawnieniem Administrator — to twarde ograniczenie Discorda",
  "Każda kara (przy włączonym „Zapisz w historii kar”) trafia do zakładki „Otrzymane kary” z moderatorem i powodem",
];

/* ── Helpery ──────────────────────────────────────────────────────── */

function rgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roleColor(color: number): string | undefined {
  return color ? `#${color.toString(16).padStart(6, "0")}` : undefined;
}

function pluralPl(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return one;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

function getAvatarUrl(userId: string, avatar?: string | null): string {
  if (avatar) return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=64`;
  const fallbackIndex = Number(BigInt(userId) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${fallbackIndex}.png`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stepLabel(step: WarnStep): string {
  if (step.action === "mute") {
    const d = MUTE_DURATIONS.find((x) => x.id === step.durationMinutes);
    return `🔇 Wyciszenie na ${d ? d.label : `${step.durationMinutes} min`}`;
  }
  return WARN_ACTIONS.find((a) => a.id === step.action)?.label ?? step.action;
}

/* ── Podkomponenty: picker ról ───────────────────────────────────── */

function RolePicker({
  roles,
  chosen,
  onChange,
}: {
  roles: Role[];
  chosen: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosenRoles = chosen.map((id) => roles.find((r) => r.id === id)).filter((r): r is Role => !!r);
  const free = roles.filter((r) => !chosen.includes(r.id));

  return (
    <div>
      {chosenRoles.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chosenRoles.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-[#d8dbe6]"
              style={{ background: "#17181E", border: "1px solid #2f3341" }}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: roleColor(r.color) ?? "#99AAB5" }} />
              {r.name}
              <button
                type="button"
                onClick={() => onChange(chosen.filter((id) => id !== r.id))}
                className="flex h-3.5 w-3.5 items-center justify-center rounded text-[#6b7280] transition-colors hover:bg-[rgba(239,68,68,0.15)] hover:text-[#ef4444]"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="flex max-h-40 flex-col gap-[3px] overflow-y-auto rounded-lg p-2" style={{ background: "#17181E", border: "1px solid rgba(99,102,241,0.4)" }}>
          {free.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onChange([...chosen, r.id]);
                setOpen(false);
              }}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-[#d8dbe6] transition-colors hover:bg-[#23252f]"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: roleColor(r.color) ?? "#99AAB5" }} />
              {r.name}
            </button>
          ))}
          {free.length === 0 ? <div className="p-2 text-center text-xs text-[#6b7280]">Wszystkie role są już dodane.</div> : null}
          <button type="button" onClick={() => setOpen(false)} className="mt-[3px] rounded-md border py-[6px] text-[11px] font-semibold text-[#8d94a8] transition-colors hover:text-white" style={{ borderColor: "#2f3341" }}>
            Anuluj
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-[11px] font-semibold text-[#8d94a8] transition-colors hover:border-bot-primary hover:text-white"
          style={{ borderColor: "#3a3f4e" }}
        >
          + Dodaj rolę z dostępem mimo braku uprawnień Discorda
        </button>
      )}
    </div>
  );
}

/* ── Podkomponenty: karta komendy ────────────────────────────────── */

function CommandCard({
  meta,
  config,
  roles,
  onUpdate,
  hideDm,
  badge,
  extra,
  defaultOpen,
}: {
  meta: { key: CommandKey; label: string; icon: string; desc: string };
  config: CommandConfig;
  roles: Role[];
  onUpdate: (patch: Partial<CommandConfig>) => void;
  /** /warn ma własny DM sterowany przez "DM z informacją o karze" w sekcji extra poniżej —
   * ten przełącznik nic by tu nie robił, więc go nie pokazujemy. */
  hideDm?: boolean;
  /** Odznaka w nagłówku obok liczby ról (np. tryb drabinki dla /warn). */
  badge?: React.ReactNode;
  /** Dodatkowa sekcja renderowana w rozwiniętym panelu, nad DM/historią/rolami — np. cała
   * konfiguracja drabinki ostrzeżeń dla /warn, żeby nie trzymać jej w osobnej karcie. */
  extra?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);

  return (
    <div className="rounded-[10px] p-4" style={{ background: "#1F2129", border: `1px solid ${config.on ? "transparent" : "#2a2d38"}` }}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => config.on && setOpen((v) => !v)}
          disabled={!config.on}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[15px]" style={{ background: config.on ? "rgba(99,102,241,0.18)" : "#23252f" }}>
            {meta.icon}
          </span>
          <div className="min-w-0 flex-1" style={{ opacity: config.on ? 1 : 0.6 }}>
            <span className="block text-sm font-bold text-white">{meta.label}</span>
            <span className="mt-0.5 block text-[11px] text-[#8d94a8]">{config.on ? meta.desc : "Wyłączona — nikt nie może jej użyć"}</span>
          </div>
          {config.on ? (
            <>
              {badge}
              {config.extraRoleIds.length > 0 ? (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                  +{config.extraRoleIds.length} {config.extraRoleIds.length === 1 ? "rola" : "role"}
                </span>
              ) : null}
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#9aa2b8] transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
            </>
          ) : null}
        </button>
        <Switch checked={config.on} onCheckedChange={(v) => onUpdate({ on: v })} className="shrink-0 data-[state=checked]:bg-[#3b82f6]" />
      </div>

      {config.on && open ? (
        <div className="mt-3.5 flex flex-col gap-3.5 border-t pt-3.5" style={{ borderColor: "#2f3341" }}>
          {extra}
          <div className="flex flex-wrap items-center gap-4">
            {!hideDm ? (
              <label className="flex items-center gap-2">
                <Switch checked={config.dm} onCheckedChange={(v) => onUpdate({ dm: v })} className="shrink-0 data-[state=checked]:bg-[#3b82f6]" style={{ transform: "scale(0.85)" }} />
                <span className="text-xs text-[#b9c0d0]">DM do użytkownika</span>
              </label>
            ) : null}
            <label className="flex items-center gap-2">
              <Switch checked={config.log} onCheckedChange={(v) => onUpdate({ log: v })} className="shrink-0 data-[state=checked]:bg-[#3b82f6]" style={{ transform: "scale(0.85)" }} />
              <span className="text-xs text-[#b9c0d0]">Zapisz w historii kar</span>
            </label>
          </div>
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">Dodatkowy dostęp bez uprawnień Discorda</div>
            <RolePicker roles={roles} chosen={config.extraRoleIds} onChange={(ids) => onUpdate({ extraRoleIds: ids })} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── Podkomponenty: drabinka ostrzeżeń ───────────────────────────── */

function WarnStepEditor({ step, onChange, allowNone = true }: { step: WarnStep; onChange: (step: WarnStep) => void; allowNone?: boolean }) {
  return (
    <div className="flex flex-col gap-[3px]">
      {WARN_ACTIONS.filter((a) => allowNone || a.id !== "none").map((a) => {
        const selected = a.id === step.action;
        return (
          <div key={a.id} className="flex items-center gap-2.5 rounded-md px-[11px]" style={{ background: selected ? rgba(a.color, 0.12) : "transparent" }}>
            <button type="button" onClick={() => onChange({ action: a.id, durationMinutes: a.id === "mute" ? (step.action === "mute" ? step.durationMinutes : 15) : 0 })} className="flex min-w-0 flex-1 items-center gap-2.5 py-[9px] text-left">
              <span className="h-4 w-4 shrink-0 rounded-full box-border" style={{ border: selected ? `5px solid ${a.color}` : "1.5px solid #4b5563" }} />
              <span className="flex-1 text-xs" style={{ fontWeight: selected ? 600 : 400, color: selected ? "#fff" : "#b9c0d0" }}>{a.label}</span>
            </button>
            {a.id === "mute" && selected ? (
              <Select value={String(step.durationMinutes)} onValueChange={(v) => onChange({ action: "mute", durationMinutes: Number(v) })}>
                <SelectTrigger className="h-7 w-[92px] shrink-0 border text-[11px]" style={{ borderColor: "#2f3341", background: "#1d202b" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MUTE_DURATIONS.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function LadderEditor({ steps, onChange }: { steps: WarnStep[]; onChange: (steps: WarnStep[]) => void }) {
  const setStep = (idx: number, step: WarnStep) => {
    const next = [...steps];
    next[idx] = step;
    onChange(next);
  };
  const removeStep = (idx: number) => onChange(steps.filter((_, i) => i !== idx));
  const addStep = () => {
    if (steps.length >= 10) return;
    onChange([...steps, { action: "mute", durationMinutes: 60 }]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {steps.map((step, i) => {
        const meta = WARN_ACTIONS.find((a) => a.id === step.action) ?? WARN_ACTIONS[0];
        const last = i === steps.length - 1;
        return (
          <div key={i} className="flex items-center gap-[11px] rounded-lg py-2.5 pl-3 pr-2.5" style={{ background: "#1d202b", borderLeft: `3px solid ${meta.color}` }}>
            <span className="flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold" style={{ background: rgba(meta.color, 0.16), color: meta.color }}>
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 text-xs text-[#8d94a8]">{last ? `${i + 1}. i kolejne` : `${i + 1}. ostrzeżenie`}</span>
            <Select
              value={step.action === "mute" ? `mute-${step.durationMinutes}` : step.action}
              onValueChange={(v) => {
                if (v.startsWith("mute-")) setStep(i, { action: "mute", durationMinutes: Number(v.slice(5)) });
                else setStep(i, { action: v as WarnAction, durationMinutes: 0 });
              }}
            >
              <SelectTrigger className="h-8 w-[160px] shrink-0 border text-xs" style={{ borderColor: "#2f3341", background: "#17181E" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WARN_ACTIONS.filter((a) => a.id !== "mute" && a.id !== "none").map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.chip}</SelectItem>
                ))}
                {MUTE_DURATIONS.map((d) => (
                  <SelectItem key={d.id} value={`mute-${d.id}`}>🔇 {d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {steps.length > 1 ? (
              <button type="button" onClick={() => removeStep(i)} title="Usuń stopień" className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded text-[#6b7280] transition-colors hover:bg-[rgba(239,68,68,0.15)] hover:text-[#ef4444]">
                ✕
              </button>
            ) : null}
          </div>
        );
      })}
      {steps.length < 10 ? (
        <button
          type="button"
          onClick={addStep}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-[11px] font-semibold text-[#8d94a8] transition-colors hover:border-bot-primary hover:text-white"
          style={{ borderColor: "#3a3f4e" }}
        >
          + Dodaj kolejny stopień
        </button>
      ) : null}
    </div>
  );
}

/* ── Zakładka: Komendy ────────────────────────────────────────────── */

function CommandsTab({
  config,
  setConfig,
  roles,
}: {
  config: ModerationConfig;
  setConfig: React.Dispatch<React.SetStateAction<ModerationConfig>>;
  roles: Role[];
}) {
  const ladder = config.warnMode === "ladder";

  // Cała konfiguracja "co robi /warn" (tryb kary, drabinka/pojedyncza kara, DM, wygasanie) —
  // renderowana wewnątrz karty komendy /warn poniżej, żeby nie trzymać jej w osobnej karcie
  // dublującej to samo ustawienie.
  const warnLadder = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">Kara przy ostrzeżeniu</span>
        <span className="flex-1" />
        <span className="flex gap-[3px] rounded-[7px] p-[3px]" style={{ background: "#1d202b" }}>
          <button type="button" onClick={() => setConfig((p) => ({ ...p, warnMode: "single" }))} className="rounded-[5px] px-[11px] py-[5px] text-[11px] font-semibold" style={{ background: !ladder ? "#6366f1" : "transparent", color: !ladder ? "#fff" : "#8d94a8" }}>
            Jedna kara
          </button>
          <button type="button" onClick={() => setConfig((p) => ({ ...p, warnMode: "ladder" }))} className="rounded-[5px] px-[11px] py-[5px] text-[11px] font-semibold" style={{ background: ladder ? "#6366f1" : "transparent", color: ladder ? "#fff" : "#8d94a8" }}>
            Eskalacja
          </button>
        </span>
      </div>

      {!ladder ? (
        <WarnStepEditor step={config.warnSingle} onChange={(step) => setConfig((p) => ({ ...p, warnSingle: step }))} />
      ) : (
        <LadderEditor steps={config.warnSteps} onChange={(steps) => setConfig((p) => ({ ...p, warnSteps: steps }))} />
      )}

      <div className="flex flex-wrap items-center gap-4 border-t pt-3" style={{ borderColor: "#2f3341" }}>
        <label className="flex items-center gap-2">
          <Switch checked={config.warnDm} onCheckedChange={(v) => setConfig((p) => ({ ...p, warnDm: v }))} className="shrink-0 data-[state=checked]:bg-[#3b82f6]" style={{ transform: "scale(0.85)" }} />
          <span className="text-xs text-[#b9c0d0]">DM z informacją o karze</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={config.warnExpiryOn} onCheckedChange={(v) => setConfig((p) => ({ ...p, warnExpiryOn: v }))} className="shrink-0 data-[state=checked]:bg-[#3b82f6]" style={{ transform: "scale(0.85)" }} />
          <span className="text-xs text-[#b9c0d0]">Ostrzeżenia wygasają po</span>
        </label>
        {config.warnExpiryOn ? (
          <Select value={String(config.warnExpiryDays)} onValueChange={(v) => setConfig((p) => ({ ...p, warnExpiryDays: Number(v) }))}>
            <SelectTrigger className="h-7 w-[92px] border text-[11px]" style={{ borderColor: "#2f3341", background: "#1d202b" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[30, 60, 90, 180, 365].map((d) => (
                <SelectItem key={d} value={String(d)}>{d} dni</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {COMMANDS.map((meta) => (
        <CommandCard
          key={meta.key}
          meta={meta}
          config={config[meta.key]}
          roles={roles}
          onUpdate={(patch) => setConfig((p) => ({ ...p, [meta.key]: { ...p[meta.key], ...patch } }))}
          hideDm={meta.key === "warn"}
          defaultOpen={meta.key === "warn"}
          extra={meta.key === "warn" ? warnLadder : undefined}
          badge={
            meta.key === "warn" ? (
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                {ladder ? "Eskalacja" : "Jedna kara"}
              </span>
            ) : undefined
          }
        />
      ))}

      <div className="rounded-[10px] p-4" style={{ background: "#1F2129", boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]" style={{ background: "rgba(59,130,246,0.16)" }}>
            <Shield className="h-4 w-4" style={{ color: "#93c5fd" }} />
          </span>
          <div className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-white">Ochrona hierarchii</span>
            <span className="mt-0.5 block text-[11px] text-[#8d94a8]">Zawsze aktywna dla /ban, /kick, /mute i /warn — bot odmawia z konkretnym komunikatem</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-[7px] sm:grid-cols-2">
          {GUARDS.map((g) => (
            <div key={g} className="flex items-start gap-2 rounded-md p-2.5 text-[11px] leading-[1.5] text-[#b9c0d0]" style={{ background: "#17181E" }}>
              <Check className="mt-0.5 h-3 w-3 shrink-0" style={{ color: "#86efac" }} />
              <span>{g}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Zakładka: Aktywne ostrzeżenia ────────────────────────────────── */

interface GroupedWarnings {
  userId: string;
  username: string | null;
  avatar: string | null;
  totalForUser: number;
  entries: ActiveWarning[];
}

function groupWarnings(items: ActiveWarning[]): GroupedWarnings[] {
  const map = new Map<string, GroupedWarnings>();
  for (const w of items) {
    const existing = map.get(w.userId);
    if (existing) existing.entries.push(w);
    else map.set(w.userId, { userId: w.userId, username: w.username, avatar: w.avatar, totalForUser: w.totalForUser, entries: [w] });
  }
  return Array.from(map.values());
}

/** Krok, który dostanie ten user przy KOLEJNYM /warn — z tej samej drabinki co bot realnie stosuje. */
function nextPenalty(config: ModerationConfig, totalForUser: number): { label: string; color: string } {
  const ladder = config.warnMode === "ladder";
  const total = ladder ? config.warnSteps.length : 1;
  const nextStep = ladder ? config.warnSteps[Math.min(totalForUser, total - 1)] : config.warnSingle;
  const meta = WARN_ACTIONS.find((a) => a.id === nextStep.action) ?? WARN_ACTIONS[0];
  if (nextStep.action === "none") return { label: "samo ostrzeżenie", color: meta.color };
  if (nextStep.action === "mute") {
    const d = MUTE_DURATIONS.find((x) => x.id === nextStep.durationMinutes);
    return { label: `wyciszenie na ${d ? d.label : `${nextStep.durationMinutes} min`}`, color: meta.color };
  }
  return { label: meta.chip.replace(/^\S+\s/, "").toLowerCase(), color: meta.color };
}

function warningExpiry(config: ModerationConfig, dateIso: string): { text: string; soon: boolean } | null {
  if (!config.warnExpiryOn) return null;
  const expiresAt = new Date(dateIso).getTime() + config.warnExpiryDays * 86_400_000;
  const daysLeft = Math.ceil((expiresAt - Date.now()) / 86_400_000);
  if (daysLeft <= 0) return { text: "wygasa dziś", soon: true };
  return { text: `wygasa za ${daysLeft} ${daysLeft === 1 ? "dzień" : "dni"}`, soon: daysLeft <= 7 };
}

function WarningsTab({ guildId, config, onChanged }: { guildId: string; config: ModerationConfig; onChanged?: () => void }) {
  const [items, setItems] = useState<ActiveWarning[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`/api/guild/${guildId}/moderation/warned`, window.location.origin);
      url.searchParams.set("limit", "50");
      if (q.trim()) url.searchParams.set("q", q.trim());
      const res = await fetchWithAuth(url.toString());
      if (res.ok) {
        const data = await res.json();
        setItems(data.warnings ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      console.error("Error loading active warnings:", err);
      toast.error("Nie udało się załadować listy ostrzeżeń");
    } finally {
      setLoading(false);
    }
  }, [guildId, q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const handleDelete = async (w: ActiveWarning) => {
    if (confirmId !== w.warnEntryId) {
      setConfirmId(w.warnEntryId);
      setTimeout(() => setConfirmId((c) => (c === w.warnEntryId ? null : c)), 3000);
      return;
    }
    setConfirmId(null);
    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/moderation/warned`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: w.userId, warnEntryId: w.warnEntryId }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      // Usuwamy wpis I obniżamy totalForUser u pozostałych wpisów tego usera — inaczej pipsy,
      // odznaka "X/Y" i podgląd następnej kary zostają na starej wartości sprzed usunięcia.
      setItems((prev) =>
        prev
          .filter((x) => x.warnEntryId !== w.warnEntryId)
          .map((x) => (x.userId === w.userId ? { ...x, totalForUser: Math.max(0, x.totalForUser - 1) } : x))
      );
      setTotal((t) => Math.max(0, t - 1));
      toast.success("Ostrzeżenie zostało usunięte");
      onChanged?.();
    } catch (err) {
      console.error("Error removing warning:", err);
      toast.error("Nie udało się usunąć ostrzeżenia");
    }
  };

  const ladder = config.warnMode === "ladder";
  const stepsTotal = ladder ? config.warnSteps.length : 1;
  const grouped = groupWarnings(items);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj po ID użytkownika lub powodzie…"
            className="pl-9"
          />
        </div>
        <span className="shrink-0 text-[11px] text-[#8d94a8]">{total} {total === 1 ? "aktywne ostrzeżenie" : "aktywnych ostrzeżeń"}</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-[10px] p-8 text-center text-sm text-[#6b7280]" style={{ background: "#1F2129" }}>
          Nikt nie ma aktywnych ostrzeżeń.
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map((g) => {
            const next = nextPenalty(config, g.totalForUser);
            const nearLimit = ladder && g.totalForUser >= stepsTotal - 1;
            return (
              <div key={g.userId} className="rounded-[8px] p-3.5" style={{ background: "#17181E" }}>
                <div className="flex items-center gap-[11px]">
                  <img src={getAvatarUrl(g.userId, g.avatar)} alt="" className="h-7 w-7 shrink-0 rounded-full" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{g.username ?? g.userId}</span>
                  <span className="shrink-0 text-xs font-bold" style={{ color: nearLimit ? "#fca5a5" : "#b9c0d0" }}>
                    {ladder ? `${g.totalForUser}/${stepsTotal}` : `${g.totalForUser} ${g.totalForUser === 1 ? "ostrzeżenie" : "ostrzeżeń"}`}
                  </span>
                  <span className="shrink-0 rounded-full px-2.5 py-[3px] text-[10px] font-bold" style={{ background: nearLimit ? "rgba(239,68,68,0.15)" : "rgba(250,204,21,0.15)", color: nearLimit ? "#fca5a5" : "#fcd34d" }}>
                    {ladder ? "następne → " : "każde → "}{next.label}
                  </span>
                </div>

                {ladder ? (
                  <div className="mt-2.5 flex gap-1">
                    {Array.from({ length: stepsTotal }, (_, i) => (
                      <span
                        key={i}
                        className="h-[5px] flex-1 rounded-[3px]"
                        style={{ background: i < g.totalForUser ? (WARN_ACTIONS.find((a) => a.id === config.warnSteps[i]?.action)?.color ?? "#facc15") : "#2f3341" }}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="mt-2.5 flex flex-col gap-1">
                  {g.entries.map((en) => {
                    const expiry = warningExpiry(config, en.date);
                    return (
                      <div key={en.warnEntryId} className="flex items-center gap-2.5 text-[11px] text-[#8d94a8]">
                        <span className="shrink-0 truncate text-[#6b7280]">{formatDate(en.date)}</span>
                        <span className="min-w-0 flex-1 truncate">{en.reason}</span>
                        <span className="shrink-0 text-[#6b7280]">{en.moderatorTag ?? en.moderatorId}</span>
                        {expiry ? (
                          <span className="shrink-0 rounded px-[7px] py-0.5 text-[10px]" style={{ background: "#1d202b", color: expiry.soon ? "#fcd34d" : "#5f6b85" }}>
                            {expiry.text}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleDelete(en)}
                          title="Usuń ostrzeżenie"
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors"
                          style={
                            confirmId === en.warnEntryId
                              ? { background: "#dc2626", color: "#fff" }
                              : { background: "transparent", color: "#6b7280" }
                          }
                        >
                          {confirmId === en.warnEntryId ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Zakładka: Otrzymane kary ─────────────────────────────────────── */

function LogTab({ guildId, onChanged }: { guildId: string; onChanged?: () => void }) {
  const [items, setItems] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<LogKind | "all">("all");
  const [days, setDays] = useState("30");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(6);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`/api/guild/${guildId}/moderation/log`, window.location.origin);
      url.searchParams.set("limit", String(perPage));
      url.searchParams.set("skip", String((page - 1) * perPage));
      url.searchParams.set("days", days);
      if (kind !== "all") url.searchParams.set("kind", kind);
      if (q.trim()) url.searchParams.set("q", q.trim());
      const res = await fetchWithAuth(url.toString());
      if (res.ok) {
        const data = await res.json();
        setItems(data.logs ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      console.error("Error loading moderation log:", err);
      toast.error("Nie udało się załadować historii kar");
    } finally {
      setLoading(false);
    }
  }, [guildId, q, kind, days, page, perPage]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / perPage));

  const setFilterAndResetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  const canUndo = (l: LogEntry) => !l.undone && (l.kind === "ban" || l.kind === "mute" || l.kind === "warn");

  const handleUndo = async (l: LogEntry) => {
    if (confirmId !== l._id) {
      setConfirmId(l._id);
      setTimeout(() => setConfirmId((c) => (c === l._id ? null : c)), 3000);
      return;
    }
    setConfirmId(null);
    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/moderation/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: l._id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Failed to undo");
      }
      setItems((prev) => prev.map((x) => (x._id === l._id ? { ...x, undone: true } : x)));
      toast.success("Kara została cofnięta");
      // Cofnięcie /warn realnie usuwa wpis z aktywnych ostrzeżeń (Warn.$pull) — statystyki
      // u góry strony (aktywne ostrzeżenia, osoby blisko limitu) muszą się odświeżyć.
      onChanged?.();
    } catch (err) {
      console.error("Error undoing action:", err);
      toast.error(err instanceof Error ? err.message : "Nie udało się cofnąć kary");
    }
  };

  const GRID_COLS = "104px minmax(0,1.1fr) 132px minmax(0,1.2fr) 96px 44px";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-[10px] p-3" style={{ background: "#1F2129" }}>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" />
          <Input
            value={q}
            onChange={(e) => setFilterAndResetPage(setQ)(e.target.value)}
            placeholder="Szukaj po użytkowniku, moderatorze lub powodzie…"
            className="h-[34px] border pl-9 text-xs"
            style={{ borderColor: "#2f3341", background: "#17181E" }}
          />
        </div>
        <Select value={kind} onValueChange={(v) => setFilterAndResetPage(setKind)(v as LogKind | "all")}>
          <SelectTrigger className="h-[34px] w-[130px] shrink-0 border text-xs" style={{ borderColor: "#2f3341", background: "#17181E" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOG_KINDS.map((k) => (
              <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={days} onValueChange={setFilterAndResetPage(setDays)}>
          <SelectTrigger className="h-[34px] w-[110px] shrink-0 border text-xs" style={{ borderColor: "#2f3341", background: "#17181E" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DAY_RANGES.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-[10px]" style={{ background: "#1F2129", boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
        <div
          className="hidden gap-2.5 border-b px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.06em] sm:grid"
          style={{ gridTemplateColumns: GRID_COLS, borderColor: "#2f3341", color: "#5f6b85" }}
        >
          <span>Kara</span><span>Użytkownik</span><span>Moderator</span><span>Powód</span><span>Kiedy</span><span />
        </div>

        {loading ? (
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#6b7280]">Brak wpisów w historii kar dla wybranych filtrów.</div>
        ) : (
          items.map((l) => {
            const kindMeta = LOG_KINDS.find((k) => k.id === l.kind)!;
            return (
              <div
                key={l._id}
                className="grid grid-cols-1 items-center gap-1.5 border-b px-3.5 py-2.5 sm:grid-cols-none sm:gap-2.5"
                style={{ gridTemplateColumns: GRID_COLS, borderLeft: `3px solid ${kindMeta.color}`, borderBottomColor: "#23252f", opacity: l.undone ? 0.5 : 1 }}
              >
                <span className="w-fit justify-self-start rounded-full px-2 py-[3px] text-[10px] font-bold" style={{ background: rgba(kindMeta.color, 0.15), color: kindMeta.color }}>
                  {kindMeta.label}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  {l.kind !== "clear" ? (
                    <img src={getAvatarUrl(l.targetId, l.targetAvatar)} alt="" className="h-[22px] w-[22px] shrink-0 rounded-full" />
                  ) : null}
                  <span className="min-w-0 truncate text-xs font-semibold text-white">
                    {l.kind === "clear" ? `#${l.targetTag.replace(/^#/, "")}` : (l.targetUsername ?? l.targetTag)}
                  </span>
                  {l.undone ? <span className="shrink-0 text-[10px] text-[#6b7280]">cofn.</span> : null}
                </span>
                <span className="min-w-0 truncate text-xs" style={{ color: l.moderatorTag.startsWith("Anti-Spam") ? "#a5b4fc" : "#b9c0d0" }}>
                  {l.moderatorTag}
                </span>
                <span className="min-w-0 truncate text-xs text-[#8d94a8]">
                  {l.reason || "—"}{l.extra ? ` · ${l.extra}` : ""}
                </span>
                <span className="text-[11px] text-[#6b7280]">{formatDate(l.createdAt)}</span>
                {canUndo(l) ? (
                  <button
                    type="button"
                    onClick={() => handleUndo(l)}
                    title={confirmId === l._id ? "Na pewno?" : "Cofnij"}
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center justify-self-end rounded-[5px] transition-colors"
                    style={
                      confirmId === l._id
                        ? { background: "#3b82f6", color: "#fff" }
                        : { background: "transparent", color: "#6b7280" }
                    }
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })
        )}

        <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5">
          <span className="text-[11px] text-[#6b7280]">
            {total > 0 ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} z ${total}` : "brak wyników"}
          </span>
          <span className="flex-1" />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Poprzednia strona"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md border transition-colors disabled:cursor-default"
              style={{ borderColor: "#2f3341", color: page > 1 ? "#c4cad8" : "#4b5563" }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className="flex h-[26px] min-w-[26px] items-center justify-center rounded-md border px-1.5 text-[11px]"
                style={{
                  borderColor: n === page ? "#6366f1" : "#2f3341",
                  background: n === page ? "rgba(99,102,241,0.15)" : "transparent",
                  color: n === page ? "#fff" : "#b9c0d0",
                  fontWeight: n === page ? 700 : 500,
                }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              aria-label="Następna strona"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md border transition-colors disabled:cursor-default"
              style={{ borderColor: "#2f3341", color: page < pageCount ? "#c4cad8" : "#4b5563" }}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
            <SelectTrigger className="h-[26px] w-[100px] shrink-0 border text-[11px]" style={{ borderColor: "#2f3341", background: "transparent" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PER_PAGE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>{n} / stronę</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

/* ── Strona ───────────────────────────────────────────────────────── */

export default function ModerationPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { registerDirtyController } = useDirtyState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);

  const [config, setConfig] = useState<ModerationConfig>({ guildId, ...DEFAULT_CONFIG });
  const savedRef = useRef<ModerationConfig>({ guildId, ...DEFAULT_CONFIG });
  const [tab, setTab] = useState<"commands" | "warnings" | "log">("commands");

  // Lekkie podsumowanie do kart statystyk u góry i liczników w zakładkach — pobierane raz,
  // niezależnie od stanu edycji configu poniżej. warnedRows ograniczone do 200 wpisów
  // (limit API) — przy bardzo dużych serwerach "osób blisko limitu" może być przybliżeniem.
  const [statSummary, setStatSummary] = useState<{ warnedRows: ActiveWarning[]; warnedTotal: number; punish30: number; logTotal: number } | null>(null);

  const loadStats = useCallback(async () => {
    if (!guildId) return;
    try {
      const [warnedRes, log30Res, logAllRes] = await Promise.all([
        fetchWithAuth(`/api/guild/${guildId}/moderation/warned?limit=200`),
        fetchWithAuth(`/api/guild/${guildId}/moderation/log?days=30&limit=1`),
        fetchWithAuth(`/api/guild/${guildId}/moderation/log?days=all&limit=1`),
      ]);
      const warned = warnedRes.ok ? await warnedRes.json() : { warnings: [], total: 0 };
      const log30 = log30Res.ok ? await log30Res.json() : { total: 0 };
      const logAll = logAllRes.ok ? await logAllRes.json() : { total: 0 };
      setStatSummary({
        warnedRows: warned.warnings ?? [],
        warnedTotal: warned.total ?? 0,
        punish30: log30.total ?? 0,
        logTotal: logAll.total ?? 0,
      });
    } catch (err) {
      console.error("Error loading moderation stats:", err);
    }
  }, [guildId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesData, configRes] = await Promise.all([
        fetchGuildData<Role[]>(guildId, "roles", `/api/discord/guild/${guildId}/roles`),
        fetchWithAuth(`/api/guild/${guildId}/moderation/config`),
      ]);

      setRoles(rolesData.filter((r) => r.name !== "@everyone"));

      if (configRes.ok) {
        const data = await configRes.json();
        const merged = { guildId, ...DEFAULT_CONFIG, ...data };
        setConfig(merged);
        savedRef.current = merged;
      }
    } catch (err) {
      console.error("Error loading moderation data:", err);
      setError("Nie udało się załadować konfiguracji moderacji. Sprawdź połączenie z internetem i spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    if (guildId) fetchData();
  }, [guildId, fetchData]);

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedRef.current);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/moderation/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to save");
      const saved = await res.json();
      const merged = { guildId, ...DEFAULT_CONFIG, ...saved };
      setConfig(merged);
      savedRef.current = merged;
      toast.success("Konfiguracja moderacji została zapisana!");
    } catch (err) {
      console.error("Error saving config:", err);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  }, [guildId, config]);

  const handleCancel = useCallback(() => {
    setConfig(savedRef.current);
  }, []);

  useEffect(() => registerDirtyController({
    id: `moderation-${guildId}`,
    isDirty,
    isSaving: saving,
    label: "Moderacja",
    onSave: handleSave,
    onCancel: handleCancel,
  }), [guildId, isDirty, saving, handleSave, handleCancel, registerDirtyController]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    fetchData();
  };

  if (error) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <ErrorState title="Nie udało się załadować Moderacji" message={error} onRetry={handleRetry} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="w-full space-y-4">
          <Skeleton className="h-16 w-full" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const onCount = COMMANDS.filter((c) => config[c.key].on).length;
  const ladder = config.warnMode === "ladder";
  const stepsTotal = ladder ? config.warnSteps.length : 1;
  const nearThreshold = ladder ? Math.max(1, stepsTotal - 1) : 1;
  const warnedUserCounts = new Map<string, number>();
  statSummary?.warnedRows.forEach((r) => warnedUserCounts.set(r.userId, r.totalForUser));
  const warnedUserCount = warnedUserCounts.size;
  const nearLimit = [...warnedUserCounts.values()].filter((c) => c >= nearThreshold).length;
  const punish30 = statSummary?.punish30 ?? 0;
  const warnedTotal = statSummary?.warnedTotal ?? 0;
  const logTotal = statSummary?.logTotal ?? 0;

  const STATS = [
    { value: `${onCount}/${COMMANDS.length}`, color: "#fff", label: pluralPl(onCount, "komenda aktywna", "komendy aktywne", "komend aktywnych") },
    { value: String(punish30), color: "#fcd34d", label: pluralPl(punish30, "kara w 30 dni", "kary w 30 dni", "kar w 30 dni") },
    { value: String(warnedTotal), color: "#c9aaff", label: pluralPl(warnedTotal, "aktywne ostrzeżenie", "aktywne ostrzeżenia", "aktywnych ostrzeżeń") },
    {
      value: String(nearLimit),
      color: "#fca5a5",
      label: ladder
        ? pluralPl(nearLimit, "osoba blisko limitu", "osoby blisko limitu", "osób blisko limitu")
        : pluralPl(nearLimit, "osoba z ostrzeżeniami", "osoby z ostrzeżeniami", "osób z ostrzeżeniami"),
    },
  ];

  const TABS: { id: "commands" | "warnings" | "log"; label: string; count: string }[] = [
    { id: "commands", label: "Komendy", count: `${onCount}/${COMMANDS.length}` },
    { id: "warnings", label: "Ostrzeżenia", count: String(warnedUserCount) },
    { id: "log", label: "Otrzymane kary", count: String(logTotal) },
  ];

  return (
    <div className="min-h-full">
      <div className="w-full space-y-3.5">
        <SlideIn direction="up" delay={100}>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
                <Shield className="h-5 w-5 text-bot-primary" />
                Moderacja
              </h1>
              <p className="mt-2 max-w-[640px] text-sm leading-6 text-[#969db0]">
                Kto może używać komend moderacyjnych, jak działa drabinka ostrzeżeń i historia wydanych kar.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-white/80">
              <span>{config.enabled ? "Aktywne" : "Nieaktywne"}</span>
              <DeezySwitch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: checked }))}
                aria-label="Włącz lub wyłącz moduł Moderacja"
              />
            </div>
          </div>
        </SlideIn>

        {!config.enabled ? (
          <SlideIn direction="up" delay={120}>
            <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-[#17181E] px-3 py-2 text-xs leading-6 text-[#9aa2b8]">
              <ShieldOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Komendy moderacyjne są <span className="font-semibold text-white/80">wyłączone</span> — żadna z nich nie zadziała, dopóki nie włączysz przełącznika u góry.
              </span>
            </div>
          </SlideIn>
        ) : null}

        <SlideIn direction="up" delay={140}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <div key={i} className="rounded-[10px] p-3.5" style={{ background: "#1F2129" }}>
                <div className="text-[22px] font-extrabold" style={{ color: s.color }}>{s.value}</div>
                <div className="mt-0.5 text-[11px] text-[#8d94a8]">{s.label}</div>
              </div>
            ))}
          </div>
        </SlideIn>

        <SlideIn direction="up" delay={160}>
          <div className="flex gap-1 rounded-[10px] p-[5px]" style={{ background: "#1F2129" }}>
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[7px] py-2.5 text-xs font-semibold transition-colors"
                  style={{ background: active ? "rgba(99,102,241,0.18)" : "transparent", color: active ? "#fff" : "#8d94a8" }}
                >
                  {t.label}
                  <span className="text-[10px]" style={{ color: active ? "#a5b4fc" : "#5f6b85" }}>{t.count}</span>
                </button>
              );
            })}
          </div>
        </SlideIn>

        <SlideIn direction="up" delay={180}>
          {tab === "commands" ? <CommandsTab config={config} setConfig={setConfig} roles={roles} /> : null}
          {tab === "warnings" ? <WarningsTab guildId={guildId} config={config} onChanged={loadStats} /> : null}
          {tab === "log" ? <LogTab guildId={guildId} onChanged={loadStats} /> : null}
        </SlideIn>
      </div>
    </div>
  );
}
