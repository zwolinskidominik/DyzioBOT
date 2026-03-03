import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ComponentType,
  Message,
  TextChannel,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';

/* ── Types & constants ────────────────────────────────────── */

type Choice = 'rock' | 'paper' | 'scissors';
type Outcome = 'win' | 'lose' | 'draw';

const CHOICES: Record<Choice, { emoji: string; label: string; beats: Choice }> = {
  rock: { emoji: '🪨', label: 'Kamień', beats: 'scissors' },
  paper: { emoji: '📄', label: 'Papier', beats: 'rock' },
  scissors: { emoji: '✂️', label: 'Nożyce', beats: 'paper' },
};

const OUTCOME_MESSAGES: Record<Outcome, { title: string; color: string }> = {
  win: { title: '🎉 Wygrałeś!', color: '#57F287' },
  lose: { title: '💀 Przegrałeś!', color: '#ED4245' },
  draw: { title: '🤝 Remis!', color: '#FEE75C' },
};

const COLLECTOR_TIMEOUT = 30_000;
const REPLAY_TIMEOUT = 180_000;

/* ── Command definition ───────────────────────────────────── */

export const data = new SlashCommandBuilder()
  .setName('kamien-papier-nozyce')
  .setDescription('Zagraj w Kamień Papier Nożyce z botem! ✊📄✂️');

export const options = {
  cooldown: 3,
};

/* ── Helpers ──────────────────────────────────────────────── */

export function pickBotChoice(): Choice {
  const keys = Object.keys(CHOICES) as Choice[];
  return keys[Math.floor(Math.random() * keys.length)];
}

export function getOutcome(player: Choice, bot: Choice): Outcome {
  if (player === bot) return 'draw';
  return CHOICES[player].beats === bot ? 'win' : 'lose';
}

function createChoiceButtons(disabled = false): ActionRowBuilder<ButtonBuilder> {
  const buttons = (Object.entries(CHOICES) as [Choice, (typeof CHOICES)[Choice]][]).map(
    ([id, { emoji, label }]) =>
      new ButtonBuilder()
        .setCustomId(`kpn_${id}`)
        .setLabel(label)
        .setEmoji(emoji)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)
  );
  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

function createReplayButton(disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('kpn_replay')
      .setLabel('Zagraj ponownie')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled)
  );
}

/* ── Run ──────────────────────────────────────────────────── */

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const authorId = interaction.user.id;
  const authorTag = interaction.user.tag;
  const authorMention = `${interaction.user}`;

  const promptEmbed = createBaseEmbed({
    title: '✊📄✂️  Kamień Papier Nożyce',
    description: `**${authorMention}**, wybierz swój ruch!\n\nMasz **30 sekund** na decyzję.`,
    color: '#5865F2',
  });

  await interaction.reply({
    embeds: [promptEmbed],
    components: [createChoiceButtons()],
  });

  const message = await interaction.fetchReply();
  startRound(message as Message, authorId, authorTag, authorMention);
}

/* ── Round logic ──────────────────────────────────────────── */

function startRound(
  message: Message,
  authorId: string,
  authorTag: string,
  authorMention: string
): void {
  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === authorId && i.customId.startsWith('kpn_') && i.customId !== 'kpn_replay',
    componentType: ComponentType.Button,
    time: COLLECTOR_TIMEOUT,
    max: 1,
  });

  collector.on('collect', async (i: ButtonInteraction) => {
    const playerChoice = i.customId.replace('kpn_', '') as Choice;
    const botChoice = pickBotChoice();
    const outcome = getOutcome(playerChoice, botChoice);
    const { title, color } = OUTCOME_MESSAGES[outcome];

    const playerInfo = `${CHOICES[playerChoice].emoji} ${CHOICES[playerChoice].label}`;
    const botInfo = `${CHOICES[botChoice].emoji} ${CHOICES[botChoice].label}`;

    const resultEmbed = createBaseEmbed({
      title,
      description: [
        `**Twój wybór:**  ${playerInfo}`,
        `**Mój wybór:**   ${botInfo}`,
      ].join('\n'),
      color,
      footerText: `${authorTag} · Kamień Papier Nożyce`,
    });

    await i.update({
      embeds: [resultEmbed],
      components: [createChoiceButtons(true), createReplayButton()],
    });

    startReplayCollector(message, authorId, authorTag, authorMention);
  });

  collector.on('end', async (collected) => {
    if (collected.size > 0) return;

    const timeoutEmbed = createBaseEmbed({
      title: '⏰ Czas minął!',
      description: 'Nie wybrałeś swojego ruchu na czas. Spróbuj ponownie!',
      color: '#99AAB5',
    });

    try {
      await message.edit({
        embeds: [timeoutEmbed],
        components: [createChoiceButtons(true), createReplayButton()],
      });
      startReplayCollector(message, authorId, authorTag, authorMention);
    } catch {
      // message may have been deleted
    }
  });
}

/* ── Replay collector ─────────────────────────────────────── */

function startReplayCollector(
  message: Message,
  authorId: string,
  authorTag: string,
  authorMention: string
): void {
  const replayCollector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: REPLAY_TIMEOUT,
    max: 1,
    filter: (i) => i.customId === 'kpn_replay',
  });

  replayCollector.on('collect', async (i: ButtonInteraction) => {
    if (i.user.id !== authorId) {
      await i.reply({
        content: '❌ To nie Twoja gra! Użyj `/kamien-papier-nozyce` żeby zagrać.',
        ephemeral: true,
      });
      startReplayCollector(message, authorId, authorTag, authorMention);
      return;
    }

    // Remove replay button from old message (keep result intact)
    try {
      await i.update({
        components: [createChoiceButtons(true)],
      });
    } catch {
      // ignore
    }

    // Send a brand new game message
    const promptEmbed = createBaseEmbed({
      title: '✊📄✂️  Kamień Papier Nożyce',
      description: `**${authorMention}**, wybierz swój ruch!\n\nMasz **30 sekund** na decyzję.`,
      color: '#5865F2',
    });

    const newMessage = await (message.channel as TextChannel).send({
      embeds: [promptEmbed],
      components: [createChoiceButtons()],
    });

    startRound(newMessage, authorId, authorTag, authorMention);
  });

  replayCollector.on('end', async (collected) => {
    if (collected.size > 0) return;

    // Time expired — remove replay button, keep result
    try {
      await message.edit({ components: [createChoiceButtons(true)] });
    } catch {
      // message may have been deleted
    }
  });
}
