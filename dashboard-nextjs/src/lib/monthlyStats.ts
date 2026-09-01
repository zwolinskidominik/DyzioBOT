/**
 * Czyste, wspólne dla dashboardu helpery Statystyk Miesięcznych — lustro logiki
 * z bota (src/services/monthlyStatsService.ts), bez zależności na Mongoose/bota,
 * żeby dało się je bezpiecznie importować zarówno w API route'ach, jak i w kliencie
 * (do rekalkulacji wyniku na żywo pod suwakami msgRate/voiceRate/topSize).
 */

export const MONTH_NAMES_NOMINATIVE: Record<string, string> = {
  "01": "Styczeń",
  "02": "Luty",
  "03": "Marzec",
  "04": "Kwiecień",
  "05": "Maj",
  "06": "Czerwiec",
  "07": "Lipiec",
  "08": "Sierpień",
  "09": "Wrzesień",
  "10": "Październik",
  "11": "Listopad",
  "12": "Grudzień",
};

export const MONTH_NAMES_GENITIVE: Record<string, string> = {
  "01": "stycznia",
  "02": "lutego",
  "03": "marca",
  "04": "kwietnia",
  "05": "maja",
  "06": "czerwca",
  "07": "lipca",
  "08": "sierpnia",
  "09": "września",
  "10": "października",
  "11": "listopada",
  "12": "grudnia",
};

export function monthAbbr(mm: string): string {
  return (MONTH_NAMES_NOMINATIVE[mm] ?? "").slice(0, 3).toLowerCase();
}

/** Miesiąc N miesięcy przed `baseDate`, format YYYY-MM. monthsAgo=0 → bieżący. */
export function getMonthString(baseDate: Date, monthsAgo = 0): string {
  const d = new Date(baseDate);
  d.setMonth(d.getMonth() - monthsAgo);
  return d.toISOString().slice(0, 7);
}

export function monthFullLabel(monthId: string): string {
  const [year, mm] = monthId.split("-");
  return `${MONTH_NAMES_NOMINATIVE[mm] ?? "Nieznany"} ${year}`;
}

export function monthFooterLabel(monthId: string): string {
  const [year, mm] = monthId.split("-");
  return `${(MONTH_NAMES_NOMINATIVE[mm] ?? "nieznany").toLowerCase()} ${year}`;
}

/** Bot publikuje topkę za miesiąc `monthId` pierwszego dnia KOLEJNEGO miesiąca. */
export function nextPublishDate(monthId: string): Date {
  const [year, mm] = monthId.split("-");
  return new Date(Number(year), Number(mm), 1); // mm (1-indexed) = kolejny miesiąc (Date jest 0-indexed)
}

export function monthPublishLabel(monthId: string): string {
  const publishDate = nextPublishDate(monthId);
  const publishMm = String(publishDate.getMonth() + 1).padStart(2, "0");
  return `1 ${MONTH_NAMES_GENITIVE[publishMm]} ${publishDate.getFullYear()}`;
}

export function monthPublishShortDate(monthId: string): string {
  const publishDate = nextPublishDate(monthId);
  const dd = String(publishDate.getDate()).padStart(2, "0");
  const mm = String(publishDate.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${publishDate.getFullYear()}`;
}

/** Wynik = 1 pkt / msgRate wiadomości + 1 pkt / voiceRate minut na voice. Domyślnie 1/2 (stary sztywny wzór). */
export function computeCombinedScore(
  messageCount: number,
  voiceMinutes: number,
  msgRate = 1,
  voiceRate = 2
): number {
  return Math.round(messageCount / msgRate) + Math.round(voiceMinutes / voiceRate);
}

export function formatHM(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function nf(num: number): string {
  return Math.round(num).toLocaleString("pl-PL");
}

export function msgRateLabel(msgRate: number): string {
  return msgRate === 1 ? "1 wiadomość" : `${msgRate} wiadomości`;
}

export interface RawMonthUser {
  userId: string;
  messageCount: number;
  voiceMinutes: number;
}

export interface RawMonth {
  id: string;
  abbr: string;
  full: string;
  footerLabel: string;
  isCurrent: boolean;
  users: RawMonthUser[];
}

export interface ScoredEntry extends RawMonthUser {
  score: number;
}

export function scoreUsers(users: RawMonthUser[], msgRate: number, voiceRate: number): ScoredEntry[] {
  return users
    .map((u) => ({ ...u, score: computeCombinedScore(u.messageCount, u.voiceMinutes, msgRate, voiceRate) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Wysokość karty podium (MVP, najwyższa) dokładnie wg tej samej sekwencji odstępów,
 * którą rysuje canvasMonthlyTopkaCardV3.ts (bot) / monthlyStatsRenderer.ts (dashboard) —
 * potrzebna WYŁĄCZNIE do policzenia szacowanej wysokości finalnej grafiki (900 × ? px)
 * na potrzeby ostrzeżenia o zbyt dużej liczbie osób. Trzymaj w synchronizacji przy zmianie layoutu.
 */
function computePodiumMidHeight(): number {
  const pad = 24;
  const avatarTopOffset = 52;
  const avatarSize = 64;
  const medalDiameter = 26;
  const scoreFont = 30;
  const nickFont = 18;
  const numLines = 3;
  const lineFont = 12;
  const lineGap = 3;

  const avatarBottom = avatarTopOffset + avatarSize;
  const rowTop = avatarBottom + 10;
  const rowHeight = Math.max(medalDiameter, scoreFont);
  const rowBottom = rowTop + rowHeight;
  const nickTop = rowBottom + 8;
  const nickBottom = nickTop + nickFont;
  const statsTop = nickBottom + 8;
  const statsHeight = numLines * lineFont + (numLines - 1) * lineGap;
  const contentBottom = statsTop + statsHeight;

  return contentBottom + pad;
}

const PODIUM_MID_HEIGHT = computePodiumMidHeight();

const CARD_PAD_TOP = 34;
const CARD_PAD_BOTTOM = 28;
const CARD_BLOCK_GAP = 24;
const CARD_HEADER_GAP = 20;
const CARD_HEADER_HEIGHT = 80;
const CARD_FOOTER_HEIGHT = 34;
const CARD_FOOTER_GAP = 14;
const TABLE_HEADER_HEIGHT = 25;
const TABLE_ROW_HEIGHT = 46;
const TABLE_ROW_GAP = 6;

/** Szacowana wysokość finalnej grafiki (900px szerokości) dla `shownCount` pokazanych osób. */
export function estimateCardHeight(shownCount: number): number {
  const hasPodium = shownCount > 0;
  const restCount = Math.max(0, shownCount - 3);
  const tableBlockHeight =
    restCount > 0 ? TABLE_HEADER_HEIGHT + restCount * TABLE_ROW_HEIGHT + Math.max(0, restCount - 1) * TABLE_ROW_GAP : 0;

  let contentHeight = CARD_HEADER_HEIGHT;
  if (hasPodium) contentHeight += CARD_HEADER_GAP + PODIUM_MID_HEIGHT;
  if (tableBlockHeight > 0) contentHeight += CARD_BLOCK_GAP + tableBlockHeight;
  contentHeight += CARD_FOOTER_GAP + CARD_FOOTER_HEIGHT;

  return CARD_PAD_TOP + contentHeight + CARD_PAD_BOTTOM;
}

export function avatarUrlFor(userId: string, avatarHash: string | null | undefined): string {
  if (avatarHash) return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=128`;
  return "https://cdn.discordapp.com/embed/avatars/0.png";
}
