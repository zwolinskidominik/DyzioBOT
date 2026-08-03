import { createCanvas, loadImage, registerFont } from "canvas";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { ITicketTypeBanner } from "@/models/TicketConfig";

/**
 * Server-only (Node runtime) renderer for the ticket panel message banner —
 * mirrors the bot's src/utils/ticketBannerRenderer.ts so the dashboard can
 * generate the exact same "text over banner.png" image when deploying the
 * panel directly via the Discord REST API (no bot process involved).
 */

const ASSETS_DIR = join(process.cwd(), "..", "assets");
const BANNER_BASE_PATH = join(ASSETS_DIR, "banner.png");
const TICKETS_DIR = join(ASSETS_DIR, "tickets");
const FONT_PATH = join(ASSETS_DIR, "Ageer.otf");

export const PRESET_BANNER_FILENAMES = ["ticketBanner.png", "ticketReport.png", "ticketPartnership.png", "ticketIdea.png"];
export const DEFAULT_PRESET_FILENAME = "ticketBanner.png";

let fontRegistered = false;

function registerAgeerFont(): void {
  if (fontRegistered) return;
  fontRegistered = true;
  try {
    if (existsSync(FONT_PATH)) {
      registerFont(FONT_PATH, { family: "Ageer", weight: "normal", style: "normal" });
    }
  } catch (error) {
    console.warn("Nie udało się zarejestrować czcionki Ageer:", error);
  }
}

function resolvePresetFilename(presetId: string | undefined): string {
  if (presetId && PRESET_BANNER_FILENAMES.includes(presetId)) return presetId;
  return DEFAULT_PRESET_FILENAME;
}

/**
 * Render text centered over the base banner.png texture, shrinking the font
 * until it fits (wrapping onto a second line if still too wide at the
 * minimum size). Returns a PNG buffer.
 */
export async function renderPanelTextBanner(text: string): Promise<Buffer> {
  registerAgeerFont();

  const base = await loadImage(BANNER_BASE_PATH);
  const width = base.width;
  const height = base.height;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(base, 0, 0, width, height);

  const paddingX = Math.round(width * 0.08);
  const maxTextWidth = width - paddingX * 2;
  const maxFontSize = Math.round(height * 0.22);
  const minFontSize = Math.round(height * 0.09);

  const safeText = (text || "").trim().slice(0, 80) || "Kontakt z Administracją";

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let fontSize = maxFontSize;
  let lines: string[] = [safeText];

  const fits = (size: number, line: string): boolean => {
    ctx.font = `${size}px Ageer`;
    return ctx.measureText(line).width <= maxTextWidth;
  };

  while (fontSize > minFontSize && !fits(fontSize, safeText)) {
    fontSize -= 2;
  }

  if (!fits(fontSize, safeText)) {
    const words = safeText.split(/\s+/);
    const mid = Math.ceil(words.length / 2);
    if (words.length > 1) {
      lines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
    }
    fontSize = Math.max(minFontSize, Math.round(maxFontSize * 0.75));
    while (fontSize > minFontSize && lines.some((l) => !fits(fontSize, l))) {
      fontSize -= 2;
    }
  }

  ctx.font = `${fontSize}px Ageer`;

  const lineHeight = fontSize * 1.25;

  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 8;

  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + index * lineHeight);
  });

  return canvas.toBuffer("image/png");
}

export interface PanelBannerAttachment {
  buffer: Buffer;
  filename: string;
}

/**
 * Resolve the panel message banner (text-over-image or bundled preset) to an
 * attachment-ready buffer. Returns null when configured with no banner ("none").
 */
export async function getPanelBannerAttachment(banner: ITicketTypeBanner | undefined): Promise<PanelBannerAttachment | null> {
  if (banner?.mode === "none") {
    return null;
  }

  if (banner?.mode === "text") {
    try {
      const buffer = await renderPanelTextBanner(banner.text ?? "");
      return { buffer, filename: "ticketPanelBanner.png" };
    } catch (error) {
      console.warn("Nie udało się wygenerować bannera tekstowego panelu, używam domyślnego presetu:", error);
    }
  }

  const filename = resolvePresetFilename(banner?.presetId);
  const buffer = await readFile(join(TICKETS_DIR, filename));
  return { buffer, filename };
}
