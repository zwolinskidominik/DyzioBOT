"use client";

/**
 * Lekki event bus (bez kontekstu) informujący Sidebar, że status modułu
 * (włączony/wyłączony) mógł się zmienić — Sidebar trzyma własny fetch
 * /api/guild/[guildId]/modules-status i nie wie, kiedy strona modułu
 * zapisała nową wartość. Wołaj `notifyModulesStatusChanged()` po każdym
 * udanym zapisie, który mógł zmienić pole `enabled`.
 */
const EVENT_NAME = "dashboard:modules-status-changed";

export function notifyModulesStatusChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function onModulesStatusChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
