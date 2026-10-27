"use client";

import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronDown, ChevronRight, Home, Cake, Hand, Trophy, UserPlus, UserCheck,
  Lightbulb, Ticket, HelpCircle, Tv, Smile, FileText, BarChart3, Activity,
  Radio, ScrollText, Gamepad2, Gift, ShieldAlert, Star, Dices, Puzzle, PartyPopper, Plus, SmilePlus, Wrench, Gavel, Settings,
} from "lucide-react";
import { prefetchGuildData } from "@/lib/cache";
import { OWNER_IDS, OWNER_GUILD_IDS } from "@/lib/owner";
import { useDirtyState } from "@/components/DirtyStateProvider";
import { onModulesStatusChanged } from "@/lib/modulesStatusBus";
import { useMessages } from "@/i18n/LanguageProvider";
import { commonMessages } from "@/i18n/messages/common";
import type { Widen } from "@/i18n/config";

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  hasBot?: boolean;
}

interface ModulesStatus {
  [key: string]: boolean;
}

type SidebarText = Widen<(typeof commonMessages)["pl"]["sidebar"]>;

interface ModuleItem {
  id: string;
  /** Klucz w commonMessages.sidebar.modules. */
  name: keyof SidebarText["modules"];
  icon: React.ElementType;
  href: string;
  ownerOnly?: boolean;
  ownerGuildOnly?: boolean;
}

interface ModuleGroup {
  id: string;
  /** Klucz w commonMessages.sidebar.groups. */
  label: keyof SidebarText["groups"] | null;
  modules: ModuleItem[];
}

