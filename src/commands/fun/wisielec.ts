import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ComponentType,
  Message,
  TextChannel,
  AttachmentBuilder,
  ChatInputCommandInteraction,
  InteractionCollector,
} from 'discord.js';
import path from 'path';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import {
  MAX_WRONG_GUESSES,
  HangmanCategory,
} from '../../config/constants/hangmanWords';
import { HangmanCategoryModel } from '../../models/HangmanCategory';

/* ── Constants ────────────────────────────────────────────── */

const ALPHABET = 'aąbcćdeęfghijklłmnńoóprsśtuwyzźż';
const PAGE1_ROWS = [
  'aąbcć',
  'deęfg',
  'hijkl',
  'łmnńo',
  'óprs',   // + nav button ➡️
];
const PAGE2_ROWS = [
  'śtuwy',
  'zźż',    // + nav button ⬅️
];
const GUESS_TIMEOUT = 120_000; // 2 minutes per game idle
const DUEL_TIMEOUT = 180_000; // 3 minutes per duel game
const CHALLENGE_TIMEOUT = 60_000; // 1 minute to accept challenge
const ASSETS_DIR = path.resolve(__dirname, '../../../assets/hangman');

/* ── Command definition ───────────────────────────────────── */

export const data = new SlashCommandBuilder()
  .setName('wisielec')
  .setDescription('Zagraj w Wisielca! Odgadnij słowo zanim ludzik zostanie powieszony 🪢')
  .addUserOption((option) =>
    option
      .setName('gracz')
      .setDescription('Wyzwij gracza na duel! ⚔️')
      .setRequired(false),
  );

export const options = {
  cooldown: 5,
};

/* ── Types ────────────────────────────────────────────────── */

interface GameState {
  word: string;
  category: HangmanCategory;
  guessedLetters: Set<string>;
  wrongGuesses: number;
  authorId: string;
  authorTag: string;
  finished: boolean;
  page: number;
}

/* ── Helpers ──────────────────────────────────────────────── */

export async function pickRandomWord(): Promise<{ word: string; category: HangmanCategory }> {
  const dbCategories = await HangmanCategoryModel.find().lean();
  if (dbCategories.length === 0) {
    throw new Error('Brak kategorii wisielca w bazie danych. Uruchom skrypt seedHangmanWords.');
  }
  const cat = dbCategories[Math.floor(Math.random() * dbCategories.length)];
  const word = cat.words[Math.floor(Math.random() * cat.words.length)];
  return { word, category: { name: cat.name, emoji: cat.emoji, words: cat.words } };
}

export function getWordDisplay(word: string, guessed: Set<string>): string {
  return [...word]
    .map((ch) => (ch === ' ' ? '   ' : guessed.has(ch) ? `**${ch.toUpperCase()}**` : '\\_'))
    .join(' ');
}

export function isWordGuessed(word: string, guessed: Set<string>): boolean {
  return [...word].every((ch) => ch === ' ' || guessed.has(ch));
}

function getStageImage(wrongGuesses: number): AttachmentBuilder {
  const stage = Math.min(wrongGuesses + 1, MAX_WRONG_GUESSES + 1);
  const filePath = path.join(ASSETS_DIR, `${stage}.png`);
  return new AttachmentBuilder(filePath, { name: 'hangman.png' });
}

function buildGameEmbed(state: GameState) {
  const wordDisplay = getWordDisplay(state.word, state.guessedLetters);
  const livesLeft = MAX_WRONG_GUESSES - state.wrongGuesses;
  const hearts = '❤️'.repeat(livesLeft) + '🖤'.repeat(state.wrongGuesses);

  const wrongLetters = [...state.guessedLetters]
    .filter((l) => !state.word.includes(l))
    .map((l) => l.toUpperCase())
    .join(', ');

  return createBaseEmbed({
    title: '🪢 Wisielec',
    description: [
      `${state.category.emoji} Kategoria: **${state.category.name}**`,
      '',
      `📝 ${wordDisplay}`,
      '',
      `${hearts}  (${livesLeft}/${MAX_WRONG_GUESSES})`,
      wrongLetters ? `\n❌ Złe litery: ${wrongLetters}` : '',
    ].join('\n'),
    color: COLORS.HANGMAN,
    footerText: `${state.authorTag} · Wisielec`,
    image: 'attachment://hangman.png',
  });
}

function buildLetterButton(letter: string, guessed: Set<string>, word: string, disabled: boolean): ButtonBuilder {
  const alreadyGuessed = guessed.has(letter);
  const isCorrect = alreadyGuessed && word.includes(letter);
  const isWrong = alreadyGuessed && !word.includes(letter);

  return new ButtonBuilder()
    .setCustomId(`hm_${letter}`)
    .setLabel(letter.toUpperCase())
    .setStyle(
      isCorrect ? ButtonStyle.Success
        : isWrong ? ButtonStyle.Danger
          : ButtonStyle.Secondary
    )
    .setDisabled(disabled || alreadyGuessed);
}

