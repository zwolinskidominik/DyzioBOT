import { createCanvas, loadImage, Canvas, Image } from 'canvas';
import { Ctx2D, registerProjectFonts, roundRect } from './canvasHelpers';
import logger from './logger';

/**
 * Generator grafiki dla miesięcznej "Topki" — wersja v3 (podium + wspólny wynik).
 * Osobny, samodzielny plik — NIE dotyka `canvasMonthlyTopkaCard.ts` (v2, dwie kolumny)
 * ani `canvasLeaderboardCard.ts` (TOPKA LEVELI, /toplvl). Wynik łączy wiadomości i głos
 * w jeden ranking: score = wiadomości + round(minuty_głosowe / 2).
 *
 * Pixel-perfect wg makiety Claude Design (sierpień 2026). Dwa świadome odstępstwa
 * wymuszone przez środowisko renderowania (node-canvas / Cairo), nie przez wybór:
 *  1. Wagi fontu 800/900 z makiety → renderowane jako `bold` (700), bo w `assets/`
 *     nie ma plików Inter ExtraBold/Black. To najcięższa zarejestrowana waga.
 *  2. `tabular-nums` nie ma odpowiednika w Canvas2D/Cairo (brak kontroli cech OpenType
 *     typu `tnum`) — kolumny liczb są za to zawsze prawo-wyrównane do stałej krawędzi,
 *     więc wizualnie nie "skaczą" mimo proporcjonalnych cyfr.
 */

export interface TopkaV3Entry {
  userId: string;
  username: string;
  avatarURL: string;
  messageCount: number;
  voiceMinutes: number;
  score: number;
}

export interface MonthlyTopkaCardV3Options {
  guildName: string;
  guildIconURL?: string | null;
  /** Nazwa miesiąca w formie zdaniowej, np. "Sierpień". */
  monthName: string;
  year: string;
  totalMessages: number;
  totalVoiceMinutes: number;
  activeUsers: number;
  /** Posortowane malejąco po score — index 0 = #1 miejsce. */
  entries: TopkaV3Entry[];
  /** Ile wiadomości = 1 pkt (domyślnie 1) — wpływa tylko na tekst stopki, wynik jest już policzony w entries. */
  msgRate?: number;
  /** Ile minut na voice = 1 pkt (domyślnie 2) — wpływa tylko na tekst stopki. */
  voiceRate?: number;
}

function formatHM(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes));
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

function pl(num: number): string {
  return Math.round(num).toLocaleString('pl-PL');
}

/* ── Medale Twemoji (złoto/srebro/brąz) — pobrane raz przy starcie procesu i ──
   cache'owane w pamięci; node-canvas nie renderuje emoji przez fillText, więc
   medale rysujemy jako obrazki drawImage(). ─────────────────────────────── */

const MEDAL_CODEPOINTS: Record<1 | 2 | 3, string> = {
  1: '1f947',
  2: '1f948',
  3: '1f949',
};
const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72';

type MedalImages = Record<1 | 2 | 3, Image | null>;

let medalImagesPromise: Promise<MedalImages> | null = null;

function loadMedalImages(): Promise<MedalImages> {
  if (!medalImagesPromise) {
    medalImagesPromise = (async () => {
      const ranks = [1, 2, 3] as const;
      const loaded = await Promise.all(
        ranks.map(async (rank) => {
          try {
            const image = await loadImage(`${TWEMOJI_BASE}/${MEDAL_CODEPOINTS[rank]}.png`);
            return [rank, image] as const;
          } catch (error) {
            logger.warn(`[TOPKA-V3-CANVAS] Nie udało się pobrać medalu Twemoji (miejsce ${rank}): ${error}`);
            return [rank, null] as const;
          }
        }),
      );
      return Object.fromEntries(loaded) as MedalImages;
    })();
  }
  return medalImagesPromise;
}

// Start pobierania od razu przy imporcie modułu (start procesu bota), nie przy
// pierwszym renderze karty.
void loadMedalImages();

