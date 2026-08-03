"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

export function BotInviteCallbackClient() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const state = searchParams.get("state");
  const guildId = state?.startsWith("bot_invite:") ? state.slice("bot_invite:".length) : null;
  const success = !error;

  useEffect(() => {
    window.opener?.postMessage(
      {
        type: "deezy:bot-invite-complete",
        success,
        guildId,
      },
      window.location.origin,
    );

    const closeTimer = window.setTimeout(() => {
      window.close();
    }, success ? 900 : 1800);

    return () => window.clearTimeout(closeTimer);
  }, [guildId, success]);

  return (
    <div className="w-full max-w-sm rounded-lg border border-bot-blue/30 bg-card p-6 text-center shadow-xl shadow-bot-primary/10">
      {success ? (
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-bot-primary" />
      ) : (
        <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
      )}
      <h1 className="mb-2 text-xl font-semibold">
        {success ? "Bot został dodany" : "Nie dodano bota"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {success
          ? "To okno zaraz zamknie się automatycznie."
          : "Możesz zamknąć to okno i spróbować ponownie."}
      </p>
    </div>
  );
}