function buildKeyboardRows(guessed: Set<string>, word: string, disabled: boolean, page: number): ActionRowBuilder<ButtonBuilder>[] {
  if (page === 1) {
    return PAGE1_ROWS.map((row, idx) => {
      const buttons = [...row].map((l) => buildLetterButton(l, guessed, word, disabled));
      if (idx === PAGE1_ROWS.length - 1) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId('hm_page2')
            .setLabel('➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        );
      }
      return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
    });
  }

  return PAGE2_ROWS.map((row, idx) => {
    const buttons = [...row].map((l) => buildLetterButton(l, guessed, word, disabled));
    if (idx === PAGE2_ROWS.length - 1) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId('hm_page1')
          .setLabel('⬅️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled),
      );
    }
    return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
  });
}

function buildReplayRow(disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('hm_replay')
      .setLabel('Zagraj ponownie')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  );
}

/* ── Run ──────────────────────────────────────────────────── */

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const opponent = interaction.options.getUser('gracz');

  if (opponent) {
    await runDuel(interaction, opponent.id, opponent.tag);
    return;
  }

  await runSolo(interaction);
}

async function runSolo(interaction: ChatInputCommandInteraction): Promise<void> {
  const { word, category } = await pickRandomWord();

  const state: GameState = {
    word,
    category,
    guessedLetters: new Set(),
    wrongGuesses: 0,
    authorId: interaction.user.id,
    authorTag: interaction.user.tag,
    finished: false,
    page: 1,
  };

  const attachment = getStageImage(0);
  const embed = buildGameEmbed(state);
  const rows = buildKeyboardRows(state.guessedLetters, state.word, false, state.page);

  await interaction.reply({
    embeds: [embed],
    files: [attachment],
    components: rows,
  });

  const message = await interaction.fetchReply();
  startGameCollector(message as Message, state);
}

/* ── Game collector ───────────────────────────────────────── */

function startGameCollector(message: Message, state: GameState): void {
  const collector = message.createMessageComponentCollector({
    filter: (i) =>
      i.user.id === state.authorId &&
      i.customId.startsWith('hm_') &&
      i.customId !== 'hm_replay',
    componentType: ComponentType.Button,
    time: GUESS_TIMEOUT,
  });

  collector.on('collect', async (i: ButtonInteraction) => {
    const letter = i.customId.replace('hm_', '');

    // Handle page navigation
    if (letter === 'page1' || letter === 'page2') {
      state.page = letter === 'page1' ? 1 : 2;
      const attachment = getStageImage(state.wrongGuesses);
      const embed = buildGameEmbed(state);
      const rows = buildKeyboardRows(state.guessedLetters, state.word, false, state.page);
      await i.update({ embeds: [embed], files: [attachment], components: rows });
      return;
    }

    if (!ALPHABET.includes(letter) || state.guessedLetters.has(letter)) {
      await i.deferUpdate();
      return;
    }

    state.guessedLetters.add(letter);

    if (!state.word.includes(letter)) {
      state.wrongGuesses++;
    }

    // Check win/lose
    const won = isWordGuessed(state.word, state.guessedLetters);
    const lost = state.wrongGuesses >= MAX_WRONG_GUESSES;

    if (won || lost) {
      state.finished = true;
      collector.stop(won ? 'win' : 'lose');

      const attachment = getStageImage(state.wrongGuesses);
      const endEmbed = buildEndEmbed(state, won);

      await i.update({
        embeds: [endEmbed],
        files: [attachment],
        components: [buildReplayRow()],
      });

      startReplayCollector(message, state.authorId, state.authorTag);
      return;
    }

    // Continue game
    const attachment = getStageImage(state.wrongGuesses);
    const embed = buildGameEmbed(state);
    const rows = buildKeyboardRows(state.guessedLetters, state.word, false, state.page);

    await i.update({
      embeds: [embed],
      files: [attachment],
      components: rows,
    });
  });

  collector.on('end', async (_collected, reason) => {
    if (state.finished || reason === 'win' || reason === 'lose') return;

    // Timeout
    state.finished = true;
    const attachment = getStageImage(MAX_WRONG_GUESSES);
    const timeoutEmbed = createBaseEmbed({
      title: '⏰ Czas minął!',
      description: [
        `Nie zdążyłeś odgadnąć słowa na czas.`,
        '',
        `Szukane słowo: **${state.word.toUpperCase()}**`,
        `${state.category.emoji} Kategoria: **${state.category.name}**`,
      ].join('\n'),
      color: COLORS.HANGMAN_LOSE,
      footerText: `${state.authorTag} · Wisielec`,
      image: 'attachment://hangman.png',
    });

    try {
      await message.edit({
        embeds: [timeoutEmbed],
        files: [attachment],
        components: [buildReplayRow()],
      });
      startReplayCollector(message, state.authorId, state.authorTag);
    } catch {
      // message may have been deleted
    }
  });
}

/* ── End-game embed ───────────────────────────────────────── */