interface PodiumTier {
  entry: TopkaV3Entry;
  rank: 1 | 2 | 3;
  medalColor: string;
  /** Kolor bazowy (np. tło awatara fallback) — bez przezroczystości. */
  accent: string;
  /** Kolor obwódki karty. */
  accentSoft: string;
  /** Stopy gradientowej nakładki (0 = góra), kończące się pełną przezroczystością — NIE kolorem tła. */
  gradientStops: [number, string][];
  scoreColor: string;
}

const FONT = 'Inter, "Segoe UI", Arial, sans-serif';

export class MonthlyTopkaCardV3 {
  private canvas: Canvas;
  private ctx: Ctx2D;
  private readonly scale = 2;
  private readonly width = 900;
  private readonly height: number;
  private readonly padX = 36;
  private readonly padTop = 34;
  private readonly padBottomOuter = 28;
  private readonly blockGap = 24;
  private readonly headerGap = 20;
  private readonly headerHeight = 80;
  private readonly podiumSideHeight: number;
  private readonly podiumMidHeight: number;
  /** Nagłówek(10) + 8px + linia(1) + 6px = odległość od topY tabeli do góry pierwszego wiersza. */
  private readonly tableHeaderHeight = 25;
  private readonly tableRowHeight = 46;
  private readonly tableRowGap = 6;
  private readonly tableInnerPad = 14;
  private readonly footerHeight = 34;
  private readonly footerGap = 14;

  private readonly colors = {
    background: '#12141c',
    border: '#232838',
    textPrimary: '#ffffff',
    textMuted: '#6b7a99',
    textDim: '#5f6b85',
    rowBg: '#171a24',
    gold: '#facc15',
    goldDim: '#d0b64a',
    goldFaint: '#a3986a',
    silver: '#cbd5e1',
    silverMuted: '#8b98b0',
    bronze: '#d97706',
    bronzeText: '#e79c2a',
    tableName: '#ffffff',
    tableValue: '#9aa7bd',
    medalDigit: '#12141c',
  };

  private readonly restCount: number;
  private medalImages: MedalImages = { 1: null, 2: null, 3: null };

  constructor(private readonly options: MonthlyTopkaCardV3Options) {
    registerProjectFonts();

    this.restCount = Math.max(0, options.entries.length - 3);

    // Karty podium mają wysokość dokładnie dopasowaną do treści (bez pustej
    // przestrzeni pod tekstem) — liczoną z tej samej sekwencji odstępów, której
    // używa drawPodiumCard(). MVP jest wyższa organicznie (więcej linii + większe fonty),
    // nie przez sztywną stałą.
    this.podiumMidHeight = this.computePodiumHeight(true);
    this.podiumSideHeight = this.computePodiumHeight(false);

    const hasPodium = options.entries.length > 0;
    const podiumHeight = hasPodium ? this.podiumMidHeight : 0;

    const tableBlockHeight =
      this.restCount > 0
        ? this.tableHeaderHeight +
          this.restCount * this.tableRowHeight +
          Math.max(0, this.restCount - 1) * this.tableRowGap
        : 0;

    let contentHeight = this.headerHeight;
    if (hasPodium) contentHeight += this.headerGap + podiumHeight;
    if (tableBlockHeight > 0) contentHeight += this.blockGap + tableBlockHeight;
    contentHeight += this.footerGap + this.footerHeight;

    this.height = this.padTop + contentHeight + this.padBottomOuter;

    // Renderujemy w skali 2× (retina) — cała logika rysuje w logicznej przestrzeni
    // 900px, a fizyczny canvas jest dwukrotnie większy dzięki ctx.scale().
    this.canvas = createCanvas(this.width * this.scale, this.height * this.scale);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(this.scale, this.scale);
  }

  public async build(): Promise<Buffer> {
    this.medalImages = await loadMedalImages();
    await this.drawBackground();

    let y = this.padTop;
    y = await this.drawHeader(y);

    if (this.options.entries.length > 0) {
      y += this.headerGap;
      y = await this.drawPodium(y);
    }

    if (this.restCount > 0) {
      y += this.blockGap;
      y = await this.drawTable(y);
    }

    y += this.footerGap;
    this.drawFooter(y);

    this.ctx.restore();
    return this.canvas.toBuffer('image/png');
  }

