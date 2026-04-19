import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { createCanvas } from 'canvas';
import type { ICommandOptions } from '../../interfaces/Command';

// ─── Canvas types ─────────────────────────────────────────────────────────────
type Ctx2D = any;

// ─── Odpowiedzi Magic 8-Ball (20 oryginalnych) ───────────────────────────────

const POSITIVE = [
  'Zdecydowanie tak',
  'Bez wątpienia',
  'Na pewno tak',
  'Możesz na to liczyć',
  'Tak — zdecydowanie',
  'Jak dla mnie — tak',
  'Moim zdaniem — tak',
  'Najprawdopodobniej',
  'Tak',
  'Perspektywy dobre',
  'Wszystko na to wskazuje',
  'Znaki mówią — tak',
  'Bardzo możliwe',
  'Czuć, że tak',
  'Bądź dobrej myśli',
  'Tak będzie',
  'Jest nadzieja',
];

const NEUTRAL = [
  'Odpowiedź niejasna,\nspróbuj ponownie',
  'Zapytaj później',
  'Lepiej nie mówić',
  'Nie mogę powiedzieć',
  'Skoncentruj się\ni zapytaj jeszcze raz',
  'Zapytaj inaczej',
  'Nie dam głowy',
  'Jeszcze nie wiem',
  'To musi poczekać',
];

const NEGATIVE = [
  'Nawet na to nie licz',
  'Moja odpowiedź\nbrzmi — nie',
  'Moje źródła\nmówią — nie',
  'Perspektywy niezbyt dobre',
  'Bardzo wątpliwe',
  'Gwiazdy mówią nie',
  'Marne szanse',
  'Na pewno nie',
];

const ALL_ANSWERS = [...POSITIVE, ...NEUTRAL, ...NEGATIVE];

type Category = 'positive' | 'neutral' | 'negative';

function getCategory(answer: string): Category {
  if (POSITIVE.includes(answer)) return 'positive';
  if (NEUTRAL.includes(answer)) return 'neutral';
  return 'negative';
}

const CATEGORY_GLOW: Record<Category, string> = {
  positive: '#57F287',
  neutral:  '#FEE75C',
  negative: '#ED4245',
};

const CATEGORY_TRIANGLE: Record<Category, string> = {
  positive: '#1a6b3a',
  neutral:  '#8a7a10',
  negative: '#8a1a1a',
};

// ─── Layout constants ─────────────────────────────────────────────────────────