function buildEndEmbed(state: GameState, won: boolean) {
  const wordUpper = state.word.toUpperCase();

  if (won) {
    const guessCount = state.guessedLetters.size;
    return createBaseEmbed({
      title: '🎉 Brawo! Odgadłeś słowo!',
      description: [
        `Słowo: **${wordUpper}**`,
        `${state.category.emoji} Kategoria: **${state.category.name}**`,
        '',
        `📊 Litery: **${guessCount}** prób, **${state.wrongGuesses}** błędów`,
      ].join('\n'),
      color: COLORS.HANGMAN_WIN,
      footerText: `${state.authorTag} · Wisielec`,
      image: 'attachment://hangman.png',
    });
  }

  return createBaseEmbed({
    title: '💀 Przegrałeś!',
    description: [
      `Szukane słowo: **${wordUpper}**`,
      `${state.category.emoji} Kategoria: **${state.category.name}**`,
      '',
      `❌ Nie udało się odgadnąć w ${MAX_WRONG_GUESSES} próbach.`,
    ].join('\n'),
    color: COLORS.HANGMAN_LOSE,
    footerText: `${state.authorTag} · Wisielec`,
    image: 'attachment://hangman.png',
  });
}

/* ── Replay collector ─────────────────────────────────────── */

function startReplayCollector(
  message: Message,
  authorId: string,
  authorTag: string,
): void {
  const replayCollector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: GUESS_TIMEOUT,
    max: 1,
    filter: (i) => i.customId === 'hm_replay',
  });

  replayCollector.on('collect', async (i: ButtonInteraction) => {
    if (i.user.id !== authorId) {
      await i.reply({
        content: '❌ To nie Twoja gra! Użyj `/wisielec` żeby zagrać.',
        ephemeral: true,
      });
      startReplayCollector(message, authorId, authorTag);
      return;
    }

    // Disable old message
    try {
      await i.update({ components: [] });
    } catch {
      // ignore
    }

    // Start new game
    const { word, category } = await pickRandomWord();
    const state: GameState = {
      word,
      category,
      guessedLetters: new Set(),
      wrongGuesses: 0,
      authorId,
      authorTag,
      finished: false,
      page: 1,
    };

    const attachment = getStageImage(0);
    const embed = buildGameEmbed(state);
    const rows = buildKeyboardRows(state.guessedLetters, state.word, false, state.page);

    const newMessage = await (message.channel as TextChannel).send({
      embeds: [embed],
      files: [attachment],
      components: rows,
    });

    startGameCollector(newMessage, state);
  });

  replayCollector.on('end', async (collected) => {
    if (collected.size > 0) return;
    try {
      await message.edit({ components: [] });
    } catch {
      // message may have been deleted
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   ██  DUEL MODE — 1 public scoreboard + 2 ephemeral games  ██
   ══════════════════════════════════════════════════════════════ */

interface DuelPlayerState {
  playerId: string;
  playerTag: string;
  guessedLetters: Set<string>;
  wrongGuesses: number;
  finished: boolean;
  won: boolean;
  page: number;
  letterCount: number;
}

interface DuelState {
  word: string;
  category: HangmanCategory;
  playerA: DuelPlayerState;
  playerB: DuelPlayerState;
  startedAt: number;
  gameOver: boolean;
}

function createDuelPlayerState(playerId: string, playerTag: string): DuelPlayerState {
  return {
    playerId,
    playerTag,
    guessedLetters: new Set(),
    wrongGuesses: 0,
    finished: false,
    won: false,
    page: 1,
    letterCount: 0,
  };
}

/* ── Challenge flow ───────────────────────────────────────── */

async function runDuel(interaction: ChatInputCommandInteraction, opponentId: string, opponentTag: string): Promise<void> {
  if (opponentId === interaction.user.id) {
    await interaction.reply({ content: '❌ Nie możesz wyzwać samego siebie!', ephemeral: true });
    return;
  }

  const opponent = await interaction.guild?.members.fetch(opponentId).catch(() => null);
  if (!opponent || opponent.user.bot) {
    await interaction.reply({ content: '❌ Nie można wyzwać tego użytkownika!', ephemeral: true });
    return;
  }

  const challengeEmbed = createBaseEmbed({
    title: '⚔️ Duel Wisielca!',
    description: [
      `${interaction.user} wyzwał ${opponent} na pojedynek!`,
      '',
      'Obaj gracze dostaną to samo słowo do odgadnięcia.',
      'Wygra ten, kto odgadnie szybciej — lub z mniejszą liczbą błędów!',
      '',
      `⏱️ <@${opponentId}>, masz **60 sekund** na odpowiedź.`,
    ].join('\n'),
    color: '#5865F2',
    footerText: `${interaction.user.tag} · Duel Wisielca`,
  });

  const challengeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('hmd_accept')
      .setLabel('Akceptuj')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('hmd_reject')
      .setLabel('Odrzuć')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({
    embeds: [challengeEmbed],
    components: [challengeRow],
  });

  const message = await interaction.fetchReply() as Message;

  const challengeCollector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: CHALLENGE_TIMEOUT,
    max: 1,
    filter: (i) =>
      i.user.id === opponentId &&
      (i.customId === 'hmd_accept' || i.customId === 'hmd_reject'),
  });

  challengeCollector.on('collect', async (i: ButtonInteraction) => {
    if (i.customId === 'hmd_reject') {
      const rejectEmbed = createBaseEmbed({
        title: '⚔️ Duel odrzucony',
        description: `${opponent} odrzucił wyzwanie.`,
        color: COLORS.HANGMAN_LOSE,
      });
      await i.update({ embeds: [rejectEmbed], components: [] });
      return;
    }

    // Accepted — start the duel
    await startDuelGame(interaction, i, interaction.user.id, interaction.user.tag, opponentId, opponentTag);
  });

  challengeCollector.on('end', async (collected) => {
    if (collected.size > 0) return;
    const timeoutEmbed = createBaseEmbed({
      title: '⏰ Czas minął!',
      description: `${opponent} nie odpowiedział na wyzwanie.`,
      color: '#99AAB5',
    });
    try {
      await message.edit({ embeds: [timeoutEmbed], components: [] });
    } catch {
      // message may have been deleted
    }
  });
}

/* ── Start duel game ──────────────────────────────────────── */

async function startDuelGame(
  originalInteraction: ChatInputCommandInteraction,
  acceptInteraction: ButtonInteraction,
  playerAId: string,
  playerATag: string,
  playerBId: string,
  playerBTag: string,
): Promise<void> {
  const { word, category } = await pickRandomWord();

  const duel: DuelState = {
    word,
    category,
    playerA: createDuelPlayerState(playerAId, playerATag),
    playerB: createDuelPlayerState(playerBId, playerBTag),
    startedAt: Date.now(),
    gameOver: false,
  };

  // 1. Update the challenge message → public scoreboard
  const scoreboardEmbed = buildScoreboardEmbed(duel, false);
  await acceptInteraction.update({
    embeds: [scoreboardEmbed],
    components: [],
  });

  const scoreboardMessage = await originalInteraction.fetchReply() as Message;

  // 2. Send ephemeral game to player A
  const gameEmbedA = buildDuelGameEmbed(duel, duel.playerA, duel.playerB);
  const keyboardA = buildDuelKeyboardRows(duel.playerA, duel.word, false, duel.playerA.page, 'a');
  await originalInteraction.followUp({
    embeds: [gameEmbedA],
    files: [getStageImage(0)],
    components: keyboardA,
    ephemeral: true,
  });

  // 3. Send ephemeral game to player B
  const gameEmbedB = buildDuelGameEmbed(duel, duel.playerB, duel.playerA);
  const keyboardB = buildDuelKeyboardRows(duel.playerB, duel.word, false, duel.playerB.page, 'b');
  await acceptInteraction.followUp({
    embeds: [gameEmbedB],
    files: [getStageImage(0)],
    components: keyboardB,
    ephemeral: true,
  });

  // 4. Start collectors for both players
  startDuelCollectors(
    originalInteraction,
    acceptInteraction,
    scoreboardMessage,
    duel,
  );
}

/* ── Duel keyboard (with player-specific prefixes) ────────── */

function buildDuelLetterButton(letter: string, guessed: Set<string>, word: string, disabled: boolean, prefix: string): ButtonBuilder {
  const alreadyGuessed = guessed.has(letter);
  const isCorrect = alreadyGuessed && word.includes(letter);
  const isWrong = alreadyGuessed && !word.includes(letter);

  return new ButtonBuilder()
    .setCustomId(`hmd_${prefix}_${letter}`)
    .setLabel(letter.toUpperCase())
    .setStyle(
      isCorrect ? ButtonStyle.Success
        : isWrong ? ButtonStyle.Danger
          : ButtonStyle.Secondary
    )
    .setDisabled(disabled || alreadyGuessed);
}

function buildDuelKeyboardRows(player: DuelPlayerState, word: string, disabled: boolean, page: number, prefix: string): ActionRowBuilder<ButtonBuilder>[] {
  if (page === 1) {
    return PAGE1_ROWS.map((row, idx) => {
      const buttons = [...row].map((l) => buildDuelLetterButton(l, player.guessedLetters, word, disabled, prefix));
      if (idx === PAGE1_ROWS.length - 1) {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`hmd_${prefix}_page2`)
            .setLabel('➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled),
        );
      }
      return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
    });
  }

  return PAGE2_ROWS.map((row, idx) => {
    const buttons = [...row].map((l) => buildDuelLetterButton(l, player.guessedLetters, word, disabled, prefix));
    if (idx === PAGE2_ROWS.length - 1) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`hmd_${prefix}_page1`)
          .setLabel('⬅️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled),
      );
    }
    return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
  });
}

