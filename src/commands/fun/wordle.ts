import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  MessageFlags,
} from 'discord.js';
import { createCanvas } from 'canvas';
import type { ICommandOptions } from '../../interfaces/Command';
import { WordleWordModel } from '../../models/WordleWord';
import { WordleStatModel } from '../../models/WordleStat';
import logger from '../../utils/logger';

/* ── Constants ─────────────────────────────────────────────── */

const MAX_ATTEMPTS  = 6;
const GAME_TIMEOUT  = 300_000;
const MODAL_TIMEOUT = 120_000;

/* ── Canvas palette & layout ────────────────────────────────── */

const TILE   = 160;
const TGAP   = 16;
const KEY_W  = 96;
const KEY_H  = 100;
const KGAP   = 12;
const PAD    = 70;
const HDR_H  = 175;
const SGAP   = 52;
const R      = 10;

const C_BG      = '#121213';
const C_BORDER  = '#3A3A3C';
const C_ABSENT  = '#3A3A3C';
const C_PRESENT = '#B59F3B';
const C_CORRECT = '#538D4E';
const C_KEY_DEF = '#818384';
const C_WHITE   = '#FFFFFF';
const C_MUTED   = '#818384';

/* ── Polish keyboard ────────────────────────────────────────── */

const KB: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ['Ą', 'Ć', 'Ę', 'Ł', 'Ń', 'Ó', 'Ś', 'Ź', 'Ż'],
];

/* ── Types ──────────────────────────────────────────────────── */

type LetterResult = 'correct' | 'present' | 'absent';
type LetterState  = LetterResult | 'unused';

interface LetterGuess { letter: string; result: LetterResult; }
interface GuessRow    { letters: LetterGuess[]; }

/* ── Active game guard ──────────────────────────────────────── */

const activeUsers = new Set<string>();

/* ── Stats helper ───────────────────────────────────────────── */

async function saveResult(
  userId: string,
  guildId: string,
  won: boolean,
  attempts: number,
): Promise<void> {
  try {
    const gameEntry = { date: new Date(), won, attempts };
    const stat = await WordleStatModel.findOne({ userId, guildId });
    if (stat) {
      if (won) {
        stat.wins++;
        stat.totalGuesses += attempts;
        stat.streak++;
        if (stat.streak > stat.bestStreak) stat.bestStreak = stat.streak;
      } else {
        stat.losses++;
        stat.streak = 0;
      }
      stat.games.push(gameEntry);
      await stat.save();
    } else {
      await WordleStatModel.create({
        userId,
        guildId,
        wins:         won ? 1 : 0,
        losses:       won ? 0 : 1,
        totalGuesses: won ? attempts : 0,
        streak:       won ? 1 : 0,
        bestStreak:   won ? 1 : 0,
        games:        [gameEntry],
      });
    }
  } catch (e) {
    logger.error(`Wordle saveResult error: ${e}`);
  }
}

/* ── Command ────────────────────────────────────────────────── */

export const data = new SlashCommandBuilder()
  .setName('wordle')
  .setDescription('Zagraj w Wordle! Odgadnij ukryte polskie słowo.')
  .addIntegerOption((o) =>
    o.setName('litery')
      .setDescription('Liczba liter w słowie (domyślnie 5, zakres 5–7)')
      .setMinValue(5).setMaxValue(7).setRequired(false),
  );

export const options = { cooldown: 5 };

/* ── Polish dictionary check (sjp.pl) ──────────────────────── */

const dictCache = new Map<string, boolean>();

