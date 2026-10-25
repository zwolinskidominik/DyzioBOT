"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { signIn } from "next-auth/react";
import { useMessages } from "@/i18n/LanguageProvider";
import { guildsMessages } from "@/i18n/messages/guilds";

export default function LoginPage() {
  const t = useMessages(guildsMessages);
  const handleLogin = () => {
    signIn("discord", { callbackUrl: "/guilds" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-bot-blue/30 bg-card/50 backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-bot-light to-bot-primary flex items-center justify-center shadow-xl shadow-bot-primary/30">
            <LogIn className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold text-white/90">
            {t.loginTitle}
          </CardTitle>
          <CardDescription>
            {t.loginLead}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleLogin}
            className="w-full h-12 text-base bg-gradient-to-r from-bot-light to-bot-primary hover:from-bot-blue hover:to-bot-primary shadow-lg shadow-bot-primary/30"
            size="lg"
          >
            <LogIn className="mr-2" />
            {t.loginButton}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-6">
            {t.loginNote}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
