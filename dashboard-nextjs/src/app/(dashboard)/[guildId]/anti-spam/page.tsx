"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CustomSlider } from "@/components/ui/custom-slider";
import { FileText, ArrowRight, Hash, ShieldOff, ChevronDown } from "lucide-react";
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

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
}

type RuleId = "rate" | "invites" | "mentions" | "repeat";
type Punishment = "none" | "warn" | "mute" | "kick" | "ban";
type Mode = "single" | "ladder";

interface RuleConfig {
  on: boolean;
  deleteMessage: boolean;
  mode: Mode;
  action: Punishment;
  steps: Punishment[];
  muteDuration: string;
  reset: string;
  threshold: number;
  windowSeconds: number;
  allowOwnServerInvites: boolean;
}

interface AntiSpamConfig {
  guildId: string;
  enabled: boolean;
  ignoredChannels: string[];
  ignoredRoles: string[];
  rate: RuleConfig;
  invites: RuleConfig;
  mentions: RuleConfig;
  repeat: RuleConfig;
}

interface PickerOption {
  id: string;
  label: string;
  color?: string;
}

/* ── Stałe ────────────────────────────────────────────────────────── */

const RULE_IDS: RuleId[] = ["rate", "invites", "mentions", "repeat"];

const RULE_META: Record<RuleId, { icon: string; name: string; sub: string; iconBg: string }> = {
  rate: { icon: "⚡", name: "Za szybkie pisanie", sub: "Rate-limit — zbyt wiele wiadomości w krótkim czasie", iconBg: "rgba(99,102,241,0.18)" },
  invites: { icon: "🔗", name: "Linki z zaproszeniami", sub: "discord.gg / discord.com/invite w wiadomościach", iconBg: "rgba(88,101,242,0.18)" },
  mentions: { icon: "👥", name: "Masowe wzmianki", sub: "Zbyt wiele @wzmianek w jednej wiadomości", iconBg: "rgba(236,72,153,0.18)" },
  repeat: { icon: "🔁", name: "Powtarzające się wiadomości", sub: "Ta sama treść wysłana kilka razy pod rząd", iconBg: "rgba(34,197,94,0.18)" },
};

const RULE_SLIDERS: Record<RuleId, { key: "threshold" | "windowSeconds"; label: string; min: number; max: number; unit: string }[]> = {
  rate: [
    { key: "threshold", label: "Próg wiadomości", min: 3, max: 15, unit: "" },
    { key: "windowSeconds", label: "Okno czasowe", min: 1, max: 15, unit: " s" },
  ],
  invites: [],
  mentions: [{ key: "threshold", label: "Próg wzmianek", min: 3, max: 20, unit: "" }],
  repeat: [{ key: "threshold", label: "Identyczne pod rząd", min: 2, max: 10, unit: "" }],
};

const ACTIONS: { id: Punishment; label: string; chip: string; color?: string }[] = [
  { id: "none", label: "Bez dodatkowej kary", chip: "Bez kary" },
  { id: "warn", label: "⚠️ Ostrzeżenie", chip: "⚠️ Ostrzeżenie", color: "#facc15" },
  { id: "mute", label: "🔇 Wyciszenie", chip: "🔇 Wyciszenie", color: "#a970ff" },
  { id: "kick", label: "👢 Wyrzucenie", chip: "👢 Wyrzucenie", color: "#ef4444" },
  { id: "ban", label: "🔨 Ban", chip: "🔨 Ban", color: "#dc2626" },
];
const DURATIONS = [
  { id: "5", label: "5 min" },
  { id: "10", label: "10 min" },
  { id: "60", label: "1 godz." },
  { id: "1440", label: "24 godz." },
];
const RESETS = [
  { id: "1", label: "1 godz." },
  { id: "24", label: "24 godz." },
  { id: "168", label: "7 dni" },
];
const STEP_COLORS = ["#facc15", "#a970ff", "#ef4444", "#dc2626"];

const BASE_RULE: RuleConfig = {
  on: false,
  deleteMessage: true,
  mode: "single",
  action: "mute",
  steps: ["warn"],
  muteDuration: "5",
  reset: "24",
  threshold: 5,
  windowSeconds: 3,
  allowOwnServerInvites: true,
};