/* ── Scoreboard embed ─────────────────────────────────────── */

function buildScoreboardEmbed(duel: DuelState, finished: boolean) {
  const elapsed = Math.floor((Date.now() - duel.startedAt) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const pA = duel.playerA;
  const pB = duel.playerB;
  const livesA = MAX_WRONG_GUESSES - pA.wrongGuesses;
  const livesB = MAX_WRONG_GUESSES - pB.wrongGuesses;
  const heartsA = '❤️'.repeat(livesA) + '🖤'.repeat(pA.wrongGuesses);
  const heartsB = '❤️'.repeat(livesB) + '🖤'.repeat(pB.wrongGuesses);

  if (finished) {
    const winner = pA.won ? pA : pB.won ? pB : null;
    const loser = pA.won ? pB : pB.won ? pA : null;

    let resultText: string;
    if (winner && loser) {
      resultText = [
        `🥇 **${winner.playerTag}** (WYGRANA!)  vs  ${loser.playerTag} 🥈`,
        `${heartsA}  ·  ${heartsB}`,
        `${pA.letterCount} liter, ${pA.wrongGuesses} błędów  ·  ${pB.letterCount} liter, ${pB.wrongGuesses} błędów`,
      ].join('\n');
    } else {
      // Both lost
      resultText = [
        `💀 **${pA.playerTag}**  vs  **${pB.playerTag}** 💀`,
        `${heartsA}  ·  ${heartsB}`,
        'Żaden gracz nie odgadł słowa!',
      ].join('\n');
    }

    return createBaseEmbed({
      title: '🏆 Duel Wisielca — Koniec!',
      description: [
        resultText,
        '',
        `📝 Słowo: **${duel.word.toUpperCase()}** (${duel.category.emoji} ${duel.category.name})`,
        `⏱️ Czas: ${timeStr}`,
      ].join('\n'),
      color: winner ? COLORS.HANGMAN_WIN : COLORS.HANGMAN_LOSE,
      footerText: 'Duel Wisielca',
    });
  }

  return createBaseEmbed({
    title: '⚔️ Duel Wisielca — Trwa!',
    description: [
      `${duel.category.emoji} Kategoria: **${duel.category.name}**`,
      '',
      `👤 **${pA.playerTag}**  vs  **${pB.playerTag}** 👤`,
      `${heartsA}          ${heartsB}`,
      `  ${livesA}/${MAX_WRONG_GUESSES} żyć · ${pA.letterCount} liter          ${livesB}/${MAX_WRONG_GUESSES} żyć · ${pB.letterCount} liter`,
      '',
      `⏱️ Czas: ${timeStr}`,
    ].join('\n'),
    color: COLORS.HANGMAN,
    footerText: 'Duel Wisielca · Gry są widoczne tylko dla graczy',
  });
}

/* ── Player game embed (ephemeral) ────────────────────────── */

function buildDuelGameEmbed(duel: DuelState, me: DuelPlayerState, opponent: DuelPlayerState) {
  const wordDisplay = getWordDisplay(duel.word, me.guessedLetters);
  const livesLeft = MAX_WRONG_GUESSES - me.wrongGuesses;
  const hearts = '❤️'.repeat(livesLeft) + '🖤'.repeat(me.wrongGuesses);

  const wrongLetters = [...me.guessedLetters]
    .filter((l) => !duel.word.includes(l))
    .map((l) => l.toUpperCase())
    .join(', ');

  const opponentLives = MAX_WRONG_GUESSES - opponent.wrongGuesses;

  return createBaseEmbed({
    title: `🪢 Duel Wisielca (vs ${opponent.playerTag})`,
    description: [
      `${duel.category.emoji} Kategoria: **${duel.category.name}**`,
      '',
      `📝 ${wordDisplay}`,
      '',
      `${hearts}  (${livesLeft}/${MAX_WRONG_GUESSES})`,
      wrongLetters ? `❌ Złe litery: ${wrongLetters}` : '',
      '',
      `🆚 Przeciwnik: ${opponentLives}/${MAX_WRONG_GUESSES} żyć · ${opponent.letterCount} liter`,
    ].join('\n'),
    color: COLORS.HANGMAN,
    footerText: `${me.playerTag} · Duel Wisielca`,
    image: 'attachment://hangman.png',
  });
}

/* ── Duel collectors ──────────────────────────────────────── */

function startDuelCollectors(
  originalInteraction: ChatInputCommandInteraction,
  acceptInteraction: ButtonInteraction,
  scoreboardMessage: Message,
  duel: DuelState,
): void {
  const channel = scoreboardMessage.channel;

  // Single collector for both players on the channel
  const collector = new InteractionCollector<ButtonInteraction>(channel.client, {
    channel,
    componentType: ComponentType.Button,
    time: DUEL_TIMEOUT,
    filter: (i) => {
      if (!i.customId.startsWith('hmd_')) return false;
      const isPlayerA = i.user.id === duel.playerA.playerId && i.customId.startsWith('hmd_a_');
      const isPlayerB = i.user.id === duel.playerB.playerId && i.customId.startsWith('hmd_b_');
      return isPlayerA || isPlayerB;
    },
  });

  collector.on('collect', async (i: ButtonInteraction) => {
    const isA = i.user.id === duel.playerA.playerId;
    const me = isA ? duel.playerA : duel.playerB;
    const opponent = isA ? duel.playerB : duel.playerA;
    const prefix = isA ? 'a' : 'b';

    if (me.finished) {
      await i.deferUpdate();
      return;
    }

    const rawAction = i.customId.replace(`hmd_${prefix}_`, '');

    // Page navigation
    if (rawAction === 'page1' || rawAction === 'page2') {
      me.page = rawAction === 'page1' ? 1 : 2;
      const embed = buildDuelGameEmbed(duel, me, opponent);
      const rows = buildDuelKeyboardRows(me, duel.word, false, me.page, prefix);
      await i.update({ embeds: [embed], files: [getStageImage(me.wrongGuesses)], components: rows });
      return;
    }

    const letter = rawAction;
    if (!ALPHABET.includes(letter) || me.guessedLetters.has(letter)) {
      await i.deferUpdate();
      return;
    }

    me.guessedLetters.add(letter);
    me.letterCount++;

    if (!duel.word.includes(letter)) {
      me.wrongGuesses++;
    }

    const won = isWordGuessed(duel.word, me.guessedLetters);
    const lost = me.wrongGuesses >= MAX_WRONG_GUESSES;

    if (won) {
      me.finished = true;
      me.won = true;
    }
    if (lost) {
      me.finished = true;
    }

    // Update this player's ephemeral game
    const embed = buildDuelGameEmbed(duel, me, opponent);
    const gameDisabled = me.finished;
    const rows = buildDuelKeyboardRows(me, duel.word, gameDisabled, me.page, prefix);
    await i.update({ embeds: [embed], files: [getStageImage(me.wrongGuesses)], components: rows });

    // Update scoreboard
    const bothDone = duel.playerA.finished && duel.playerB.finished;
    if (won || bothDone) {
      duel.gameOver = true;
      collector.stop('finished');

      // If opponent hasn't finished yet, give them a loss
      if (!opponent.finished) {
        opponent.finished = true;
      }

      const scoreEmbed = buildScoreboardEmbed(duel, true);
      const rematchRow = buildDuelRematchRow();
      try {
        await scoreboardMessage.edit({ embeds: [scoreEmbed], components: [rematchRow] });
      } catch { /* ignore */ }

      // Disable opponent's keyboard
      const oppPrefix = isA ? 'b' : 'a';
      const oppRows = buildDuelKeyboardRows(opponent, duel.word, true, opponent.page, oppPrefix);
      const oppEndEmbed = buildDuelEndEmbed(duel, opponent, me);
      try {
        const oppInteraction = isA ? acceptInteraction : originalInteraction;
        await oppInteraction.editReply({ embeds: [oppEndEmbed], files: [getStageImage(opponent.wrongGuesses)], components: oppRows });
      } catch { /* ignore */ }

      startDuelRematchCollector(scoreboardMessage, duel);
      return;
    }

    if (lost && !duel.gameOver) {
      // This player lost but opponent still playing — update scoreboard
      try {
        const scoreEmbed = buildScoreboardEmbed(duel, false);
        await scoreboardMessage.edit({ embeds: [scoreEmbed] });
      } catch { /* ignore */ }
      return;
    }

    // Ongoing — update scoreboard
    try {
      const scoreEmbed = buildScoreboardEmbed(duel, false);
      await scoreboardMessage.edit({ embeds: [scoreEmbed] });
    } catch { /* ignore */ }
  });

  collector.on('end', async (_collected, reason) => {
    if (duel.gameOver || reason === 'finished') return;

    // Timeout
    duel.gameOver = true;
    if (!duel.playerA.finished) duel.playerA.finished = true;
    if (!duel.playerB.finished) duel.playerB.finished = true;

    const scoreEmbed = buildScoreboardEmbed(duel, true);
    try {
      await scoreboardMessage.edit({ embeds: [scoreEmbed], components: [] });
    } catch { /* ignore */ }

    // Disable both keyboards
    try {
      const rowsA = buildDuelKeyboardRows(duel.playerA, duel.word, true, duel.playerA.page, 'a');
      const endEmbedA = buildDuelEndEmbed(duel, duel.playerA, duel.playerB);
      await originalInteraction.editReply({ embeds: [endEmbedA], files: [getStageImage(duel.playerA.wrongGuesses)], components: rowsA });
    } catch { /* ignore */ }
    try {
      const rowsB = buildDuelKeyboardRows(duel.playerB, duel.word, true, duel.playerB.page, 'b');
      const endEmbedB = buildDuelEndEmbed(duel, duel.playerB, duel.playerA);
      await acceptInteraction.editReply({ embeds: [endEmbedB], files: [getStageImage(duel.playerB.wrongGuesses)], components: rowsB });
    } catch { /* ignore */ }
  });
}

/* ── Duel end embed (for ephemeral messages) ──────────────── */

function buildDuelEndEmbed(duel: DuelState, me: DuelPlayerState, opponent: DuelPlayerState) {
  const wordUpper = duel.word.toUpperCase();

  if (me.won) {
    return createBaseEmbed({
      title: '🏆 Wygrałeś duel!',
      description: [
        `Słowo: **${wordUpper}**`,
        `${duel.category.emoji} Kategoria: **${duel.category.name}**`,
        '',
        `📊 ${me.letterCount} liter, ${me.wrongGuesses} błędów`,
        `🆚 Przeciwnik: ${opponent.letterCount} liter, ${opponent.wrongGuesses} błędów`,
      ].join('\n'),
      color: COLORS.HANGMAN_WIN,
      footerText: `${me.playerTag} · Duel Wisielca`,
      image: 'attachment://hangman.png',
    });
  }

  if (opponent.won) {
    return createBaseEmbed({
      title: '💀 Przegrałeś duel!',
      description: [
        `Słowo: **${wordUpper}**`,
        `${duel.category.emoji} Kategoria: **${duel.category.name}**`,
        '',
        `📊 ${me.letterCount} liter, ${me.wrongGuesses} błędów`,
        `🆚 **${opponent.playerTag}** odgadł szybciej!`,
      ].join('\n'),
      color: COLORS.HANGMAN_LOSE,
      footerText: `${me.playerTag} · Duel Wisielca`,
      image: 'attachment://hangman.png',
    });
  }

  // Both lost (timeout or both ran out of lives)
  return createBaseEmbed({
    title: '⏰ Duel zakończony!',
    description: [
      `Szukane słowo: **${wordUpper}**`,
      `${duel.category.emoji} Kategoria: **${duel.category.name}**`,
      '',
      'Żaden gracz nie odgadł słowa na czas.',
    ].join('\n'),
    color: COLORS.HANGMAN_LOSE,
    footerText: `${me.playerTag} · Duel Wisielca`,
    image: 'attachment://hangman.png',
  });
}

/* ── Duel rematch ─────────────────────────────────────────── */

function buildDuelRematchRow(disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('hmd_rematch')
      .setLabel('Rewanż')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  );
}

