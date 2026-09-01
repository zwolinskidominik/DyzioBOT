/**
 * Definicje motywów kolorystycznych Server Wrapped — wartości 1:1 z zatwierdzonego prototypu
 * (Claude Design). Plik bez zależności Node-only (brak `canvas`), bezpieczny do importu
 * zarówno po stronie serwera, jak i w komponentach klienckich.
 */

export const WRAPPED_THEMES = ["violet", "midnight", "emerald", "sunset", "amber", "graphite"] as const;
export type WrappedTheme = (typeof WRAPPED_THEMES)[number];
export const DEFAULT_WRAPPED_THEME: WrappedTheme = "violet";

export const WRAPPED_THEME_LABELS: Record<WrappedTheme, string> = {
  violet: "Fiolet",
  midnight: "Midnight",
  emerald: "Emerald",
  sunset: "Sunset",
  amber: "Amber",
  graphite: "Grafit",
};

export interface ThemePalette {
  bg: string;
  tile: string;
  tileBorder: string;
  accent: string;
  border: string;
  /** CSS radial-gradient (dwie duże, miękkie plamy światła w rogach karty). */
  glowA: string;
  glowB: string;
}

function glow(rgb: string, a: number): string {
  return `radial-gradient(circle at 50% 50%, rgba(${rgb},${a}) 0%, rgba(${rgb},0) 68%)`;
}

export const THEME_PALETTES: Record<WrappedTheme, ThemePalette> = {
  violet: {
    bg: "#100f1e",
    tile: "#1d1b35",
    tileBorder: "rgba(139,125,251,0.16)",
    accent: "#a89bff",
    border: "rgba(139,125,251,0.3)",
    glowA: glow("139,125,251", 0.3),
    glowB: glow("59,130,246", 0.22),
  },
  midnight: {
    bg: "#080f1d",
    tile: "#152238",
    tileBorder: "rgba(96,165,250,0.16)",
    accent: "#7cb8ff",
    border: "rgba(96,165,250,0.3)",
    glowA: glow("96,165,250", 0.28),
    glowB: glow("14,165,233", 0.2),
  },
  emerald: {
    bg: "#05100d",
    tile: "#0f2119",
    tileBorder: "rgba(52,211,153,0.14)",
    accent: "#34d399",
    border: "rgba(52,211,153,0.28)",
    glowA: glow("16,185,129", 0.26),
    glowB: glow("13,148,136", 0.2),
  },
  sunset: {
    bg: "#1c0e1b",
    tile: "#31182b",
    tileBorder: "rgba(244,114,182,0.16)",
    accent: "#f9a8d4",
    border: "rgba(244,114,182,0.3)",
    glowA: glow("244,114,182", 0.28),
    glowB: glow("249,115,22", 0.22),
  },
  amber: {
    bg: "#19120a",
    tile: "#2e2417",
    tileBorder: "rgba(251,191,36,0.16)",
    accent: "#fcd34d",
    border: "rgba(251,191,36,0.3)",
    glowA: glow("251,191,36", 0.24),
    glowB: glow("239,68,68", 0.18),
  },
  graphite: {
    bg: "#101116",
    tile: "#20222c",
    tileBorder: "rgba(255,255,255,0.1)",
    accent: "#e6e9f2",
    border: "rgba(255,255,255,0.16)",
    glowA: glow("255,255,255", 0.12),
    glowB: glow("148,163,184", 0.12),
  },
};

export function resolveWrappedTheme(theme: string | undefined | null): WrappedTheme {
  return (WRAPPED_THEMES as readonly string[]).includes(theme ?? "") ? (theme as WrappedTheme) : DEFAULT_WRAPPED_THEME;
}
