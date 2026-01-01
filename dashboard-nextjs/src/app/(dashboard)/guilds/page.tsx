"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Settings, LogOut, Crown } from "lucide-react";
import Image from "next/image";

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

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-discord-blurple mx-auto mb-4" />
          <p className="text-muted-foreground">Ładowanie serwerów...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
              Wybierz serwer
            </h1>
            <p className="text-muted-foreground">
              Zalogowano jako <span className="font-semibold text-bot-light">{session?.user?.name}</span>
            </p>
          </div>
          <Button variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>
            <LogOut className="mr-2 h-4 w-4" />
            Wyloguj
          </Button>
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
              const clientId = "1248419676740915310";
              const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands&guild_id=${guild.id}`;
              
              return (
                <Card
                  key={guild.id}
                  className={`hover:shadow-xl hover:shadow-bot-primary/10 transition-all cursor-pointer hover:scale-[1.02] ${!hasBot ? "opacity-80 hover:opacity-100" : ""} border-bot-blue/30 hover:border-bot-primary/50 bg-card/50 backdrop-blur`}
                  onClick={() => hasBot ? router.push(`/${guild.id}`) : window.open(inviteUrl, "_blank")}
                >
                  <CardHeader className="pb-4">
                    <div className="flex flex-col items-center gap-4 text-center">
                      {getGuildIcon(guild) ? (
                        <Image
                          src={getGuildIcon(guild)!}
                          alt={guild.name}
                          width={80}
                          height={80}
                          className={`rounded-full ${!hasBot ? "grayscale" : ""}`}
                        />
                      ) : (
                        <div className={`w-20 h-20 rounded-full ${!hasBot ? "bg-gray-500" : "bg-discord-blurple"} flex items-center justify-center text-white font-bold text-2xl`}>
                          {guild.name.charAt(0)}
                        </div>
                      )}
                      <div className="w-full">
                        <CardTitle className="text-lg mb-1">{guild.name}</CardTitle>
                        {guild.owner && (
                          <div className="flex items-center justify-center gap-1 text-xs text-discord-yellow">
                            <Crown className="w-3 h-3" />
                            <span>Właściciel</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {hasBot ? (
                      <Button className="w-full btn-gradient" size="sm">
                        <Settings className="mr-2 h-4 w-4" />
                        Zarządzaj
                      </Button>
                    ) : (
                      <Button className="w-full bg-bot-blue/20 hover:bg-bot-blue/30 text-bot-light border border-bot-blue/40" size="sm">
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
    </div>
  );
}
