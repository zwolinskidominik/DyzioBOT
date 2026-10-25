"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import { LEGAL } from "@/lib/legal";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Shield, Zap, Users, Gift, MessageSquare } from "lucide-react";
import { useLang, useMessages } from "@/i18n/LanguageProvider";
import { commonMessages } from "@/i18n/messages/common";
import { landingMessages } from "@/i18n/messages/landing";

export default function HomePage() {
  const t = useMessages(landingMessages);
  const footer = useMessages(commonMessages).footer;
  const { lang } = useLang();
  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "";
  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-bot-primary/15 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-bot-accent/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-bot-blue/15 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">
        <Navbar />

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 animated-border bg-card/80 backdrop-blur-sm shadow-lg shadow-bot-primary/10">
              <Sparkles className="w-4 h-4 text-bot-light" />
              <span className="text-sm text-muted-foreground">{t.badge}</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-bot-light via-bot-primary to-bot-blue bg-clip-text text-transparent drop-shadow-2xl">
                {t.titleAccent}
              </span>
              <br />
              <span className="text-foreground">{t.titleRest}</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t.lead}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button
                asChild
                size="lg"
                className="btn-gradient shadow-2xl shadow-bot-primary/40 text-base px-8 hover:shadow-bot-primary/60 hover:scale-105"
              >
                <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
                  {t.addToServer}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </Button>

              <Button
                onClick={scrollToFeatures}
                variant="outline"
                size="lg"
                className="text-base px-8 border-bot-blue/30 hover:border-bot-primary/50 hover:bg-bot-primary/10 transition-all"
              >
                {t.seeFeatures}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 pt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/30 backdrop-blur-sm border border-bot-blue/20 hover:scale-110 hover:border-bot-primary/40 transition-all duration-300 cursor-default" style={{ transition: 'all 0.3s ease' }} onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 0 15px 2px rgba(99, 102, 241, 0.35)'} onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
                <Shield className="w-5 h-5 text-bot-light" />
                <span>{t.perks.encrypted}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/30 backdrop-blur-sm border border-bot-blue/20 hover:scale-110 hover:border-bot-primary/40 transition-all duration-300 cursor-default" style={{ transition: 'all 0.3s ease' }} onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 0 15px 2px rgba(99, 102, 241, 0.35)'} onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
                <Zap className="w-5 h-5 text-bot-light" />
                <span>{t.perks.fast}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-card/30 backdrop-blur-sm border border-bot-blue/20 hover:scale-110 hover:border-bot-primary/40 transition-all duration-300 cursor-default" style={{ transition: 'all 0.3s ease' }} onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 0 15px 2px rgba(99, 102, 241, 0.35)'} onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}>
                <Users className="w-5 h-5 text-bot-light" />
                <span>{t.perks.support}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="text-white/90">
                {t.featuresTitle}
              </span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t.featuresLead}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Feature Cards */}
            <div className="group p-6 rounded-xl border border-bot-blue/30 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm hover:border-bot-primary/50 transition-all hover:shadow-2xl hover:shadow-bot-primary/20 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-bot-light to-bot-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-bot-primary/30">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t.features.birthdays.title}</h3>
              <p className="text-muted-foreground">
                {t.features.birthdays.text}
              </p>
            </div>

            <div className="group p-6 rounded-xl border border-bot-blue/30 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm hover:border-bot-primary/50 transition-all hover:shadow-2xl hover:shadow-bot-primary/20 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-bot-light to-bot-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-bot-primary/30">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t.features.greetings.title}</h3>
              <p className="text-muted-foreground">
                {t.features.greetings.text}
              </p>
            </div>

            <div className="group p-6 rounded-xl border border-bot-blue/30 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm hover:border-bot-primary/50 transition-all hover:shadow-2xl hover:shadow-bot-primary/20 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-bot-light to-bot-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-bot-primary/30">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t.features.levels.title}</h3>
              <p className="text-muted-foreground">
                {t.features.levels.text}
              </p>
            </div>

            <div className="group p-6 rounded-xl border border-bot-blue/30 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm hover:border-bot-primary/50 transition-all hover:shadow-2xl hover:shadow-bot-primary/20 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-bot-light to-bot-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-bot-primary/30">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t.features.autoroles.title}</h3>
              <p className="text-muted-foreground">
                {t.features.autoroles.text}
              </p>
            </div>

            <div className="group p-6 rounded-xl border border-bot-blue/30 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm hover:border-bot-primary/50 transition-all hover:shadow-2xl hover:shadow-bot-primary/20 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-bot-light to-bot-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-bot-primary/30">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t.features.suggestions.title}</h3>
              <p className="text-muted-foreground">
                {t.features.suggestions.text}
              </p>
            </div>

            <div className="group p-6 rounded-xl border border-bot-blue/30 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm hover:border-bot-primary/50 transition-all hover:shadow-2xl hover:shadow-bot-primary/20 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-bot-light to-bot-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-bot-primary/30">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t.features.tickets.title}</h3>
              <p className="text-muted-foreground">
                {t.features.tickets.text}
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-6 p-6 sm:p-12 rounded-2xl border border-bot-blue/30 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm shadow-2xl shadow-bot-primary/10">
            <h2 className="text-3xl md:text-4xl font-bold">
              {t.ctaTitle}
            </h2>
            <p className="text-muted-foreground text-lg">
              {t.ctaLead}
            </p>
            <Button
              asChild
              size="lg"
              className="btn-gradient shadow-2xl shadow-bot-primary/40 text-base px-8 hover:shadow-bot-primary/60 hover:scale-105"
            >
              <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
                {t.ctaButton}
                <ArrowRight className="ml-2 w-5 h-5" />
              </a>
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-bot-blue/20 py-8 backdrop-blur-sm">
          <div className="container mx-auto px-4 text-center text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Deezy. {footer.rights}</p>
            <nav aria-label={footer.documents} className="mt-2 flex justify-center gap-4 text-sm">
              <Link href="/terms" className="hover:text-foreground">{footer.terms}</Link>
              <Link href="/privacy" className="hover:text-foreground">{footer.privacy}</Link>
              <a href={lang === "pl" ? `${LEGAL.statusUrl}/pl` : LEGAL.statusUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">{footer.status}</a>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
