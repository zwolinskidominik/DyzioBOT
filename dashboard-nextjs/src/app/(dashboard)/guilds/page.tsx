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

  const buildInviteUrl = (guildId: string) => {
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "";
    const callbackUrl = `${window.location.origin}/bot-invite/callback`;
    const inviteUrl = new URL("https://discord.com/oauth2/authorize");

    inviteUrl.searchParams.set("client_id", clientId);
    inviteUrl.searchParams.set("permissions", "8");
    inviteUrl.searchParams.set("scope", "bot applications.commands");
    inviteUrl.searchParams.set("guild_id", guildId);
    inviteUrl.searchParams.set("disable_guild_select", "true");
    inviteUrl.searchParams.set("redirect_uri", callbackUrl);
    inviteUrl.searchParams.set("response_type", "code");
    inviteUrl.searchParams.set("state", `bot_invite:${guildId}`);

    return inviteUrl.toString();
  };

  const openBotInvitePopup = (guildId: string) => {
    const popupWidth = 540;
    const popupHeight = 760;
    const popupLeft = window.screenX + Math.max(0, (window.outerWidth - popupWidth) / 2);
    const popupTop = window.screenY + Math.max(0, (window.outerHeight - popupHeight) / 2);
    const inviteUrl = buildInviteUrl(guildId);
    const popup = window.open(
      inviteUrl,
      "deezy-bot-invite",
      `popup=yes,width=${popupWidth},height=${popupHeight},left=${Math.round(popupLeft)},top=${Math.round(popupTop)},resizable=yes,scrollbars=yes`,
    );

    if (!popup) {
      window.location.href = inviteUrl;
      return;
    }

    popup.focus();

    const closeWatcher = window.setInterval(() => {
      if (!popup.closed) return;

      window.clearInterval(closeWatcher);
      fetchGuilds();
    }, 800);
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
            <h1 className="text-3xl font-bold mb-2 text-white/90">
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
              
              return (
                <Card
                  key={guild.id}
                  className={`hover:shadow-xl hover:shadow-bot-primary/10 transition-all cursor-pointer hover:scale-[1.02] ${!hasBot ? "opacity-80 hover:opacity-100" : ""} border-bot-blue/30 hover:border-bot-primary/50 bg-card/50 backdrop-blur`}
                  onClick={() => hasBot ? router.push(`/${guild.id}`) : openBotInvitePopup(guild.id)}
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
                      <Button
                        className="w-full bg-bot-blue/20 hover:bg-bot-blue/30 text-bot-light border border-bot-blue/40"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          openBotInvitePopup(guild.id);
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
    </div>
  );
}
