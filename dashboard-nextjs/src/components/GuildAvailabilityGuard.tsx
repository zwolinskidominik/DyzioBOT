"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BotOff, LayoutDashboard, Loader2, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { openBotInvitePopup } from "@/lib/botInvite";
import { useMessages } from "@/i18n/LanguageProvider";
import { commonMessages } from "@/i18n/messages/common";

type AvailabilityStatus = "checking" | "available" | "missing-bot" | "missing-guild" | "transient-error" | "error";

const PASSIVE_RECHECK_MS = 30_000;
const MISSING_BOT_REDIRECT_MS = 5_000;

interface GuildAvailabilityGuardProps {
  children: React.ReactNode;
}

interface GuildAvailabilityResponse {
  name?: string;
  hasBot?: boolean;
  transient?: boolean;
}

interface VerifyGuildOptions {
  showChecking?: boolean;
  force?: boolean;
}

function getGuildName(data: GuildAvailabilityResponse): string | null {
  return typeof data.name === "string" && data.name.trim().length > 0 ? data.name : null;
}

export function GuildAvailabilityGuard({ children }: GuildAvailabilityGuardProps) {
  const params = useParams<{ guildId: string }>();
  const router = useRouter();
  const guildId = params.guildId;
  const [status, setStatus] = useState<AvailabilityStatus>("checking");
  const t = useMessages(commonMessages).availability;
  const [guildName, setGuildName] = useState<string | null>(null);
  const statusRef = useRef(status);
  const lastCheckedAtRef = useRef(0);
  const inflightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const verifyGuild = useCallback(async ({ showChecking = false, force = false }: VerifyGuildOptions = {}) => {
    if (!guildId) return;

    const now = Date.now();
    if (!force && !showChecking && now - lastCheckedAtRef.current < PASSIVE_RECHECK_MS) return;
    if (inflightRef.current) return inflightRef.current;

    if (showChecking) setStatus("checking");

    const request = (async () => {
      try {
        const url = `/api/discord/guild/${guildId}${force ? "?force=1" : ""}`;
        const response = await fetchWithAuth(url, { cache: "no-store" });

        lastCheckedAtRef.current = Date.now();

        if (response.status === 404) {
          setStatus("missing-guild");
          return;
        }

        if (response.status === 429 || response.status === 503) {
          if (statusRef.current !== "available") setStatus("transient-error");
          return;
        }

        if (!response.ok) {
          if (statusRef.current !== "available") setStatus("error");
          return;
        }

        const data: GuildAvailabilityResponse = await response.json();
        setGuildName(getGuildName(data));
        setStatus(data.hasBot === false && !data.transient ? "missing-bot" : "available");
      } catch {
        if (statusRef.current !== "available") setStatus("transient-error");
      } finally {
        inflightRef.current = null;
      }
    })();

    inflightRef.current = request;
    return request;
  }, [guildId]);

  useEffect(() => {
    verifyGuild({ showChecking: true });
  }, [verifyGuild]);

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === "visible") verifyGuild();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [verifyGuild]);

  useEffect(() => {
    if (status !== "missing-bot") return;

    const redirectTimer = window.setTimeout(() => {
      router.replace("/guilds");
    }, MISSING_BOT_REDIRECT_MS);

    return () => window.clearTimeout(redirectTimer);
  }, [router, status]);

  if (status === "available") return <>{children}</>;

  if (status === "checking") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-bot-primary" />
          <p className="text-sm text-muted-foreground">{t.checking}</p>
        </div>
      </div>
    );
  }

  const isMissingBot = status === "missing-bot";
  const isTransient = status === "transient-error";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-2 py-10">
      <div className="w-full max-w-xl rounded-lg border border-bot-blue/30 bg-card p-6 text-center shadow-xl shadow-bot-primary/10 sm:p-8">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-bot-blue/30 bg-bot-primary/10">
          {isMissingBot ? (
            <BotOff className="h-7 w-7 text-bot-primary" strokeWidth={1.6} />
          ) : isTransient ? (
            <RefreshCw className="h-7 w-7 text-bot-primary" strokeWidth={1.6} />
          ) : (
            <ShieldAlert className="h-7 w-7 text-bot-primary" strokeWidth={1.6} />
          )}
        </div>

        <h1 className="mb-2 text-2xl font-semibold text-white/90">
          {isMissingBot ? t.missingBotTitle : isTransient ? t.rateLimitedTitle : t.unavailableTitle}
        </h1>
        <p className="mx-auto mb-6 max-w-md text-sm leading-6 text-muted-foreground">
          {isMissingBot
            ? t.missingBotText(guildName ?? t.thisServer)
            : isTransient
              ? t.rateLimitedText
            : t.unavailableText}
        </p>

        <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-5 sm:flex-row sm:justify-center sm:px-8">
          {isMissingBot && (
            <Button
              className="btn-gradient"
              onClick={() => openBotInvitePopup(guildId, { onComplete: () => verifyGuild({ showChecking: true, force: true }), onClosed: () => verifyGuild({ force: true }) })}
            >
              <Plus className="h-4 w-4" />
              {t.addBotAgain}
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/guilds">
              <LayoutDashboard className="h-4 w-4" />
              {t.myServers}
            </Link>
          </Button>
          <Button variant="ghost" onClick={() => verifyGuild({ showChecking: true, force: true })}>
            <RefreshCw className="h-4 w-4" />
            {t.checkAgain}
          </Button>
        </div>
      </div>
    </div>
  );
}
