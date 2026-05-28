import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { BotInviteCallbackClient } from "./BotInviteCallbackClient";

export default function BotInviteCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Suspense
        fallback={
          <div className="w-full max-w-sm rounded-lg border border-bot-blue/30 bg-card p-6 text-center shadow-xl shadow-bot-primary/10">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-bot-primary" />
            <p className="text-sm text-muted-foreground">Finalizowanie dodania bota...</p>
          </div>
        }
      >
        <BotInviteCallbackClient />
      </Suspense>
    </main>
  );
}