const DEFAULT_CONFIG: Omit<AntiSpamConfig, "guildId"> = {
  enabled: false,
  ignoredChannels: [],
  ignoredRoles: [],
  rate: { ...BASE_RULE, on: true, threshold: 5, windowSeconds: 3 },
  invites: { ...BASE_RULE, on: false },
  mentions: { ...BASE_RULE, on: false, threshold: 5 },
  repeat: { ...BASE_RULE, on: false, threshold: 3, windowSeconds: 30 },
};

/* ── Helpery ──────────────────────────────────────────────────────── */

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

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

function actionShortLabel(id: Punishment, muteDuration: string): string {
  if (id === "none") return "";
  if (id === "warn") return "ostrzeżenie";
  if (id === "mute") {
    const d = DURATIONS.find((x) => x.id === muteDuration);
    return `wyciszenie na ${d ? d.label : "10 min"}`;
  }
  if (id === "kick") return "wyrzucenie z serwera";
  if (id === "ban") return "ban";
  return "";
}

function outcomeLabel(rule: RuleConfig): string {
  const parts: string[] = [];
  if (rule.deleteMessage) parts.push("usunięcie wiadomości");
  const id = rule.mode === "ladder" ? rule.steps[rule.steps.length - 1] ?? "warn" : rule.action;
  const label = actionShortLabel(id, rule.muteDuration);
  if (label) parts.push(label);
  return parts.length ? parts.join(" + ") : "brak reakcji (nic nie zostanie zrobione)";
}

function hintFor(ruleId: RuleId, rule: RuleConfig): string {
  const outcome = outcomeLabel(rule);
  const ladder = rule.mode === "ladder" && rule.steps.length > 1;
  const tail = ladder ? ` ${rule.steps.length}. raz → ${outcome}.` : ` → ${outcome}.`;
  // Progi muszą się zgadzać z realnymi warunkami w antiSpamService.ts/antiSpam.ts:
  // rate i repeat triggerują przy `count >= threshold` (próg=5 → spam już przy 5. wiadomości),
  // mentions triggeruje przy `totalMentions > threshold` (ściśle większe — próg=5 → trzeba 6).
  if (ruleId === "rate") return `Przy tych wartościach: ${rule.threshold} wiadomości w ${rule.windowSeconds} s${tail}`;
  if (ruleId === "invites")
    return `${rule.allowOwnServerInvites ? "Linki do innych serwerów" : "Każde zaproszenie, także do tego serwera"}${tail}`;
  if (ruleId === "mentions") return `${rule.threshold + 1} lub więcej wzmianek w jednej wiadomości${tail}`;
  return `${rule.threshold} identyczne wiadomości pod rząd${tail}`;
}

/* ── Podkomponenty ────────────────────────────────────────────────── */

