"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Award,
  Ban,
  Check,
  ChevronDown,
  EyeOff,
  Hash,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { cn } from "@/lib/utils";
import { toSortedDiscordChannels, toSortedDiscordRoles } from "@/lib/discordOrdering";
import { deriveRankCardPalette } from "@/lib/rankCardPalette";
import VariableInserter from "@/components/VariableInserter";
import { CustomSlider } from "@/components/ui/custom-slider";
import { useDirtyState } from "@/components/DirtyStateProvider";
import { DiscordMessagePreview } from "@/components/DiscordMessagePreview";

const PREVIEW_SAMPLE = { level: "67", roleName: "Aktywny" };

/** Niewidoczny sentinel otaczający podstawioną wartość zmiennej — DiscordMessagePreview
 * renderuje taki fragment jako wzmiankę (chip), patrz reguła w DiscordMessagePreview.tsx. */
const SENTINEL = "";
function mention(value: string): string {
  return `${SENTINEL}${value}${SENTINEL}`;
}

/** Podstawia {user}/{roleId}/{level} przykładowymi wartościami do podglądu na żywo. */
function resolveLevelsPreview(template: string): string {
  return template
    .replace(/\{user\}/g, mention("@Deezy"))
    .replace(/\{roleId\}/g, mention(`@${PREVIEW_SAMPLE.roleName}`))
    .replace(/\{level\}/g, PREVIEW_SAMPLE.level);
}

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

interface RoleReward {
  level: number;
  roleId: string;
  rewardMessage?: string;
}

interface ChannelMultiplier {
  channelId: string;
  multiplier: number;
}

interface RoleMultiplier {
  roleId: string;
  multiplier: number;
}

interface LevelConfig {
  guildId: string;
  enabled: boolean;
  xpPerMsg: number;
  xpPerMinVc: number;
  cooldownSec: number;
  notifyChannelId?: string;
  enableLevelUpMessages: boolean;
  levelUpMessage: string;
  rewardMessage: string;
  roleRewards: RoleReward[];
  roleMultipliers: RoleMultiplier[];
  channelMultipliers: ChannelMultiplier[];
  ignoredChannels: string[];
  ignoredRoles: string[];
  cardThemeColor: string;
  showRankBadge: boolean;
  removePreviousRewards: boolean;
}

const MAX_ROLE_REWARDS = 20;

const THEME_COLOR_PRESETS: { name: string; value: string; slug: string }[] = [
  { name: "Lime Green", value: "#84cc16", slug: "lime" },
  { name: "Blue", value: "#3b82f6", slug: "blue" },
  { name: "Aqua", value: "#06b6d4", slug: "aqua" },
  { name: "Mint", value: "#10b981", slug: "mint" },
  { name: "Violet", value: "#8b5cf6", slug: "violet" },
  { name: "Orange", value: "#f97316", slug: "orange" },
];

const DEFAULT_CONFIG: LevelConfig = {
  guildId: "",
  enabled: false,
  xpPerMsg: 5,
  xpPerMinVc: 10,
  cooldownSec: 0,
  enableLevelUpMessages: false,
  levelUpMessage: '{user} jesteś kozakiem! Wbiłeś/aś: **{level}** level. 👏',
  rewardMessage: '{user}! Zdobyto nową rolę na serwerze: {roleId}! Dziękujemy za aktywność!',
  roleRewards: [],
  roleMultipliers: [],
  channelMultipliers: [],
  ignoredChannels: [],
  ignoredRoles: [],
  cardThemeColor: "#3b82f6",
  showRankBadge: true,
  removePreviousRewards: true,
};

/* ── shared accordion row (SettingRow pattern, matching tickets/autoroles/greetings) ── */

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