function startDuelRematchCollector(scoreboardMessage: Message, duel: DuelState): void {
  const collector = scoreboardMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: GUESS_TIMEOUT,
    max: 1,
    filter: (i) =>
      i.customId === 'hmd_rematch' &&
      (i.user.id === duel.playerA.playerId || i.user.id === duel.playerB.playerId),
  });

  collector.on('collect', async (i: ButtonInteraction) => {
    // Disable rematch button
    try {
      await i.update({ components: [] });
    } catch { /* ignore */ }

    // Figure out who initiated the rematch → they become the "challenger"
    const isA = i.user.id === duel.playerA.playerId;
    const newOpponentId = isA ? duel.playerB.playerId : duel.playerA.playerId;
    const newOpponentTag = isA ? duel.playerB.playerTag : duel.playerA.playerTag;

    // Send a fresh challenge as a new message in the channel
    const { word, category } = await pickRandomWord();

    const newDuel: DuelState = {
      word,
      category,
      playerA: createDuelPlayerState(i.user.id, i.user.tag),
      playerB: createDuelPlayerState(newOpponentId, newOpponentTag),
      startedAt: Date.now(),
      gameOver: false,
    };

    const challengeEmbed = createBaseEmbed({
      title: '⚔️ Rewanż Wisielca!',
      description: [
        `${i.user} wyzwał <@${newOpponentId}> na rewanż!`,
        '',
        `⏱️ <@${newOpponentId}>, masz **60 sekund** na odpowiedź.`,
      ].join('\n'),
      color: '#5865F2',
      footerText: `${i.user.tag} · Duel Wisielca`,
    });

    const challengeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('hmd_accept')
        .setLabel('Akceptuj')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('hmd_reject')
        .setLabel('Odrzuć')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
    );

    const newMsg = await (scoreboardMessage.channel as TextChannel).send({
      embeds: [challengeEmbed],
      components: [challengeRow],
    });

    const challengeCollector = newMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: CHALLENGE_TIMEOUT,
      max: 1,
      filter: (ci) =>
        ci.user.id === newOpponentId &&
        (ci.customId === 'hmd_accept' || ci.customId === 'hmd_reject'),
    });

    challengeCollector.on('collect', async (ci: ButtonInteraction) => {
      if (ci.customId === 'hmd_reject') {
        const rejectEmbed = createBaseEmbed({
          title: '⚔️ Rewanż odrzucony',
          description: `<@${newOpponentId}> odrzucił rewanż.`,
          color: COLORS.HANGMAN_LOSE,
        });
        await ci.update({ embeds: [rejectEmbed], components: [] });
        return;
      }

      // Start rematch game — use message-based approach since we don't have slash interaction
      await startRematchGame(ci, newMsg, newDuel);
    });

    challengeCollector.on('end', async (collected) => {
      if (collected.size > 0) return;
      const timeoutEmbed = createBaseEmbed({
        title: '⏰ Czas minął!',
        description: `<@${newOpponentId}> nie odpowiedział na rewanż.`,
        color: '#99AAB5',
      });
      try {
        await newMsg.edit({ embeds: [timeoutEmbed], components: [] });
      } catch { /* ignore */ }
    });
  });

  collector.on('end', async (collected) => {
    if (collected.size > 0) return;
    try {
      await scoreboardMessage.edit({ components: [] });
    } catch { /* ignore */ }
  });
}