function SinglePunishmentEditor({ rule, onUpdate }: { rule: RuleConfig; onUpdate: (patch: Partial<RuleConfig>) => void }) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onUpdate({ deleteMessage: !rule.deleteMessage })}
        className="flex w-full items-center gap-2.5 rounded-md px-[11px] py-[9px] text-left transition-colors"
        style={{ background: rule.deleteMessage ? "rgba(99,102,241,0.12)" : "transparent" }}
      >
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] text-white"
          style={{ background: rule.deleteMessage ? "#6366f1" : "transparent", border: `1.5px solid ${rule.deleteMessage ? "#6366f1" : "#4b5563"}` }}
        >
          {rule.deleteMessage ? "✓" : ""}
        </span>
        <span className="text-xs" style={{ color: rule.deleteMessage ? "#fff" : "#b9c0d0" }}>🗑️ Usuń wiadomość</span>
      </button>
      <div className="my-2 h-px" style={{ background: "#2f3341" }} />
      <div className="flex flex-col gap-[3px]">
        {ACTIONS.map((a) => {
          const selected = a.id === rule.action;
          return (
            <div key={a.id} className="flex items-center gap-2.5 rounded-md px-[11px]" style={{ background: selected ? "rgba(169,112,255,0.12)" : "transparent" }}>
              <button type="button" onClick={() => onUpdate({ action: a.id })} className="flex min-w-0 flex-1 items-center gap-2.5 py-[9px] text-left">
                <span className="h-4 w-4 shrink-0 rounded-full box-border" style={{ border: selected ? `5px solid ${a.color ?? "#6366f1"}` : "1.5px solid #4b5563" }} />
                <span className="flex-1 text-xs" style={{ fontWeight: selected ? 600 : 400, color: selected ? "#fff" : "#b9c0d0" }}>{a.label}</span>
              </button>
              {a.id === "mute" && selected ? (
                <Select value={rule.muteDuration} onValueChange={(v) => onUpdate({ muteDuration: v })}>
                  <SelectTrigger className="h-7 w-[92px] shrink-0 border text-[11px]" style={{ borderColor: "#2f3341", background: "#1d202b" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LadderEditor({ rule, onUpdate }: { rule: RuleConfig; onUpdate: (patch: Partial<RuleConfig>) => void }) {
  const steps = rule.steps;

  const setStep = (idx: number, action: Punishment) => {
    const next = [...steps];
    next[idx] = action;
    onUpdate({ steps: next });
  };
  const removeStep = (idx: number) => onUpdate({ steps: steps.filter((_, i) => i !== idx) });
  const addStep = () => {
    if (steps.length >= 4) return;
    onUpdate({ steps: [...steps, "kick"] });
  };

  return (
    <div>
      <div className="flex flex-col gap-1.5">
        {steps.map((action, i) => {
          const color = STEP_COLORS[Math.min(i, STEP_COLORS.length - 1)];
          const last = i === steps.length - 1;
          const label = steps.length === 1 ? "każde wykrycie" : last ? `${i + 1}. i kolejne` : `${i + 1}. wykrycie`;
          return (
            <div key={i} className="flex items-center gap-[11px] rounded-lg py-2.5 pl-3 pr-2.5" style={{ background: "#1d202b", borderLeft: `3px solid ${color}` }}>
              <span className="flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-md text-[11px] font-extrabold" style={{ background: rgba(color, 0.16), color }}>
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-xs text-[#8d94a8]">{label}</span>
              <Select value={action} onValueChange={(v) => setStep(i, v as Punishment)}>
                <SelectTrigger className="h-8 w-[132px] shrink-0 border text-xs" style={{ borderColor: "#2f3341", background: "#17181E" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIONS.filter((a) => a.id !== "none").map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.chip}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {steps.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  title="Usuń stopień"
                  className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded text-[#6b7280] transition-colors hover:bg-[rgba(239,68,68,0.15)] hover:text-[#ef4444]"
                >
                  ✕
                </button>
              ) : null}
            </div>
          );
        })}
        {steps.length < 4 ? (
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

      <div className="mt-3 flex flex-wrap items-center gap-3.5 border-t pt-2.5" style={{ borderColor: "#2f3341" }}>
        <span className="flex items-center gap-2">
          <Switch checked={rule.deleteMessage} onCheckedChange={(v) => onUpdate({ deleteMessage: v })} className="shrink-0 data-[state=checked]:bg-[#3b82f6]" style={{ transform: "scale(0.85)" }} />
          <span className="text-[11px] text-[#b9c0d0]">Zawsze usuwaj wiadomość</span>
        </span>
        <span className="flex-1" />
        <span className="flex items-center gap-1.5 text-[11px] text-[#c4cad8]">
          Licznik resetuje się po
          <Select value={rule.reset} onValueChange={(v) => onUpdate({ reset: v })}>
            <SelectTrigger className="h-7 w-[92px] border text-[11px]" style={{ borderColor: "#2f3341", background: "#1d202b" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESETS.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
      </div>
    </div>
  );
}

function RuleCard({
  ruleId,
  rule,
  onUpdate,
}: {
  ruleId: RuleId;
  rule: RuleConfig;
  onUpdate: (patch: Partial<RuleConfig>) => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const meta = RULE_META[ruleId];
  const sliders = RULE_SLIDERS[ruleId];
  const ladder = rule.mode === "ladder";
  const badgeId = ladder ? rule.steps[rule.steps.length - 1] ?? "warn" : rule.action;
  const badgeMeta = ACTIONS.find((a) => a.id === badgeId) ?? ACTIONS[0];
  const accent = badgeMeta.color ?? "#8d94a8";
  const badgeText =
    ladder && rule.steps.length > 1
      ? `${rule.steps.length} stopnie`
      : (rule.deleteMessage ? "🗑️ + " : "") + (badgeMeta.chip || "Bez kary");

  return (
    <div className="rounded-[10px] p-4" style={{ background: "#1F2129", border: `1px solid ${rule.on ? "transparent" : "#2a2d38"}`, boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => rule.on && setPanelOpen((v) => !v)}
          disabled={!rule.on}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[15px]" style={{ background: rule.on ? meta.iconBg : "#23252f" }}>
            {meta.icon}
          </span>
          <div className="min-w-0 flex-1" style={{ opacity: rule.on ? 1 : 0.6 }}>
            <span className="block text-sm font-bold text-white">{meta.name}</span>
            <span className="mt-0.5 block text-[11px] text-[#8d94a8]">{rule.on ? meta.sub : `Wyłączona — ${meta.sub.toLowerCase()}`}</span>
          </div>

          {rule.on ? (
            <>
              <ChevronDown
                className="h-3.5 w-3.5 shrink-0 text-[#9aa2b8] transition-transform"
                style={{ transform: panelOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
              <span
                className="flex shrink-0 items-center gap-1.5 rounded-full text-[11px] font-bold"
                style={{ border: `1px solid ${rgba(accent, 0.5)}`, background: rgba(accent, 0.13), color: accent, padding: "5px 11px" }}
              >
                {ladder && rule.steps.length > 1 ? (
                  <span className="flex items-center gap-[3px]">
                    {rule.steps.map((st, i) => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: ACTIONS.find((a) => a.id === st)?.color ?? "#6b7280" }} />
                    ))}
                  </span>
                ) : null}
                {badgeText}
              </span>
            </>
          ) : null}
        </button>

        <Switch checked={rule.on} onCheckedChange={(v) => onUpdate({ on: v })} className="shrink-0 data-[state=checked]:bg-[#3b82f6]" />
      </div>

      {rule.on ? (
        <div>
          {panelOpen && sliders.length > 0 ? (
            <div className="mt-3.5 grid items-end gap-3.5" style={{ gridTemplateColumns: sliders.length > 1 ? "1fr 1fr" : "minmax(0,1fr)" }}>
              {sliders.map((sl) => {
                const value = rule[sl.key];
                return (
                  <div key={sl.key}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#c4cad8]">{sl.label}</span>
                      <span className="font-mono text-sm font-extrabold text-[#b8c8ff]">{value}{sl.unit}</span>
                    </div>
                    <div className="mt-2">
                      <CustomSlider value={value} onChange={(v) => onUpdate({ [sl.key]: v } as Partial<RuleConfig>)} min={sl.min} max={sl.max} ariaLabel={sl.label} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {panelOpen ? (
            <div className="mt-3.5 rounded-lg p-3.5" style={{ background: "#17181E", border: "1px solid rgba(99,102,241,0.4)" }}>
              <div className="mb-3 flex items-center gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">Co robi bot po wykryciu</span>
                <span className="flex-1" />
                <span className="flex gap-[3px] rounded-[7px] p-[3px]" style={{ background: "#1d202b" }}>
                  <button type="button" onClick={() => onUpdate({ mode: "single" })} className="rounded-[5px] px-[11px] py-[5px] text-[11px] font-semibold" style={{ background: !ladder ? "#6366f1" : "transparent", color: !ladder ? "#fff" : "#8d94a8" }}>
                    Jedna kara
                  </button>
                  <button type="button" onClick={() => onUpdate({ mode: "ladder" })} className="rounded-[5px] px-[11px] py-[5px] text-[11px] font-semibold" style={{ background: ladder ? "#6366f1" : "transparent", color: ladder ? "#fff" : "#8d94a8" }}>
                    Eskalacja
                  </button>
                </span>
              </div>

              {!ladder ? <SinglePunishmentEditor rule={rule} onUpdate={onUpdate} /> : <LadderEditor rule={rule} onUpdate={onUpdate} />}

              {ruleId === "invites" ? (
                <div className="mt-3 flex items-center gap-2 border-t pt-2.5" style={{ borderColor: "#2f3341" }}>
                  <Switch checked={rule.allowOwnServerInvites} onCheckedChange={(v) => onUpdate({ allowOwnServerInvites: v })} className="shrink-0 data-[state=checked]:bg-[#3b82f6]" style={{ transform: "scale(0.85)" }} />
                  <span className="text-xs text-[#b9c0d0]">Pozwól na linki do tego serwera</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {panelOpen ? (
            <div className="mt-3 rounded-md p-2.5 text-[11px] leading-6 text-[#8d94a8]" style={{ background: "#17181E" }}>
              {hintFor(ruleId, rule)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ExceptionPicker({
  heading,
  chosen,
  all,
  pickerOpen,
  onOpenPicker,
  onClosePicker,
  onAdd,
  onRemove,
  addLabel,
  iconRender,
}: {
  heading: string;
  chosen: PickerOption[];
  all: PickerOption[];
  pickerOpen: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  addLabel: string;
  iconRender: (opt: PickerOption) => React.ReactNode;
}) {
  const free = all.filter((o) => !chosen.some((c) => c.id === o.id));

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">{heading}</div>

      {chosen.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {chosen.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#d8dbe6]" style={{ background: "#17181E", border: "1px solid #2f3341" }}>
              {iconRender(c)}
              {c.label}
              <button type="button" onClick={() => onRemove(c.id)} title="Usuń" className="flex h-4 w-4 items-center justify-center rounded text-[#6b7280] transition-colors hover:bg-[rgba(239,68,68,0.15)] hover:text-[#ef4444]">
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {pickerOpen ? (
        <div className="flex flex-col gap-[3px] rounded-lg p-2" style={{ background: "#17181E", border: "1px solid rgba(99,102,241,0.4)" }}>
          {free.map((o) => (
            <button key={o.id} type="button" onClick={() => onAdd(o.id)} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-[#d8dbe6] transition-colors hover:bg-[#23252f]">
              {iconRender(o)}
              {o.label}
            </button>
          ))}
          {free.length === 0 ? <div className="p-2.5 text-center text-xs text-[#6b7280]">Wszystkie pozycje są już na liście.</div> : null}
          <button type="button" onClick={onClosePicker} className="mt-[3px] rounded-md border py-[7px] text-[11px] font-semibold text-[#8d94a8] transition-colors hover:text-white" style={{ borderColor: "#2f3341" }}>
            Anuluj
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpenPicker}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-xs font-semibold text-[#8d94a8] transition-colors hover:border-bot-primary hover:text-white"
          style={{ borderColor: "#3a3f4e" }}
        >
          + {addLabel}
        </button>
      )}
    </div>
  );
}

/* ── Strona ───────────────────────────────────────────────────────── */

export default function AntiSpamPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { registerDirtyController } = useDirtyState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [interventions7d, setInterventions7d] = useState(0);

  const [config, setConfig] = useState<AntiSpamConfig>({ guildId, ...DEFAULT_CONFIG });
  const [exOpen, setExOpen] = useState(true);
  const [chanPicker, setChanPicker] = useState(false);
  const [rolePicker, setRolePicker] = useState(false);

  const savedRef = useRef<AntiSpamConfig>({ guildId, ...DEFAULT_CONFIG });

  useEffect(() => {
    if (guildId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [channelsData, rolesData, configRes, statsRes] = await Promise.all([
        fetchGuildData<Channel[]>(guildId, "channels", `/api/discord/guild/${guildId}/channels`),
        fetchGuildData<Role[]>(guildId, "roles", `/api/discord/guild/${guildId}/roles`),
        fetchWithAuth(`/api/guild/${guildId}/anti-spam/config`),
        fetchWithAuth(`/api/guild/${guildId}/anti-spam/stats`),
      ]);

      setChannels(channelsData.filter((c) => c.type === 0 || c.type === 5));
      setRoles(rolesData.filter((r) => r.name !== "@everyone"));

      if (configRes.ok) {
        const data = await configRes.json();
        const merged = { guildId, ...DEFAULT_CONFIG, ...data };
        setConfig(merged);
        savedRef.current = merged;
      }
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setInterventions7d(stats.interventions7d ?? 0);
      }
    } catch (err) {
      console.error("Error loading anti-spam data:", err);
      setError("Nie udało się załadować konfiguracji Anti-Spam. Sprawdź połączenie z internetem i spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  const updateRule = (ruleId: RuleId, patch: Partial<RuleConfig>) => {
    setConfig((prev) => ({ ...prev, [ruleId]: { ...prev[ruleId], ...patch } }));
  };

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedRef.current);

  const handleSave = useCallback(async () => {
    const onCount = RULE_IDS.filter((id) => config[id].on).length;
    if (onCount === 0) {
      toast.error("Włącz przynajmniej jedną regułę");
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/anti-spam/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to save");
      const saved = await res.json();
      const merged = { guildId, ...DEFAULT_CONFIG, ...saved };
      setConfig(merged);
      savedRef.current = merged;
      toast.success("Konfiguracja Anti-Spamu została zapisana!");
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
    id: `anti-spam-${guildId}`,
    isDirty,
    isSaving: saving,
    label: "Anti-Spam",
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
          <ErrorState title="Nie udało się załadować Anti-Spam" message={error} onRetry={handleRetry} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="w-full space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-20 w-full" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const onCount = RULE_IDS.filter((id) => config[id].on).length;
  const exCount = config.ignoredChannels.length + config.ignoredRoles.length;

  const chosenChannels: PickerOption[] = config.ignoredChannels.map((id) => {
    const c = channels.find((x) => x.id === id);
    return { id, label: c?.name ?? id };
  });
  const allChannelOptions: PickerOption[] = channels.map((c) => ({ id: c.id, label: c.name }));

  const chosenRoles: PickerOption[] = config.ignoredRoles.map((id) => {
    const r = roles.find((x) => x.id === id);
    return { id, label: r?.name ?? id, color: r ? roleColor(r.color) : undefined };
  });
  const allRoleOptions: PickerOption[] = roles.map((r) => ({ id: r.id, label: r.name, color: roleColor(r.color) }));

  return (
    <div className="min-h-full">
      <div className="w-full space-y-4">

        <SlideIn direction="up" delay={100}>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white">Anti-Spam</h1>
              <p className="mt-2 max-w-[640px] text-sm leading-6 text-[#969db0]">
                Każde zagrożenie ma osobną regułę — własny próg i własną karę. Wyjątki obowiązują we wszystkich regułach.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-white/80">
              <span>{config.enabled ? "Aktywne" : "Nieaktywne"}</span>
              <DeezySwitch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: checked }))}
                aria-label="Włącz lub wyłącz Anti-Spam"
              />
            </div>
          </div>
        </SlideIn>

        {!config.enabled ? (
          <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-[#17181E] px-3 py-2 text-xs leading-6 text-[#9aa2b8]">
            <ShieldOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Anti-Spam jest <span className="font-semibold text-white/80">wyłączony</span>. Możesz konfigurować reguły i
              zapisać ustawienia, ale bot nie będzie reagował, dopóki nie włączysz przełącznika{" "}
              <span className="font-semibold text-white/80">Aktywne</span> u góry.
            </span>
          </div>
        ) : null}

        <Link
          href={`/${guildId}/logs?highlight=antiSpam`}
          className="group flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/50 p-4 transition-colors hover:border-bot-primary/40 hover:bg-background/70"
        >
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-bot-primary" />
            <div>
              <p className="text-sm font-medium">Gdzie widać podjęte akcje?</p>
              <p className="text-xs text-muted-foreground">
                Skonfiguruj kanał logów dla zdarzenia „Anti-Spam" w module Logi, aby widzieć każdą wykrytą próbę i podjętą akcję
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-bot-primary" />
        </Link>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[10px] bg-[#1F2129] px-4 py-3.5">
            <div className="text-[22px] font-extrabold text-white">
              {onCount}<span className="text-[13px] font-semibold text-[#6b7280]">/4</span>
            </div>
            <div className="mt-0.5 text-[11px] text-[#8d94a8]">{plural(onCount, "reguła aktywna", "reguły aktywne", "reguł aktywnych")}</div>
          </div>
          <div className="rounded-[10px] bg-[#1F2129] px-4 py-3.5">
            <div className="text-[22px] font-extrabold text-[#fcd34d]">{interventions7d}</div>
            <div className="mt-0.5 text-[11px] text-[#8d94a8]">interwencji w 7 dni</div>
          </div>
          <div className="rounded-[10px] bg-[#1F2129] px-4 py-3.5">
            <div className="text-[22px] font-extrabold text-[#a5b4fc]">{exCount}</div>
            <div className="mt-0.5 text-[11px] text-[#8d94a8]">{plural(exCount, "wyjątek", "wyjątki", "wyjątków")}</div>
          </div>
        </div>

        {RULE_IDS.map((ruleId) => (
          <RuleCard
            key={ruleId}
            ruleId={ruleId}
            rule={config[ruleId]}
            onUpdate={(patch) => updateRule(ruleId, patch)}
          />
        ))}

        <div className="overflow-hidden rounded-[10px] bg-[#1F2129]" style={{ boxShadow: "0 8px 18px rgba(8,10,16,0.16)" }}>
          <button type="button" onClick={() => setExOpen((v) => !v)} className="flex w-full items-center gap-3.5 px-[18px] py-4 text-left transition-colors hover:bg-[#23252f]">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]" style={{ background: "rgba(239,68,68,0.15)" }}>
              <ShieldOff className="h-4 w-4" style={{ color: "#fca5a5" }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white">Wyjątki</span>
              <span className="mt-0.5 block text-[11px] text-[#8d94a8]">Kanały i role pomijane przez wszystkie reguły ({exCount})</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#9aa2b8] transition-transform" style={{ transform: exOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
          </button>

          {exOpen ? (
            <div className="flex flex-col gap-[18px] px-[18px] pb-[18px]">
              <ExceptionPicker
                heading="Ignorowane kanały"
                chosen={chosenChannels}
                all={allChannelOptions}
                pickerOpen={chanPicker}
                onOpenPicker={() => { setChanPicker(true); setRolePicker(false); }}
                onClosePicker={() => setChanPicker(false)}
                onAdd={(id) => {
                  setConfig((prev) => ({ ...prev, ignoredChannels: [...prev.ignoredChannels, id] }));
                  setChanPicker(false);
                  toast.success("Dodano kanał do ignorowanych");
                }}
                onRemove={(id) => {
                  setConfig((prev) => ({ ...prev, ignoredChannels: prev.ignoredChannels.filter((c) => c !== id) }));
                  toast.success("Usunięto kanał z wyjątków");
                }}
                addLabel="Dodaj kanał do ignorowanych"
                iconRender={() => <Hash className="h-3.5 w-3.5 text-[#6b7280]" />}
              />
              <ExceptionPicker
                heading="Ignorowane role"
                chosen={chosenRoles}
                all={allRoleOptions}
                pickerOpen={rolePicker}
                onOpenPicker={() => { setRolePicker(true); setChanPicker(false); }}
                onClosePicker={() => setRolePicker(false)}
                onAdd={(id) => {
                  setConfig((prev) => ({ ...prev, ignoredRoles: [...prev.ignoredRoles, id] }));
                  setRolePicker(false);
                  toast.success("Dodano rolę do ignorowanych");
                }}
                onRemove={(id) => {
                  setConfig((prev) => ({ ...prev, ignoredRoles: prev.ignoredRoles.filter((r) => r !== id) }));
                  toast.success("Usunięto rolę z wyjątków");
                }}
                addLabel="Dodaj rolę do ignorowanych"
                iconRender={(opt) => <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: opt.color ?? "#99AAB5" }} />}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