async function isPolishWord(word: string): Promise<boolean> {
  if (dictCache.has(word)) return dictCache.get(word)!;
  try {
    const res = await fetch(`https://sjp.pl/${encodeURIComponent(word)}`, {
      signal: AbortSignal.timeout(4_000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) { dictCache.set(word, false); return false; }
    const html = await res.text();
    // sjp.pl shows this phrase when word is not in the dictionary
    const valid = !html.includes('nie występuje w słowniku');
    dictCache.set(word, valid);
    return valid;
  } catch {
    // If API is unreachable, fail open — don't punish the player
    return true;
  }
}

/* ── Word helpers ───────────────────────────────────────────── */

async function pickRandomWord(length: number): Promise<string | null> {
  const count = await WordleWordModel.countDocuments({ length });
  if (!count) return null;
  const doc = await WordleWordModel.findOne({ length })
    .skip(Math.floor(Math.random() * count)).lean();
  return doc ? doc.word : null;
}

function evaluate(guess: string, word: string): GuessRow {
  const letters: LetterGuess[] = [...guess].map((l) => ({ letter: l, result: 'absent' as LetterResult }));
  const wordChars = [...word];
  const used = new Array(word.length).fill(false);
  for (let i = 0; i < letters.length; i++) {
    if (letters[i].letter === wordChars[i]) { letters[i].result = 'correct'; used[i] = true; }
  }
  for (let i = 0; i < letters.length; i++) {
    if (letters[i].result === 'correct') continue;
    for (let j = 0; j < wordChars.length; j++) {
      if (!used[j] && letters[i].letter === wordChars[j]) {
        letters[i].result = 'present'; used[j] = true; break;
      }
    }
  }
  return { letters };
}

/* ── Canvas helpers ─────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx2D = any;

function rrect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r); ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

function tileColor(r: LetterResult): string {
  return r === 'correct' ? C_CORRECT : r === 'present' ? C_PRESENT : C_ABSENT;
}
function keyBg(s: LetterState): string {
  return s === 'correct' ? C_CORRECT : s === 'present' ? C_PRESENT : s === 'absent' ? C_ABSENT : C_KEY_DEF;
}

function letterStatesFromGuesses(guesses: GuessRow[]): Map<string, LetterState> {
  const m = new Map<string, LetterState>();
  const p: Record<LetterState, number> = { correct: 3, present: 2, absent: 1, unused: 0 };
  for (const row of guesses)
    for (const { letter, result } of row.letters) {
      const cur = m.get(letter) ?? 'unused';
      if (p[result] > p[cur]) m.set(letter, result);
    }
  return m;
}

function renderImage(
  username: string,
  guesses: GuessRow[],
  length: number,
  state: 'playing' | 'won' | 'lost',
  word?: string,
): Buffer {
  const maxKeyRow = Math.max(...KB.map((r) => r.length));
  const keyRowW   = maxKeyRow * KEY_W + (maxKeyRow - 1) * KGAP;
  const gridW     = length * TILE + (length - 1) * TGAP;
  const IMG_W     = Math.max(gridW, keyRowW) + PAD * 2;
  const gridH     = MAX_ATTEMPTS * TILE + (MAX_ATTEMPTS - 1) * TGAP;
  const keysH     = KB.length * (KEY_H + KGAP) - KGAP;
  const IMG_H     = HDR_H + gridH + SGAP + keysH + PAD;

  const canvas = createCanvas(IMG_W, IMG_H);
  const ctx    = canvas.getContext('2d');

  /* Background */
  ctx.fillStyle = C_BG;
  ctx.fillRect(0, 0, IMG_W, IMG_H);

  /* Header */
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C_WHITE; ctx.font = 'bold 42px sans-serif';
  ctx.fillText(`Game played by ${username}`, IMG_W / 2, 64);
  const sub =
    state === 'won'  ? `Wygrałeś w ${guesses.length}/${MAX_ATTEMPTS} prób · ${length} liter` :
    state === 'lost' ? `Koniec gry · ${length} liter` :
                       `Próba ${guesses.length + 1}/${MAX_ATTEMPTS} · ${length} liter`;
  ctx.fillStyle = C_MUTED; ctx.font = '30px sans-serif';
  ctx.fillText(sub, IMG_W / 2, 112);
  ctx.strokeStyle = C_BORDER; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(PAD, HDR_H - 20); ctx.lineTo(IMG_W - PAD, HDR_H - 20); ctx.stroke();

  /* Grid */
  const gx0 = (IMG_W - gridW) / 2;
  for (let row = 0; row < MAX_ATTEMPTS; row++) {
    const gy  = HDR_H + row * (TILE + TGAP);
    const g   = guesses[row];
    for (let col = 0; col < length; col++) {
      const tx = gx0 + col * (TILE + TGAP);
      rrect(ctx, tx, gy, TILE, TILE, R);
      if (g) {
        ctx.fillStyle = tileColor(g.letters[col].result); ctx.fill();
        ctx.fillStyle = C_WHITE;
        ctx.font = `bold ${Math.round(TILE * 0.44)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(g.letters[col].letter.toUpperCase(), tx + TILE / 2, gy + TILE / 2);
      } else {
        ctx.strokeStyle = C_BORDER; ctx.lineWidth = 2; ctx.stroke();
      }
    }
  }

  /* Answer overlay — floats centered over grid on loss */
  if (state === 'lost' && word) {
    const OTILE  = Math.round(TILE * 1.18);  // tiles slightly bigger than grid tiles
    const OGAP   = TGAP;
    const overW  = length * OTILE + (length - 1) * OGAP;
    const overH  = OTILE;
    const overX  = (IMG_W - overW) / 2;
    const overY  = HDR_H + (gridH - overH) / 2; // vertically centred on the grid

    // dim the grid behind
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, HDR_H, IMG_W, gridH);

    // drop-shadow behind each tile
    ctx.shadowColor   = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur    = 28;
    ctx.shadowOffsetY = 8;

    const C_ANSWER = '#ED4245';
    for (let col = 0; col < length; col++) {
      const tx = overX + col * (OTILE + OGAP);
      rrect(ctx, tx, overY, OTILE, OTILE, R + 2);
      ctx.fillStyle = C_ANSWER; ctx.fill();
    }

    // reset shadow before drawing letters
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    for (let col = 0; col < length; col++) {
      const tx = overX + col * (OTILE + OGAP);
      ctx.fillStyle    = C_WHITE;
      ctx.font         = `bold ${Math.round(OTILE * 0.48)}px sans-serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(word[col].toUpperCase(), tx + OTILE / 2, overY + OTILE / 2);
    }
  }

  /* Keyboard */
  const ls   = letterStatesFromGuesses(guesses);
  const ky0  = HDR_H + gridH + SGAP;
  for (let ri = 0; ri < KB.length; ri++) {
    const keys = KB[ri];
    const rw   = keys.length * KEY_W + (keys.length - 1) * KGAP;
    let   kx   = (IMG_W - rw) / 2;
    const ky   = ky0 + ri * (KEY_H + KGAP);
    for (const k of keys) {
      const st = ls.get(k.toLowerCase()) ?? 'unused';
      rrect(ctx, kx, ky, KEY_W, KEY_H, R);
      ctx.fillStyle = keyBg(st); ctx.fill();
      ctx.fillStyle = C_WHITE;
      ctx.font = `bold ${Math.round(KEY_H * 0.38)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(k, kx + KEY_W / 2, ky + KEY_H / 2);
      kx += KEY_W + KGAP;
    }
  }

  return canvas.toBuffer('image/png');
}

function makeAttachment(
  username: string,
  guesses: GuessRow[],
  length: number,
  state: 'playing' | 'won' | 'lost',
  word?: string,
): AttachmentBuilder {
  return new AttachmentBuilder(renderImage(username, guesses, length, state, word), { name: 'wordle.png' });
}



/* ── Discord UI ─────────────────────────────────────────────── */

function makeButtons(userId: string, disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`wordle_guess_${userId}`).setLabel('Zgadnij słowo').setEmoji('💬')
      .setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`wordle_quit_${userId}`).setLabel('Poddaj się').setEmoji('🏳️')
      .setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
}

function makeModal(userId: string, length: number) {
  return new ModalBuilder()
    .setCustomId(`wordle_modal_${userId}`)
    .setTitle(`Wordle — wpisz ${length}-literowe słowo`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('wordle_input')
          .setLabel(`Słowo (dokładnie ${length} polskich liter)`)
          .setStyle(TextInputStyle.Short)
          .setMinLength(length).setMaxLength(length).setRequired(true)
          .setPlaceholder('np. katar'),
      ),
    );
}

/* ── Main run ───────────────────────────────────────────────── */

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const userId   = interaction.user.id;
  const username = interaction.user.username;
  const guildId  = interaction.guildId ?? 'dm';
  const length   = interaction.options.getInteger('litery') ?? 5;

  if (activeUsers.has(userId)) {
    await interaction.reply({
      content: '❌ Masz już aktywną grę Wordle! Zakończ ją przed rozpoczęciem nowej.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const word = await pickRandomWord(length);
  if (!word) {
    await interaction.reply({
      content: `❌ Brak ${length}-literowych słów w bazie. Dodaj słowa przez **Dashboard → Wordle**.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  activeUsers.add(userId);
  const guesses: GuessRow[] = [];
  const submittedGuesses = new Set<string>();
  const processedSubmits = new Set<string>();
  const row = makeButtons(userId);

  const { resource: replyResource } = await interaction.reply({
    files: [makeAttachment(username, guesses, length, 'playing')],
    components: [row],
    withResponse: true,
  });

  const collector = replyResource!.message!.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: GAME_TIMEOUT,
    filter: (i) => i.user.id === userId,
  });

  /* end helper — collector already declared above */
  const endGame = async (state: 'won' | 'lost') => {
    activeUsers.delete(userId);
    collector.stop('done');
    await saveResult(userId, guildId, state === 'won', guesses.length);
    try {
      await interaction.editReply({
        files: [makeAttachment(username, guesses, length, state, word)],
        components: [makeButtons(userId, true)],
      });
    } catch (e) { logger.error(`Wordle editReply error: ${e}`); }
  };

  collector.on('collect', async (btn: ButtonInteraction) => {
    if (btn.customId === `wordle_quit_${userId}`) {
      // Acknowledge button immediately (Discord requires response within 3s)
      await btn.update({
        files: [makeAttachment(username, guesses, length, 'lost', word)],
        components: [makeButtons(userId, true)],
      });
      activeUsers.delete(userId);
      collector.stop('done');
      await saveResult(userId, guildId, false, guesses.length);
      return;
    }
    if (btn.customId !== `wordle_guess_${userId}`) return;

    await btn.showModal(makeModal(userId, length));

    let modalInter;
    try {
      modalInter = await btn.awaitModalSubmit({
        time: MODAL_TIMEOUT,
        filter: (i) => i.user.id === userId && i.customId === `wordle_modal_${userId}`,
      });
    } catch {
      return;
    }

    // Każdy modal-submit ma unikalne id. Jeśli kilka równoległych `awaitModalSubmit`
    // rozwiąże się tym samym submitem (po wielokrotnym kliknięciu "Zgadnij słowo"),
    // tylko PIERWSZY ma prawo go przetworzyć — pozostałe cicho odrzucamy.
    if (processedSubmits.has(modalInter.id)) {
      return;
    }
    processedSubmits.add(modalInter.id);

    const rawInput = modalInter.fields.getTextInputValue('wordle_input').trim().toLowerCase();

    if (!/^[a-ząćęłńóśźż]+$/.test(rawInput)) {
      await modalInter.reply({ content: '❌ Używaj tylko polskich liter (bez q, v, x)!', flags: MessageFlags.Ephemeral });
      return;
    }
    if (rawInput.length !== length) {
      await modalInter.reply({ content: `❌ Słowo musi mieć dokładnie ${length} liter!`, flags: MessageFlags.Ephemeral });
      return;
    }

    // Zapobiegaj zgłaszaniu tego samego słowa kilka razy (marnuje próbę).
    // To także obsługuje przypadek, gdy dwa równoległe `awaitModalSubmit` rozwiążą się
    // tym samym submitem — pierwszy doda słowo, drugi wykryje duplikat.
    if (submittedGuesses.has(rawInput)) {
      await modalInter.reply({ content: `❌ To słowo już zgadywałeś w tej grze!`, flags: MessageFlags.Ephemeral });
      return;
    }

    const valid = await isPolishWord(rawInput);
    if (!valid) {
      await modalInter.reply({ content: `❌ Słowo **${rawInput.toUpperCase()}** nie istnieje w słowniku języka polskiego!`, flags: MessageFlags.Ephemeral });
      return;
    }

    submittedGuesses.add(rawInput);
    const guessRow = evaluate(rawInput, word);
    guesses.push(guessRow);
    const won = guessRow.letters.every((l) => l.result === 'correct');

    if (modalInter.isFromMessage()) {
      await modalInter.deferUpdate();
    } else {
      try { await modalInter.deferReply({ flags: MessageFlags.Ephemeral }); await modalInter.deleteReply(); } catch { /* ignore */ }
    }

    if (won) {
      await endGame('won');
    } else if (guesses.length >= MAX_ATTEMPTS) {
      await endGame('lost');
    } else {
      await interaction.editReply({
        files: [makeAttachment(username, guesses, length, 'playing')],
        components: [row],
      });
    }
  });

  collector.on('end', async (_, reason) => {
    activeUsers.delete(userId);
    if (reason !== 'done') {
      try {
        await interaction.editReply({
          files: [makeAttachment(username, guesses, length, 'lost', word)],
          components: [makeButtons(userId, true)],
        });
      } catch (e) { logger.error(`Wordle timeout: ${e}`); }
    }
  });
}