/* ── Rematch game (via channel messages, non-ephemeral) ───── */

async function startRematchGame(
  acceptInteraction: ButtonInteraction,
  challengeMessage: Message,
  duel: DuelState,
): Promise<void> {
  const channel = challengeMessage.channel as TextChannel;
  const pA = duel.playerA;
  const pB = duel.playerB;

  // Update challenge → scoreboard
  const scoreEmbed = buildScoreboardEmbed(duel, false);
  await acceptInteraction.update({ embeds: [scoreEmbed], components: [] });

  // Send two public game messages (rematch can't use ephemeral since no slash command)
  const embedA = buildDuelGameEmbed(duel, pA, pB);
  const rowsA = buildDuelKeyboardRows(pA, duel.word, false, pA.page, 'a');
  const messageA = await channel.send({
    content: `🎮 Gra: <@${pA.playerId}>`,
    embeds: [embedA],
    files: [getStageImage(0)],
    components: rowsA,
  });

  const embedB = buildDuelGameEmbed(duel, pB, pA);
  const rowsB = buildDuelKeyboardRows(pB, duel.word, false, pB.page, 'b');
  const messageB = await channel.send({
    content: `🎮 Gra: <@${pB.playerId}>`,
    embeds: [embedB],
    files: [getStageImage(0)],
    components: rowsB,
  });

  startRematchCollectors(challengeMessage, messageA, messageB, duel);
}

