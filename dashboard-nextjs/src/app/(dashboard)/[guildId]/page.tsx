"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Home, Cake, Hand, TrendingUp, UserPlus, Lightbulb, Ticket, HelpCircle, MessagesSquare, Smile, BarChart3, Activity, Radio, Gift } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideIn } from "@/components/ui/animated";
import { prefetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
  botPresent: boolean;
}

interface ModulesStatus {
  [key: string]: boolean;
}

const modules = [
  { id: "birthdays", name: "Urodziny", icon: Cake, description: "System życzeń urodzinowych", color: "bg-pink-500" },
  { id: "greetings", name: "Powitania", icon: Hand, description: "Wiadomości powitalne i pożegnalne", color: "bg-green-500" },
  { id: "levels", name: "System Poziomów", icon: TrendingUp, description: "System XP i poziomów", color: "bg-purple-500" },
  { id: "monthly-stats", name: "Statystyki Miesięczne", icon: BarChart3, description: "Miesięczne podsumowania aktywności", color: "bg-indigo-500" },
  { id: "channel-stats", name: "Statystyki Kanałów", icon: Activity, description: "Dynamiczne statystyki na kanałach głosowych", color: "bg-teal-500" },
  { id: "temp-channels", name: "Tymczasowe Kanały", icon: Radio, description: "Automatyczne tworzenie prywatnych kanałów głosowych", color: "bg-pink-500" },
  { id: "autoroles", name: "Auto-role", icon: UserPlus, description: "Automatyczne role przy dołączeniu", color: "bg-blue-500" },
  { id: "qotd", name: "Pytanie Dnia", icon: HelpCircle, description: "Codzienne pytania dla społeczności", color: "bg-cyan-500" },
  { id: "suggestions", name: "Sugestie", icon: Lightbulb, description: "System zgłaszania propozycji", color: "bg-yellow-500" },
  { id: "tickets", name: "Tickety", icon: Ticket, description: "System zgłoszeń wsparcia", color: "bg-red-500" },
  { id: "giveaway", name: "Giveaway", icon: Gift, description: "Konfiguracja giveawayów", color: "bg-pink-600" },
  { id: "stream-config", name: "Twitch", icon: MessagesSquare, description: "Powiadomienia o streamach", color: "bg-purple-600" },
  { id: "reaction-roles", name: "Role za reakcje", icon: Smile, description: "Role przypisywane przez reakcje", color: "bg-orange-500" },
];