function ListRow({
  badge,
  color,
  label,
  onRemove,
  removeLabel,
}: {
  badge?: string;
  color?: string;
  label: string;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className={listRowClass}>
      {badge ? (
        <span className="shrink-0 rounded bg-dark-900 px-2 py-1 text-xs font-bold text-[#3b82f6]">{badge}</span>
      ) : null}
      {color ? <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} /> : null}
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">{label}</p>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#8d94a8] transition-colors hover:bg-red-500/20 hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Współrzędne 10 dekoracyjnych kółek w tle — 1:1 z drawDecorativeCircles()
 * w src/utils/canvasRankCard.ts (bot). viewBox SVG poniżej ma dokładnie
 * te same wymiary co canvas (1000x250), więc współrzędne kopiujemy bez
 * przeliczania skali.
 */
const RANK_CARD_CIRCLES: { cx: number; cy: number; r: number }[] = [
  { cx: 88.5, cy: 100.5, r: 75 },
  { cx: 239, cy: 16, r: 10.5 },
  { cx: 396, cy: 33, r: 7.5 },
  { cx: 516, cy: 38, r: 12.5 },
  { cx: 992, cy: 101, r: 10 },
  { cx: 213, cy: 81, r: 10 },
  { cx: 476, cy: 148, r: 40 },
  { cx: 153, cy: 225, r: 10 },
  { cx: 572, cy: 257, r: 30 },
  { cx: 783, cy: 227, r: 8.5 },
];

const RANK_CARD_SAMPLE = {
  username: "Deezy",
  level: 12,
  currentXP: 285,
  requiredXP: 605,
  totalXP: 18260,
  rank: 3,
};

/**
 * Wierny podgląd karty /level — SVG odzwierciedlający dokładnie ten sam
 * układ co canvasRankCard.ts po stronie bota (te same współrzędne,
 * ta sama logika wyprowadzania koloru z motywu), więc to co widać tutaj
 * odpowiada temu, co użytkownicy zobaczą po użyciu /level na Discordzie.
 * Renderowane w 100% po stronie przeglądarki — bez zależności od `canvas`.
 */
function RankCardPreviewSvg({ themeColor, showRank }: { themeColor: string; showRank: boolean }) {
  const palette = deriveRankCardPalette(themeColor);
  const progressX = 210;
  const progressY = 165;
  const progressWidth = 760;
  const progressHeight = 35;
  const percent = Math.min(RANK_CARD_SAMPLE.currentXP / RANK_CARD_SAMPLE.requiredXP, 1);
  const fillWidth = progressWidth * percent;
  const rankEndX = progressX + progressWidth;

  return (
    <div className="w-full overflow-hidden rounded-xl border border-[#2f3341]">
      <svg viewBox="0 0 1000 250" className="block w-full h-auto" style={{ background: "#0a1628" }}>
        <defs>
          <clipPath id="rankCardAvatarClip">
            <circle cx="105" cy="125" r="75" />
          </clipPath>
        </defs>

        {RANK_CARD_CIRCLES.map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={palette.circleTints[i]} />
        ))}

        <image
          href="/deezy.png"
          x={30}
          y={50}
          width={150}
          height={150}
          preserveAspectRatio="xMidYMid slice"
          clipPath="url(#rankCardAvatarClip)"
        />

        <text x={progressX} y={150} fontSize={36} fontWeight={700} fill="#ffffff">
          {RANK_CARD_SAMPLE.username}
        </text>

        <text x={rankEndX} y={150} fontSize={34} fontWeight={700} textAnchor="end">
          <tspan fill="#ffffff">{RANK_CARD_SAMPLE.currentXP.toLocaleString("pl-PL")} </tspan>
          <tspan fill="#7f8381">/ {RANK_CARD_SAMPLE.requiredXP.toLocaleString("pl-PL")} xp</tspan>
        </text>

        <text x={rankEndX} y={75} textAnchor="end">
          <tspan fontSize={36} fontWeight={700} fill="#ffffff">LVL </tspan>
          <tspan fontSize={60} fontWeight={700} fill={palette.primary}>{RANK_CARD_SAMPLE.level}</tspan>
          {showRank && (
            <>
              <tspan fontSize={36} fontWeight={700} fill="#ffffff">   RANK </tspan>
              <tspan fontSize={60} fontWeight={700} fill={palette.primary}>{`#${RANK_CARD_SAMPLE.rank}`}</tspan>
            </>
          )}
        </text>

        <rect x={progressX} y={progressY} width={progressWidth} height={progressHeight} rx={17.5} fill={palette.progressBackground} />
        {fillWidth > 0 && (
          <rect x={progressX} y={progressY} width={fillWidth} height={progressHeight} rx={17.5} fill={palette.progressFill} />
        )}
        <text
          x={progressX + progressWidth / 2}
          y={progressY + progressHeight / 2 + 5}
          fontSize={13}
          fontWeight={700}
          fill="#ffffff"
          textAnchor="middle"
        >
          {`Razem: ${RANK_CARD_SAMPLE.totalXP.toLocaleString("pl-PL").replace(/,/g, ".")} XP`}
        </text>
      </svg>
    </div>
  );
}

/**
 * Hierarchia tła (od najjaśniejszego): wiersz listy / pasek formularza
 * (dark-700) > treść sekcji (dark-800) > pole formularza. Pole jest zawsze
 * JEDEN stopień ciemniejsze od tego, na czym leży bezpośrednio — nigdy dwa
 * (stąd dwie wersje: inputClass dla pól w treści sekcji, boxedInputClass
 * dla pól w jaśniejszym addBoxClass).
 */
const inputClass =
  "h-11 border border-[#3f4455] bg-dark-900 text-white/90 placeholder:text-[#9aa2b8] focus-visible:border-[#3b82f6] focus-visible:ring-[#3b82f6]/30 focus-visible:ring-offset-0 data-[placeholder]:text-[#9aa2b8]";
const boxedInputClass =
  "h-11 border border-[#3f4455] bg-dark-800 text-white/90 placeholder:text-[#9aa2b8] focus-visible:border-[#3b82f6] focus-visible:ring-[#3b82f6]/30 focus-visible:ring-offset-0 data-[placeholder]:text-[#9aa2b8]";