const moduleGroups: ModuleGroup[] = [
  {
    id: "main",
    label: null,
    modules: [
      { id: "", name: "home", icon: Home, href: "" },
      { id: "settings", name: "settings", icon: Settings, href: "/settings" },
    ],
  },
  {
    id: "management",
    label: "management",
    modules: [
      { id: "commands", name: "commands", icon: Wrench, href: "/commands" },
      { id: "greetings", name: "greetings", icon: Hand, href: "/greetings" },
      { id: "autoroles", name: "autoroles", icon: UserPlus, href: "/autoroles" },
      { id: "reaction-roles", name: "reactionRoles", icon: Smile, href: "/reaction-roles" },
      { id: "temp-channels", name: "tempChannels", icon: Radio, href: "/temp-channels" },
      { id: "tickets", name: "tickets", icon: Ticket, href: "/tickets" },
      { id: "suggestions", name: "suggestions", icon: Lightbulb, href: "/suggestions" },
    ],
  },
  {
    id: "engagement",
    label: "engagement",
    modules: [
      { id: "levels", name: "levels", icon: Trophy, href: "/levels" },
      { id: "birthdays", name: "birthdays", icon: Cake, href: "/birthdays" },
      { id: "qotd", name: "qotd", icon: HelpCircle, href: "/qotd" },
      { id: "hangman", name: "hangman", icon: Dices, href: "/hangman", ownerOnly: true },
      { id: "wordle", name: "wordle", icon: Puzzle, href: "/wordle", ownerOnly: true },
      { id: "tournament", name: "tournament", icon: Gamepad2, href: "/tournament", ownerOnly: true, ownerGuildOnly: true },
      { id: "giveaway", name: "giveaway", icon: Gift, href: "/giveaway" },
      { id: "wrapped", name: "wrapped", icon: PartyPopper, href: "/wrapped", ownerOnly: true, ownerGuildOnly: true },
      { id: "stream-config", name: "streamConfig", icon: Tv, href: "/stream-config" },
    ],
  },
  {
    id: "stats",
    label: "stats",
    modules: [
      { id: "channel-stats", name: "channelStats", icon: Activity, href: "/channel-stats" },
      { id: "monthly-stats", name: "monthlyStats", icon: BarChart3, href: "/monthly-stats" },
      { id: "invite-tracker", name: "inviteTracker", icon: UserCheck, href: "/invite-tracker" },
    ],
  },
  {
    id: "moderation",
    label: "moderation",
    modules: [
      { id: "logs", name: "logs", icon: FileText, href: "/logs" },
      { id: "anti-spam", name: "antiSpam", icon: ShieldAlert, href: "/anti-spam" },
      { id: "moderation", name: "moderation", icon: Gavel, href: "/moderation" },
    ],
  },
  {
    id: "system",
    label: "system",
    modules: [
      { id: "audit-logs", name: "auditLogs", icon: ScrollText, href: "/audit-logs" },
      { id: "disboard", name: "disboard", icon: Star, href: "/disboard", ownerOnly: true, ownerGuildOnly: true },
      { id: "bot-emojis", name: "botEmojis", icon: SmilePlus, href: "/bot-emojis", ownerOnly: true },
    ],
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps = {}) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentGuildId = params.guildId as string;
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;
  const { guardedNavigate } = useDirtyState();
  const t = useMessages(commonMessages).sidebar;

  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildOpen, setGuildOpen] = useState(false);
  const [currentGuild, setCurrentGuild] = useState<Guild | null>(null);
  // Lista serwerów pobrana (albo pobieranie się nie udało): od tej chwili brak currentGuild
  // znaczy „nie masz tego serwera na liście”, a nie „jeszcze ładuję”.
  const [guildsLoaded, setGuildsLoaded] = useState(false);
  const [modulesStatus, setModulesStatus] = useState<ModulesStatus>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const guildDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchGuilds();
    try {
      const saved = localStorage.getItem("sidebar-collapsed-groups");
      if (saved) setCollapsedGroups(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    if (currentGuildId) fetchModulesStatus();
  }, [currentGuildId]);

  // Strony modułów wołają notifyModulesStatusChanged() po zapisie (patrz
  // FloatingSaveBar / reaction-roles) — bez tego kropka on/off aktualizowała
  // się dopiero po odświeżeniu strony, bo Sidebar żyje poza modułem.
  useEffect(() => {
    if (!currentGuildId) return;
    return onModulesStatusChanged(() => fetchModulesStatus());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGuildId]);

  useEffect(() => {
    if (guilds.length > 0 && currentGuildId) {
      const guild = guilds.find((g) => g.id === currentGuildId);
      if (guild) setCurrentGuild(guild);
    }
  }, [guilds, currentGuildId]);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (guildDropdownRef.current && !guildDropdownRef.current.contains(event.target as Node)) {
        setGuildOpen(false);
      }
    };
    if (guildOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [guildOpen]);

  const fetchGuilds = async () => {
    try {
      const response = await fetch("/api/discord/guilds");
      if (response.ok) {
        const data: Guild[] = await response.json();
        setCurrentGuild(data.find((guild) => guild.id === currentGuildId) ?? null);
        setGuilds(data.filter((guild) => guild.hasBot !== false));
      }
    } catch (error) {
      console.error("Failed to fetch guilds:", error);
    } finally {
      setGuildsLoaded(true);
    }
  };

  const fetchModulesStatus = async () => {
    try {
      const response = await fetch(`/api/guild/${currentGuildId}/modules-status`);
      if (response.ok) {
        const data = await response.json();
        setModulesStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch modules status:", error);
    }
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try { localStorage.setItem("sidebar-collapsed-groups", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const getGuildIcon = (guild: Guild) =>
    guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64` : null;

  const handleGuildChange = (guildId: string) => {
    setGuildOpen(false);
    guardedNavigate(() => {
      onClose?.();
      router.push(`/${guildId}`);
    }, t.unsavedChangeServer);
  };

  const handleModuleNavigate = (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault();

    if (pathname === href) {
      onClose?.();
      return;
    }

    guardedNavigate(() => {
      onClose?.();
      router.push(href);
    }, t.unsavedChangeModule);
  };

  const handleModulePrefetch = () => {
    if (currentGuildId) prefetchGuildData(currentGuildId, ["channels", "roles", "members"]);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`dashboard-sidebar absolute left-0 top-0 z-[50] m-0 flex h-dvh w-[300px] min-w-[300px] transform flex-col overflow-y-auto overscroll-contain bg-dark-800 p-0 transition-all duration-200 ease-out no-scrollbar lg:relative ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:!translate-x-0`}
      >
      {/* Brand */}
      <div className="h-20 px-5 flex items-center justify-center shrink-0">
        <Link href="/" className="flex items-center gap-4 hover:opacity-85 transition-opacity min-w-0">
          <div className="relative flex-shrink-0">
            <Image
              src="/deezy.png"
              alt="Deezy"
              width={42}
              height={42}
              className="rounded-full"
            />
          </div>
          <span className="text-2xl font-bold text-white/90 truncate mt-1.5">
            Deezy
          </span>
        </Link>
      </div>

      {/* Guild Selector */}
        <div className="px-5 pt-3 pb-1 shrink-0">
        <div className="relative" ref={guildDropdownRef}>
          <button
            onClick={() => setGuildOpen(!guildOpen)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors border border-bot-primary/40 hover:border-bot-primary/70"
            style={{ backgroundColor: "#13161a" }}
          >
            {currentGuild ? (
              <>
                {getGuildIcon(currentGuild) ? (
                  <Image
                    src={getGuildIcon(currentGuild)!}
                    alt={currentGuild.name}
                    width={28}
                    height={28}
                    className="w-7 h-7 rounded-full flex-shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-discord-blurple flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {currentGuild.name.charAt(0)}
                  </div>
                )}
                <span className="text-sm font-semibold truncate flex-1 text-left">
                  {currentGuild.name}
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground flex-1 text-left">{guildsLoaded ? t.chooseServer : t.loading}</span>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${guildOpen ? "rotate-180" : ""}`} />
          </button>

          {guildOpen && (
            <div
              className="absolute top-full left-0 right-0 mt-1.5 rounded-lg shadow-xl z-50 flex flex-col max-h-80 animate-in fade-in slide-in-from-top-2 duration-150"
              style={{ backgroundColor: "#13161a", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {/* Current guild — pinned top */}
              {currentGuild && (
                <div className="p-1.5 flex-shrink-0 border-b border-white/[0.06]">
                  <button
                    onClick={() => setGuildOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors border border-bot-primary/30 bg-bot-primary/10 text-white"
                  >
                    {getGuildIcon(currentGuild) ? (
                      <Image
                        src={getGuildIcon(currentGuild)!}
                        alt={currentGuild.name}
                        width={28}
                        height={28}
                        className="w-7 h-7 rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-discord-blurple flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {currentGuild.name.charAt(0)}
                      </div>
                    )}
                    <span className="text-sm font-semibold truncate flex-1 text-left">{currentGuild.name}</span>
                  </button>
                </div>
              )}

              {/* Other guilds — scrollable middle */}
              {guilds.filter((g) => g.id !== currentGuildId).length > 0 && (
                <div className="overflow-y-auto no-scrollbar overscroll-contain flex-1 p-1.5 flex flex-col gap-0.5">
                  {guilds.filter((g) => g.id !== currentGuildId).map((guild) => (
                    <button
                      key={guild.id}
                      onClick={() => handleGuildChange(guild.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors hover:bg-white/5 text-muted-foreground hover:text-foreground"
                    >
                      {getGuildIcon(guild) ? (
                        <Image
                          src={getGuildIcon(guild)!}
                          alt={guild.name}
                          width={28}
                          height={28}
                          className="w-7 h-7 rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-discord-blurple flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {guild.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm truncate flex-1 text-left">{guild.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Add server — pinned bottom */}
              <div className="p-1.5 flex-shrink-0 border-t border-white/[0.06]">
                <button
                  onClick={() =>
                    window.open(
                      `https://discord.com/api/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? ""}&permissions=8&scope=bot%20applications.commands`,
                      "_blank"
                    )
                  }
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors hover:bg-white/5 text-muted-foreground hover:text-foreground"
                >
                  <div className="w-8 h-8 rounded-full border border-dashed border-white/20 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="text-sm">{t.addServer}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
    <nav className="px-5 pb-4 mt-6 space-y-3">
        {moduleGroups.map((group) => {
          const isCollapsed = collapsedGroups[group.id] ?? false;

          return (
            <div key={group.id} className="">
              {/* Group Header */}
              {group.label && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center gap-1 px-3 pt-3 pb-1 text-[10px] font-semibold tracking-widest hover:text-muted-foreground transition-colors"
                  style={{ color: "rgb(242 244 251)" }}
                >
                  <ChevronRight
                    className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
                  />
                  {t.groups[group.label]}
                </button>
              )}

              {/* Group Modules */}
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {group.modules.filter(m => !m.ownerOnly || (OWNER_IDS.includes(currentUserId ?? '') && (!m.ownerGuildOnly || OWNER_GUILD_IDS.includes(currentGuildId ?? '')))).map((module) => {
                    const Icon = module.icon;
                    const modulePath = `/${currentGuildId}${module.href}`;
                    const isActive = pathname === modulePath;
                    const hasStatusDot = module.id !== "" && modulesStatus[module.id] !== undefined;

                    return (
                      <Link
                        key={`${module.id}-${currentGuildId}`}
                        href={modulePath}
                        onMouseEnter={handleModulePrefetch}
                        onClick={(event) => handleModuleNavigate(event, modulePath)}
                        className={`relative flex items-center gap-3 px-3 py-2 transition-all duration-150 ${
                          isActive
                            ? "rounded bg-bot-primary/15 text-white"
                            : "rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {isActive && (
                          <span
                            className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r-full bg-bot-primary"
                            aria-hidden="true"
                          />
                        )}
                        <Icon className="w-6 h-6 flex-shrink-0" strokeWidth={1.5} />
                        <span className="text-sm font-medium flex-1 truncate">{t.modules[module.name]}</span>
                        {hasStatusDot && (
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300 ${
                              modulesStatus[module.id]
                                ? "bg-bot-primary shadow-[0_0_5px_1px_rgba(99,102,241,0.6)]"
                                : "bg-gray-500/60"
                            }`}
                            title={modulesStatus[module.id] ? t.enabled : t.disabled}
                          />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      </aside>
    </>
  );
}