function startRematchCollectors(
  scoreboardMessage: Message,
  messageA: Message,
  messageB: Message,
  duel: DuelState,
): void {
  const channel = scoreboardMessage.channel;

  const collector = new InteractionCollector<ButtonInteraction>(channel.client, {
    channel,
    componentType: ComponentType.Button,
    time: DUEL_TIMEOUT,
    filter: (i) => {
      if (!i.customId.startsWith('hmd_')) return false;
      const isA = i.user.id === duel.playerA.playerId && i.customId.startsWith('hmd_a_');
      const isB = i.user.id === duel.playerB.playerId && i.customId.startsWith('hmd_b_');
      return isA || isB;
    },
  });

  collector.on('collect', async (i: ButtonInteraction) => {
    const isA = i.user.id === duel.playerA.playerId;
    const me = isA ? duel.playerA : duel.playerB;
    const opponent = isA ? duel.playerB : duel.playerA;
    const prefix = isA ? 'a' : 'b';
    const oppMessage = isA ? messageB : messageA;

    if (me.finished) {
      await i.deferUpdate();
      return;
    }

    const rawAction = i.customId.replace(`hmd_${prefix}_`, '');

    if (rawAction === 'page1' || rawAction === 'page2') {
      me.page = rawAction === 'page1' ? 1 : 2;
      const embed = buildDuelGameEmbed(duel, me, opponent);
      const rows = buildDuelKeyboardRows(me, duel.word, false, me.page, prefix);
      await i.update({ embeds: [embed], files: [getStageImage(me.wrongGuesses)], components: rows });
      return;
    }

    const letter = rawAction;
    if (!ALPHABET.includes(letter) || me.guessedLetters.has(letter)) {
      await i.deferUpdate();
      return;
    }

    me.guessedLetters.add(letter);
    me.letterCount++;
    if (!duel.word.includes(letter)) me.wrongGuesses++;

    const won = isWordGuessed(duel.word, me.guessedLetters);
    const lost = me.wrongGuesses >= MAX_WRONG_GUESSES;

    if (won) { me.finished = true; me.won = true; }
    if (lost) { me.finished = true; }

    const embed = buildDuelGameEmbed(duel, me, opponent);
    const rows = buildDuelKeyboardRows(me, duel.word, me.finished, me.page, prefix);
    await i.update({ embeds: [embed], files: [getStageImage(me.wrongGuesses)], components: rows });

    const bothDone = duel.playerA.finished && duel.playerB.finished;
    if (won || bothDone) {
      duel.gameOver = true;
      collector.stop('finished');
      if (!opponent.finished) opponent.finished = true;

      const scoreEmbed = buildScoreboardEmbed(duel, true);
      const rematchRow = buildDuelRematchRow();
      try { await scoreboardMessage.edit({ embeds: [scoreEmbed], components: [rematchRow] }); } catch { /* ignore */ }

      const oppPrefix = isA ? 'b' : 'a';
      const oppRows = buildDuelKeyboardRows(opponent, duel.word, true, opponent.page, oppPrefix);
      const oppEndEmbed = buildDuelEndEmbed(duel, opponent, me);
      try { await oppMessage.edit({ embeds: [oppEndEmbed], files: [getStageImage(opponent.wrongGuesses)], components: oppRows }); } catch { /* ignore */ }

      startDuelRematchCollector(scoreboardMessage, duel);
      return;
    }

    if (lost || !duel.gameOver) {
      try { const scoreEmbed = buildScoreboardEmbed(duel, false); await scoreboardMessage.edit({ embeds: [scoreEmbed] }); } catch { /* ignore */ }
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (duel.gameOver || reason === 'finished') return;
    duel.gameOver = true;
    if (!duel.playerA.finished) duel.playerA.finished = true;
    if (!duel.playerB.finished) duel.playerB.finished = true;

    const scoreEmbed = buildScoreboardEmbed(duel, true);
    try { await scoreboardMessage.edit({ embeds: [scoreEmbed], components: [] }); } catch { /* ignore */ }
    try {
      const rowsA = buildDuelKeyboardRows(duel.playerA, duel.word, true, duel.playerA.page, 'a');
      const endA = buildDuelEndEmbed(duel, duel.playerA, duel.playerB);
      await messageA.edit({ embeds: [endA], files: [getStageImage(duel.playerA.wrongGuesses)], components: rowsA });
    } catch { /* ignore */ }
    try {
      const rowsB = buildDuelKeyboardRows(duel.playerB, duel.word, true, duel.playerB.page, 'b');
      const endB = buildDuelEndEmbed(duel, duel.playerB, duel.playerA);
      await messageB.edit({ embeds: [endB], files: [getStageImage(duel.playerB.wrongGuesses)], components: rowsB });
    } catch { /* ignore */ }
  });
}