const labelClass = "text-xs font-medium text-[#c4cad8]";
const helperClass = "text-[11px] text-[#6f7690]";
const sectionLabelClass = "text-[11px] font-semibold uppercase tracking-wider text-[#8d94a8]";
/** Jaśniejszy pasek pod formularz dodawania — inputy na nim wyraźnie kontrastują. */
const addBoxClass = "space-y-3 rounded-md bg-dark-700 p-4";
/** Wiersz listy (nagroda / mnożnik / wyjątek) — jaśniejszy od tła sekcji, bez ramki. */
const listRowClass =
  "flex items-center gap-3 rounded-md bg-dark-700 px-3 py-2.5 transition-colors hover:bg-[#2e3140]";
const dashedButtonClass =
  "flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-[#3f4455] bg-transparent px-4 py-3 text-xs font-medium text-[#9aa2b8] transition-colors hover:border-[#3b82f6] hover:bg-dark-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#3f4455] disabled:hover:bg-transparent disabled:hover:text-[#9aa2b8]";

type SectionKey =
  | "xpRules"
  | "levelUpMessages"
  | "rankCard"
  | "roleRewards"
  | "multipliers"
  | "exceptions";

export default function LevelsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { registerDirtyController } = useDirtyState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [config, setConfig] = useState<LevelConfig>({ ...DEFAULT_CONFIG, guildId });
  const savedRef = useRef<LevelConfig>({ ...DEFAULT_CONFIG, guildId });

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    xpRules: true,
    levelUpMessages: true,
    rankCard: false,
    roleRewards: false,
    multipliers: false,
    exceptions: false,
  });

  const [newRewardLevel, setNewRewardLevel] = useState('');
  const [newRewardRoleId, setNewRewardRoleId] = useState('');

  const [newMultiplierChannelId, setNewMultiplierChannelId] = useState('');
  const [newMultiplierValue, setNewMultiplierValue] = useState('1.5');
  const [showChannelMultiplierForm, setShowChannelMultiplierForm] = useState(false);

  const [newRoleMultiplierRoleId, setNewRoleMultiplierRoleId] = useState('');
  const [newRoleMultiplierValue, setNewRoleMultiplierValue] = useState('1.5');
  const [showRoleMultiplierForm, setShowRoleMultiplierForm] = useState(false);

  const [selectedIgnoredChannel, setSelectedIgnoredChannel] = useState('');
  const [selectedIgnoredRole, setSelectedIgnoredRole] = useState('');
  const [showIgnoredChannelForm, setShowIgnoredChannelForm] = useState(false);
  const [showIgnoredRoleForm, setShowIgnoredRoleForm] = useState(false);

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [channelsData, rolesData, configRes] = await Promise.all([
          fetchGuildData<unknown[]>(guildId, 'channels', `/api/discord/guild/${guildId}/channels`),
          fetchGuildData<unknown[]>(guildId, 'roles', `/api/discord/guild/${guildId}/roles`),
          fetchWithAuth(`/api/guild/${guildId}/levels/config`, { next: { revalidate: 600 } }),
        ]);

        if (channelsData) {
          setChannels(toSortedDiscordChannels(channelsData).map((c) => ({ id: c.id, name: c.name, type: c.type })));
        }

        if (rolesData) {
          setRoles(toSortedDiscordRoles(rolesData).map((r) => ({ id: r.id, name: r.name, color: r.color ?? 0 })));
        }

        if (configRes.ok) {
          const configData = await configRes.json();
          const nextConfig: LevelConfig = {
            ...DEFAULT_CONFIG,
            ...configData,
            guildId,
          };
          setConfig(nextConfig);
          savedRef.current = nextConfig;
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading levels data:", error);
        setError("Nie udało się załadować danych systemu poziomów. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [guildId]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedRef.current);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);

      const response = await fetch(`/api/guild/${guildId}/levels/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      savedRef.current = config;
      toast.success("Konfiguracja została zapisana!");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  }, [config, guildId]);

  const handleCancel = useCallback(() => {
    setConfig(savedRef.current);
  }, []);

  useEffect(() => registerDirtyController({
    id: `levels-${guildId}`,
    isDirty,
    isSaving: saving,
    label: "Poziomy",
    onSave: handleSave,
    onCancel: handleCancel,
  }), [guildId, isDirty, saving, handleSave, handleCancel, registerDirtyController]);

  const addRoleReward = () => {
    const level = parseInt(newRewardLevel);
    if (!level || level < 1 || !newRewardRoleId) {
      toast.error("Podaj poprawny poziom (min. 1) i wybierz rolę");
      return;
    }

    if (config.roleRewards.length >= MAX_ROLE_REWARDS) {
      toast.error(`Limit ${MAX_ROLE_REWARDS} nagród został osiągnięty`);
      return;
    }

    if (config.roleRewards.some(r => r.level === level)) {
      toast.error("Nagroda za ten poziom już istnieje");
      return;
    }

    setConfig({
      ...config,
      roleRewards: [
        ...config.roleRewards,
        {
          level,
          roleId: newRewardRoleId,
        },
      ].sort((a, b) => a.level - b.level),
    });

    setNewRewardLevel('');
    setNewRewardRoleId('');
  };

  const removeRoleReward = (level: number) => {
    setConfig({
      ...config,
      roleRewards: config.roleRewards.filter(r => r.level !== level),
    });
  };

  const handleAddMultiplier = () => {
    if (!newMultiplierChannelId) {
      toast.error("Wybierz kanał");
      return;
    }

    const multiplierValue = parseFloat(newMultiplierValue);
    if (isNaN(multiplierValue) || multiplierValue < 0.1 || multiplierValue > 10) {
      toast.error("Mnożnik musi być liczbą między 0.1 a 10");
      return;
    }

    const existingIndex = config.channelMultipliers.findIndex(m => m.channelId === newMultiplierChannelId);
    let updated: ChannelMultiplier[];
    if (existingIndex >= 0) {
      updated = [...config.channelMultipliers];
      updated[existingIndex] = { channelId: newMultiplierChannelId, multiplier: multiplierValue };
    } else {
      updated = [...config.channelMultipliers, { channelId: newMultiplierChannelId, multiplier: multiplierValue }];
    }

    setConfig({ ...config, channelMultipliers: updated });
    setNewMultiplierChannelId("");
    setNewMultiplierValue("1.5");
    setShowChannelMultiplierForm(false);
  };

  const handleDeleteMultiplier = (channelId: string) => {
    setConfig({
      ...config,
      channelMultipliers: config.channelMultipliers.filter(m => m.channelId !== channelId),
    });
  };

  const handleAddRoleMultiplier = () => {
    if (!newRoleMultiplierRoleId) {
      toast.error("Wybierz rolę");
      return;
    }

    const multiplierValue = parseFloat(newRoleMultiplierValue);
    if (isNaN(multiplierValue) || multiplierValue < 0.1 || multiplierValue > 10) {
      toast.error("Mnożnik musi być liczbą między 0.1 a 10");
      return;
    }

    const existingIndex = config.roleMultipliers.findIndex(m => m.roleId === newRoleMultiplierRoleId);
    let updated: RoleMultiplier[];
    if (existingIndex >= 0) {
      updated = [...config.roleMultipliers];
      updated[existingIndex] = { roleId: newRoleMultiplierRoleId, multiplier: multiplierValue };
    } else {
      updated = [...config.roleMultipliers, { roleId: newRoleMultiplierRoleId, multiplier: multiplierValue }];
    }

    setConfig({ ...config, roleMultipliers: updated });
    setNewRoleMultiplierRoleId("");
    setNewRoleMultiplierValue("1.5");
    setShowRoleMultiplierForm(false);
  };

  const handleDeleteRoleMultiplier = (roleId: string) => {
    setConfig({
      ...config,
      roleMultipliers: config.roleMultipliers.filter(m => m.roleId !== roleId),
    });
  };

  const handleAddIgnoredChannel = () => {
    if (!selectedIgnoredChannel) {
      toast.error("Wybierz kanał");
      return;
    }
    if (config.ignoredChannels.includes(selectedIgnoredChannel)) {
      toast.error("Ten kanał jest już ignorowany");
      return;
    }
    setConfig({ ...config, ignoredChannels: [...config.ignoredChannels, selectedIgnoredChannel] });
    setSelectedIgnoredChannel('');
    setShowIgnoredChannelForm(false);
  };

  const handleRemoveIgnoredChannel = (channelId: string) => {
    setConfig({ ...config, ignoredChannels: config.ignoredChannels.filter(id => id !== channelId) });
  };

  const handleAddIgnoredRole = () => {
    if (!selectedIgnoredRole) {
      toast.error("Wybierz rolę");
      return;
    }
    if (config.ignoredRoles.includes(selectedIgnoredRole)) {
      toast.error("Ta rola jest już ignorowana");
      return;
    }
    setConfig({ ...config, ignoredRoles: [...config.ignoredRoles, selectedIgnoredRole] });
    setSelectedIgnoredRole('');
    setShowIgnoredRoleForm(false);
  };

  const handleRemoveIgnoredRole = (roleId: string) => {
    setConfig({ ...config, ignoredRoles: config.ignoredRoles.filter(id => id !== roleId) });
  };

  const getChannelName = (channelId: string) => channels.find(c => c.id === channelId)?.name || 'Nieznany kanał';
  const getRoleName = (roleId: string) => roles.find(r => r.id === roleId)?.name || 'Nieznana rola';
  const getRoleColor = (color: number) => (color === 0 ? '#99AAB5' : `#${color.toString(16).padStart(6, '0')}`);

  if (error) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <ErrorState title="Błąd ładowania danych" message={error} onRetry={handleRetry} />
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
          <Skeleton className="h-16 w-full rounded-md bg-dark-800" />
          <Skeleton className="h-64 w-full rounded-md bg-dark-800" />
        </div>
      </div>
    );
  }

  const rewardsAtCap = config.roleRewards.length >= MAX_ROLE_REWARDS;
  const textChannels = channels.filter(ch => ch.type === 0 || ch.type === 5);

  return (
    <div className="min-h-full pb-16">
      <div className="w-full space-y-5">
        <SlideIn direction="up" delay={100}>
          <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold text-white">Poziomy</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                Ustaw nagrody za XP i poziomy dla aktywnych członków.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <span>{config.enabled ? "Aktywne" : "Nieaktywne"}</span>
              <DeezySwitch checked={config.enabled} onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })} aria-label="Włącz lub wyłącz system poziomów" />
            </div>
          </header>
        </SlideIn>

        {!config.enabled ? (
          <SlideIn direction="up" delay={130}>
            <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-dark-900 px-4 py-3 text-xs text-[#9aa2b8]">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Moduł Poziomów jest <span className="font-semibold text-white/80">wyłączony na tym serwerze</span>. Możesz edytować konfigurację i nagrody, ale bot nie będzie naliczał XP, a komendy <span className="font-semibold text-white/80">/level</span>, <span className="font-semibold text-white/80">/toplvl</span> i <span className="font-semibold text-white/80">/xp</span> nie zadziałają, dopóki nie włączysz przełącznika <span className="font-semibold text-white/80">Aktywne</span> u góry i nie zapiszesz konfiguracji.
              </span>
            </div>
          </SlideIn>
        ) : null}

        {/* ── Zasady zdobywania XP ─────────────────────────────── */}
        <SlideIn direction="up" delay={150}>
          <SettingRow
            title="Zasady zdobywania XP"
            description="Ustaw ile XP dają wiadomości i VC"
            icon={<Sparkles className="h-4 w-4" />}
            isOpen={openSections.xpRules}
            onToggle={() => toggleSection("xpRules")}
          >
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>XP za wiadomość</label>
                  <span className="text-sm font-medium text-[#3b82f6]">{config.xpPerMsg}</span>
                </div>
                <CustomSlider
                  value={config.xpPerMsg}
                  onChange={(v) => setConfig({ ...config, xpPerMsg: v })}
                  min={0}
                  max={50}
                  step={5}
                  ticks={[0, 10, 20, 30, 40, 50]}
                  ariaLabel="XP za wiadomość"
                />
                <p className={helperClass}>Ile XP dostaje użytkownik za każdą wiadomość</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>XP za minutę na VC</label>
                  <span className="text-sm font-medium text-[#3b82f6]">{config.xpPerMinVc}</span>
                </div>
                <CustomSlider
                  value={config.xpPerMinVc}
                  onChange={(v) => setConfig({ ...config, xpPerMinVc: v })}
                  min={0}
                  max={50}
                  step={5}
                  ticks={[0, 10, 20, 30, 40, 50]}
                  ariaLabel="XP za minutę na kanale głosowym"
                />
                <p className={helperClass}>Ile XP za minutę spędzoną na kanale głosowym</p>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Cooldown (sekundy)</label>
                <Input
                  type="number"
                  min="0"
                  value={config.cooldownSec}
                  onChange={(e) => setConfig({ ...config, cooldownSec: parseInt(e.target.value) || 0 })}
                  className={cn(inputClass, "w-32")}
                />
                <p className={helperClass}>Minimalna przerwa między zdobywaniem XP z wiadomości</p>
              </div>
            </div>
          </SettingRow>
        </SlideIn>

        {/* ── Wiadomości o awansie ─────────────────────────────── */}
        <SlideIn direction="up" delay={200}>
          <SettingRow
            title="Wiadomości o awansie"
            description="Powiadomienie i nagroda gdy ktoś zdobędzie poziom"
            icon={<TrendingUp className="h-4 w-4" />}
            isOpen={openSections.levelUpMessages}
            onToggle={() => toggleSection("levelUpMessages")}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-[#2f3341] bg-dark-900 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white/90">Włącz wiadomości o awansie</p>
                  <p className={cn("mt-0.5", helperClass)}>Wysyłaj powiadomienie gdy użytkownik zdobędzie poziom</p>
                </div>
                <DeezySwitch
                  checked={config.enableLevelUpMessages}
                  onCheckedChange={(checked) => setConfig({ ...config, enableLevelUpMessages: checked })}
                />
              </div>

              {config.enableLevelUpMessages && (
                <>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Kanał powiadomień</label>
                    <Select
                      value={config.notifyChannelId || "none"}
                      onValueChange={(value) => setConfig({ ...config, notifyChannelId: value === "none" ? undefined : value })}
                    >
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Brak (DM)" />
                      </SelectTrigger>
                      <SelectContent className="border-[#3f4455] bg-dark-900">
                        <SelectItem value="none">Brak (wiadomość prywatna)</SelectItem>
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
                    <p className={helperClass}>Gdzie wysyłać powiadomienia o awansie</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className={labelClass}>Wiadomość o poziomie</label>
                        <VariableInserter
                          value={config.levelUpMessage}
                          onChange={(value) => setConfig({ ...config, levelUpMessage: value })}
                          variables={[
                            { name: "Użytkownik", display: "Użytkownik", value: "{user}", description: "Wzmianka użytkownika" },
                            { name: "Poziom", display: "Poziom", value: "{level}", description: "Numer poziomu" },
                          ]}
                          rows={2}
                          emojiPicker
                          unstyled
                          className="rounded-md border border-[#2f3341] bg-dark-900 text-sm leading-6 text-[#d8dbe6] transition-colors focus:border-[#3b82f6]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelClass}>Wiadomość o nagrodzie</label>
                        <VariableInserter
                          value={config.rewardMessage}
                          onChange={(value) => setConfig({ ...config, rewardMessage: value })}
                          variables={[
                            { name: "Użytkownik", display: "Użytkownik", value: "{user}", description: "Wzmianka użytkownika" },
                            { name: "Rola", display: "Rola", value: "{roleId}", description: "Wzmianka roli nagrody" },
                          ]}
                          rows={2}
                          emojiPicker
                          unstyled
                          className="rounded-md border border-[#2f3341] bg-dark-900 text-sm leading-6 text-[#d8dbe6] transition-colors focus:border-[#3b82f6]"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#8d94a8]">Podgląd na żywo</p>
                      <div className="space-y-3">
                        <DiscordMessagePreview
                          compact
                          avatarUrl="/deezy.png"
                          content={
                            config.levelUpMessage.trim()
                              ? resolveLevelsPreview(config.levelUpMessage)
                              : "*Brak treści wiadomości*"
                          }
                        />
                        <DiscordMessagePreview
                          compact
                          avatarUrl="/deezy.png"
                          content={
                            config.rewardMessage.trim()
                              ? resolveLevelsPreview(config.rewardMessage)
                              : "*Brak treści wiadomości*"
                          }
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </SettingRow>
        </SlideIn>

        {/* ── Karta /level ─────────────────────────────────────── */}
        <SlideIn direction="up" delay={250}>
          <SettingRow
            title="Karta /level"
            description="Kolor motywu i widoczność rangi na karcie"
            icon={<TrendingUp className="h-4 w-4" />}
            isOpen={openSections.rankCard}
            onToggle={() => toggleSection("rankCard")}
          >
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className={labelClass}>Kolor motywu karty</label>
                  <div className="flex flex-wrap gap-3">
                    {THEME_COLOR_PRESETS.map((preset) => {
                      const selected = config.cardThemeColor === preset.value;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          title={preset.name}
                          onClick={() => setConfig({ ...config, cardThemeColor: preset.value })}
                          className="relative flex h-10 w-10 items-center justify-center rounded-full transition-transform hover:scale-110"
                          style={{
                            backgroundColor: preset.value,
                            boxShadow: selected ? `0 0 0 3px #17181E, 0 0 0 5px ${preset.value}` : 'none',
                          }}
                        >
                          {selected && <Check className="h-5 w-5 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border border-[#2f3341] bg-dark-900 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white/90">Pokaż rangę na serwerze</p>
                    <p className={cn("mt-0.5", helperClass)}>Ukryj, jeśli nie chcesz porównywać użytkowników rankingiem</p>
                  </div>
                  <DeezySwitch
                    checked={config.showRankBadge}
                    onCheckedChange={(checked) => setConfig({ ...config, showRankBadge: checked })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8d94a8]">Podgląd karty</p>
                  <p className={helperClass}>Zobacz jak karta będzie wyglądać w Discordzie</p>
                </div>
                <RankCardPreviewSvg themeColor={config.cardThemeColor} showRank={config.showRankBadge} />
              </div>
            </div>
          </SettingRow>
        </SlideIn>

        {/* ── Nagrody za poziomy ───────────────────────────────── */}
        <SlideIn direction="up" delay={300}>
          <SettingRow
            title="Nagrody za poziomy"
            description={`Role przyznawane za osiągnięcie poziomu (${config.roleRewards.length}/${MAX_ROLE_REWARDS})`}
            icon={<Award className="h-4 w-4" />}
            isOpen={openSections.roleRewards}
            onToggle={() => toggleSection("roleRewards")}
          >
            <div className="space-y-4">
              {config.roleRewards.length === 0 ? (
                <p className="py-4 text-center text-xs text-[#8d94a8]">Brak nagród — dodaj nagrody za osiągnięcie poziomów</p>
              ) : (
                <div className="space-y-2">
                  {config.roleRewards.map((reward) => (
                    <div key={reward.level} className={listRowClass}>
                      <span className="shrink-0 rounded bg-dark-900 px-2 py-1 text-xs font-bold text-[#3b82f6]">
                        {reward.level}
                      </span>
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: getRoleColor(roles.find(r => r.id === reward.roleId)?.color || 0) }}
                      />
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">
                        {reward.level} lvl → {getRoleName(reward.roleId)}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeRoleReward(reward.level)}
                        aria-label={`Usuń nagrodę za poziom ${reward.level}`}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#8d94a8] transition-colors hover:bg-red-500/20 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className={addBoxClass}>
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="w-full space-y-1.5 md:w-28">
                    <label className={labelClass}>Poziom</label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="10"
                      value={newRewardLevel}
                      onChange={(e) => setNewRewardLevel(e.target.value)}
                      disabled={rewardsAtCap}
                      className={boxedInputClass}
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <label className={labelClass}>Rola nagrody</label>
                    <Select value={newRewardRoleId} onValueChange={setNewRewardRoleId} disabled={rewardsAtCap}>
                      <SelectTrigger className={boxedInputClass}>
                        <SelectValue placeholder="Wybierz rolę..." />
                      </SelectTrigger>
                      <SelectContent className="border-[#3f4455] bg-dark-800">
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: getRoleColor(role.color) }} />
                              {role.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <button
                    type="button"
                    onClick={addRoleReward}
                    disabled={rewardsAtCap}
                    className={cn(dashedButtonClass, "h-11 md:w-auto md:shrink-0 md:px-6")}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {rewardsAtCap ? `Limit ${MAX_ROLE_REWARDS} nagród` : "Dodaj nagrodę"}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-md border border-[#2f3341] bg-dark-900 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white/90">Usuwaj poprzednie nagrody</p>
                  <p className={cn("mt-0.5", helperClass)}>Przy zdobyciu nowej roli-nagrody odbierz wcześniejsze, niższe role</p>
                </div>
                <DeezySwitch
                  checked={config.removePreviousRewards}
                  onCheckedChange={(checked) => setConfig({ ...config, removePreviousRewards: checked })}
                />
              </div>
            </div>
          </SettingRow>
        </SlideIn>

        {/* ── Mnożniki XP ──────────────────────────────────────── */}
        <SlideIn direction="up" delay={350}>
          <SettingRow
            title="Mnożniki XP"
            description={`Kanały i role z niestandardowym mnożnikiem (${config.channelMultipliers.length + config.roleMultipliers.length})`}
            icon={<Hash className="h-4 w-4" />}
            isOpen={openSections.multipliers}
            onToggle={() => toggleSection("multipliers")}
          >
            <div className="space-y-6">
              <div className="space-y-3">
                <div className={cn("flex items-center gap-2", sectionLabelClass)}>
                  <Hash className="h-3.5 w-3.5" />
                  Kanały
                </div>

                {showChannelMultiplierForm ? (
                  <div className={addBoxClass}>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className={labelClass}>Kanał</label>
                        <Select value={newMultiplierChannelId} onValueChange={setNewMultiplierChannelId}>
                          <SelectTrigger className={boxedInputClass}>
                            <SelectValue placeholder="Wybierz kanał..." />
                          </SelectTrigger>
                          <SelectContent className="border-[#3f4455] bg-dark-800">
                            {textChannels.map((channel) => (
                              <SelectItem key={channel.id} value={channel.id}>
                                # {channel.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelClass}>Mnożnik</label>
                        <Input
                          type="number"
                          min="0.1"
                          max="10"
                          step="0.1"
                          placeholder="1.5"
                          value={newMultiplierValue}
                          onChange={(e) => setNewMultiplierValue(e.target.value)}
                          className={boxedInputClass}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button type="button" onClick={handleAddMultiplier} className={cn(dashedButtonClass, "flex-1")}>
                        <Plus className="h-3.5 w-3.5" />
                        Dodaj mnożnik kanału
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowChannelMultiplierForm(false);
                          setNewMultiplierChannelId("");
                          setNewMultiplierValue("1.5");
                        }}
                        className="rounded-md border border-[#3f4455] px-4 py-3 text-xs font-medium text-[#9aa2b8] transition-colors hover:text-white"
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowChannelMultiplierForm(true)} className={dashedButtonClass}>
                    <Plus className="h-3.5 w-3.5" />
                    Dodaj mnożnik kanału
                  </button>
                )}

                {config.channelMultipliers.length > 0 && (
                  <div className="space-y-2">
                    {config.channelMultipliers.map((multiplier) => (
                      <ListRow
                        key={multiplier.channelId}
                        label={getChannelName(multiplier.channelId)}
                        badge={`${multiplier.multiplier}x`}
                        onRemove={() => handleDeleteMultiplier(multiplier.channelId)}
                        removeLabel={`Usuń mnożnik kanału ${getChannelName(multiplier.channelId)}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className={cn("flex items-center gap-2", sectionLabelClass)}>
                  <Users className="h-3.5 w-3.5" />
                  Role
                </div>

                {showRoleMultiplierForm ? (
                  <div className={addBoxClass}>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className={labelClass}>Rola</label>
                        <Select value={newRoleMultiplierRoleId} onValueChange={setNewRoleMultiplierRoleId}>
                          <SelectTrigger className={boxedInputClass}>
                            <SelectValue placeholder="Wybierz rolę..." />
                          </SelectTrigger>
                          <SelectContent className="border-[#3f4455] bg-dark-800">
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                <div className="flex items-center gap-2">
                                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: getRoleColor(role.color) }} />
                                  {role.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelClass}>Mnożnik</label>
                        <Input
                          type="number"
                          min="0.1"
                          max="10"
                          step="0.1"
                          placeholder="1.5"
                          value={newRoleMultiplierValue}
                          onChange={(e) => setNewRoleMultiplierValue(e.target.value)}
                          className={boxedInputClass}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button type="button" onClick={handleAddRoleMultiplier} className={cn(dashedButtonClass, "flex-1")}>
                        <Plus className="h-3.5 w-3.5" />
                        Dodaj mnożnik roli
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowRoleMultiplierForm(false);
                          setNewRoleMultiplierRoleId("");
                          setNewRoleMultiplierValue("1.5");
                        }}
                        className="rounded-md border border-[#3f4455] px-4 py-3 text-xs font-medium text-[#9aa2b8] transition-colors hover:text-white"
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowRoleMultiplierForm(true)} className={dashedButtonClass}>
                    <Plus className="h-3.5 w-3.5" />
                    Dodaj mnożnik roli
                  </button>
                )}

                {config.roleMultipliers.length > 0 && (
                  <div className="space-y-2">
                    {config.roleMultipliers.map((multiplier) => (
                      <ListRow
                        key={multiplier.roleId}
                        color={getRoleColor(roles.find(r => r.id === multiplier.roleId)?.color || 0)}
                        label={getRoleName(multiplier.roleId)}
                        badge={`${multiplier.multiplier}x`}
                        onRemove={() => handleDeleteRoleMultiplier(multiplier.roleId)}
                        removeLabel={`Usuń mnożnik roli ${getRoleName(multiplier.roleId)}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SettingRow>
        </SlideIn>

        {/* ── Wyjątki ──────────────────────────────────────────── */}
        <SlideIn direction="up" delay={400}>
          <SettingRow
            title="Wyjątki"
            description={`Kanały i role wykluczone ze zdobywania XP (${config.ignoredChannels.length + config.ignoredRoles.length})`}
            icon={<Ban className="h-4 w-4 text-red-400" />}
            isOpen={openSections.exceptions}
            onToggle={() => toggleSection("exceptions")}
          >
            <div className="space-y-6">
              <div className="space-y-3">
                <div className={cn("flex items-center gap-2", sectionLabelClass)}>
                  <Hash className="h-3.5 w-3.5" />
                  Ignorowane kanały
                </div>

                {showIgnoredChannelForm ? (
                  <div className={addBoxClass}>
                    <Select value={selectedIgnoredChannel} onValueChange={setSelectedIgnoredChannel}>
                      <SelectTrigger className={boxedInputClass}>
                        <SelectValue placeholder="Wybierz kanał..." />
                      </SelectTrigger>
                      <SelectContent className="border-[#3f4455] bg-dark-800">
                        {textChannels
                          .filter(ch => !config.ignoredChannels.includes(ch.id))
                          .map((channel) => (
                            <SelectItem key={channel.id} value={channel.id}>
                              # {channel.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleAddIgnoredChannel} className={cn(dashedButtonClass, "flex-1")}>
                        <Plus className="h-3.5 w-3.5" />
                        Dodaj kanał do ignorowanych
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowIgnoredChannelForm(false);
                          setSelectedIgnoredChannel('');
                        }}
                        className="rounded-md border border-[#3f4455] px-4 py-3 text-xs font-medium text-[#9aa2b8] transition-colors hover:text-white"
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowIgnoredChannelForm(true)} className={dashedButtonClass}>
                    <Plus className="h-3.5 w-3.5" />
                    Dodaj kanał do ignorowanych
                  </button>
                )}

                {config.ignoredChannels.length > 0 && (
                  <div className="space-y-2">
                    {config.ignoredChannels.map((channelId) => (
                      <ListRow
                        key={channelId}
                        label={getChannelName(channelId)}
                        onRemove={() => handleRemoveIgnoredChannel(channelId)}
                        removeLabel={`Usuń z ignorowanych kanał ${getChannelName(channelId)}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className={cn("flex items-center gap-2", sectionLabelClass)}>
                  <Users className="h-3.5 w-3.5" />
                  Ignorowane role
                </div>

                {showIgnoredRoleForm ? (
                  <div className={addBoxClass}>
                    <Select value={selectedIgnoredRole} onValueChange={setSelectedIgnoredRole}>
                      <SelectTrigger className={boxedInputClass}>
                        <SelectValue placeholder="Wybierz rolę..." />
                      </SelectTrigger>
                      <SelectContent className="border-[#3f4455] bg-dark-800">
                        {roles
                          .filter(role => !config.ignoredRoles.includes(role.id))
                          .map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              <div className="flex items-center gap-2">
                                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: getRoleColor(role.color) }} />
                                {role.name}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleAddIgnoredRole} className={cn(dashedButtonClass, "flex-1")}>
                        <Plus className="h-3.5 w-3.5" />
                        Dodaj rolę do ignorowanych
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowIgnoredRoleForm(false);
                          setSelectedIgnoredRole('');
                        }}
                        className="rounded-md border border-[#3f4455] px-4 py-3 text-xs font-medium text-[#9aa2b8] transition-colors hover:text-white"
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowIgnoredRoleForm(true)} className={dashedButtonClass}>
                    <Plus className="h-3.5 w-3.5" />
                    Dodaj rolę do ignorowanych
                  </button>
                )}

                {config.ignoredRoles.length > 0 && (
                  <div className="space-y-2">
                    {config.ignoredRoles.map((roleId) => (
                      <ListRow
                        key={roleId}
                        color={getRoleColor(roles.find(r => r.id === roleId)?.color || 0)}
                        label={getRoleName(roleId)}
                        onRemove={() => handleRemoveIgnoredRole(roleId)}
                        removeLabel={`Usuń z ignorowanych rolę ${getRoleName(roleId)}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SettingRow>
        </SlideIn>
      </div>
    </div>
  );
}