  private async drawBackground() {
    const cornerRadius = 20;
    this.ctx.fillStyle = this.colors.background;
    roundRect(this.ctx, 0, 0, this.width, this.height, cornerRadius);
    this.ctx.fill();
    this.ctx.strokeStyle = this.colors.border;
    this.ctx.lineWidth = 1;
    roundRect(this.ctx, 0, 0, this.width, this.height, cornerRadius);
    this.ctx.stroke();

    this.ctx.save();
    this.ctx.beginPath();
    roundRect(this.ctx, 0, 0, this.width, this.height, cornerRadius);
    this.ctx.clip();
  }

  /** Rysuje tekst z ręcznym letter-spacingiem (Canvas2D/Cairo nie wspiera CSS letter-spacing w skrócie fontu). */
  private fillTextTracked(
    text: string,
    x: number,
    y: number,
    letterSpacingPx: number,
    align: 'left' | 'right' | 'center' = 'left',
  ): number {
    const chars = Array.from(text);
    const savedAlign = this.ctx.textAlign;
    this.ctx.textAlign = 'left';

    const widths = chars.map((c) => this.ctx.measureText(c).width);
    const totalWidth = widths.reduce((a, b) => a + b, 0) + letterSpacingPx * Math.max(0, chars.length - 1);

    let cx = x;
    if (align === 'right') cx = x - totalWidth;
    else if (align === 'center') cx = x - totalWidth / 2;

    for (let i = 0; i < chars.length; i++) {
      this.ctx.fillText(chars[i], cx, y);
      cx += widths[i] + letterSpacingPx;
    }

    this.ctx.textAlign = savedAlign;
    return totalWidth;
  }

  private async drawHeader(y: number): Promise<number> {
    const { guildName, guildIconURL, monthName, year, totalMessages, totalVoiceMinutes, activeUsers } =
      this.options;
    const x = this.padX;
    const logoSize = 60;

    await this.drawCircleImage(guildIconURL ?? null, x, y, logoSize, guildName.charAt(0).toUpperCase(), {
      borderColor: this.colors.border,
      borderWidth: 2,
    });

    const textX = x + logoSize + 18;

    this.ctx.fillStyle = this.colors.textMuted;
    this.ctx.font = `bold 11px ${FONT}`;
    this.fillTextTracked(guildName.toUpperCase(), textX, y + 16, 0.18 * 11, 'left');

    this.ctx.fillStyle = this.colors.textPrimary;
    this.ctx.font = `bold 34px ${FONT}`;
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`${monthName} ${year}`, textX, y + 50);

    // Trzy statystyki, prawo-wyrównane do krawędzi treści — liczone od prawej,
    // tak by żadna z nich (razem z podpisem) nie mogła wyjść poza krawędź.
    const stats: [string, string][] = [
      [pl(totalMessages), 'wiadomości'],
      [`${pl(Math.floor(totalVoiceMinutes / 60))} h`, 'voice chat'],
      [pl(activeUsers), 'aktywne osoby'],
    ];
    const statGap = 26;
    const contentRight = this.width - this.padX;
    const valueBaselineY = y + 34;
    const labelBaselineY = y + 50;

    this.ctx.textAlign = 'right';
    let rightEdge = contentRight;
    for (let i = stats.length - 1; i >= 0; i--) {
      const [value, label] = stats[i];

      this.ctx.font = `bold 20px ${FONT}`;
      this.ctx.fillStyle = this.colors.textPrimary;
      this.ctx.fillText(value, rightEdge, valueBaselineY);

      this.ctx.font = `11px ${FONT}`;
      this.ctx.fillStyle = this.colors.textMuted;
      this.ctx.fillText(label, rightEdge, labelBaselineY);

      const groupWidth = Math.max(
        this.measureWith(`bold 20px ${FONT}`, value),
        this.measureWith(`11px ${FONT}`, label),
      );
      rightEdge -= groupWidth + statGap;
    }
    this.ctx.textAlign = 'left';

