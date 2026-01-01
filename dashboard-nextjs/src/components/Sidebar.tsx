"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Home, Cake, Hand, TrendingUp, UserPlus, Lightbulb, Ticket, HelpCircle, Tv, Smile, FileText } from "lucide-react";
import { prefetchGuildData } from "@/lib/cache";

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  hasBot?: boolean;
}

const modules = [
  { id: "", name: "Panel główny", icon: Home, href: "" },
  { id: "birthdays", name: "Urodziny", icon: Cake, href: "/birthdays" },
  { id: "greetings", name: "Powitania", icon: Hand, href: "/greetings" },
  { id: "levels", name: "System Poziomów", icon: TrendingUp, href: "/levels" },
  { id: "autoroles", name: "Auto-role", icon: UserPlus, href: "/autoroles" },
  { id: "qotd", name: "Pytanie Dnia", icon: HelpCircle, href: "/qotd" },
  { id: "stream-config", name: "Powiadomienia Twitch", icon: Tv, href: "/stream-config" },
  { id: "suggestions", name: "Sugestie", icon: Lightbulb, href: "/suggestions" },
  { id: "tickets", name: "Tickety", icon: Ticket, href: "/tickets" },
  { id: "reaction-roles", name: "Role za reakcje", icon: Smile, href: "/reaction-roles" },
  { id: "logs", name: "Logi", icon: FileText, href: "/logs" },
];

export default function Sidebar() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentGuildId = params.guildId as string;
  
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [guildOpen, setGuildOpen] = useState(false);
  const [currentGuild, setCurrentGuild] = useState<Guild | null>(null);
  const guildDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchGuilds();
  }, []);

  useEffect(() => {
    if (guilds.length > 0 && currentGuildId) {
      const guild = guilds.find(g => g.id === currentGuildId);
      if (guild) {
        setCurrentGuild(guild);
      }
    }
  }, [guilds, currentGuildId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (guildDropdownRef.current && !guildDropdownRef.current.contains(event.target as Node)) {
        setGuildOpen(false);
      }
    };

    if (guildOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [guildOpen]);

  const fetchGuilds = async () => {
    try {
      const response = await fetch("/api/discord/guilds");
      if (response.ok) {
        const data = await response.json();
        setGuilds(data.filter((g: Guild) => g.hasBot !== false));
      }
    } catch (error) {
      console.error("Failed to fetch guilds:", error);
    }
  };

  const getGuildIcon = (guild: Guild) => {
    if (guild.icon) {
      return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`;
    }
    return null;
  };

  const handleGuildChange = (guildId: string) => {
    setGuildOpen(false);
    router.push(`/${guildId}`);
  };

  const handleModulePrefetch = () => {
    if (currentGuildId) {
      prefetchGuildData(currentGuildId, ['channels', 'roles', 'members']);
    }
  };

  return (
    <aside
      className="w-64 flex flex-col fixed left-0 top-16 bottom-0 z-40"
      style={{ backgroundColor: '#20272F', boxShadow: 'inset -50px 0 50px 1px #1f252e' }}
    >
      {/* Guild Selector */}
      <div className="p-4">
        <div className="relative" ref={guildDropdownRef}>
          <button
            onClick={() => setGuildOpen(!guildOpen)}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
          >
            {currentGuild ? (
              <>
                {getGuildIcon(currentGuild) ? (
                  <Image
                    src={getGuildIcon(currentGuild)!}
                    alt={currentGuild.name}
                    width={32}
                    height={32}
                    className="rounded-full flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-discord-blurple flex items-center justify-center text-white font-bold flex-shrink-0">
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
            <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-bot-blue/30 bg-card/95 backdrop-blur shadow-lg z-50 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
              {guilds.map((guild) => (
                <button
                  key={guild.id}
                  onClick={() => handleGuildChange(guild.id)}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors ${
                    guild.id === currentGuildId ? "bg-accent" : ""
                  }`}
                >
                  {getGuildIcon(guild) ? (
                    <Image
                      src={getGuildIcon(guild)!}
                      alt={guild.name}
                      width={32}
                      height={32}
                      className="rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-discord-blurple flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {guild.name.charAt(0)}
                    </div>
                  )}
                  <span className="text-sm truncate flex-1 text-left">{guild.name}</span>
                </button>
              ))}
              
              <div className="border-t border-bot-blue/20 mt-1 pt-1">
                <button
                  onClick={() => {
                    setGuildOpen(false);
                    window.open(`https://discord.com/api/oauth2/authorize?client_id=1248419676740915310&permissions=8&scope=bot%20applications.commands`, "_blank");
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-bot-light"
                >
                  <div className="w-8 h-8 rounded-full bg-bot-primary/20 border-2 border-bot-primary/50 border-dashed flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold">+</span>
                  </div>
                  <span className="text-sm font-medium">Dodaj inny serwer</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {modules.map((module) => {
          const Icon = module.icon;
          const modulePath = `/${currentGuildId}${module.href}`;
          const isActive = pathname === modulePath;
          
          return (
            <Link
              key={module.id}
              href={modulePath}
              onMouseEnter={handleModulePrefetch}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-bot-primary text-white"
                  : "hover:bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{module.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