const getGuildIcon = (guild: GuildInfo | null) => {
  if (!guild?.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
};

export default function GuildDashboard() {
  const params = useParams();
  const router = useRouter();
  const guildId = params.guildId as string;
  const [loading, setLoading] = useState(true);
  const [guild, setGuild] = useState<GuildInfo | null>(null);
  const [modulesStatus, setModulesStatus] = useState<ModulesStatus>({});
  const [clickedModule, setClickedModule] = useState<string | null>(null);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchGuildInfo = async () => {
      try {
        const response = await fetchWithAuth(`/api/discord/guild/${guildId}`);
        if (response.ok) {
          const data = await response.json();
          setGuild({
            id: guildId,
            name: data.name,
            icon: data.icon,
            botPresent: data.hasBot !== false,
          });
        } else {
          setGuild({
            id: guildId,
            name: "Twój serwer",
            icon: null,
            botPresent: true,
          });
        }
      } catch (error) {
        console.error("Failed to fetch guild:", error);
        setGuild({
          id: guildId,
          name: "Twój serwer",
          icon: null,
          botPresent: true,
        });
      } finally {
        setLoading(false);
      }
    };

    const fetchModulesStatus = async () => {
      try {
        const response = await fetch(`/api/guild/${guildId}/modules-status`);
        if (response.ok) {
          const data = await response.json();
          setModulesStatus(data);
        }
      } catch (error) {
        console.error("Failed to fetch modules status:", error);
      }
    };

    fetchGuildInfo();
    fetchModulesStatus();
  }, [guildId]);

  const handleModuleHover = (moduleId: string) => {
    prefetchGuildData(guildId, ['channels', 'roles', 'members']);
  };

  const handleModuleClick = (e: React.MouseEvent, moduleId: string) => {
    
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
    
    setClickedModule(moduleId);
    
    navigationTimeoutRef.current = setTimeout(() => {
      router.push(`/${guildId}/${moduleId}`);
      navigationTimeoutRef.current = null
      router.push(`/${guildId}/${moduleId}`);
    }, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto p-4 md:p-8">
          <Skeleton className="h-10 w-48 mb-4" />
          
          <div className="mb-8">
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <Card 
                key={i}
                className="backdrop-blur"
                style={{
                  backgroundColor: 'rgba(189, 189, 189, .05)',
                  boxShadow: '0 0 10px #00000026',
                  border: '1px solid transparent'
                }}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-lg" />
                    <Skeleton className="h-6 w-32" />
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!guild?.botPresent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-discord-blurple/10 via-background to-discord-fuchsia/10 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Bot nie jest na serwerze</CardTitle>
            <CardDescription>
              Aby zarządzać tym serwerem, musisz najpierw dodać DyzioBot
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" size="lg">
              <a
                href={`https://discord.com/api/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${guildId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Dodaj bota na serwer
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full mt-2">
              <Link href="/guilds">Wróć do listy serwerów</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-4 md:p-8">
        <SlideIn direction="up">
          <div className="mb-8">
            <Link 
              href="/guilds"
              className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded-lg bg-gradient-to-r from-bot-blue/10 to-bot-primary/10 hover:from-bot-blue/20 hover:to-bot-primary/20 border border-bot-blue/30 hover:border-bot-blue/50 transition-all group"
            >
              <svg 
                className="w-4 h-4 text-bot-light group-hover:-translate-x-1 transition-transform" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium text-foreground">Wszystkie serwery</span>
            </Link>
            <div className="flex items-center gap-4">
              {getGuildIcon(guild) ? (
                <Image
                  src={getGuildIcon(guild)!}
                  alt={guild.name}
                  width={64}
                  height={64}
                  className="rounded-full shadow-lg shadow-bot-primary/20"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-bot-light to-bot-primary flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-bot-primary/20">
                  {guild.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold mb-1 bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                  Panel główny - {guild.name}
                </h1>
                <p className="text-muted-foreground">Zarządzaj modułami bota na swoim serwerze</p>
              </div>
            </div>
          </div>
        </SlideIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module, index) => (
            <SlideIn key={module.id} direction="up" delay={index * 50}>
              <Link 
                href={`/${guildId}/${module.id}`}
                onMouseEnter={() => handleModuleHover(module.id)}
                onClick={(e) => handleModuleClick(e, module.id)}
                prefetch={true}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-bot-primary focus-visible:ring-offset-2 rounded-lg block"
              >
                <Card 
                  className={`hover:shadow-xl hover:shadow-bot-primary/10 transition-all cursor-pointer hover:scale-105 h-full backdrop-blur ${
                    clickedModule === module.id ? 'opacity-60 scale-95' : ''
                  }`}
                  style={{
                    backgroundColor: 'rgba(189, 189, 189, .05)',
                    boxShadow: '0 0 10px #00000026',
                    border: '1px solid transparent'
                  }}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-br from-bot-light to-bot-primary p-3 rounded-lg shadow-lg shadow-bot-primary/20">
                        {clickedModule === module.id ? (
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        ) : (
                          <module.icon className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-lg">{module.name}</CardTitle>
                          {modulesStatus[module.id] !== undefined && (
                            <Badge 
                              variant={modulesStatus[module.id] ? "default" : "secondary"}
                              className={modulesStatus[module.id] 
                                ? "bg-green-500 hover:bg-green-600 text-white" 
                                : "bg-gray-400 hover:bg-gray-500 text-white"
                              }
                            >
                              {modulesStatus[module.id] ? "Włączony" : "Wyłączony"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{module.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            </SlideIn>
          ))}
        </div>
      </div>
    </div>
  );
}
