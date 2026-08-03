"use client";

import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronDown, ChevronRight, Home, Cake, Hand, Trophy, UserPlus, UserCheck,
  Lightbulb, Ticket, HelpCircle, Tv, Smile, FileText, BarChart3, Activity,
  Radio, ScrollText, Gamepad2, Gift, ShieldAlert, Star, Dices, Puzzle, PartyPopper, Plus, SmilePlus,
} from "lucide-react";
import { prefetchGuildData } from "@/lib/cache";
import { OWNER_IDS, OWNER_GUILD_IDS } from "@/lib/owner";
import { useDirtyState } from "@/components/DirtyStateProvider";

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  hasBot?: boolean;
}

interface ModulesStatus {
  [key: string]: boolean;
}

interface ModuleItem {
  id: string;
  name: string;
  icon: React.ElementType;
  href: string;
  ownerOnly?: boolean;
  ownerGuildOnly?: boolean;
}

interface ModuleGroup {
  id: string;
  label: string | null;
  modules: ModuleItem[];
}

const moduleGroups: ModuleGroup[] = [
  {
    id: "main",
    label: null,
    modules: [
      { id: "", name: "Panel główny", icon: Home, href: "" },
    ],
  },
  {
    id: "management",
    label: "ZARZĄDZANIE SERWEREM",
    modules: [
      { id: "greetings", name: "Powitania", icon: Hand, href: "/greetings" },
      { id: "autoroles", name: "Auto role", icon: UserPlus, href: "/autoroles" },
      { id: "reaction-roles", name: "Role za reakcje", icon: Smile, href: "/reaction-roles" },
      { id: "temp-channels", name: "Tymczasowe Kanały", icon: Radio, href: "/temp-channels" },
      { id: "tickets", name: "Tickety", icon: Ticket, href: "/tickets" },
      { id: "suggestions", name: "Sugestie", icon: Lightbulb, href: "/suggestions" },
    ],
  },
  {
    id: "engagement",
    label: "ZAANGAŻOWANIE I ZABAWA",
    modules: [
      { id: "levels", name: "Poziomy", icon: Trophy, href: "/levels" },
      { id: "birthdays", name: "Urodziny", icon: Cake, href: "/birthdays" },
      { id: "qotd", name: "Pytanie Dnia", icon: HelpCircle, href: "/qotd" },
      { id: "hangman", name: "Wisielec", icon: Dices, href: "/hangman", ownerOnly: true },
      { id: "wordle", name: "Wordle", icon: Puzzle, href: "/wordle", ownerOnly: true },
      { id: "tournament", name: "Turniej CS2", icon: Gamepad2, href: "/tournament", ownerOnly: true, ownerGuildOnly: true },
      { id: "giveaway", name: "Giveaway", icon: Gift, href: "/giveaway" },
      { id: "wrapped", name: "Server Wrapped", icon: PartyPopper, href: "/wrapped", ownerOnly: true, ownerGuildOnly: true },
      { id: "stream-config", name: "Powiadomienia Twitch", icon: Tv, href: "/stream-config" },
    ],
  },
  {
    id: "stats",
    label: "STATYSTYKI",
    modules: [
      { id: "channel-stats", name: "Kanały z licznikami", icon: Activity, href: "/channel-stats" },
      { id: "monthly-stats", name: "Statystyki Miesięczne", icon: BarChart3, href: "/monthly-stats" },
      { id: "invite-tracker", name: "Invite Tracker", icon: UserCheck, href: "/invite-tracker" },
    ],
  },
  {
    id: "moderation",
    label: "MODERACJA SERWERA",
    modules: [
      { id: "logs", name: "Logi", icon: FileText, href: "/logs" },
      { id: "anti-spam", name: "Anti-Spam", icon: ShieldAlert, href: "/anti-spam" },
    ],
  },
  {
    id: "system",
    label: "SYSTEM",
    modules: [
      { id: "audit-logs", name: "Logi Systemowe", icon: ScrollText, href: "/audit-logs" },
      { id: "disboard", name: "Disboard", icon: Star, href: "/disboard", ownerOnly: true, ownerGuildOnly: true },
      { id: "bot-emojis", name: "Emoji Bota", icon: SmilePlus, href: "/bot-emojis", ownerOnly: true },
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

  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildOpen, setGuildOpen] = useState(false);
  const [currentGuild, setCurrentGuild] = useState<Guild | null>(null);
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
    }, "Masz niezapisane zmiany w tym module.");
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
    }, "Zapisz albo anuluj zmiany przed zmianą modułu.");
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
        className={`dashboard-sidebar absolute left-0 top-0 z-[50] m-0 flex h-screen w-[300px] min-w-[300px] transform flex-col overflow-y-auto overscroll-contain bg-dark-800 p-0 transition-all duration-200 ease-out no-scrollbar lg:relative ${
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
              <span className="text-sm text-muted-foreground">Ładowanie...</span>
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
                  <span className="text-sm">Dodaj nowy serwer</span>
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
                  {group.label}
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
                        <span className="text-sm font-medium flex-1 truncate">{module.name}</span>
                        {hasStatusDot && (
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300 ${
                              modulesStatus[module.id]
                                ? "bg-bot-primary shadow-[0_0_5px_1px_rgba(99,102,241,0.6)]"
                                : "bg-gray-500/60"
                            }`}
                            title={modulesStatus[module.id] ? "Włączony" : "Wyłączony"}
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
