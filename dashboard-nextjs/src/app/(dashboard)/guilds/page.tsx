"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Settings, Crown, Search } from "lucide-react";
import Image from "next/image";
import { openBotInvitePopup } from "@/lib/botInvite";
import { DashboardTopbar } from "@/components/DashboardTopbar";
import { Input } from "@/components/ui/input";

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
  const [query, setQuery] = useState("");

  const filteredGuilds = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pl");
    if (!q) return guilds;
    return guilds.filter((g) => g.name.toLocaleLowerCase("pl").includes(q));
  }, [guilds, query]);

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

  const openGuild = (guild: Guild) => {
    if (guild.hasBot !== false) router.push(`/${guild.id}`);
    else handleBotInvite(guild.id);
  };

  const handleBotInvite = (guildId: string) => {
    openBotInvitePopup(guildId, {
      onComplete: fetchGuilds,
      onClosed: fetchGuilds,
    });
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-dark-800">
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
    <div className="min-h-screen bg-dark-800">
      <DashboardTopbar />
      <main className="px-4 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold text-white/90">Twoje serwery</h1>
            <p className="text-muted-foreground">
              Zalogowano jako <span className="font-semibold text-bot-light">{session?.user?.name}</span>
            </p>
          </div>

          {guilds.length === 0 ? (
            <Card className="mx-auto max-w-lg border-0 bg-dark-700">
              <CardContent className="p-12 text-center">
                <Settings className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
                <h2 className="mb-2 text-xl font-semibold">Brak dostępnych serwerów</h2>
                <p className="text-muted-foreground">
                  Nie znaleziono serwerów Discord gdzie masz uprawnienia administratora.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <form
                className="mx-auto mb-10 max-w-md"
                role="search"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (filteredGuilds.length > 0) openGuild(filteredGuilds[0]);
                }}
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Szukaj serwerów..."
                    aria-label="Szukaj serwerów"
                    className="h-11 border-dark-700 bg-dark-900 pl-9"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Naciśnij Enter, aby wybrać pierwszy wynik</p>
              </form>

              {filteredGuilds.length === 0 ? (
                <p className="text-center text-muted-foreground">Brak serwerów pasujących do „{query.trim()}”.</p>
              ) : (
                <div className="flex flex-wrap justify-center gap-6">
                  {filteredGuilds.map((guild) => {
                    const hasBot = guild.hasBot !== false;
                    const icon = getGuildIcon(guild);

                    return (
                      <Card
                        key={guild.id}
                        className={`flex min-h-[244px] w-full cursor-pointer flex-col border-dark-700 bg-dark-700 transition-all hover:border-bot-primary/50 hover:shadow-xl hover:shadow-bot-primary/10 sm:w-[300px] ${!hasBot ? "opacity-80 hover:opacity-100" : ""}`}
                        onClick={() => openGuild(guild)}
                      >
                        <CardHeader className="pb-4">
                          <div className="flex flex-col items-center gap-4 text-center">
                            <div className="flex h-20 items-center justify-center">
                              {icon ? (
                                <Image
                                  src={icon}
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
                                  <Crown className="h-3 w-3" />
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
            </>
          )}
        </div>
      </main>
    </div>
  );
}