    const bottom = y + this.headerHeight;
    this.ctx.strokeStyle = this.colors.border;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x, bottom);
    this.ctx.lineTo(this.width - this.padX, bottom);
    this.ctx.stroke();

    return bottom;
  }

  private measureWith(font: string, text: string): number {
    this.ctx.font = font;
    return this.ctx.measureText(text).width;
  }

  private tier(rank: 1 | 2 | 3, entry: TopkaV3Entry): PodiumTier {
    if (rank === 1) {
      return {
        entry,
        rank,
        medalColor: this.colors.gold,
        accent: this.colors.gold,
        accentSoft: 'rgba(250,204,21,0.4)',
        gradientStops: [
          [0, 'rgba(250,204,21,0.16)'],
          [0.35, 'rgba(250,204,21,0.07)'],
          [0.62, 'rgba(250,204,21,0)'],
        ],
        scoreColor: this.colors.gold,
      };
    }
    if (rank === 2) {
      return {
        entry,
        rank,
        medalColor: this.colors.silver,
        accent: this.colors.silver,
        accentSoft: 'rgba(203,213,225,0.24)',
        gradientStops: [
          [0, 'rgba(203,213,225,0.10)'],
          [0.3, 'rgba(203,213,225,0.04)'],
          [0.6, 'rgba(203,213,225,0)'],
        ],
        scoreColor: this.colors.silver,
      };
    }
    return {
      entry,
      rank,
      medalColor: this.colors.bronze,
      accent: this.colors.bronze,
      accentSoft: 'rgba(217,119,6,0.3)',
      gradientStops: [
        [0, 'rgba(217,119,6,0.12)'],
        [0.3, 'rgba(217,119,6,0.05)'],
        [0.6, 'rgba(217,119,6,0)'],
      ],
      scoreColor: this.colors.bronzeText,
    };
  }

  /**
   * Wysokość karty podium dopasowana ściśle do treści — ta sama sekwencja odstępów,
   * którą rysuje drawPodiumCard(): awatar → 10 → wiersz medal/wynik/pkt → 8 → nick → 8 → linie (gap 3).
   * Górny/dolny padding karty są symetryczne (24 dla MVP, 20 dla bocznych).
   */
  private computePodiumHeight(isMvp: boolean): number {
    const pad = isMvp ? 24 : 20;
    const avatarTopOffset = isMvp ? 52 : 20; // MVP: pad(24) + 2×(11px etykieta + 3px odstęp)
    const avatarSize = isMvp ? 64 : 52;
    const medalDiameter = isMvp ? 26 : 20;
    const scoreFont = isMvp ? 30 : 22;
    const nickFont = isMvp ? 18 : 15;
    const numLines = isMvp ? 3 : 2;
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

  private async drawPodium(topY: number): Promise<number> {
    const { entries } = this.options;
    const colGap = 14;
    const sideWidth = (this.width - this.padX * 2 - colGap * 2) / 3.1;
    const midWidth = sideWidth * 1.1;

    const leftX = this.padX;
    const midX = leftX + sideWidth + colGap;
    const rightX = midX + midWidth + colGap;

    const blockBottom = topY + this.podiumMidHeight;

    if (entries[1]) {
      await this.drawPodiumCard(
        this.tier(2, entries[1]),
        leftX,
        blockBottom - this.podiumSideHeight,
        sideWidth,
        this.podiumSideHeight,
        false,
      );
    }
    if (entries[0]) {
      await this.drawPodiumCard(this.tier(1, entries[0]), midX, topY, midWidth, this.podiumMidHeight, true);
    }
    if (entries[2]) {
      await this.drawPodiumCard(
        this.tier(3, entries[2]),
        rightX,
        blockBottom - this.podiumSideHeight,
        sideWidth,
        this.podiumSideHeight,
        false,
      );
    }

    return blockBottom;
  }

  /**
   * Medal Twemoji (drawImage, pobrany raz przy starcie i cache'owany) — NIE fillText
   * z emoji, node-canvas nie renderuje glifów emoji. Jeśli pobranie się nie powiodło
   * (np. brak sieci przy starcie), zapasowo rysuje koło z cyfrą miejsca.
   */
  private drawMedalImage(rank: 1 | 2 | 3, fallbackColor: string, cx: number, cy: number, size: number) {
    const image = this.medalImages[rank];
    if (image) {
      this.ctx.drawImage(image, cx - size / 2, cy - size / 2, size, size);
      return;
    }

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    this.ctx.fillStyle = fallbackColor;
    this.ctx.fill();

    this.ctx.fillStyle = this.colors.medalDigit;
    this.ctx.font = `bold ${Math.round(size * 0.52)}px ${FONT}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`${rank}`, cx, cy + 0.5);
    this.ctx.restore();
    this.ctx.textBaseline = 'alphabetic';
    this.ctx.textAlign = 'left';
  }

  private async drawPodiumCard(
    tier: PodiumTier,
    x: number,
    y: number,
    width: number,
    height: number,
    isMvp: boolean,
  ) {
    const cx = x + width / 2;
    const pad = isMvp ? 24 : 20;

    // Warstwa 1: jednolite tło karty.
    this.ctx.fillStyle = '#171a24';
    roundRect(this.ctx, x, y, width, height, 16);
    this.ctx.fill();

    // Warstwa 2: nakładka — kolor akcentu tylko u góry, gradient kończy się PEŁNĄ
    // przezroczystością (nie kolorem tła), więc nie ma twardej krawędzi/plamy.
    const overlay = this.ctx.createLinearGradient(0, y, 0, y + height);
    for (const [stop, color] of tier.gradientStops) overlay.addColorStop(stop, color);
    this.ctx.fillStyle = overlay;
    roundRect(this.ctx, x, y, width, height, 16);
    this.ctx.fill();

    this.ctx.strokeStyle = tier.accentSoft;
    this.ctx.lineWidth = 1;
    roundRect(this.ctx, x, y, width, height, 16);
    this.ctx.stroke();

    // Cała reszta karty rysowana na textBaseline='top' — każdy element ma z góry
    // znaną wysokość (rozmiar fontu), więc odstępy z makiety mapują się 1:1 na
    // sumowanie cursorY, bez żadnych "domyślanych" poprawek pod baseline alfabetyczny.
    this.ctx.textBaseline = 'top';
    this.ctx.textAlign = 'center';

    let cursorY = y + pad;

    if (isMvp) {
      this.ctx.fillStyle = this.colors.gold;
      this.ctx.font = `bold 11px ${FONT}`;
      this.ctx.fillText('MVP MIESIĄCA', cx, cursorY);
      cursorY += 11 + 3;
      this.ctx.fillStyle = this.colors.goldFaint;
      this.ctx.font = `11px ${FONT}`;
      this.ctx.fillText('Najwyższy wynik aktywności', cx, cursorY);
      cursorY += 11 + 3;
    }

    const avatarSize = isMvp ? 64 : 52;
    await this.drawCircleImage(
      tier.entry.avatarURL,
      cx - avatarSize / 2,
      cursorY,
      avatarSize,
      tier.entry.username.charAt(0).toUpperCase(),
      { fallbackColor: tier.accent },
    );
    cursorY += avatarSize + 10;

    // Wiersz: medal Twemoji + 8px + wynik + 4px + "pkt", wyśrodkowane wspólną linią środkową.
    const medalDiameter = isMvp ? 26 : 20;
    const scoreFont = isMvp ? 30 : 22;
    const pktFont = isMvp ? 13 : 12;
    const gap1 = 8;
    const gap2 = 4;

    this.ctx.font = `bold ${scoreFont}px ${FONT}`;
    const scoreText = pl(tier.entry.score);
    const scoreWidth = this.ctx.measureText(scoreText).width;
    this.ctx.font = `bold ${pktFont}px ${FONT}`;
    const pktWidth = this.ctx.measureText('pkt').width;

    const rowWidth = medalDiameter + gap1 + scoreWidth + gap2 + pktWidth;
    const rowHeight = Math.max(medalDiameter, scoreFont);
    const rowCenterY = cursorY + rowHeight / 2;
    let rowX = cx - rowWidth / 2;

    this.drawMedalImage(tier.rank, tier.medalColor, rowX + medalDiameter / 2, rowCenterY, medalDiameter);
    rowX += medalDiameter + gap1;

    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = tier.scoreColor;
    this.ctx.font = `bold ${scoreFont}px ${FONT}`;
    this.ctx.fillText(scoreText, rowX, rowCenterY);
    rowX += scoreWidth + gap2;

    this.ctx.fillStyle = isMvp ? this.colors.goldDim : this.colors.silverMuted;
    this.ctx.font = `bold ${pktFont}px ${FONT}`;
    this.ctx.fillText('pkt', rowX, rowCenterY);

    this.ctx.textBaseline = 'top';
    this.ctx.textAlign = 'center';
    cursorY += rowHeight + 8;

    const nickFont = isMvp ? 18 : 15;
    this.ctx.fillStyle = this.colors.textPrimary;
    this.ctx.font = `bold ${nickFont}px ${FONT}`;
    this.ctx.fillText(this.truncate(tier.entry.username, width - 20), cx, cursorY);
    cursorY += nickFont + 8;

    const lines = [`${pl(tier.entry.messageCount)} wiadomości`, `${formatHM(tier.entry.voiceMinutes)} na VC`];
    if (isMvp) {
      const share =
        this.options.totalVoiceMinutes > 0
          ? Math.round((tier.entry.voiceMinutes / this.options.totalVoiceMinutes) * 100)
          : 0;
      lines.push(`${share}% ruchu serwera`);
    }

    const lineFont = 12;
    const lineGap = 3;
    lines.forEach((line, i) => {
      const isShareLine = isMvp && i === lines.length - 1;
      this.ctx.fillStyle = isShareLine ? this.colors.gold : isMvp ? '#cbd5e1' : '#9aa7bd';
      this.ctx.font = isShareLine ? `bold ${lineFont}px ${FONT}` : `${lineFont}px ${FONT}`;
      this.ctx.fillText(line, cx, cursorY + i * (lineFont + lineGap));
    });

    this.ctx.textBaseline = 'alphabetic';
    this.ctx.textAlign = 'left';
  }

  private async drawTable(topY: number): Promise<number> {
    const x = this.padX;
    const width = this.width - this.padX * 2;
    const pad = this.tableInnerPad;
    const cols = { rank: 34, msg: 104, voice: 104, score: 96 };
    const gap = 12;
    const nameWidth = width - pad * 2 - cols.rank - cols.msg - cols.voice - cols.score - gap * 4;

    const rankX = x + pad;
    const nameX = rankX + cols.rank + gap;
    const msgRight = nameX + nameWidth + gap + cols.msg;
    const voiceRight = msgRight + gap + cols.voice;
    const scoreRight = voiceRight + gap + cols.score;

    // Nagłówek → 8px → linia → 6px → pierwszy wiersz. Nic więcej w tym miejscu.
    this.ctx.fillStyle = this.colors.textDim;
    this.ctx.font = `bold 10px ${FONT}`;
    this.ctx.textBaseline = 'top';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('#', rankX, topY);
    this.ctx.fillText('OSOBA', nameX, topY);
    this.ctx.textAlign = 'right';
    this.ctx.fillText('WIADOMOŚCI', msgRight, topY);
    this.ctx.fillText('VOICE CHAT', voiceRight, topY);
    this.ctx.fillText('WYNIK', scoreRight, topY);
    this.ctx.textBaseline = 'alphabetic';

    const lineY = topY + 10 + 8;
    this.ctx.strokeStyle = this.colors.border;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x, lineY);
    this.ctx.lineTo(x + width, lineY);
    this.ctx.stroke();

    let rowY = lineY + 1 + 6;
    const rest = this.options.entries.slice(3);

    // ROW_H stała 46px — tekst wyśrodkowany względem niej (textBaseline='middle'),
    // bez liczenia z line-height i bez dodatkowego paddingu do wysokości wiersza.
    const ROW_H = this.tableRowHeight;
    this.ctx.textBaseline = 'middle';

    for (let i = 0; i < rest.length; i++) {
      const entry = rest[i];
      const rank = i + 4;

      this.ctx.fillStyle = this.colors.rowBg;
      roundRect(this.ctx, x, rowY, width, ROW_H, 10);
      this.ctx.fill();

      const midY = rowY + 23;

      this.ctx.fillStyle = this.colors.textMuted;
      this.ctx.font = `bold 13px ${FONT}`;
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`${rank}`, rankX, midY);

      const avatarSize = 24;
      await this.drawCircleImage(
        entry.avatarURL,
        nameX,
        midY - avatarSize / 2,
        avatarSize,
        entry.username.charAt(0).toUpperCase(),
      );

      this.ctx.fillStyle = this.colors.tableName;
      this.ctx.font = `bold 14px ${FONT}`;
      this.ctx.fillText(this.truncate(entry.username, nameWidth - avatarSize - 10), nameX + avatarSize + 10, midY);

      this.ctx.fillStyle = this.colors.tableValue;
      this.ctx.font = `600 13px ${FONT}`;
      this.ctx.textAlign = 'right';
      this.ctx.fillText(pl(entry.messageCount), msgRight, midY);
      this.ctx.fillText(formatHM(entry.voiceMinutes), voiceRight, midY);

      // "Wynik" + "pkt" — oba prawo-wyrównane razem do tej samej krawędzi kolumny.
      this.ctx.font = `11px ${FONT}`;
      this.ctx.fillStyle = this.colors.textDim;
      const pktWidth = this.ctx.measureText('pkt').width;
      this.ctx.fillText('pkt', scoreRight, midY);

      this.ctx.font = `bold 15px ${FONT}`;
      this.ctx.fillStyle = this.colors.textPrimary;
      const scoreText = pl(entry.score);
      this.ctx.fillText(scoreText, scoreRight - pktWidth - 4, midY);

      rowY += ROW_H + this.tableRowGap;
    }

    this.ctx.textBaseline = 'alphabetic';
    this.ctx.textAlign = 'left';
    return rowY - this.tableRowGap;
  }

  private drawFooter(y: number) {
    const x = this.padX;
    const width = this.width - this.padX * 2;

    this.ctx.strokeStyle = this.colors.border;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x + width, y);
    this.ctx.stroke();

    const msgRate = this.options.msgRate ?? 1;
    const voiceRate = this.options.voiceRate ?? 2;
    const msgRateLabel = msgRate === 1 ? '1 wiadomość' : `${msgRate} wiadomości`;

    const textY = y + 22;
    this.ctx.fillStyle = this.colors.textDim;
    this.ctx.font = `11px ${FONT}`;
    this.ctx.textAlign = 'left';
    this.ctx.fillText(
      `Wynik = aktywność na czacie (1 pkt / ${msgRateLabel}) + aktywność głosowa (1 pkt / ${voiceRate} min)`,
      x,
      textY,
    );

    this.ctx.textAlign = 'right';
    this.ctx.fillText(
      `Raport miesięczny · ${this.options.monthName.toLowerCase()} ${this.options.year}`,
      x + width,
      textY,
    );
    this.ctx.textAlign = 'left';
  }

  private async drawCircleImage(
    url: string | null,
    x: number,
    y: number,
    size: number,
    fallbackInitial: string,
    opts?: { fallbackColor?: string; borderColor?: string; borderWidth?: number },
  ) {
    try {
      if (!url) throw new Error('no url');
      const imagePromise = loadImage(url);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000));
      const image = (await Promise.race([imagePromise, timeoutPromise])) as Image;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      this.ctx.closePath();
      this.ctx.clip();
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(image, x, y, size, size);
      this.ctx.restore();
    } catch (error) {
      logger.warn(`[TOPKA-V3-CANVAS] Nie udało się wczytać obrazu: ${error}`);
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      this.ctx.closePath();
      this.ctx.fillStyle = opts?.fallbackColor ?? '#3b4256';
      this.ctx.fill();
      this.ctx.fillStyle = this.colors.textPrimary;
      this.ctx.font = `bold ${Math.floor(size * 0.4)}px ${FONT}`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(fallbackInitial, x + size / 2, y + size / 2);
      this.ctx.restore();
      this.ctx.textBaseline = 'alphabetic';
      this.ctx.textAlign = 'left';
    }

    if (opts?.borderColor) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(x + size / 2, y + size / 2, size / 2 - (opts.borderWidth ?? 1) / 2, 0, Math.PI * 2);
      this.ctx.strokeStyle = opts.borderColor;
      this.ctx.lineWidth = opts.borderWidth ?? 1;
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  private truncate(text: string, maxWidth: number): string {
    let display = text;
    let w = this.ctx.measureText(display).width;
    if (w <= maxWidth) return display;
    while (w > maxWidth && display.length > 1) {
      display = display.slice(0, -1);
      w = this.ctx.measureText(display + '…').width;
    }
    return `${display}…`;
  }
}
