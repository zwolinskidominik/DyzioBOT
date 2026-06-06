"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Settings, Crown } from "lucide-react";
import Image from "next/image";
import { openBotInvitePopup } from "@/lib/botInvite";
import { DashboardTopbar } from "@/components/DashboardTopbar";

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  hasBot?: boolean;
}

export default function GuildsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchGuilds();
    }
  }, [status]);

  useEffect(() => {
    const handleBotInviteComplete = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "deezy:bot-invite-complete") return;

      fetchGuilds();
    };

    window.addEventListener("message", handleBotInviteComplete);

    return () => {
      window.removeEventListener("message", handleBotInviteComplete);
    };
  }, []);

  const fetchGuilds = async () => {
    try {
      const response = await fetch("/api/discord/guilds");
      if (response.ok) {
        const data = await response.json();
        setGuilds(data);
      }
    } catch (error) {
      console.error("Failed to fetch guilds:", error);
    } finally {
      setLoading(false);
    }
  };

  const getGuildIcon = (guild: Guild) => {
    if (guild.icon) {
      return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
    }
    return null;
  };

  const handleBotInvite = (guildId: string) => {
    openBotInvitePopup(guildId, {
      onComplete: fetchGuilds,
      onClosed: fetchGuilds,
    });
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-dark-700">
        <DashboardTopbar />
        <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-discord-blurple" />
            <p className="text-muted-foreground">Ładowanie serwerów...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-700">
      <DashboardTopbar />
      <main className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-white/90">
              Wybierz serwer
            </h1>
            <p className="text-muted-foreground">
              Zalogowano jako <span className="font-semibold text-bot-light">{session?.user?.name}</span>
            </p>
          </div>
        </div>

        {guilds.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Settings className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">Brak dostępnych serwerów</h2>
              <p className="text-muted-foreground">
                Nie znaleziono serwerów Discord gdzie masz uprawnienia administratora.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {guilds.map((guild) => {
              const hasBot = guild.hasBot !== false;
              
              return (
                <Card
                  key={guild.id}
                  className={`flex min-h-[244px] cursor-pointer flex-col border-bot-blue/30 bg-card/50 backdrop-blur transition-all hover:border-bot-primary/50 hover:shadow-xl hover:shadow-bot-primary/10 hover:scale-[1.02] ${!hasBot ? "opacity-80 hover:opacity-100" : ""}`}
                  onClick={() => hasBot ? router.push(`/${guild.id}`) : handleBotInvite(guild.id)}
                >
                  <CardHeader className="pb-4">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="flex h-20 items-center justify-center">
                        {getGuildIcon(guild) ? (
                          <Image
                            src={getGuildIcon(guild)!}
                            alt={guild.name}
                            width={80}
                            height={80}
                            className={`rounded-full ${!hasBot ? "grayscale" : ""}`}
                          />
                        ) : (
                          <div className={`flex h-20 w-20 items-center justify-center rounded-full ${!hasBot ? "bg-gray-500" : "bg-discord-blurple"} text-2xl font-bold text-white`}>
                            {guild.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex min-h-[52px] w-full flex-col items-center justify-start">
                        <CardTitle className="mb-1 max-w-full truncate text-lg">{guild.name}</CardTitle>
                        {guild.owner && (
                          <div className="flex items-center justify-center gap-1 text-xs text-discord-yellow">
                            <Crown className="w-3 h-3" />
                            <span>Właściciel</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="mt-auto pt-0">
                    {hasBot ? (
                      <Button className="w-full btn-gradient" size="sm">
                        <Settings className="mr-2 h-4 w-4" />
                        Zarządzaj
                      </Button>
                    ) : (
                      <Button
                        className="w-full bg-bot-blue/20 hover:bg-bot-blue/30 text-bot-light border border-bot-blue/40"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleBotInvite(guild.id);
                        }}
                      >
                        Dodaj bota
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      </main>
    </div>
  );
}