const IMG_W     = 700;
const IMG_H     = 700;
const CX        = IMG_W / 2;
const CY        = IMG_H / 2 - 20;
const BALL_R    = 230;
const WINDOW_R  = 100;
const TRIANGLE_R = 78;

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function drawBackground(ctx: Ctx2D) {
  // Dark gradient background
  const bg = ctx.createRadialGradient(CX, CY, 100, CX, CY, IMG_W);
  bg.addColorStop(0, '#1a1a2e');
  bg.addColorStop(1, '#0a0a14');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, IMG_W, IMG_H);

  // Subtle star-like dots
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  const rng = (s: number) => {
    let x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 60; i++) {
    const x = rng(i * 7.3) * IMG_W;
    const y = rng(i * 13.7) * IMG_H;
    const r = rng(i * 3.1) * 1.8 + 0.3;
    // Skip stars that would be inside the ball
    const dx = x - CX;
    const dy = y - CY;
    if (Math.sqrt(dx * dx + dy * dy) < BALL_R + 15) continue;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBall(ctx: Ctx2D, glowColor: string) {
  // Outer glow
  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 60;
  ctx.beginPath();
  ctx.arc(CX, CY, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();

  // Main ball gradient — dark sphere
  const ballGrad = ctx.createRadialGradient(CX - 70, CY - 80, 30, CX, CY, BALL_R);
  ballGrad.addColorStop(0, '#3a3a4a');
  ballGrad.addColorStop(0.4, '#1a1a24');
  ballGrad.addColorStop(1, '#050508');
  ctx.beginPath();
  ctx.arc(CX, CY, BALL_R, 0, Math.PI * 2);
  ctx.fillStyle = ballGrad;
  ctx.fill();

  // Rim edge
  ctx.beginPath();
  ctx.arc(CX, CY, BALL_R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Specular highlight (top-left)
  const spec = ctx.createRadialGradient(CX - 100, CY - 120, 10, CX - 60, CY - 80, 160);
  spec.addColorStop(0, 'rgba(255,255,255,0.25)');
  spec.addColorStop(0.5, 'rgba(255,255,255,0.04)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(CX, CY, BALL_R - 2, 0, Math.PI * 2);
  ctx.fillStyle = spec;
  ctx.fill();
}

function drawWindow(ctx: Ctx2D, category: Category) {
  // Blue/dark window circle
  const winGrad = ctx.createRadialGradient(CX, CY, 10, CX, CY, WINDOW_R);
  winGrad.addColorStop(0, '#0d1b3e');
  winGrad.addColorStop(1, '#060e22');
  ctx.beginPath();
  ctx.arc(CX, CY, WINDOW_R, 0, Math.PI * 2);
  ctx.fillStyle = winGrad;
  ctx.fill();

  // Window ring
  ctx.beginPath();
  ctx.arc(CX, CY, WINDOW_R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(100,140,255,0.15)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Inner glow from answer category
  const innerGlow = ctx.createRadialGradient(CX, CY, 0, CX, CY, WINDOW_R);
  innerGlow.addColorStop(0, CATEGORY_GLOW[category] + '18');
  innerGlow.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(CX, CY, WINDOW_R - 2, 0, Math.PI * 2);
  ctx.fillStyle = innerGlow;
  ctx.fill();
}

function drawTriangle(ctx: Ctx2D, category: Category) {
  const triColor = CATEGORY_TRIANGLE[category];

  // Equilateral triangle
  const angle = -Math.PI / 2; // point up
  const points: [number, number][] = [];
  for (let i = 0; i < 3; i++) {
    const a = angle + (i * 2 * Math.PI) / 3;
    points.push([CX + TRIANGLE_R * Math.cos(a), CY + TRIANGLE_R * Math.sin(a)]);
  }

  // Triangle shadow
  ctx.save();
  ctx.shadowColor = CATEGORY_GLOW[category];
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  ctx.lineTo(points[1][0], points[1][1]);
  ctx.lineTo(points[2][0], points[2][1]);
  ctx.closePath();

  // Triangle fill
  const triFill = ctx.createLinearGradient(CX, CY - TRIANGLE_R, CX, CY + TRIANGLE_R);
  triFill.addColorStop(0, triColor + 'cc');
  triFill.addColorStop(1, triColor + '44');
  ctx.fillStyle = triFill;
  ctx.fill();
  ctx.restore();

  // Triangle border
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  ctx.lineTo(points[1][0], points[1][1]);
  ctx.lineTo(points[2][0], points[2][1]);
  ctx.closePath();
  ctx.strokeStyle = CATEGORY_GLOW[category] + '55';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawAnswerText(ctx: Ctx2D, answer: string, _category: Category) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = answer.split('\n');
  const fontSize = lines.some(l => l.length > 18) ? 18 : 21;
  ctx.font = `bold ${fontSize}px sans-serif`;

  const lineHeight = fontSize + 6;
  const totalH = lines.length * lineHeight;
  const startY = CY - totalH / 2 + lineHeight / 2;

  // Text shadow for contrast
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#FFFFFF';

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], CX, startY + i * lineHeight);
  }
  ctx.restore();
}

function drawBigEight(ctx: Ctx2D) {
  // Large "8" on the ball, slightly above the window
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillText('8', CX, CY - WINDOW_R - 55);
  ctx.restore();
}

function drawQuestionFooter(ctx: Ctx2D, question: string, username: string) {
  // Question text below the ball
  const maxW = IMG_W - 80;
  const footerY = CY + BALL_R + 62;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Username
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`Zapytał(a): ${username}`, CX, footerY + 30);

  // Question — truncate if too long
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  let q = question;
  while (ctx.measureText(q).width > maxW && q.length > 3) {
    q = q.slice(0, -4) + '…';
  }
  ctx.fillText(`„${q}"`, CX, footerY);
}

// ─── Command ──────────────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName('8ball')
  .setDescription('Zapytaj magiczną kulę 8-Ball o cokolwiek!')
  .addStringOption((o) =>
    o.setName('pytanie')
      .setDescription('Twoje pytanie do magicznej kuli')
      .setRequired(true)
      .setMaxLength(256),
  );

export const options = { cooldown: 3 };

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const question = interaction.options.getString('pytanie', true);
  const answer   = ALL_ANSWERS[Math.floor(Math.random() * ALL_ANSWERS.length)];
  const category = getCategory(answer);

  // ── Build canvas ────────────────────────────────────────────────────────────
  const canvas = createCanvas(IMG_W, IMG_H);
  const ctx    = canvas.getContext('2d') as Ctx2D;

  drawBackground(ctx);
  drawBall(ctx, CATEGORY_GLOW[category]);
  drawBigEight(ctx);
  drawWindow(ctx, category);
  drawTriangle(ctx, category);
  drawAnswerText(ctx, answer, category);
  drawQuestionFooter(ctx, question, interaction.user.displayName);

  // ── Send ────────────────────────────────────────────────────────────────────
  const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: '8ball.png' });
  await interaction.reply({ files: [attachment] });
}
