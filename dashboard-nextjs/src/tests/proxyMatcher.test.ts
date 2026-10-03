import { describe, it, expect } from "vitest";
import { config } from "@/proxy";

/**
 * Które ścieżki przechodzą przez proxy (wymagają zalogowania), a które są publiczne.
 *
 * Matcher to wyrażenie regularne z negatywnym lookaheadem — łatwo w nim coś pominąć. Tak
 * było z /flags/*.svg: niezalogowany odwiedzający dostawał przekierowanie na /login zamiast
 * obrazka flagi. Z kolei /privacy i /terms MUSZĄ być publiczne (Discord, Stripe, wymóg
 * udostępnienia regulaminu przed zawarciem umowy), a panel i API serwerów — chronione.
 */
const matcher = new RegExp(`^${config.matcher[0]}$`);
const requiresAuth = (pathname: string) => matcher.test(pathname);

describe("proxy matcher", () => {
  it.each([
    "/",
    "/login",
    "/privacy",
    "/terms",
    "/flags/pl.svg",
    "/twemoji/svg/1f3ae.svg",
    "/deezy.png",
    "/favicon.ico",
    "/api/auth/session",
    "/api/health",
    "/_next/static/chunks/main.js",
    "/_next/image",
  ])("leaves %s public", (pathname) => {
    expect(requiresAuth(pathname)).toBe(false);
  });

  it.each([
    "/guilds",
    "/881293681783623680",
    "/881293681783623680/commands",
    "/cs2-investments",
    "/api/guild/881293681783623680/wrapped/config",
    "/api/discord/guilds",
    // Wyjątki dla stron prawnych są dokładne — nie otwierają ścieżek o podobnym prefiksie.
    "/privacy-settings",
    "/terms/admin",
  ])("protects %s", (pathname) => {
    expect(requiresAuth(pathname)).toBe(true);
  });
});
